-- Gambar bagian beranda (4 pilar) yang bisa diganti dari admin. Hanya tabel baru (aman dijalankan dari build preview).
CREATE TABLE IF NOT EXISTS `site_images` (
  `key` varchar(30) NOT NULL,
  `url` varchar(500) NOT NULL,
  CONSTRAINT `site_images_key` PRIMARY KEY(`key`)
);
