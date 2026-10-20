import crypto from 'crypto';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function checkPlatform(name, url, parser) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    const found = parser(r.status, await r.text().catch(() => ''));
    return { platform: name, found, url: url.split('?')[0] };
  } catch {
    return { platform: name, found: false, error: 'timeout', url: url.split('?')[0] };
  }
}

async function checkHudsonRock(email) {
  try {
    const r = await fetch('https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email?email=' + encodeURIComponent(email), {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000)
    });
    const data = await r.json();
    return {
      found: (data.stealers?.length || 0) > 0,
      stealerCount: data.stealers?.length || 0,
      stealers: (data.stealers || []).slice(0, 5).map(s => ({
        malware: s.malware_path || 'Unknown',
        date: s.date_compromised || 'Unknown',
        ip: s.ip || 'Unknown',
        os: s.operating_system || 'Unknown'
      })),
      message: data.message || null
    };
  } catch {
    return { found: false, message: 'Service unavailable', stealerCount: 0, stealers: [] };
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { email } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const username = email.split('@')[0];
  const domain = email.split('@')[1];
  const md5 = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  const sha256 = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

  const [hudsonrock, ...accounts] = await Promise.all([
    checkHudsonRock(email),
    checkPlatform('X (Twitter)', `https://x.com/${username}`, (s) => s === 200),
    checkPlatform('GitHub', `https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`, (s, t) => { try { return JSON.parse(t).total_count > 0; } catch { return false; } }),
    checkPlatform('GitHub User', `https://github.com/${username}`, (s) => s === 200),
    checkPlatform('Gravatar', `https://en.gravatar.com/${md5}.json`, (s) => s === 200),
    checkPlatform('Spotify', `https://open.spotify.com/search/${encodeURIComponent(email)}`, (s, t) => t.includes('spotify:user') || t.includes(username)),
    checkPlatform('Pinterest', `https://www.pinterest.com/${username}/`, (s, t) => s === 200 && !t.includes('not found')),
    checkPlatform('Chess.com', `https://api.chess.com/pub/player/${username}`, (s) => s === 200),
    checkPlatform('Strava', `https://www.strava.com/athletes/search?utf8=✓&query=${encodeURIComponent(email)}`, (s, t) => t.includes('athlete') && s === 200),
    checkPlatform('Flickr', `https://www.flickr.com/search/people/?q=${encodeURIComponent(email)}`, (s, t) => t.includes('person') && s === 200),
    checkPlatform('Duolingo', `https://www.duolingo.com/2017-06-30/users?email=${encodeURIComponent(email)}`, (s, t) => { try { const d = JSON.parse(t); return d.users?.length > 0; } catch { return false; } }),
    checkPlatform('Imgur', `https://api.imgur.com/account/v1/accounts/${username}?client_id=546c25a59c58ad7`, (s) => s === 200),
    checkPlatform('Adobe', `https://auth.services.adobe.com/signin/v2/users/accounts`, (s) => s === 200),
    checkPlatform('Deezer', `https://api.deezer.com/search/user?q=${encodeURIComponent(username)}`, (s, t) => { try { return JSON.parse(t).total > 0; } catch { return false; } }),
    checkPlatform('ProtonMail', `https://account.proton.me/api/users/available?Name=${username}&Type=1`, (s, t) => { try { const d = JSON.parse(t); return !d.available; } catch { return false; } }),
    checkPlatform('BandLab', `https://www.bandlab.com/api/v1.4/users/${username}`, (s) => s === 200),
    checkPlatform('PicsArt', `https://api.picsart.com/users/${username}.json`, (s) => s === 200),
    checkPlatform('Instagram', `https://www.instagram.com/${username}/`, (s, t) => s === 200 && !t.includes('Sorry')),
    checkPlatform('Reddit', `https://www.reddit.com/user/${username}/about.json`, (s, t) => s === 200 && !t.includes('error')),
    checkPlatform('YouTube', `https://www.youtube.com/@${username}`, (s, t) => s === 200 && t.includes('channel')),
    checkPlatform('TikTok', `https://www.tiktok.com/@${username}`, (s) => s === 200),
    checkPlatform('Twitch', `https://www.twitch.tv/${username}`, (s, t) => s === 200 && !t.includes('Sorry')),
    checkPlatform('Steam', `https://steamcommunity.com/id/${username}`, (s, t) => s === 200 && !t.includes('could not be found')),
    checkPlatform('SoundCloud', `https://soundcloud.com/${username}`, (s) => s === 200),
    checkPlatform('Medium', `https://medium.com/@${username}`, (s) => s === 200),
    checkPlatform('DeviantArt', `https://www.deviantart.com/${username}`, (s) => s === 200),
    checkPlatform('Patreon', `https://www.patreon.com/${username}`, (s) => s === 200),
    checkPlatform('Keybase', `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${username}`, (s, t) => { try { const d = JSON.parse(t); return d.them?.length > 0 && d.them[0].id; } catch { return false; } }),
    checkPlatform('HackerNews', `https://hacker-news.firebaseio.com/v0/user/${username}.json`, (s, t) => { try { return JSON.parse(t) !== null; } catch { return false; } }),
    checkPlatform('GitLab', `https://gitlab.com/api/v4/users?username=${username}`, (s, t) => { try { return JSON.parse(t).length > 0; } catch { return false; } }),
  ]);

  // Generate possible email variations
  const generatedEmails = [];
  const providers = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'protonmail.com', 'icloud.com'];
  const cleanUser = username.replace(/[._+-]/g, '');
  providers.forEach(p => {
    if (p !== domain) {
      generatedEmails.push({ email: `${username}@${p}`, type: 'variation' });
      if (cleanUser !== username) generatedEmails.push({ email: `${cleanUser}@${p}`, type: 'cleaned' });
    }
  });

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    email,
    hudsonrock,
    accounts,
    generatedEmails: generatedEmails.slice(0, 15),
    gravatar: {
      hash: md5,
      sha256: sha256,
      url: `https://www.gravatar.com/avatar/${md5}?d=404&s=500`,
      found: accounts.find(a => a.platform === 'Gravatar')?.found || false
    }
  });
}
