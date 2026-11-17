ALTER TABLE `users` ADD `invite_id` integer;--> statement-breakpoint
UPDATE `users` SET `invite_id` = (SELECT `id` FROM `invites` WHERE `invites`.`used_by` = `users`.`id`);