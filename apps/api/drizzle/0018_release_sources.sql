ALTER TABLE `notifications` ADD `provider` text;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_aired` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `notifications` SET `provider` = 'anime365' WHERE `provider` IS NULL;
