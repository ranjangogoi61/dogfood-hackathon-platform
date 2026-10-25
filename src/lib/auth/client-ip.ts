/**
 * Single trusted-proxy rule for the whole app.
 * - TRUST_PROXY !== "true": forwarded headers are attacker-controlled, so we
 *   return null (callers must not key security decisions on a spoofable IP).
 * - TRUST_PROXY === "true": the app sits behind our own reverse proxy, which
 *   overwrites X-Forwarded-For; the left-most entry is the client.
 */
export function getClientIp(request: Request): string | null {
  if (process.env.TRUST_PROXY !== "true") return null;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && forwarded.length <= 64) return forwarded;
  const real = request.headers.get("x-real-ip")?.trim();
  return real && real.length <= 64 ? real : null;
}
