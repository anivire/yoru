CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mal_id` integer NOT NULL,
	`episode` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_user_created_idx` ON `activity` (`user_id`,`created_at`);--> statement-breakpoint
INSERT INTO `activity` (`user_id`, `mal_id`, `episode`, `created_at`) SELECT `user_id`, `mal_id`, `episode`, `updated_at` FROM `watch_progress` WHERE `duration` > 0 AND `position` / `duration` >= 0.85;
