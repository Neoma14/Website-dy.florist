-- Alur kerja undangan: formulir data pelanggan (intake), link pratinjau pelanggan, dan masa aktif otomatis.
-- Hanya penambahan kolom (aman dijalankan dari build preview).
ALTER TABLE `invitations` ADD `retention_days` int DEFAULT 180 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invitations` ADD `intake_token` varchar(64);
--> statement-breakpoint
ALTER TABLE `invitations` ADD `intake_status` varchar(10) DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invitations` ADD `intake_data` mediumtext;
--> statement-breakpoint
ALTER TABLE `invitations` ADD `intake_submitted_at` datetime;
--> statement-breakpoint
ALTER TABLE `invitations` ADD `preview_token` varchar(64);
--> statement-breakpoint
ALTER TABLE `invitations` ADD `preview_expires_at` datetime;
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_intake_token_unique` ON `invitations` (`intake_token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_preview_token_unique` ON `invitations` (`preview_token`);
