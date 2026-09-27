import {
  describe,
  expect,
  it,
} from "vitest";

import {
  generateSessionToken,
} from "@/lib/auth/session";

import {
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";

describe("authentication primitives", () => {
  it("generates a 256-bit session token", () => {
    const token = generateSessionToken();

    expect(token.raw).toHaveLength(64);
    expect(token.hash).toHaveLength(64);
    expect(token.raw).not.toBe(token.hash);
  });

  it("hashes and verifies passwords", async () => {
    const password =
      "a-very-strong-password";

    const hash =
      await hashPassword(password);

    expect(hash).not.toBe(password);

    expect(
      await verifyPassword(password, hash),
    ).toBe(true);

    expect(
      await verifyPassword(
        "wrong-password",
        hash,
      ),
    ).toBe(false);
  });
});
