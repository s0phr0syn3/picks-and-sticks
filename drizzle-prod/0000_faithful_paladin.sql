CREATE TABLE `picks` (
	`id` integer PRIMARY KEY NOT NULL,
	`week` integer NOT NULL,
	`round` integer NOT NULL,
	`user_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`order_in_round` integer NOT NULL,
	`assigned_by_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`team_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` integer PRIMARY KEY NOT NULL,
	`game_id` integer NOT NULL,
	`week_id` integer NOT NULL,
	`game_date` text NOT NULL,
	`home_team_id` integer NOT NULL,
	`away_team_id` integer NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`spread` real,
	`over_under` real,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`team_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`team_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`logo_url` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedules_game_id_unique` ON `schedules` (`game_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_team_id_unique` ON `teams` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);