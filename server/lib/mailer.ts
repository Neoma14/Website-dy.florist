// Pengiriman email peringatan keamanan lewat Resend (https://resend.com), tanpa dependensi tambahan.
// Env: RESEND_API_KEY (wajib untuk mengirim), ALERT_EMAIL, MAIL_FROM, SITE_URL.
export const ALERT_EMAIL = process.env.ALERT_EMAIL || 'dyfloristparcel@gmail.com';
const SITE_URL = (process.env.SITE_URL || 'https://www.dyflorist.site').replace(/\/+$/, '');

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function recoveryUrl(token: string): string {
  return `${SITE_URL}/admin?pemulihan=${token}`;
}

export async function sendBlockedAlert(info: { token: string; ip: string; userAgent: string }): Promise<boolean> {
  const link = recoveryUrl(info.token);
  const when = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' }) + ' WIB';
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Cadangan: link pemulihan dicatat di log Vercel (hanya bisa dibaca pemilik proyek)
    console.error(`[KEAMANAN] Login admin diblokir (${info.ip}). RESEND_API_KEY belum diatur, email tidak terkirim. Link pemulihan (24 jam): ${link}`);
    return false;
  }
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2b2227">
  <h2 style="color:#E4007F;margin-bottom:4px">dy.florist</h2>
  <h3 style="margin-top:0">Login admin diblokir</h3>
  <p>Ada percobaan login ke halaman admin dengan password salah berulang kali. Setelah dikunci 15 menit, percobaan itu masih salah, sehingga login dari perangkat tersebut <strong>diblokir</strong>.</p>
  <table style="font-size:14px;margin:12px 0">
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Waktu</td><td>${escHtml(when)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Alamat IP</td><td>${escHtml(info.ip)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Perangkat</td><td>${escHtml(info.userAgent.slice(0, 160))}</td></tr>
  </table>
  <p>Jika itu Anda, buka blokir dengan tombol di bawah (berlaku 24 jam, sekali pakai):</p>
  <p><a href="${link}" style="display:inline-block;background:#E4007F;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Buka Blokir Login Admin</a></p>
  <p style="font-size:13px;color:#6c6267">Jika bukan Anda, jangan klik tombol di atas. Blokir tetap aktif dan password Anda aman. Pertimbangkan mengganti password admin.</p>
</div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'dy.florist Keamanan <onboarding@resend.dev>',
        to: [ALERT_EMAIL],
        subject: 'Peringatan: login admin dy.florist diblokir',
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[KEAMANAN] Email pemulihan gagal (${res.status}). Link pemulihan (24 jam): ${link}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[KEAMANAN] Email pemulihan gagal: ${e instanceof Error ? e.message : e}. Link pemulihan (24 jam): ${link}`);
    return false;
  }
}
