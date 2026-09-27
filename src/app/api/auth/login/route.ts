import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { loginSchema } from "@/lib/auth/schema";
import { findUserByEmail } from "@/lib/auth/user";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookie";

const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(
  request: Request,
) {
  try {
    const body = await request.json();

    const parsed =
      loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const user =
      await findUserByEmail(
        parsed.data.email,
      );

    const passwordHash =
      user?.passwordHash ??
      DUMMY_HASH;

    const valid =
      await bcrypt.compare(
        parsed.data.password,
        passwordHash,
      );

    if (!user || !valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const session =
      await createSession(user.id);

    const response =
      NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          displayName:
            user.displayName,
          isAdmin: user.isAdmin,
        },
      });

    setSessionCookie(
      response,
      session.token,
      session.expiresAt,
    );

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 },
    );
  }
}
