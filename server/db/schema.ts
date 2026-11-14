import { mysqlTable, varchar, int, text, timestamp, datetime, index } from 'drizzle-orm/mysql-core';

export const categories = mysqlTable('categories', {
  key: varchar('key', { length: 30 }).primaryKey(),
  name: varchar('name', { length: 40 }).notNull(),
  emoji: varchar('emoji', { length: 16 }).notNull().default(''),
  sort: int('sort').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const products = mysqlTable('products', {
  id: varchar('id', { length: 40 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  categoryName: varchar('category_name', { length: 40 }).notNull(),
  price: int('price').notNull(),
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
});

export const loginAttempts = mysqlTable('login_attempts', {
  id: int('id').autoincrement().primaryKey(),
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('login_attempts_ip_idx').on(t.ipHash, t.createdAt)]);

export const rateEvents = mysqlTable('rate_events', {
  id: int('id').autoincrement().primaryKey(),
  bucket: varchar('bucket', { length: 40 }).notNull(),
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('rate_events_idx').on(t.bucket, t.ipHash, t.createdAt)]);
