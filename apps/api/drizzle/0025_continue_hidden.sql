CREATE TABLE `continue_hidden` (
	`user_id` integer NOT NULL,
	`mal_id` integer NOT NULL,
	`hidden_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `mal_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
