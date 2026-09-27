import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pingDatabase();

    return NextResponse.json({
      ok: true,
      db: "up",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
      },
      {
        status: 503,
      }
    );
  }
}
