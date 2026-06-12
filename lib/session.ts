import { prisma } from "@/lib/prisma";

// A session id is public — other peers need it to address you (tap your dot).
// The `secret`, issued once by /api/join and never returned by /api/poll, is
// what proves a request actually comes from the owner of that id. This stops
// one client from impersonating another or tampering with their state.
export async function verifySession(
  id: string,
  secret: unknown,
): Promise<boolean> {
  if (!id || typeof secret !== "string" || secret.length === 0) return false;
  const row = await prisma.presence.findUnique({
    where: { id },
    select: { secret: true },
  });
  return row?.secret != null && row.secret === secret;
}
