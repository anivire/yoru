ALTER TABLE `notifications` ADD `type` text DEFAULT 'episode' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_premieres` integer DEFAULT true NOT NULL;