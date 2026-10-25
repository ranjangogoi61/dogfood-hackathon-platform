import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { tracks } from "@/db/schema/tracks";
import { forbidden, hasEventRole, requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const rows = await db.select().from(tracks).where(eq(tracks.eventId, id)).orderBy(asc(tracks.position));
  return NextResponse.json({ tracks: rows });
}

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  position: z.number().int().min(0).max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { user, error } = await requireUser();
  if (error) return error;
  if (!user.isAdmin && !(await hasEventRole(user.id, id, "organizer"))) return forbidden();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const [track] = await db.insert(tracks).values({ eventId: id, ...parsed.data }).returning();
    return NextResponse.json({ track }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Track name already exists" }, { status: 409 });
    }
    throw e;
  }
}
