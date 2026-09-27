import { NextResponse } from "next/server";

import {
  getCurrentSession,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session =
    await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthenticated",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: session.user,
    session: {
      expiresAt:
        session.expiresAt.toISOString(),
    },
  });
}
