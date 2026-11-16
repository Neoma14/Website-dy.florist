-- Etalase beranda dipilih admin lewat ceklis. Hanya penambahan kolom (aman dijalankan dari build preview).
-- Pilihan awal = 4 produk terbaru (yang selama ini tampil di beranda), jadi beranda tidak berubah sampai admin mengubahnya.
ALTER TABLE `products` ADD `featured` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `products` SET `featured` = true WHERE `id` IN (SELECT `id` FROM (SELECT `id` FROM `products` ORDER BY `created_at` DESC, `id` DESC LIMIT 4) AS newest_four);
