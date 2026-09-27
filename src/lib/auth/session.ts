import crypto from "node:crypto";

export function generateSessionToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");

  return {
    raw,
    hash,
  };
}
