import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const DEMO_PASSWORD = "DogfoodDemo123!";

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ------------------------------------------------------------
    // Deterministic fixture IDs
    // ------------------------------------------------------------

    const organizerId = "10000000-0000-4000-8000-000000000001";
    const judgeAId = "10000000-0000-4000-8000-000000000002";
    const judgeBId = "10000000-0000-4000-8000-000000000003";
    const participantId = "10000000-0000-4000-8000-000000000004";

    const publishedEventId = "20000000-0000-4000-8000-000000000001";
    const closedEventId = "20000000-0000-4000-8000-000000000002";

    const publishedTrackId = "30000000-0000-4000-8000-000000000001";

    const teamId = "40000000-0000-4000-8000-000000000001";

    const projectId = "50000000-0000-4000-8000-000000000001";

    // ------------------------------------------------------------
    // Users
    // ------------------------------------------------------------

    await client.query(
      `
      INSERT INTO users (
        id,
        email,
        password_hash,
        display_name,
        is_admin
      )
      VALUES
        ($1, 'organizer@dogfood.local', crypt($5, gen_salt('bf', 10)), 'Demo Organizer', false),
        ($2, 'judge-a@dogfood.local', crypt($5, gen_salt('bf', 10)), 'Demo Judge A', false),
        ($3, 'judge-b@dogfood.local', crypt($5, gen_salt('bf', 10)), 'Demo Judge B', false),
        ($4, 'participant@dogfood.local', crypt($5, gen_salt('bf', 10)), 'Demo Participant', false)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        display_name = EXCLUDED.display_name,
        is_admin = EXCLUDED.is_admin,
        deleted_at = NULL,
        updated_at = NOW()
      `,
      [
        organizerId,
        judgeAId,
        judgeBId,
        participantId,
        DEMO_PASSWORD,
      ],
    );

    // ------------------------------------------------------------
    // Events
    // ------------------------------------------------------------

    await client.query(
      `
      INSERT INTO events (
        id,
        slug,
        name,
        timezone,
        state,
        starts_at,
        ends_at,
        submission_opens_at,
        submission_closes_at,
        judging_opens_at,
        judging_closes_at,
        settings
      )
      VALUES
        (
          $1,
          'dogfood-demo-2026',
          'Dogfood Demo Hackathon 2026',
          'Asia/Kolkata',
          'published',
          NOW() - INTERVAL '1 day',
          NOW() + INTERVAL '7 days',
          NOW() - INTERVAL '1 day',
          NOW() + INTERVAL '2 days',
          NOW() + INTERVAL '2 days',
          NOW() + INTERVAL '5 days',
          '{}'::jsonb
        ),
        (
          $2,
          'dogfood-closed-demo-2026',
          'Dogfood Closed Demo Event 2026',
          'Asia/Kolkata',
          'closed',
          NOW() - INTERVAL '8 days',
          NOW() - INTERVAL '1 day',
          NOW() - INTERVAL '8 days',
          NOW() - INTERVAL '2 days',
          NOW() - INTERVAL '2 days',
          NOW() - INTERVAL '1 day',
          '{}'::jsonb
        )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        timezone = EXCLUDED.timezone,
        state = EXCLUDED.state,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        submission_opens_at = EXCLUDED.submission_opens_at,
        submission_closes_at = EXCLUDED.submission_closes_at,
        judging_opens_at = EXCLUDED.judging_opens_at,
        judging_closes_at = EXCLUDED.judging_closes_at,
        settings = EXCLUDED.settings,
        updated_at = NOW()
      `,
      [publishedEventId, closedEventId],
    );

    // ------------------------------------------------------------
    // Event roles
    // ------------------------------------------------------------

    const roleRows = [
      [randomUUID(), publishedEventId, organizerId, "organizer"],
      [randomUUID(), publishedEventId, judgeAId, "judge"],
      [randomUUID(), publishedEventId, judgeBId, "judge"],
      [randomUUID(), publishedEventId, participantId, "participant"],
    ];

    for (const [id, eventId, userId, role] of roleRows) {
      await client.query(
        `
        INSERT INTO event_roles (
          id,
          event_id,
          user_id,
          role
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (event_id, user_id, role) DO NOTHING
        `,
        [id, eventId, userId, role],
      );
    }

    // ------------------------------------------------------------
    // Track
    // ------------------------------------------------------------

    await client.query(
      `
      INSERT INTO tracks (
        id,
        event_id,
        name,
        description,
        position
      )
      VALUES (
        $1,
        $2,
        'AI & Developer Tools',
        'Demo track for AI and developer-tool projects.',
        1
      )
      ON CONFLICT (id) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        position = EXCLUDED.position,
        updated_at = NOW()
      `,
      [publishedTrackId, publishedEventId],
    );

    // ------------------------------------------------------------
    // Team
    // ------------------------------------------------------------

    await client.query(
      `
      INSERT INTO teams (
        id,
        event_id,
        name,
        invite_code,
        created_by,
        status
      )
      VALUES (
        $1,
        $2,
        'Demo Builders',
        'dogfood-demo-invite-2026',
        $3,
        'active'
      )
      ON CONFLICT (id) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        name = EXCLUDED.name,
        invite_code = EXCLUDED.invite_code,
        created_by = EXCLUDED.created_by,
        status = EXCLUDED.status,
        deleted_at = NULL
      `,
      [teamId, publishedEventId, participantId],
    );

    // ------------------------------------------------------------
    // Team member
    // ------------------------------------------------------------

    await client.query(
      `
      INSERT INTO team_members (
        id,
        team_id,
        event_id,
        user_id,
        role
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'leader'
      )
      ON CONFLICT (user_id, event_id) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        role = EXCLUDED.role
      `,
      [
        "60000000-0000-4000-8000-000000000001",
        teamId,
        publishedEventId,
        participantId,
      ],
    );

    // ------------------------------------------------------------
    // Demo project
    // ------------------------------------------------------------

    await client.query(
      `
      INSERT INTO projects (
        id,
        event_id,
        team_id,
        track_id,
        title,
        tagline,
        description,
        thumbnail_url,
        image_urls,
        video_url,
        repo_url,
        live_url,
        tech_tags,
        status,
        submitted_at,
        created_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'Offline-First AI Workspace',
        'A local-first workspace for building and judging hackathon projects.',
        'A demonstration project seeded for the Dogfood acceptance environment.',
        'https://placehold.co/1200x630/png?text=Dogfood+Demo',
        $5::jsonb,
        NULL,
        'https://github.com/ranjangogoi61/dogfood-hackathon-platform',
        NULL,
        $6::jsonb,
        'submitted',
        NOW(),
        $7
      )
      ON CONFLICT (id) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        team_id = EXCLUDED.team_id,
        track_id = EXCLUDED.track_id,
        title = EXCLUDED.title,
        tagline = EXCLUDED.tagline,
        description = EXCLUDED.description,
        thumbnail_url = EXCLUDED.thumbnail_url,
        image_urls = EXCLUDED.image_urls,
        video_url = EXCLUDED.video_url,
        repo_url = EXCLUDED.repo_url,
        live_url = EXCLUDED.live_url,
        tech_tags = EXCLUDED.tech_tags,
        status = EXCLUDED.status,
        submitted_at = EXCLUDED.submitted_at,
        created_by = EXCLUDED.created_by,
        deleted_at = NULL,
        updated_at = NOW()
      `,
      [
        projectId,
        publishedEventId,
        teamId,
        publishedTrackId,
        JSON.stringify([
          "https://placehold.co/1200x630/png?text=Dogfood+Demo+1",
          "https://placehold.co/1200x630/png?text=Dogfood+Demo+2",
        ]),
        JSON.stringify(["AI", "TypeScript", "Next.js", "PostgreSQL"]),
        participantId,
      ],
    );

    await client.query("COMMIT");

    console.log("Seed completed successfully.");
    console.log("");
    console.log("Demo accounts:");
    console.log("  organizer@dogfood.local / DogfoodDemo123!");
    console.log("  judge-a@dogfood.local   / DogfoodDemo123!");
    console.log("  judge-b@dogfood.local   / DogfoodDemo123!");
    console.log("  participant@dogfood.local / DogfoodDemo123!");
    console.log("");
    console.log("Published event: dogfood-demo-2026");
    console.log("Closed event:    dogfood-closed-demo-2026");
    console.log("Project ID:      " + projectId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:");
  console.error(error);
  process.exit(1);
});
