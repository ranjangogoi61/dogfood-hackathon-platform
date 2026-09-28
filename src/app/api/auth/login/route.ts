import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/auth/schema";
import { findUserByEmail } from "@/lib/auth/user";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookie";

const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const user = await findUserByEmail(parsed.data.email);
    const passwordHash = user?.passwordHash ?? DUMMY_HASH;

    const valid = await verifyPassword(
      parsed.data.password,
      passwordHash,
    );

    if (!user || !valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const session = await createSession(user.id, {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isAdmin: user.isAdmin,
      },
    });

    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 },
    );
  }
      }
