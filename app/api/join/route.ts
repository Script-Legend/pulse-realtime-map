import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { isValidId } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { id, lat, lng } (raw coords).
// Applies a 1–3 km privacy offset and upserts the presence row. Raw
// coordinates are never stored. Returns a per-session `secret` the client must
// present on later requests to prove it owns this session id.
export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`join:${clientIp(request.headers)}`, 20, 60_000)) {
      return Response.json({ error: "rate limited" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid body" }, { status: 400 });
    }

    const { id, lat, lng } = (body ?? {}) as Record<string, unknown>;

    if (!isValidId(id)) {
      return Response.json({ error: "invalid id" }, { status: 400 });
    }
    if (!isValidLatLng(lat, lng)) {
      return Response.json({ error: "invalid coordinates" }, { status: 400 });
    }

    const offset = applyPrivacyOffset(lat as number, lng as number);
    const secret = randomUUID();

    await prisma.presence.upsert({
      where: { id },
      create: {
        id,
        lat: offset.lat,
        lng: offset.lng,
        busy: false,
        lastSeen: new Date(),
        secret,
      },
      update: {
        lat: offset.lat,
        lng: offset.lng,
        lastSeen: new Date(),
        busy: false,
        secret,
      },
    });

    return Response.json({ ok: true, secret });
  } catch (err) {
    return dbErrorResponse(err, "[api/join]");
  }
}
