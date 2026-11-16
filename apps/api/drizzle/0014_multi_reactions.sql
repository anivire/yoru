DROP INDEX `reactions_user_event_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_user_event_emoji_idx` ON `reactions` (`user_id`,`event_id`,`emoji`);