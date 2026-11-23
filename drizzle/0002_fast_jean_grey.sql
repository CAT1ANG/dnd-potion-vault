CREATE TABLE `inventory_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`item_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`potion_type` text NOT NULL,
	`batch_id` text NOT NULL,
	`owner_device` text,
	`claimed_at` text,
	`consumed_at` text,
	`result_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_token_hash_unique` ON `inventory_items` (`token_hash`);