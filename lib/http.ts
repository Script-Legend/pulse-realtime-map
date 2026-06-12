// Classify a thrown DB/runtime error. Transient Neon/pooler hiccups (free-tier
// cold start, dropped connection) are common and recoverable, so return a
// retryable 503 + Retry-After; everything else is a genuine 500. The client
// retries 5xx, so this turns a transient blip into a retry instead of a
// permanently stalled connection.
export function dbErrorResponse(err: unknown, tag: string): Response {
  console.error(tag, err);
  const code = (err as { code?: string })?.code ?? "";
  const text = `${code} ${(err as Error)?.message ?? ""}`;
  const transient =
    code === "P1001" || // can't reach database (Neon waking from suspend)
    code === "P1017" || // server closed the connection
    /can't reach|connection|connect|timeout|ECONNRESET|terminat|pool/i.test(text);
  return Response.json(
    { error: "server error" },
    transient
      ? { status: 503, headers: { "Retry-After": "1" } }
      : { status: 500 },
  );
}
