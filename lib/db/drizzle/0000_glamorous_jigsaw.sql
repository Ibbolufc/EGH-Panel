CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'client');--> statement-breakpoint
CREATE TYPE "public"."node_scheme" AS ENUM('http', 'https');--> statement-breakpoint
CREATE TYPE "public"."node_status" AS ENUM('online', 'offline', 'maintenance', 'pending');--> statement-breakpoint
CREATE TYPE "public"."server_status" AS ENUM('installing', 'install_failed', 'running', 'offline', 'stopping', 'starting', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."backup_status" AS ENUM('created', 'in_progress', 'completed', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."schedule_action" AS ENUM('start', 'stop', 'restart', 'kill', 'backup', 'command');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "nests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "egg_variables" (
	"id" serial PRIMARY KEY NOT NULL,
	"egg_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"env_variable" text NOT NULL,
	"default_value" text DEFAULT '' NOT NULL,
	"user_viewable" text DEFAULT 'true' NOT NULL,
	"user_editable" text DEFAULT 'false' NOT NULL,
	"rules" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eggs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nest_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"docker_image" text NOT NULL,
	"docker_images" text[],
	"startup" text NOT NULL,
	"install_script" text,
	"config_files" text,
	"file_deny_list" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" integer NOT NULL,
	"ip" text NOT NULL,
	"port" integer NOT NULL,
	"alias" text,
	"server_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"fqdn" text NOT NULL,
	"scheme" "node_scheme" DEFAULT 'https' NOT NULL,
	"daemon_port" integer DEFAULT 8080 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"memory_total" integer NOT NULL,
	"memory_overallocate" integer DEFAULT 0 NOT NULL,
	"disk_total" integer NOT NULL,
	"disk_overallocate" integer DEFAULT 0 NOT NULL,
	"status" "node_status" DEFAULT 'pending' NOT NULL,
	"daemon_token" text,
	"registration_token" text,
	"registration_token_expires_at" timestamp with time zone,
	"notes" text,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_variables" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"env_variable" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" integer NOT NULL,
	"node_id" integer NOT NULL,
	"egg_id" integer NOT NULL,
	"allocation_id" integer NOT NULL,
	"status" "server_status" DEFAULT 'offline' NOT NULL,
	"memory_limit" integer DEFAULT 512 NOT NULL,
	"disk_limit" integer DEFAULT 1024 NOT NULL,
	"cpu_limit" integer DEFAULT 100 NOT NULL,
	"startup" text,
	"docker_image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"name" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"status" "backup_status" DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"name" text NOT NULL,
	"cron_minute" text DEFAULT '0' NOT NULL,
	"cron_hour" text DEFAULT '*' NOT NULL,
	"cron_day_of_month" text DEFAULT '*' NOT NULL,
	"cron_month" text DEFAULT '*' NOT NULL,
	"cron_day_of_week" text DEFAULT '*' NOT NULL,
	"action" "schedule_action" DEFAULT 'restart' NOT NULL,
	"payload" text,
	"is_enabled" text DEFAULT 'true' NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"server_id" integer,
	"event" text NOT NULL,
	"description" text NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "egg_variables" ADD CONSTRAINT "egg_variables_egg_id_eggs_id_fk" FOREIGN KEY ("egg_id") REFERENCES "public"."eggs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_nest_id_nests_id_fk" FOREIGN KEY ("nest_id") REFERENCES "public"."nests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_variables" ADD CONSTRAINT "server_variables_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_egg_id_eggs_id_fk" FOREIGN KEY ("egg_id") REFERENCES "public"."eggs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_allocation_id_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."allocations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE set null ON UPDATE no action;