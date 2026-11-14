CREATE TABLE `categories` (
	`key` varchar(30) NOT NULL,
	`name` varchar(40) NOT NULL,
	`emoji` varchar(16) NOT NULL DEFAULT '',
	`sort` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
INSERT IGNORE INTO `categories` (`key`, `name`, `emoji`, `sort`) VALUES
	('artificial', 'Bucket Bunga Artificial', '🌷', 1),
	('segar', 'Bucket Bunga Segar', '🌸', 2),
	('satin', 'Bucket Bunga Satin', '🎀', 3),
	('gift_craft', 'Gift, Craft & Hampers', '🎁', 4),
	('dekorasi', 'Dekorasi', '🎊', 5),
	('undangan', 'Undangan Digital', '💌', 6),
	('lainnya', 'Layanan Lainnya', '✨', 7);
