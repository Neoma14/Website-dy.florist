CREATE TABLE `login_blocks` (
	`ip_hash` varchar(64) NOT NULL,
	`level` int NOT NULL,
	`locked_until` datetime,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_blocks_ip_hash` PRIMARY KEY(`ip_hash`)
);
--> statement-breakpoint
CREATE TABLE `recovery_tokens` (
	`token_hash` varchar(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recovery_tokens_token_hash` PRIMARY KEY(`token_hash`)
);
