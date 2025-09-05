CREATE TABLE `live_scores` (
	`id` integer PRIMARY KEY NOT NULL,
	`event_id` integer NOT NULL,
	`home_score` integer DEFAULT 0 NOT NULL,
	`away_score` integer DEFAULT 0 NOT NULL,
	`quarter` text,
	`time_remaining` text,
	`last_updated` integer NOT NULL,
	`is_live` integer DEFAULT false NOT NULL,
	`is_complete` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_scores_event_id_unique` ON `live_scores` (`event_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_weekly_scores` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week` integer NOT NULL,
	`current_points` integer DEFAULT 0 NOT NULL,
	`projected_points` integer DEFAULT 0 NOT NULL,
	`completed_games` integer DEFAULT 0 NOT NULL,
	`total_games` integer DEFAULT 0 NOT NULL,
	`last_updated` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weeks` (
	`id` integer PRIMARY KEY NOT NULL,
	`week_number` integer NOT NULL,
	`punishment` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weeks_week_number_unique` ON `weeks` (`week_number`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_picks` (
	`id` integer PRIMARY KEY NOT NULL,
	`week` integer NOT NULL,
	`round` integer NOT NULL,
	`user_id` text NOT NULL,
	`team_id` integer,
	`order_in_round` integer NOT NULL,
	`assigned_by_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`team_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_picks`("id", "week", "round", "user_id", "team_id", "order_in_round", "assigned_by_id") SELECT "id", "week", "round", "user_id", "team_id", "order_in_round", "assigned_by_id" FROM `picks`;--> statement-breakpoint
DROP TABLE `picks`;--> statement-breakpoint
ALTER TABLE `__new_picks` RENAME TO `picks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "first_name", "last_name", "password_hash", "created_at") SELECT "id", "username", "first_name", "last_name", "password_hash", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);