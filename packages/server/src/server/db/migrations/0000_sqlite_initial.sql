CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`directory` text NOT NULL,
	`display_name` text NOT NULL,
	`kind` text NOT NULL,
	`git_remote` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_directory_unique` ON `projects` (`directory`);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`directory` text NOT NULL,
	`display_name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_directory_unique` ON `workspaces` (`directory`);
--> statement-breakpoint
CREATE INDEX `workspaces_project_id_idx` ON `workspaces` (`project_id`);
--> statement-breakpoint
CREATE TABLE `agent_snapshots` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`workspace_id` integer NOT NULL,
	`cwd` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_activity_at` text,
	`last_user_message_at` text,
	`title` text,
	`labels` text NOT NULL,
	`last_status` text NOT NULL,
	`last_mode_id` text,
	`config` text,
	`runtime_info` text,
	`persistence` text,
	`requires_attention` integer NOT NULL,
	`attention_reason` text,
	`attention_timestamp` text,
	`internal` integer NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_timeline_rows` (
	`agent_id` text NOT NULL,
	`seq` integer NOT NULL,
	`committed_at` text NOT NULL,
	`item` text NOT NULL,
	`item_kind` text,
	PRIMARY KEY(`agent_id`, `seq`)
);
