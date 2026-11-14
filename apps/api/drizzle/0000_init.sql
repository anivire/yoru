CREATE TABLE `anime` (
	`mal_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`title_english` text,
	`title_japanese` text,
	`synonyms` text DEFAULT '[]' NOT NULL,
	`image_url` text,
	`type` text,
	`episodes` integer,
	`status` text,
	`airing` integer DEFAULT false NOT NULL,
	`year` integer,
	`season` text,
	`score` real,
	`genres` text DEFAULT '[]' NOT NULL,
	`studios` text DEFAULT '[]' NOT NULL,
	`synopsis` text,
	`duration` text,
	`rating` text,
	`aired_from` text,
	`aired_to` text,
	`broadcast_day` text,
	`broadcast_time` text,
	`broadcast_timezone` text,
	`trailer_url` text,
	`latest_episode` integer,
	`details_fetched_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `http_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`imported` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`note` text,
	`created_by` integer,
	`used_by` integer,
	`created_at` text NOT NULL,
	`expires_at` text,
	`used_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_idx` ON `invites` (`code`);--> statement-breakpoint
CREATE TABLE `list_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mal_id` integer NOT NULL,
	`status` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`score` real,
	`rewatches` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mal_id`) REFERENCES `anime`(`mal_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `list_entries_user_anime_idx` ON `list_entries` (`user_id`,`mal_id`);--> statement-breakpoint
CREATE INDEX `list_entries_anime_idx` ON `list_entries` (`mal_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mal_id` integer NOT NULL,
	`episode` integer NOT NULL,
	`kind` text NOT NULL,
	`author` text,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_unique_idx` ON `notifications` (`user_id`,`mal_id`,`episode`,`kind`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`code_verifier` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `provider_mappings` (
	`provider` text NOT NULL,
	`mal_id` integer NOT NULL,
	`provider_id` integer,
	`title` text,
	`manual` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`provider`, `mal_id`)
);
--> statement-breakpoint
CREATE TABLE `provider_releases` (
	`provider` text NOT NULL,
	`mal_id` integer NOT NULL,
	`episode` integer NOT NULL,
	`kind` text NOT NULL,
	`translation_id` integer NOT NULL,
	`author` text,
	`released_at` text NOT NULL,
	PRIMARY KEY(`provider`, `mal_id`, `episode`, `kind`)
);
--> statement-breakpoint
CREATE INDEX `provider_releases_anime_idx` ON `provider_releases` (`mal_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`locale` text DEFAULT 'ru' NOT NULL,
	`notify_sub` integer DEFAULT true NOT NULL,
	`notify_voice` integer DEFAULT true NOT NULL,
	`anime365_token` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `watch_progress` (
	`user_id` integer NOT NULL,
	`mal_id` integer NOT NULL,
	`episode` integer NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`duration` real DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `mal_id`, `episode`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watch_progress_user_updated_idx` ON `watch_progress` (`user_id`,`updated_at`);