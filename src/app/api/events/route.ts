import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { eventRoles } from "@/db/schema/event-roles";
import { requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const date = z.string().datetime({ offset: true }).transform((v) => new Date(v));

const eventInputSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).optional(),
    timezone: z.string().trim().max(64).optional(),
    startsAt: date.optional(),
    endsAt: date.optional(),
    submissionOpensAt: date.optional(),
    submissionClosesAt: date.optional(),
    judgingOpensAt: date.optional(),
    judgingClosesAt: date.optional(),
    minTeamSize: z.number().int().min(1).max(100).optional(),
    maxTeamSize: z.number().int().min(1).max(100).nullable().optional(),
    normalizationMinSamples: z.number().int().min(2).max(1000).optional(),
    normalizationEpsilon: z.number().positive().max(1).optional(),
    blindToOrganizer: z.boolean().optional(),
  })
  .refine((v) => !(v.minTeamSize && v.maxTeamSize && v.maxTeamSize < v.minTeamSize), {
    message: "maxTeamSize must be >= minTeamSize",
  })
  .refine(
    (v) =>
      !(v.submissionOpensAt && v.submissionClosesAt && v.submissionClosesAt <= v.submissionOpensAt) &&
      !(v.judgingOpensAt && v.judgingClosesAt && v.judgingClosesAt <= v.judgingOpensAt),
    { message: "Close time must be after open time" },
  );

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return `${base || "event"}-${randomBytes(2).toString("hex")}`;
}

/** Public list of published/closed events. */
export async function GET() {
  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      description: events.description,
      status: events.status,
      submissionOpensAt: events.submissionOpensAt,
      submissionClosesAt: events.submissionClosesAt,
    })
    .from(events)
    .where(inArray(events.status, ["published", "closed"]))
    .orderBy(desc(events.createdAt))
    .limit(100);
  return NextResponse.json({ events: rows });
}

/** Any signed-in user can create an event (as draft) and becomes its organizer. */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = eventInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event", issues: parsed.error.issues }, { status: 400 });
  }

  const created = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({ ...parsed.data, slug: slugify(parsed.data.name), createdBy: user.id, status: "draft" })
      .returning();
    await tx.insert(eventRoles).values({ eventId: event.id, userId: user.id, role: "organizer" });
    return event;
  });

  return NextResponse.json({ event: created }, { status: 201 });
}
