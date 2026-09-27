import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/auth/schema";
import {
  createSession,
} from "@/lib/auth/session";
import {
  findUserByEmail,
  createUser,
} from "@/lib/auth/user";
import { setSessionCookie } from "@/lib/auth/cookie";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed =
      registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid registration data",
        },
        { status: 400 },
      );
    }

    const email = parsed.data.email;

    const existing =
      await findUserByEmail(email);

    if (existing) {
      return NextResponse.json(
        {
          error: "Unable to create account",
        },
        { status: 409 },
      );
    }

    const passwordHash =
      await hashPassword(
        parsed.data.password,
      );

    const user = await createUser({
      email,
      passwordHash,
      displayName:
        parsed.data.displayName,
    });

    const session =
      await createSession(user.id);

    const response =
      NextResponse.json(
        {
          ok: true,
          user,
        },
        { status: 201 },
      );

    setSessionCookie(
      response,
      session.token,
      session.expiresAt,
    );

    return response;
  } catch {
    return NextResponse.json(
      {
        error: "Unable to create account",
      },
      { status: 500 },
    );
  }
}
