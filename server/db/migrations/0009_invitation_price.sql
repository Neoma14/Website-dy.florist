-- Harga riil undangan Jawa Elegan: Rp 75.000 dengan harga coret Rp 150.000.
-- Hanya jika harganya masih harga awal (belum diubah lewat admin).
UPDATE `products` SET `price` = 75000, `original_price` = 150000
WHERE `id` = 'undangan_jawa_elegan' AND `price` = 150000 AND `original_price` IS NULL;
