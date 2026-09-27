import { NextResponse } from "next/server";

import {
  getCurrentSession,
} from "@/lib/auth/session";

import {
  setSessionCookie,
} from "@/lib/auth/cookie";

export const dynamic = "force-dynamic";

export async function GET() {
  const session =
    await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthenticated",
      },
      {
        status: 401,
      },
    );
  }

  const response = NextResponse.json({
    ok: true,
    user: session.user,
    session: {
      expiresAt:
        session.expiresAt.toISOString(),
    },
  });

  // Keep browser cookie aligned with
  // the refreshed server-side session.
  setSessionCookie(
    response,
    session.rawToken,
    session.expiresAt,
  );

  return response;
}
