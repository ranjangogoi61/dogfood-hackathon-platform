import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/auth/schema";
import { findUserByEmail } from "@/lib/auth/user";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookie";
import { getClientIp } from "@/lib/auth/client-ip";
import { isBlocked, recordFailure, recordSuccess } from "@/lib/auth/throttle";

const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ip = getClientIp(request);

    if (await isBlocked(parsed.data.email, ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const user = await findUserByEmail(parsed.data.email);
    const passwordHash = user?.passwordHash ?? DUMMY_HASH;

    const valid = await verifyPassword(parsed.data.password, passwordHash);

    if (!user || !valid) {
      await recordFailure(parsed.data.email, ip);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await recordSuccess(parsed.data.email);

    const session = await createSession(user.id, {
      ip: ip ?? undefined,
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
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}
