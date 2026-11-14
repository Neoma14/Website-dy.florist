-- Produk asli dy.florist (foto riil). Hanya dimasukkan jika kategorinya ada; nama kategori diambil dari tabel categories.
INSERT IGNORE INTO `products` (`id`, `name`, `category`, `category_name`, `price`, `badge`, `description`, `image`, `rating_x10`, `reviews`, `created_at`)
SELECT 'satin_blush_ruffle', 'Blush Pink Satin Rose Bouquet', c.`key`, c.`name`, 250000, 'New',
  'Buket mawar satin pink lembut dengan wrapping ruffle putih bertumpuk, aksen bunga mungil, dan pita satin pink. Bunga satin awet tanpa layu, cocok untuk wisuda, ulang tahun, atau anniversary.',
  '/assets/produk-satin-blush-pink-ruffle.jpg', 50, 0, NOW()
FROM `categories` c WHERE c.`key` = 'satin';
--> statement-breakpoint
INSERT IGNORE INTO `products` (`id`, `name`, `category`, `category_name`, `price`, `badge`, `description`, `image`, `rating_x10`, `reviews`, `created_at`)
SELECT 'artificial_rainbow_burlap', 'Rainbow Garden Burlap Bouquet', c.`key`, c.`name`, 225000, '',
  'Rangkaian bunga artificial warna-warni: lily biru, mawar, gerbera, krisan, dan bunga matahari mini, dibalut kain goni (burlap) natural dengan pita satin fuchsia. Ceria dan tahan lama.',
  '/assets/produk-artificial-rainbow-burlap.jpg', 50, 0, NOW() - INTERVAL 1 SECOND
FROM `categories` c WHERE c.`key` = 'artificial';
--> statement-breakpoint
INSERT IGNORE INTO `products` (`id`, `name`, `category`, `category_name`, `price`, `badge`, `description`, `image`, `rating_x10`, `reviews`, `created_at`)
SELECT 'artificial_pink_lily', 'Pink Lily Blossom Bouquet', c.`key`, c.`name`, 200000, '',
  'Perpaduan lily pink, krisan, peony, dan daisy artificial bernuansa pink-putih, dibungkus wrapping pink dengan pita satin fuchsia. Manis untuk hadiah ulang tahun dan ucapan terima kasih.',
  '/assets/produk-artificial-pink-lily.jpg', 50, 0, NOW() - INTERVAL 2 SECOND
FROM `categories` c WHERE c.`key` = 'artificial';
--> statement-breakpoint
INSERT IGNORE INTO `products` (`id`, `name`, `category`, `category_name`, `price`, `badge`, `description`, `image`, `rating_x10`, `reviews`, `created_at`)
SELECT 'satin_dusty_rose', 'Dusty Rose Satin & Butterfly Bouquet', c.`key`, c.`name`, 275000, '',
  'Mawar satin dusty rose dengan aksen tulle berbintik dan hiasan kupu-kupu, dikelilingi wrapping ruffle putih besar serta pita satin mauve. Elegan untuk wisuda dan momen spesial.',
  '/assets/produk-satin-dusty-rose-butterfly.jpg', 50, 0, NOW() - INTERVAL 3 SECOND
FROM `categories` c WHERE c.`key` = 'satin';
--> statement-breakpoint
INSERT IGNORE INTO `products` (`id`, `name`, `category`, `category_name`, `price`, `badge`, `description`, `image`, `rating_x10`, `reviews`, `created_at`)
SELECT 'artificial_sunflower_grand', 'Grand Sunflower Celebration Bouquet', c.`key`, c.`name`, 550000, 'Grand Size',
  'Buket ukuran besar berisi bunga matahari, mawar warna-warni, dan krisan artificial dengan hiasan kupu-kupu, wrapping pink bertumpuk, serta pita organza panjang. Cocok untuk wisuda dan perayaan besar.',
  '/assets/produk-artificial-sunflower-grand.jpg', 50, 0, NOW() - INTERVAL 4 SECOND
FROM `categories` c WHERE c.`key` = 'artificial';
--> statement-breakpoint
INSERT IGNORE INTO `products` (`id`, `name`, `category`, `category_name`, `price`, `badge`, `description`, `image`, `rating_x10`, `reviews`, `created_at`)
SELECT 'artificial_white_calla', 'White Calla Lily Hand Bouquet', c.`key`, c.`name`, 250000, 'Wedding',
  'Hand bouquet calla lily putih dengan mawar putih dan dedaunan hijau, diikat pita satin putih. Anggun untuk pernikahan, lamaran, atau foto prewedding.',
  '/assets/produk-artificial-white-calla.jpg', 50, 0, NOW() - INTERVAL 5 SECOND
FROM `categories` c WHERE c.`key` = 'artificial';
--> statement-breakpoint
-- Hapus 12 produk contoh, hanya jika fotonya masih foto contoh (produk yang sudah diedit di admin tidak tersentuh)
DELETE FROM `products`
WHERE `id` IN ('f1', 'f2', 'f3', 'f4', 'g1', 'g2', 'g3', 'g4', 'c1', 'c2', 'c3', 'c4')
  AND `image` IN ('/assets/bouquet.jpg', '/assets/bloom_box.jpg', '/assets/gift.jpg', '/assets/dome.jpg');
