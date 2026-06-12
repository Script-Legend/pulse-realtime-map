// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";

// The per-session secret issued by /api/join. Kept in module scope so callers
// don't have to thread it through every request. It proves we own our session
// id and is never shared with other peers.
let sessionSecret: string | null = null;

export async function join(
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, lat, lng }),
  });
  if (res.ok) {
    try {
      const data = await res.json();
      if (typeof data?.secret === "string") sessionSecret = data.secret;
    } catch {
      // ignore — without a secret, later requests will simply be rejected
    }
  }
}

export async function poll(id: string): Promise<PollResponse> {
  const res = await fetch(`/api/poll?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: sessionSecret ? { "x-session-secret": sessionSecret } : undefined,
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  fromId: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromId, toId, type, payload, secret: sessionSecret }),
  });
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
