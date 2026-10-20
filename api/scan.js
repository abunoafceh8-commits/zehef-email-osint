import { endpoint, readBody, json, V, rateLimit, safeFetch, isSafeUrl } from './_lib/guard.js';
import crypto from 'node:crypto';

/**
 * POST /api/scan — استخبارات بريد إلكتروني (نسخة معزّزة v2.0)
 * يعمل محليًا بالكامل: Hudson Rock · Gravatar · MX/SPF · تسريبات عامة · 22 منصة.
 * لا وسطاء خارجيين، لا مفاتيح، لا تسريب بيانات.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const PLATFORMS = [
  ['GitHub', (u) => `https://github.com/${u}`, 'Page not found'],
  ['Instagram', (u) => `https://www.instagram.com/${u}/`, 'Sorry, this page'],
  ['X (Twitter)', (u) => `https://x.com/${u}`, 'This account doesn'],
  ['Reddit', (u) => `https://www.reddit.com/user/${u}/about.json`, null],
  ['Pinterest', (u) => `https://www.pinterest.com/${u}/`, 'Page not found'],
  ['TikTok', (u) => `https://www.tiktok.com/@${u}`, "Couldn't find this account"],
  ['YouTube', (u) => `https://www.youtube.com/@${u}`, '404'],
  ['Steam', (u) => `https://steamcommunity.com/id/${u}`, 'could not be found'],
  ['Twitch', (u) => `https://www.twitch.tv/${u}`, "Sorry. Unless you"],
  ['SoundCloud', (u) => `https://soundcloud.com/${u}`, "We can't find that user"],
  ['Medium', (u) => `https://medium.com/@${u}`, 'Out of nothing, something'],
  ['Spotify', (u) => `https://open.spotify.com/user/${u}`, 'Page not found'],
  ['Chess.com', (u) => `https://api.chess.com/pub/player/${u}`, null],
  ['GitLab', (u) => `https://gitlab.com/${u}`, 'Page not found'],
  ['DeviantArt', (u) => `https://www.deviantart.com/${u}`, 'not found'],
  ['Flickr', (u) => `https://www.flickr.com/people/${u}`, 'Page Not Found'],
  ['Behance', (u) => `https://www.behance.net/${u}`, 'Page not found'],
  ['Dribbble', (u) => `https://dribbble.com/${u}`, 'Page not found'],
  ['Keybase', (u) => `https://keybase.io/${u}`, 'not found'],
  ['Telegram', (u) => `https://t.me/${u}`, 'you can contact'],
  ['Patreon', (u) => `https://www.patreon.com/${u}`, 'not found'],
  ['Vimeo', (u) => `https://vimeo.com/${u}`, 'Page not found'],
];

const DISPOSABLE = /^(mailinator|guerrillamail|tempmail|10minutemail|yopmail|trashmail|sharklasers|getnada|dispostable|maildrop)\./i;
const PROVIDERS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'protonmail.com', 'proton.me', 'live.com', 'aol.com', 'zoho.com', 'yandex.com', 'gmx.com', 'mail.com'];

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); } catch { out[idx] = { error: true }; }
    }
  });
  await Promise.all(workers);
  return out;
}

async function dns(name, type) {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    return (j.Answer || []).map((a) => String(a.data));
  } catch { return []; }
}

export default endpoint(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!rateLimit(req, res, { max: 20, windowMs: 60_000, key: 'scan' })) return;

  const t0 = Date.now();
  const b = await readBody(req, 8 * 1024);
  const email = V.email(b.email);
  if (!email) return json(res, 400, { error: 'بريد إلكتروني غير صالح' });

  const [local, domain] = email.split('@');
  const md5 = crypto.createHash('md5').update(email).digest('hex');
  const baseLocal = local.replace(/[.+].*$/, '').replace(/[^a-zA-Z0-9._-]/g, '') || local;

  // 1) Hudson Rock — تسريبات معلومات
  let hudsonrock = { found: false, message: 'لا توجد سجلات معروفة لدى Hudson Rock', stealers: [] };
  try {
    const r = await safeFetch(`https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email?email=${encodeURIComponent(email)}`, {
      allowedHosts: ['hudsonrock.com'], timeout: 9000, maxBytes: 1024 * 1024,
    });
    if (r.ok) {
      const j = await r.json();
      const stealers = (j.stealers || []).slice(0, 10).map((s) => ({
        date_compromised: s.date_compromised, computer_name: s.computer_name,
        operating_system: s.operating_system, ip: s.ip ? 'محجوب' : null,
        total_user_services: s.total_user_services, total_corporate_services: s.total_corporate_services,
      }));
      hudsonrock = {
        found: stealers.length > 0,
        stealerCount: stealers.length,
        stealers,
        message: j.message || (stealers.length ? `تم العثور على ${stealers.length} سجل تسريب` : hudsonrock.message),
      };
    }
  } catch (e) { hudsonrock.message = 'تعذّر الوصول إلى Hudson Rock مؤقتًا'; }

  // 2) Gravatar
  let gravatar = { exists: false, profile: null, avatar: `https://www.gravatar.com/avatar/${md5}?d=404`, hash: md5 };
  try {
    const r = await safeFetch(gravatar.avatar, { allowedHosts: ['gravatar.com'], timeout: 5000, maxBytes: 64 * 1024 });
    gravatar.exists = r.status === 200;
    if (gravatar.exists) {
      try {
        const pr = await fetch(`https://www.gravatar.com/${md5}.json`, { signal: AbortSignal.timeout(5000) });
        if (pr.ok) {
          const pj = await pr.json();
          const e = pj.entry?.[0] || {};
          gravatar.profile = {
            displayName: e.displayName || null, aboutMe: e.aboutMe || null,
            currentLocation: e.currentLocation || null, profileUrl: e.profileUrl || null,
            accounts: (e.accounts || []).map((a) => ({ shortname: a.shortname, username: a.username, url: a.url })),
          };
        }
      } catch {}
    }
  } catch {}

  // 3) DNS / بريد
  const [mx, spf, dmarc] = await Promise.all([dns(domain, 'MX'), dns(domain, 'TXT'), dns(`_dmarc.${domain}`, 'TXT')]);
  const hasSpf = spf.some((t) => /v=spf1/i.test(t));
  const hasDmarc = dmarc.some((t) => /v=DMARC1/i.test(t));

  // 4) منصات
  const accounts = await pool(PLATFORMS, 9, async ([name, url, marker]) => {
    const target = url(baseLocal);
    try {
      const r = await fetch(target, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(7000) });
      const body = r.status === 200 ? (await r.text()).slice(0, 120000) : '';
      const text = body.toLowerCase();
      const notFound = marker && text.includes(String(marker).toLowerCase());
      const found = r.status === 200 && !notFound;
      return { platform: name, found, url: target, status: r.status };
    } catch {
      return { platform: name, found: false, url: target, error: true };
    }
  });

  // 5) إيميلات بديلة مقترحة
  const generatedEmails = PROVIDERS.filter((p) => p !== domain).slice(0, 8).map((p) => `${baseLocal}@${p}`);

  // 6) تحليل مخاطر
  let risk = 0;
  if (hudsonrock.found) risk += 55;
  if (!hasSpf) risk += 10;
  if (!hasDmarc) risk += 10;
  if (DISPOSABLE.test(domain)) risk += 20;
  if (!mx.length) risk += 25;
  const foundAccounts = accounts.filter((a) => a.found).length;
  if (foundAccounts > 8) risk += 5;
  risk = Math.min(100, risk);

  return json(res, 200, {
    email,
    hudsonrock,
    accounts,
    generatedEmails,
    gravatar,
    domain: {
      name: domain,
      mx: mx.slice(0, 5),
      spf: hasSpf,
      dmarc: hasDmarc,
      disposable: DISPOSABLE.test(domain),
      provider: PROVIDERS.includes(domain) ? 'عام' : (mx.join(' ').includes('google') ? 'Google Workspace' : mx.join(' ').includes('outlook') ? 'Microsoft 365' : 'مخصص'),
    },
    risk: { score: risk, level: risk >= 70 ? 'critical' : risk >= 45 ? 'high' : risk >= 20 ? 'medium' : 'low' },
    stats: {
      totalPlatformsChecked: accounts.length,
      foundAccounts,
      errorAccounts: accounts.filter((a) => a.error).length,
      scanDuration: Date.now() - t0,
    },
    timestamp: new Date().toISOString(),
    engine: 'Zehef · AbuNawaf Enhance 2.0',
  });
}, { name: 'scan', methods: ['POST'] });
