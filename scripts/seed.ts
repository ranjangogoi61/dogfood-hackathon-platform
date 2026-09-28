import { Client } from "pg";
import { hash } from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const DEMO_PASSWORD = "DogfoodDemo123!";

const ORGANIZER_ID = "10000000-0000-4000-8000-000000000001";
const JUDGE_A_ID = "10000000-0000-4000-8000-000000000002";
const JUDGE_B_ID = "10000000-0000-4000-8000-000000000003";
const PARTICIPANT_ID = "10000000-0000-4000-8000-000000000004";

const PUBLISHED_EVENT_ID = "20000000-0000-4000-8000-000000000001";
const CLOSED_EVENT_ID = "20000000-0000-4000-8000-000000000002";

const TRACK_ID = "30000000-0000-4000-8000-000000000001";

const TEAM_ID = "40000000-0000-4000-8000-000000000001";
const TEAM_MEMBER_ID = "40000000-0000-4000-8000-000000000002";

const PROJECT_ID = "50000000-0000-4000-8000-000000000001";

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  await client.connect();

  try {
    const demoPasswordHash = await hash(DEMO_PASSWORD, 10);

    await client.query({ text: "BEGIN" });

    await client.query({
      text: `
        INSERT INTO users (
          id,
          email,
          password_hash,
          display_name,
          is_admin
        )
        VALUES
          ($1, 'organizer@dogfood.local', $5, 'Demo Organizer', false),
          ($2, 'judge-a@dogfood.local', $5, 'Demo Judge A', false),
          ($3, 'judge-b@dogfood.local', $5, 'Demo Judge B', false),
          ($4, 'participant@dogfood.local', $5, 'Demo Participant', false)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          display_name = EXCLUDED.display_name,
          is_admin = EXCLUDED.is_admin,
          deleted_at = NULL,
          updated_at = NOW()
      `,
      values: [
        ORGANIZER_ID,
        JUDGE_A_ID,
        JUDGE_B_ID,
        PARTICIPANT_ID,
        demoPasswordHash,
      ],
    });

    await client.query({
      text: `
        INSERT INTO events (
          id,
          slug,
          name,
          description,
          status,
          timezone,
          starts_at,
          ends_at,
          submission_opens_at,
          submission_closes_at,
          judging_opens_at,
          judging_closes_at,
          created_by,
          min_team_size,
          max_team_size,
          normalization_method,
          normalization_min_samples,
          normalization_epsilon,
          fallback_method,
          results_visibility,
          publication_status,
          blind_to_organizer
        )
        VALUES
          (
            $1,
            'dogfood-demo-2026',
            'Dogfood Demo Hackathon 2026',
            'Seeded published fixture event for local acceptance testing.',
            'published',
            'Asia/Kolkata',
            NOW() - INTERVAL '1 day',
            NOW() + INTERVAL '7 days',
            NOW() - INTERVAL '1 day',
            NOW() + INTERVAL '2 days',
            NOW() + INTERVAL '2 days',
            NOW() + INTERVAL '5 days',
            $3,
            1,
            4,
            'zscore',
            3,
            0.000001,
            'raw_scaled',
            'hidden',
            'published',
            false
          ),
          (
            $2,
            'dogfood-closed-demo-2026',
            'Dogfood Closed Demo Event 2026',
            'Seeded closed fixture event for deadline testing.',
            'closed',
            'Asia/Kolkata',
            NOW() - INTERVAL '8 days',
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '8 days',
            NOW() - INTERVAL '2 days',
            NOW() - INTERVAL '2 days',
            NOW() - INTERVAL '1 day',
            $3,
            1,
            4,
            'zscore',
            3,
            0.000001,
            'raw_scaled',
            'hidden',
            'unpublished',
            false
          )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          timezone = EXCLUDED.timezone,
          starts_at = EXCLUDED.starts_at,
          ends_at = EXCLUDED.ends_at,
          submission_opens_at = EXCLUDED.submission_opens_at,
          submission_closes_at = EXCLUDED.submission_closes_at,
          judging_opens_at = EXCLUDED.judging_opens_at,
          judging_closes_at = EXCLUDED.judging_closes_at,
          created_by = EXCLUDED.created_by,
          min_team_size = EXCLUDED.min_team_size,
          max_team_size = EXCLUDED.max_team_size,
          normalization_method = EXCLUDED.normalization_method,
          normalization_min_samples = EXCLUDED.normalization_min_samples,
          normalization_epsilon = EXCLUDED.normalization_epsilon,
          fallback_method = EXCLUDED.fallback_method,
          results_visibility = EXCLUDED.results_visibility,
          publication_status = EXCLUDED.publication_status,
          blind_to_organizer = EXCLUDED.blind_to_organizer,
          updated_at = NOW()
      `,
      values: [
        PUBLISHED_EVENT_ID,
        CLOSED_EVENT_ID,
        ORGANIZER_ID,
      ],
    });

    const roles = [
      [PUBLISHED_EVENT_ID, ORGANIZER_ID, "organizer"],
      [PUBLISHED_EVENT_ID, JUDGE_A_ID, "judge"],
      [PUBLISHED_EVENT_ID, JUDGE_B_ID, "judge"],
      [PUBLISHED_EVENT_ID, PARTICIPANT_ID, "participant"],
    ];

    for (const [eventId, userId, role] of roles) {
      await client.query({
        text: `
          INSERT INTO event_roles (
            event_id,
            user_id,
            role
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (event_id, user_id, role) DO NOTHING
        `,
        values: [eventId, userId, role],
      });
    }

    await client.query({
      text: `
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
      values: [TRACK_ID, PUBLISHED_EVENT_ID],
    });

    await client.query({
      text: `
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
          deleted_at = NULL,
          updated_at = NOW()
      `,
      values: [
        TEAM_ID,
        PUBLISHED_EVENT_ID,
        PARTICIPANT_ID,
      ],
    });

    await client.query({
      text: `
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
        ON CONFLICT (id) DO UPDATE SET
          team_id = EXCLUDED.team_id,
          event_id = EXCLUDED.event_id,
          user_id = EXCLUDED.user_id,
          role = EXCLUDED.role
      `,
      values: [
        TEAM_MEMBER_ID,
        TEAM_ID,
        PUBLISHED_EVENT_ID,
        PARTICIPANT_ID,
      ],
    });

    await client.query({
      text: `
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
          'A seeded demonstration project used for Dogfood acceptance and gallery testing.',
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
      values: [
        PROJECT_ID,
        PUBLISHED_EVENT_ID,
        TEAM_ID,
        TRACK_ID,
        JSON.stringify([
          "https://placehold.co/1200x630/png?text=Dogfood+Demo+1",
          "https://placehold.co/1200x630/png?text=Dogfood+Demo+2",
        ]),
        JSON.stringify([
          "AI",
          "TypeScript",
          "Next.js",
          "PostgreSQL",
        ]),
        PARTICIPANT_ID,
      ],
    });

    await client.query({ text: "COMMIT" });

    console.log("Seed completed successfully.");
    console.log("Demo accounts:");
    console.log("  organizer@dogfood.local / DogfoodDemo123!");
    console.log("  judge-a@dogfood.local / DogfoodDemo123!");
    console.log("  judge-b@dogfood.local / DogfoodDemo123!");
    console.log("  participant@dogfood.local / DogfoodDemo123!");
    console.log("Published event: dogfood-demo-2026");
    console.log("Closed event: dogfood-closed-demo-2026");
    console.log("Project ID:", PROJECT_ID);
  } catch (error) {
    try {
      await client.query({ text: "ROLLBACK" });
    } catch {
      // Ignore rollback failure and preserve the original error.
    }

    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:");
  console.error(error);
  process.exit(1);
});
