CREATE TABLE `teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `week_schedules` (
	`id` integer PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`week_id` integer NOT NULL,
	`game_date` text NOT NULL,
	`game_time` text NOT NULL,
	`home_team_id` integer NOT NULL,
	`away_team_id` integer NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`spread` real,
	`over_under` real,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_team_id_unique` ON `teams` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `week_schedules_game_id_unique` ON `week_schedules` (`game_id`);