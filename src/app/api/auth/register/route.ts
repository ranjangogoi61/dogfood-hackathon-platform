import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.email || !body.password || !body.displayName) {
    return NextResponse.json(
      { error: "Missing fields" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(body.password);

  // DB insert arrives after repository layer.
  return NextResponse.json({
    ok: true,
    email: body.email,
    displayName: body.displayName,
    passwordHashGenerated: Boolean(passwordHash),
  });
}
