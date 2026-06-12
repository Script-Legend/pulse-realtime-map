# Notes - Pulse

## Setup

Before the app could run I had to fix a few things:

- Node was too old (v17). Next.js 16 needs Node 20+, and prisma.config.ts uses process.loadEnvFile which needs Node 20.12+. I switched to Node 20.
- I added my own Neon Postgres URL and Mapbox token in .env.
- First `npx prisma db push` failed with P1001 (cannot reach database). The Neon free DB was asleep - I ran it again, it woke up, then the tables were created.

## Phase 1 - Make it Run

I found 3 real bugs. All of them break the main flow - see each other, connect, chat, video.
In each case the code did not match its own comment, so they were easy to confirm once I read the files.

### Bug 1 - dots never disappear

- File - app/api/poll/route.ts
- The heartbeat refreshed lastSeen for every row (where: {}), not only the caller.
- So no one ever went stale, and the cleanup right below it deleted nothing.
- Result - dots stay on the map forever after people leave. This is the example in the README.
- Fix - change `where: {}` to `where: { id }`.

### Bug 2 - stuck "busy" after a call

- File - app/api/signal/route.ts
- busy was set on accept and cleared on decline, but the `end` signal was not handled.
- The comment said "decline/end: free both peers" but end was missing.
- Result - after one chat both users stay busy, new requests get auto-declined.
- Fix - also clear busy on `end`.

### Bug 3 - text chat never shows

- File - lib/webrtc.ts
- Sender sends chat as `t: "msg"`, but the receiver checks for `t: "chat"`.
- Control messages use "ctrl" on both sides, so only chat was broken.
- Result - messages go out over WebRTC but get dropped on the other side.
- Fix - send `t: "chat"` so both sides match.

### Bug 4 - chat and video never connect (stuck on "Connecting...")

- File - lib/webrtc.ts
- handleSignal flushed the queued ICE candidates before setRemoteDescription. Over HTTP polling the offer and the ICE candidates arrive in one poll batch and are processed without await - so the candidates queue while setRemoteDescription is still running, but the flush already ran on an empty queue. They were never added.
- Result - no remote ICE candidates, ICE state stuck at "new", the data channel never opens.
- How I found it - on the live deploy. chrome://webrtc-internals showed offer + answer set and a srflx candidate (so STUN works), but ICE was stuck at "new".
- Fix - setRemoteDescription first, then flush the queued candidates.

### Bug 5 - chat connects sometimes, then not (intermittent on the live deploy)

- Found by deep testing on Vercel, not locally.
- The whole handshake (request/accept/offer/answer/ice) went through one fetch that did not check if it succeeded and never retried. If Neon free tier was asleep and woke slowly, the first request returned a 500 and the signal was just lost - so the peer hung on "Connecting..." forever, with no timeout.
- The busy flag was also not freed when a connection failed (only on a clean decline/end), so the next attempt got auto-declined.
- Fixes:
  - sendSignal now retries transient failures (429 / 5xx / network) a few times. Routes return 503 + Retry-After for transient DB errors instead of a flat 500.
  - Added a 15s watchdog - if still "connecting", tear down with a "try again" message instead of spinning forever.
  - Free busy on a failed connection (send end), and reset busy on rejoin.

## Phase 2 - Make it Good

I went for a "neon pulse / radar" look. The app is called Pulse, so I leaned into that.

What I changed:
- Design system in globals.css - dark base, emerald + cyan glow, glass panels, shared animations. I also fixed the font - the app loaded Geist but body was still using Arial.
- Map dots - each dot now glows in its own color and sends out a radar ring. The "Me" marker is a glowing beacon instead of a 📍 emoji.
- Entry screen - radar rings in the background, glowing Pulse wordmark, cleaner button.
- Chat panel - glass style, slide-in, pulsing "connected" dot, nicer message bubbles.
- Prompts, video, toasts - glass cards with scale and float animations.

I kept all the logic the same - only styling and small markup changes.
Motion respects prefers-reduced-motion for accessibility.

## Phase 3 - Make it Secure

I reviewed the 4 API routes and ranked the issues. There is no login, so the main risk is one client acting as another.

S1 (high) - identity was spoofable.
- fromId was trusted from the request body, and poll returned every user's id. So anyone could impersonate others, mark them busy, or drain their mailbox.
- Fix - join now issues a private secret, stored on the row and returned to the client. signal, poll and leave require it. Public ids stay for addressing but can no longer act as someone.

S2 (high) - no rate limiting.
- Fix - a best-effort in-memory limiter on every route, keyed by IP. Note - on Vercel serverless this is a soft guard only. A hard limit needs a shared store like Redis, which the no-external-services rule does not allow. I documented the tradeoff in the code.

S3 (medium) - input validation was not consistent.
- Fix - one shared isValidId check (bounded length, safe charset) on every route.

S4 (medium) - a DB error could leak details or throw a 500.
- Fix - every route is wrapped in try/catch, logs on the server, returns a generic error.

S5 (low) - a fake Mapbox token was hardcoded as a fallback.
- Fix - removed it, env only. The public token should also be URL-restricted in the Mapbox dashboard.

I kept the 64KB payload cap on signals that was already there.

## Phase 4 - Make it Better

I picked "live map" - I wanted the map to feel alive, not just static dots.

What I built (all client-side, no server or API changes):
- Arrival ripple - when a new dot appears, it sends out a one-time burst, so you see people landing on the map.
- Nearest stranger - a glowing line connects you to the closest dot, and that dot gets a brighter ring.
- A small "nearest ~X km" readout in the corner.
- Typing indicator - when the connected stranger is typing, you see bouncing dots. It rides the same WebRTC data channel as chat, so still no server involved.

Why this - it fits the name Pulse and builds on the neon look from Phase 2. It reuses the peer data we already poll, so there are no extra requests and no new endpoints.

With more time:
- Fade-out animation when someone leaves.
- Cluster dots when zoomed far out for big crowds.
- Optional soft sound on new arrivals, off by default.

## Assumptions / Blockers

- For local setup and db push I used the direct Neon connection. For Vercel I will use the pooled (-pooler) connection.
- WebRTC uses STUN + free public TURN (Open Relay). TURN is what makes it connect behind the same NAT / strict networks - e.g. two windows on one machine, which is the README's own test setup. ICE was reaching "checking" but never "connected" without a relay. The free public TURN can be rate-limited; for production you would use your own TURN credentials.
- The secret column was added with prisma db push (the project uses db push, not migrations), so it exists in the deployed DB. I did not add a prisma migrate step on build, to avoid a conflict with the already-pushed column.
