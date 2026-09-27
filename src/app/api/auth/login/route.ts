import { NextResponse } from "next/server";
import { generateSessionToken } from "@/lib/auth/session";

export async function POST() {
  const session = generateSessionToken();

  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.set("session", session.raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  return response;
}
