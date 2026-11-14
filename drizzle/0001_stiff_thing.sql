CREATE TABLE `potion_codes` (
	`hash` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`potion_type` text NOT NULL,
	`batch_id` text,
	`created_at` text NOT NULL,
	`disabled` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `potion_codes_public_id_unique` ON `potion_codes` (`public_id`);--> statement-breakpoint
ALTER TABLE `consumed` ADD `type` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `consumed` ADD `dice_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `consumed` ADD `outcome_json` text DEFAULT '{}' NOT NULL;