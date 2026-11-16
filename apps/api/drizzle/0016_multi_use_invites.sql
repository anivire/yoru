ALTER TABLE `invites` ADD `multi_use` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `invites` ADD `uses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `invited_by` integer;--> statement-breakpoint
UPDATE `invites` SET `uses` = 1 WHERE `used_at` IS NOT NULL;--> statement-breakpoint
UPDATE `users` SET `invited_by` = (SELECT `created_by` FROM `invites` WHERE `invites`.`used_by` = `users`.`id`) WHERE `invited_by` IS NULL;
