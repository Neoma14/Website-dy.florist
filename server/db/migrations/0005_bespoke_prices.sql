CREATE TABLE `bespoke_prices` (
	`key` varchar(40) NOT NULL,
	`kind` varchar(10) NOT NULL,
	`label` varchar(60) NOT NULL,
	`price` int,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `bespoke_prices_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
INSERT IGNORE INTO `bespoke_prices` (`key`, `kind`, `label`, `price`, `sort`) VALUES
	('hand_bouquet', 'type', 'Hand Bouquet (Buket)', 280000, 1),
	('table', 'type', 'Table Arrangement', NULL, 2),
	('standing', 'type', 'Standing Flower', NULL, 3),
	('board', 'type', 'Bunga Papan (Flower Board)', NULL, 4),
	('parcel', 'type', 'Parcel', NULL, 5),
	('gift_craft', 'type', 'Gift Craft & Hampers', 490000, 6),
	('dekorasi', 'type', 'Dekorasi', NULL, 7),
	('undangan', 'type', 'Undangan Digital', NULL, 8),
	('seserahan', 'type', 'Seserahan', NULL, 9),
	('lainnya', 'type', 'Lainnya (Request Khusus)', NULL, 10),
	('chocolate', 'addon', 'Cokelat', 25000, 11),
	('scented_candle', 'addon', 'Lilin Aromaterapi', 100000, 12);
