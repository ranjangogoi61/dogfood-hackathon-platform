import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { projects } from "@/db/schema/projects";
import { teams } from "@/db/schema/teams";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gallery · Dogfood" };

const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q?.trim().slice(0, 100);

  const conditions = [
    eq(projects.status, "submitted"),
    isNull(projects.deletedAt),
    inArray(events.status, ["published", "closed"]),
  ];
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(ilike(projects.title, pattern), ilike(projects.tagline, pattern), ilike(projects.description, pattern))!,
    );
  }

  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      tagline: projects.tagline,
      thumbnailUrl: projects.thumbnailUrl,
      repoUrl: projects.repoUrl,
      liveUrl: projects.liveUrl,
      techTags: projects.techTags,
      team: teams.name,
      event: events.name,
    })
    .from(projects)
    .innerJoin(events, eq(projects.eventId, events.id))
    .innerJoin(teams, eq(projects.teamId, teams.id))
    .where(and(...conditions))
    .orderBy(desc(projects.submittedAt))
    .limit(200);

  return (
    <main style={{ maxWidth: 960, margin: "32px auto", padding: "0 16px" }}>
      <h1>Project gallery</h1>
      <form method="get" style={{ margin: "16px 0" }}>
        <input
          name="q"
          defaultValue={term ?? ""}
          placeholder="Search projects"
          aria-label="Search projects"
          style={{ padding: 8, width: "70%", maxWidth: 360 }}
        />
        <button type="submit" style={{ padding: 8, marginLeft: 8 }}>Search</button>
      </form>

      {rows.length === 0 ? (
        <p>No submitted projects yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {rows.map((p) => (
            <li key={p.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
              {safeUrl(p.thumbnailUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={safeUrl(p.thumbnailUrl)!} alt="" style={{ width: "100%", borderRadius: 4 }} />
              )}
              <h2 style={{ fontSize: 18, margin: "8px 0 4px" }}>{p.title}</h2>
              <p style={{ margin: "0 0 8px" }}>{p.tagline}</p>
              <small>{p.team} · {p.event}</small>
              <p style={{ margin: "8px 0 0" }}>
                {safeUrl(p.repoUrl) && <a href={safeUrl(p.repoUrl)!} rel="noopener noreferrer">Repo</a>}
                {safeUrl(p.repoUrl) && safeUrl(p.liveUrl) && " · "}
                {safeUrl(p.liveUrl) && <a href={safeUrl(p.liveUrl)!} rel="noopener noreferrer">Live</a>}
              </p>
              {p.techTags.length > 0 && <p style={{ margin: "8px 0 0", fontSize: 12 }}>{p.techTags.join(" · ")}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
