import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    db: "pending",
    message: "Database wiring arrives in the next batch.",
  });
}
