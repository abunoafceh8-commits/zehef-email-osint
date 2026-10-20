export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { email } = body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const r = await fetch('https://zehef-osint-tool-iylf.arcada.app/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Zehef-Proxy/1.0' },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await r.json();
    return res.json(data);
  } catch (e) {
    // Fallback: basic scan
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const u = email.split('@')[0];
    const accounts = await Promise.all([
      ['GitHub', `https://github.com/${u}`],
      ['Instagram', `https://www.instagram.com/${u}/`],
      ['X (Twitter)', `https://x.com/${u}`],
      ['Reddit', `https://www.reddit.com/user/${u}/about.json`],
      ['Pinterest', `https://www.pinterest.com/${u}/`],
      ['TikTok', `https://www.tiktok.com/@${u}`],
      ['YouTube', `https://www.youtube.com/@${u}`],
      ['Steam', `https://steamcommunity.com/id/${u}`],
      ['Twitch', `https://www.twitch.tv/${u}`],
      ['SoundCloud', `https://soundcloud.com/${u}`],
      ['Medium', `https://medium.com/@${u}`],
      ['Spotify', `https://open.spotify.com/user/${u}`],
      ['Chess.com', `https://api.chess.com/pub/player/${u}`],
      ['GitLab', `https://gitlab.com/api/v4/users?username=${u}`],
      ['HackerNews', `https://hacker-news.firebaseio.com/v0/user/${u}.json`],
      ['DeviantArt', `https://www.deviantart.com/${u}`],
    ].map(async ([name, url]) => {
      try { const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) }); return { platform: name, found: r.status === 200, url }; } catch { return { platform: name, found: false, url }; }
    }));
    
    const providers = ['gmail.com','yahoo.com','hotmail.com','outlook.com','protonmail.com','icloud.com'];
    const d = email.split('@')[1];
    const generatedEmails = providers.filter(p => p !== d).map(p => `${u}@${p}`);
    
    return res.json({
      email,
      hudsonrock: { found: false, message: 'Fallback mode', stealerCount: 0, stealers: [] },
      accounts,
      generatedEmails,
      timestamp: new Date().toISOString()
    });
  }
}
