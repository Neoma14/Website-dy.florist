CREATE TABLE `login_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ip_hash` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`price` int NOT NULL,
	`qty` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipient` varchar(120) NOT NULL,
	`scheduled` varchar(120) NOT NULL,
	`note` varchar(500) NOT NULL DEFAULT '',
	`total` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`category` varchar(20) NOT NULL,
	`category_name` varchar(40) NOT NULL,
	`price` int NOT NULL,
	`badge` varchar(40) NOT NULL DEFAULT '',
	`description` text NOT NULL,
	`image` varchar(500) NOT NULL,
	`rating_x10` int NOT NULL DEFAULT 50,
	`reviews` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bucket` varchar(40) NOT NULL,
	`ip_hash` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rate_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` varchar(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `sessions_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `login_attempts_ip_idx` ON `login_attempts` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `rate_events_idx` ON `rate_events` (`bucket`,`ip_hash`,`created_at`);