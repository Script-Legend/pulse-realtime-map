import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, isValidId } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id, secret }. Removes the presence row and any
// pending signals to/from this user. Called via navigator.sendBeacon on tab
// close, so the body may arrive as text — parse defensively. The secret proves
// the caller owns this session, so one user can't delete another.
export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`leave:${clientIp(request.headers)}`, 60, 60_000)) {
      return Response.json({ error: "rate limited" }, { status: 429 });
    }

    let id: unknown;
    let secret: unknown;
    try {
      const text = await request.text();
      const parsed = text ? JSON.parse(text) : {};
      id = parsed?.id;
      secret = parsed?.secret;
    } catch {
      id = undefined;
    }

    if (!isValidId(id)) {
      return Response.json({ error: "invalid id" }, { status: 400 });
    }
    if (!(await verifySession(id, secret))) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    // Independent cleanup deletes — no atomicity needed (and interactive
    // transactions are unreliable over a PgBouncer pooler).
    await prisma.signal.deleteMany({
      where: { OR: [{ toId: id }, { fromId: id }] },
    });
    await prisma.presence.deleteMany({ where: { id } });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[api/leave]", err);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
