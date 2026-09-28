CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('unpublished', 'published');--> statement-breakpoint
CREATE TYPE "public"."results_visibility" AS ENUM('hidden', 'participants', 'public');--> statement-breakpoint
CREATE TYPE "public"."event_role" AS ENUM('participant', 'judge', 'organizer');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('leader', 'member');--> statement-breakpoint
CREATE TYPE "public"."team_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"submission_opens_at" timestamp with time zone,
	"submission_closes_at" timestamp with time zone,
	"judging_opens_at" timestamp with time zone,
	"judging_closes_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"min_team_size" integer DEFAULT 1 NOT NULL,
	"max_team_size" integer,
	"normalization_method" varchar(50) DEFAULT 'zscore' NOT NULL,
	"normalization_min_samples" integer DEFAULT 3 NOT NULL,
	"normalization_epsilon" double precision DEFAULT 0.000001 NOT NULL,
	"fallback_method" varchar(50) DEFAULT 'raw_scaled' NOT NULL,
	"results_visibility" "results_visibility" DEFAULT 'hidden' NOT NULL,
	"publication_status" "publication_status" DEFAULT 'unpublished' NOT NULL,
	"blind_to_organizer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_min_team_size_check" CHECK ("events"."min_team_size" >= 1),
	CONSTRAINT "events_max_team_size_check" CHECK ("events"."max_team_size" IS NULL OR "events"."max_team_size" >= "events"."min_team_size"),
	CONSTRAINT "events_normalization_min_samples_check" CHECK ("events"."normalization_min_samples" >= 1),
	CONSTRAINT "events_normalization_epsilon_check" CHECK ("events"."normalization_epsilon" > 0)
);
--> statement-breakpoint
CREATE TABLE "event_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "event_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judge_track_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"judge_user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_member_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"invite_code" varchar(128) NOT NULL,
	"created_by" uuid NOT NULL,
	"status" "team_status" DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_track_scopes" ADD CONSTRAINT "judge_track_scopes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_track_scopes" ADD CONSTRAINT "judge_track_scopes_judge_user_id_users_id_fk" FOREIGN KEY ("judge_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_track_scopes" ADD CONSTRAINT "judge_track_scopes_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_roles_event_user_role_unique" ON "event_roles" USING btree ("event_id","user_id","role");--> statement-breakpoint
CREATE INDEX "event_roles_event_idx" ON "event_roles" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_roles_user_idx" ON "event_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "judge_track_scopes_event_judge_track_unique" ON "judge_track_scopes" USING btree ("event_id","judge_user_id","track_id");--> statement-breakpoint
CREATE INDEX "judge_track_scopes_event_idx" ON "judge_track_scopes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "judge_track_scopes_judge_idx" ON "judge_track_scopes" USING btree ("judge_user_id");--> statement-breakpoint
CREATE INDEX "judge_track_scopes_track_idx" ON "judge_track_scopes" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_event_name_unique" ON "tracks" USING btree ("event_id","name");--> statement-breakpoint
CREATE INDEX "tracks_event_idx" ON "tracks" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_unique" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_user_event_unique" ON "team_members" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "team_members_team_idx" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_members_event_idx" ON "team_members" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_event_name_unique" ON "teams" USING btree ("event_id","name");--> statement-breakpoint
CREATE INDEX "teams_event_idx" ON "teams" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "teams_created_by_idx" ON "teams" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "teams_status_idx" ON "teams" USING btree ("status");