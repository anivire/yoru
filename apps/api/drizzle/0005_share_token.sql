ALTER TABLE `users` ADD `share_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_share_token_idx` ON `users` (`share_token`);