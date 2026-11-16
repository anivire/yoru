ALTER TABLE `users` ADD `notify_source` text;--> statement-breakpoint
ALTER TABLE `users` ADD `premiere_source` text;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `notify_sources`;