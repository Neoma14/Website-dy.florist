import { randomBytes, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { SITE_URL } from '../lib/mailer';
import { demoInvitation } from './demo';
import { expiryOf, parseStoredData, type InvitationData } from './model';

export type InvitationRow = typeof schema.invitations.$inferSelect;
export type WishRow = typeof schema.invitationWishes.$inferSelect;

export const newToken = () => randomBytes(24).toString('hex');

/** Perbandingan token yang tahan serangan waktu (panjang berbeda langsung salah). */
export function tokenEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function expiresAtOf(row: InvitationRow): Date | null {
  return expiryOf(parseStoredData(row.data), row.retentionDays);
}

/**
 * Arsipkan otomatis undangan terbit yang sudah melewati masa aktif (acara terakhir + retentionDays).
 * Dipanggil saat undangan dibuka tamu, saat admin membuka daftar, dan saat ucapan dikirim, tanpa cron.
 * Mengembalikan true bila undangan ini baru saja diarsipkan.
 */
export async function archiveIfExpired(row: InvitationRow): Promise<boolean> {
  if (row.status !== 'terbit') return false;
  const exp = expiresAtOf(row);
  if (!exp || exp.getTime() > Date.now()) return false;
  await getDb().update(schema.invitations).set({ status: 'arsip', updatedAt: new Date() })
    .where(and(eq(schema.invitations.id, row.id), eq(schema.invitations.status, 'terbit')));
  return true;
}

/** Periksa semua undangan terbit sekaligus (untuk daftar admin). Mengembalikan jumlah yang diarsipkan. */
export async function sweepExpired(): Promise<number> {
  const rows = await getDb().select().from(schema.invitations).where(eq(schema.invitations.status, 'terbit'));
  let n = 0;
  for (const r of rows) if (await archiveIfExpired(r)) n++;
  return n;
}

export async function findInvitationByIntakeToken(token: string): Promise<InvitationRow | undefined> {
  if (!/^[a-f0-9]{48}$/.test(token)) return undefined;
  const [row] = await getDb().select().from(schema.invitations).where(eq(schema.invitations.intakeToken, token)).limit(1);
  return row;
}

/** Bersihkan link pratinjau yang sudah lewat masa berlaku. */
export async function clearExpiredPreviews() {
  await getDb().update(schema.invitations).set({ previewToken: null, previewExpiresAt: null })
    .where(lt(schema.invitations.previewExpiresAt, new Date()));
}

export async function findInvitationBySlug(slug: string): Promise<InvitationRow | undefined> {
  const [row] = await getDb().select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  return row;
}

export async function findInvitationById(id: number): Promise<InvitationRow | undefined> {
  const [row] = await getDb().select().from(schema.invitations).where(eq(schema.invitations.id, id)).limit(1);
  return row;
}

/** Jumlah konfirmasi kehadiran (ucapan yang disembunyikan admin tidak dihitung). */
export async function attendanceStats(invitationId: number) {
  const rows = await getDb().select({
    attendance: schema.invitationWishes.attendance,
    n: sql<number>`count(*)`,
    guests: sql<number>`coalesce(sum(${schema.invitationWishes.guests}), 0)`,
  }).from(schema.invitationWishes)
    .where(and(eq(schema.invitationWishes.invitationId, invitationId), inArray(schema.invitationWishes.status, ['tampil', 'menunggu'])))
    .groupBy(schema.invitationWishes.attendance);
  const stats = { hadir: 0, tidak: 0, ragu: 0, tamuHadir: 0 };
  for (const r of rows) {
    if (r.attendance === 'hadir') { stats.hadir = Number(r.n); stats.tamuHadir = Number(r.guests); }
    if (r.attendance === 'tidak') stats.tidak = Number(r.n);
    if (r.attendance === 'ragu') stats.ragu = Number(r.n);
  }
  return stats;
}

export async function visibleWishes(invitationId: number) {
  const rows = await getDb().select().from(schema.invitationWishes)
    .where(and(eq(schema.invitationWishes.invitationId, invitationId), eq(schema.invitationWishes.status, 'tampil')))
    .orderBy(desc(schema.invitationWishes.createdAt), desc(schema.invitationWishes.id))
    .limit(200);
  return rows.map(publicWish);
}

export const publicWish = (w: WishRow) => ({
  name: w.name,
  message: w.message,
  attendance: w.attendance,
  createdAt: new Date(w.createdAt).toISOString(),
});

/** Bentuk data yang dikirim ke halaman undangan (tanpa data pelanggan/internal). */
export async function publicInvitation(row: InvitationRow, preview: boolean) {
  const d = parseStoredData(row.data);
  const [stats, items] = await Promise.all([attendanceStats(row.id), visibleWishes(row.id)]);
  return {
    slug: row.slug,
    template: row.template,
    isDemo: false,
    isPreview: preview,
    ...d,
    rsvp: { ...d.rsvp, stats: { hadir: stats.hadir, tidak: stats.tidak, ragu: stats.ragu } },
    wishes: { ...d.wishes, items: d.wishes.enabled ? items : [] },
  };
}

// ---------- Halaman pratinjau link (Open Graph) untuk WhatsApp & media sosial ----------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const absolute = (u: string) => (u.startsWith('/') ? SITE_URL + u : u);

export async function invitationShareHtml(slug: string, guest: string): Promise<{ status: number; html: string }> {
  let d: Pick<InvitationData, 'couple' | 'dateLabel' | 'photos'> | null = null;
  if (slug === 'demo') d = demoInvitation();
  else if (/^[a-z0-9-]{3,60}$/.test(slug)) {
    const row = await findInvitationBySlug(slug);
    if (row?.status === 'terbit' && !(await archiveIfExpired(row))) d = parseStoredData(row.data);
    else if (row?.status === 'draft') {
      // Draft (pratinjau pelanggan): tampilkan kartu umum, nama dan foto belum dibocorkan ke pratinjau link
      const u = `${SITE_URL}/undangan/${encodeURIComponent(slug)}`;
      return { status: 200, html: page('Pratinjau Undangan Digital — dy.florist', 'Undangan pernikahan digital sedang disiapkan oleh dy.florist.', `${SITE_URL}/assets/undangan/og-undangan.jpg`, u) };
    }
  }
  const url = `${SITE_URL}/undangan/${encodeURIComponent(slug)}${guest ? `?to=${encodeURIComponent(guest)}` : ''}`;
  if (!d) {
    return { status: 404, html: page('Undangan Digital — dy.florist', 'Undangan pernikahan digital oleh dy.florist.', `${SITE_URL}/assets/undangan/og-undangan.jpg`, url) };
  }
  const names = [d.couple.groom.nickname, d.couple.bride.nickname].filter(Boolean).join(' & ');
  const title = `The Wedding of ${names}`;
  const desc = [d.dateLabel, guest ? `Kepada Yth. ${guest}` : 'Kami mengundang Anda untuk hadir dan memberikan doa restu.'].filter(Boolean).join(' · ');
  const photo = d.photos.cover || d.photos.couple;
  return { status: 200, html: page(title, desc, photo ? absolute(photo) : `${SITE_URL}/assets/undangan/og-undangan.jpg`, url) };
}

function page(title: string, desc: string, image: string, url: string) {
  return `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="dy.florist">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
</head><body><p><a href="${esc(url)}">${esc(title)}</a></p></body></html>`;
}
