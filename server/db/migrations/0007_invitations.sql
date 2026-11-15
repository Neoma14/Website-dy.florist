ALTER TABLE `sessions` ADD `role` varchar(10) DEFAULT 'main' NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `demo_url` varchar(200);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(60) NOT NULL,
	`status` varchar(10) NOT NULL DEFAULT 'draft',
	`template` varchar(30) NOT NULL DEFAULT 'jawa-elegan',
	`customer_name` varchar(120) NOT NULL DEFAULT '',
	`customer_phone` varchar(30) NOT NULL DEFAULT '',
	`note` varchar(500) NOT NULL DEFAULT '',
	`data` mediumtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`published_at` datetime,
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `invitation_wishes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invitation_id` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`message` varchar(300) NOT NULL,
	`attendance` varchar(10),
	`guests` int NOT NULL DEFAULT 1,
	`status` varchar(10) NOT NULL DEFAULT 'tampil',
	`ip_hash` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitation_wishes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `invitation_wishes_inv_idx` ON `invitation_wishes` (`invitation_id`,`created_at`);
