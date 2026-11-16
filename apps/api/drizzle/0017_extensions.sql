CREATE TABLE `extensions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`type` text NOT NULL,
	`author` text,
	`description` text,
	`manifest_url` text,
	`manifest` text NOT NULL,
	`code` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`last_error` text,
	`last_error_at` text,
	`installed_at` text NOT NULL,
	`updated_at` text NOT NULL
);
