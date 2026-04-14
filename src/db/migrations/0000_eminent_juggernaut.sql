CREATE TYPE "public"."direction" AS ENUM('long', 'short');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('active', 'closed', 'paused');--> statement-breakpoint
CREATE TYPE "public"."thesis_impact" AS ENUM('strengthened', 'weakened', 'unchanged');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_type" varchar(50),
	"file_size" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" varchar(20) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"direction" "direction" NOT NULL,
	"benchmark" varchar(100) DEFAULT 'S&P 500' NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"latest_impact" "thesis_impact",
	"last_updated" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"summary" text,
	"quality_assess" text,
	"valuation" jsonb,
	"assumptions" jsonb,
	"risks" jsonb,
	"sources" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thesis_pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"week_label" varchar(20),
	"week_date" date,
	"price_change_pct" numeric(8, 4),
	"index_change_pct" numeric(8, 4),
	"relative_perf" numeric(8, 4),
	"thesis_impact" "thesis_impact",
	"summary" text,
	"pillar_refs" jsonb,
	"sources" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theses" ADD CONSTRAINT "theses_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis_pillars" ADD CONSTRAINT "thesis_pillars_thesis_id_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_logs" ADD CONSTRAINT "weekly_logs_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE cascade ON UPDATE no action;