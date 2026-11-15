import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { SITE_URL } from '../lib/mailer';
import { demoInvitation } from './demo';
import { parseStoredData, type InvitationData } from './model';

export type InvitationRow = typeof schema.invitations.$inferSelect;
export type WishRow = typeof schema.invitationWishes.$inferSelect;

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
    if (row?.status === 'terbit') d = parseStoredData(row.data);
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
