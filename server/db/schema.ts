import { mysqlTable, varchar, int, text, mediumtext, timestamp, datetime, index } from 'drizzle-orm/mysql-core';

export const categories = mysqlTable('categories', {
  key: varchar('key', { length: 30 }).primaryKey(),
  name: varchar('name', { length: 40 }).notNull(),
  emoji: varchar('emoji', { length: 16 }).notNull().default(''),
  sort: int('sort').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Harga Bespoke Studio (jenis produk & tambahan), bisa diubah dari admin
export const bespokePrices = mysqlTable('bespoke_prices', {
  key: varchar('key', { length: 40 }).primaryKey(),
  kind: varchar('kind', { length: 10 }).notNull(), // 'type' | 'addon'
  label: varchar('label', { length: 60 }).notNull(),
  price: int('price'), // null = harga via konsultasi (khusus jenis produk)
  sort: int('sort').notNull().default(0),
});

export const products = mysqlTable('products', {
  id: varchar('id', { length: 40 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  categoryName: varchar('category_name', { length: 40 }).notNull(),
  price: int('price').notNull(),
  // Harga coret (harga normal sebelum diskon); null = tidak ada diskon
  originalPrice: int('original_price'),
  // Link contoh untuk produk undangan digital (mis. /undangan/demo); null = tidak ada
  demoUrl: varchar('demo_url', { length: 200 }),
  badge: varchar('badge', { length: 40 }).notNull().default(''),
  description: text('description').notNull(),
  image: varchar('image', { length: 500 }).notNull(),
  rating: int('rating_x10').notNull().default(50),
  reviews: int('reviews').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const orders = mysqlTable('orders', {
  id: int('id').autoincrement().primaryKey(),
  recipient: varchar('recipient', { length: 120 }).notNull(),
  scheduled: varchar('scheduled', { length: 120 }).notNull(),
  note: varchar('note', { length: 500 }).notNull().default(''),
  total: int('total').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const orderItems = mysqlTable('order_items', {
  id: int('id').autoincrement().primaryKey(),
  orderId: int('order_id').notNull(),
  productId: varchar('product_id', { length: 40 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  price: int('price').notNull(),
  qty: int('qty').notNull(),
}, (t) => [index('order_items_order_idx').on(t.orderId)]);

export const sessions = mysqlTable('sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  expiresAt: datetime('expires_at').notNull(),
  // 'main' = admin utama (semua menu), 'undangan' = Admin Undangan (hanya undangan digital)
  role: varchar('role', { length: 10 }).notNull().default('main'),
});

// Undangan digital pelanggan. Isi undangan (nama, acara, foto, dst.) disimpan sebagai JSON tervalidasi di kolom data.
export const invitations = mysqlTable('invitations', {
  id: int('id').autoincrement().primaryKey(),
  slug: varchar('slug', { length: 60 }).notNull().unique(),
  status: varchar('status', { length: 10 }).notNull().default('draft'), // draft | terbit | arsip
  template: varchar('template', { length: 30 }).notNull().default('jawa-elegan'),
  customerName: varchar('customer_name', { length: 120 }).notNull().default(''),
  customerPhone: varchar('customer_phone', { length: 30 }).notNull().default(''),
  note: varchar('note', { length: 500 }).notNull().default(''),
  data: mediumtext('data').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  publishedAt: datetime('published_at'),
});

// Ucapan & konfirmasi kehadiran tamu
export const invitationWishes = mysqlTable('invitation_wishes', {
  id: int('id').autoincrement().primaryKey(),
  invitationId: int('invitation_id').notNull(),
  name: varchar('name', { length: 60 }).notNull(),
  message: varchar('message', { length: 300 }).notNull(),
  attendance: varchar('attendance', { length: 10 }), // hadir | tidak | ragu | null
  guests: int('guests').notNull().default(1),
  status: varchar('status', { length: 10 }).notNull().default('tampil'), // tampil | menunggu | sembunyi
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('invitation_wishes_inv_idx').on(t.invitationId, t.createdAt)]);

export const loginAttempts = mysqlTable('login_attempts', {
  id: int('id').autoincrement().primaryKey(),
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('login_attempts_ip_idx').on(t.ipHash, t.createdAt)]);

// Status penguncian login per IP: level 1 = dikunci sementara, level 2 = diblokir sampai pemulihan via email
export const loginBlocks = mysqlTable('login_blocks', {
  ipHash: varchar('ip_hash', { length: 64 }).primaryKey(),
  level: int('level').notNull(),
  lockedUntil: datetime('locked_until'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Token pemulihan (hanya hash yang disimpan), sekali pakai, berlaku 24 jam
export const recoveryTokens = mysqlTable('recovery_tokens', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  expiresAt: datetime('expires_at').notNull(),
  usedAt: datetime('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const rateEvents = mysqlTable('rate_events', {
  id: int('id').autoincrement().primaryKey(),
  bucket: varchar('bucket', { length: 40 }).notNull(),
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('rate_events_idx').on(t.bucket, t.ipHash, t.createdAt)]);
