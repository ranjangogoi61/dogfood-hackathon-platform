import { NextResponse } from "next/server";

import {
  revokeCurrentSession,
} from "@/lib/auth/session";

import {
  clearSessionCookie,
} from "@/lib/auth/cookie";

export async function POST() {
  await revokeCurrentSession();

  const response =
    NextResponse.json({
      ok: true,
    });

  clearSessionCookie(response);

  return response;
}
