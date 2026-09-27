import { describe, expect, it } from "vitest";
import { generateSessionToken } from "@/lib/auth/token";

describe("session tokens", () => {
  it("generates 256-bit random raw tokens and SHA-256 hashes", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();

    expect(a.raw).toHaveLength(64);
    expect(a.hash).toHaveLength(64);
    expect(b.raw).toHaveLength(64);
    expect(b.hash).toHaveLength(64);

    expect(a.raw).not.toBe(a.hash);
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});
