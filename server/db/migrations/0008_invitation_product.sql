-- Produk undangan digital "Jawa Elegan" dengan foto contoh dan tautan ke undangan contoh. Hanya jika kategori undangan ada.
INSERT IGNORE INTO `products` (`id`, `name`, `category`, `category_name`, `price`, `badge`, `description`, `image`, `demo_url`, `rating_x10`, `reviews`, `created_at`)
SELECT 'undangan_jawa_elegan', 'Undangan Digital Jawa Elegan', c.`key`, c.`name`, 150000, 'Digital',
  'Undangan pernikahan digital bernuansa Jawa elegan (ivory, navy & emas): sampul foto, profil mempelai, hitung mundur, detail acara dengan Google Maps, kisah cinta, galeri, amplop digital, musik, serta konfirmasi kehadiran & ucapan tamu. Termasuk link khusus per nama tamu. Data diisi oleh tim dy.florist.',
  '/assets/produk-undangan-jawa-elegan.jpg', '/undangan/demo', 50, 0, NOW()
FROM `categories` c WHERE c.`key` = 'undangan';
