CREATE TABLE `anime_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mal_id` integer NOT NULL,
	`episode` integer,
	`text` text NOT NULL,
	`private` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `anime_notes_anime_idx` ON `anime_notes` (`mal_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `anime_notes_user_idx` ON `anime_notes` (`user_id`);--> statement-breakpoint
CREATE TABLE `feed_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mal_id` integer NOT NULL,
	`type` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feed_events_created_idx` ON `feed_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `feed_events_user_idx` ON `feed_events` (`user_id`,`created_at`);