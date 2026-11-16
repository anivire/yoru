ALTER TABLE `users` ADD `banner_mal_id` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `favorites` text DEFAULT '[]' NOT NULL;