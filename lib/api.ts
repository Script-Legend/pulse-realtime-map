// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";
import { dlog } from "@/lib/debug";

// The per-session secret issued by /api/join. Kept in module scope so callers
// don't have to thread it through every request. It proves we own our session
// id and is never shared with other peers.
let sessionSecret: string | null = null;

// Signaling rides a lossy DB mailbox over HTTP, and Neon free tier can return a
// transient 5xx on cold start. A single dropped handshake message (offer /
// answer / accept) would stall the WebRTC connection forever, so POST with a
// few retries on transient failures (429 / 5xx / network). Non-transient 4xx
// (400 / 401) return immediately.
async function postWithRetry(
  url: string,
  body: string,
  attempts = 4,
): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) return res; // not transient
    } catch {
      // network blip — fall through to retry
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  return null;
}

export async function join(
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  const res = await postWithRetry("/api/join", JSON.stringify({ id, lat, lng }));
  if (res && res.ok) {
    try {
      const data = await res.json();
      if (typeof data?.secret === "string") sessionSecret = data.secret;
    } catch {
      // ignore — without a secret, later requests will be rejected
    }
  }
  dlog("join ->", res ? res.status : "no response", "| secret:", sessionSecret ? "set" : "MISSING");
}

export async function poll(id: string): Promise<PollResponse> {
  const res = await fetch(`/api/poll?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: sessionSecret ? { "x-session-secret": sessionSecret } : undefined,
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

// Returns true if the server accepted the signal. Handshake-critical messages
// get the built-in retry above; a false result means it gave up after retries,
// so the caller's connection watchdog can recover instead of hanging.
export async function sendSignal(
  fromId: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<boolean> {
  const res = await postWithRetry(
    "/api/signal",
    JSON.stringify({ fromId, toId, type, payload, secret: sessionSecret }),
  );
  const ok = !!res && res.ok;
  dlog("signal sent:", type, "->", ok ? "OK" : `FAILED (${res ? res.status : "no response"})`);
  return ok;
}

// Fire-and-forget leave that survives the tab closing.
export function leave(id: string): void {
  const body = JSON.stringify({ id, secret: sessionSecret });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
