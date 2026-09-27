import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/auth/schema";
import { createSession } from "@/lib/auth/session";
import { findUserByEmail, createUser } from "@/lib/auth/user";
import { setSessionCookie } from "@/lib/auth/cookie";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration data" },
        { status: 400 },
      );
    }

    const email = parsed.data.email;
    const existing = await findUserByEmail(email);

    if (existing) {
      return NextResponse.json(
        { error: "Unable to create account" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);

    let user;
    try {
      user = await createUser({
        email,
        passwordHash,
        displayName: parsed.data.displayName,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          { error: "Unable to create account" },
          { status: 409 },
        );
      }
      throw error;
    }

    const session = await createSession(user.id, {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const response = NextResponse.json(
      { ok: true, user },
      { status: 201 },
    );

    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to create account" },
      { status: 500 },
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
