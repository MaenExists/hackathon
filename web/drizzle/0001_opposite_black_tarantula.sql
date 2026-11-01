CREATE TABLE `map_search_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `map_search_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`next_request_at` integer NOT NULL
);
