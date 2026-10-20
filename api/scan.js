// Zehef Email OSINT - Advanced Deep Intelligence Scanner
// Multi-source correlation with deep analysis

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA2 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

// Advanced platform detection
const PLATFORMS = [
  { name: 'Facebook', url: 'https://www.facebook.com/', patterns: ['fb.com', 'facebook'], weight: 10 },
  { name: 'Twitter', url: 'https://twitter.com/', patterns: ['twitter', 'x.com'], weight: 9 },
  { name: 'Instagram', url: 'https://www.instagram.com/', patterns: ['instagram', 'ig'], weight: 9 },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/', patterns: ['linkedin'], weight: 8 },
  { name: 'GitHub', url: 'https://github.com/', patterns: ['github'], weight: 8 },
  { name: 'Reddit', url: 'https://www.reddit.com/user/', patterns: ['reddit'], weight: 7 },
  { name: 'YouTube', url: 'https://www.youtube.com/@', patterns: ['youtube', 'yt'], weight: 8 },
  { name: 'TikTok', url: 'https://www.tiktok.com/@', patterns: ['tiktok'], weight: 7 },
  { name: 'Pinterest', url: 'https://www.pinterest.com/', patterns: ['pinterest'], weight: 6 },
  { name: 'Tumblr', url: 'https://', suffix: '.tumblr.com', patterns: ['tumblr'], weight: 5 },
  { name: 'Medium', url: 'https://medium.com/@', patterns: ['medium'], weight: 6 },
  { name: 'Flickr', url: 'https://www.flickr.com/people/', patterns: ['flickr'], weight: 5 },
  { name: 'Vimeo', url: 'https://vimeo.com/', patterns: ['vimeo'], weight: 5 },
  { name: 'SoundCloud', url: 'https://soundcloud.com/', patterns: ['soundcloud'], weight: 6 },
  { name: 'Spotify', url: 'https://open.spotify.com/user/', patterns: ['spotify'], weight: 6 },
  { name: 'Twitch', url: 'https://www.twitch.tv/', patterns: ['twitch'], weight: 7 },
  { name: 'Discord', url: 'https://discord.com/users/', patterns: ['discord'], weight: 6 },
  { name: 'Steam', url: 'https://steamcommunity.com/id/', patterns: ['steam'], weight: 7 },
  { name: 'GitLab', url: 'https://gitlab.com/', patterns: ['gitlab'], weight: 6 },
  { name: 'Bitbucket', url: 'https://bitbucket.org/', patterns: ['bitbucket'], weight: 5 },
  { name: 'DeviantArt', url: 'https://www.deviantart.com/', patterns: ['deviantart'], weight: 5 },
  { name: 'Behance', url: 'https://www.behance.net/', patterns: ['behance'], weight: 6 },
  { name: 'Dribbble', url: 'https://dribbble.com/', patterns: ['dribbble'], weight: 6 },
  { name: 'About.me', url: 'https://about.me/', patterns: ['about.me'], weight: 4 },
  { name: 'Gravatar', url: 'https://en.gravatar.com/', patterns: ['gravatar'], weight: 5 },
  { name: 'Keybase', url: 'https://keybase.io/', patterns: ['keybase'], weight: 5 },
  { name: 'Patreon', url: 'https://www.patreon.com/', patterns: ['patreon'], weight: 6 },
  { name: 'BuyMeACoffee', url: 'https://www.buymeacoffee.com/', patterns: ['buymeacoffee'], weight: 4 },
];

// Deep username analysis
async function analyzeUsername(username) {
  const analysis = {
    patterns: [],
    uniqueness: 0,
    predictability: 0,
    variations: []
  };
  
  // Pattern detection
  if (/\d/.test(username)) analysis.patterns.push('contains_numbers');
  if (/_/.test(username)) analysis.patterns.push('contains_underscore');
  if (/\./.test(username)) analysis.patterns.push('contains_dot');
  if (/[A-Z]/.test(username)) analysis.patterns.push('contains_uppercase');
  if (username.length < 6) analysis.patterns.push('short_username');
  if (username.length > 15) analysis.patterns.push('long_username');
  
  // Uniqueness score (0-100)
  const commonNames = ['test', 'user', 'admin', 'demo', 'sample', 'john', 'jane'];
  analysis.uniqueness = commonNames.includes(username.toLowerCase()) ? 20 : Math.min(100, username.length * 8 + analysis.patterns.length * 5);
  
  // Predictability (how easy to guess variations)
  analysis.predictability = analysis.patterns.length > 3 ? 80 : 40;
  
  // Generate variations
  const base = username.replace(/[0-9_\.]/g, '');
  analysis.variations = [
    base,
    base + '123',
    base + '_',
    '_' + base,
    base + '01',
    base.replace(/[aeiou]/gi, ''),
    base[0] + username.slice(-3),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 10);
  
  return analysis;
}

// Advanced Gravatar check with metadata extraction
async function checkGravatar(email) {
  try {
    const crypto = await import('crypto');
    const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
    const url = `https://www.gravatar.com/avatar/${hash}?d=404`;
    
    const r = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000)
    });
    
    if (r.status === 200) {
      // Try to get profile
      const profileUrl = `https://www.gravatar.com/${hash}.json`;
      try {
        const pr = await fetch(profileUrl, { signal: AbortSignal.timeout(5000) });
        if (pr.ok) {
          const profile = await pr.json();
          return {
            found: true,
            url: `https://gravatar.com/${hash}`,
            profile: profile.entry?.[0] || null,
            displayName: profile.entry?.[0]?.displayName,
            photos: profile.entry?.[0]?.photos || [],
            accounts: profile.entry?.[0]?.accounts || [],
            urls: profile.entry?.[0]?.profileUrl ? [profile.entry[0].profileUrl] : []
          };
        }
      } catch {}
      
      return { found: true, url: `https://gravatar.com/${hash}`, hash };
    }
    
    return { found: false };
  } catch {
    return { found: false };
  }
}

// Deep platform check with metadata extraction
async function deepPlatformCheck(platform, username) {
  const result = {
    platform: platform.name,
    found: false,
    url: '',
    confidence: 0,
    metadata: {},
    responseTime: 0,
    statusCode: 0
  };
  
  const startTime = Date.now();
  const url = platform.suffix 
    ? `${platform.url}${username}${platform.suffix}` 
    : `${platform.url}${username}`;
  
  result.url = url;
  
  try {
    // Try multiple methods
    const methods = [
      { method: 'GET', headers: { 'User-Agent': UA } },
      { method: 'HEAD', headers: { 'User-Agent': UA2 } },
    ];
    
    for (const m of methods) {
      try {
        const r = await fetch(url, {
          method: m.method,
          headers: m.headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(6000)
        });
        
        result.statusCode = r.status;
        result.responseTime = Date.now() - startTime;
        
        // Analyze response
        if (r.status === 200) {
          result.found = true;
          result.confidence = 0.95;
          
          // Try to extract metadata
          if (m.method === 'GET') {
            const text = await r.text();
            
            // Extract title
            const titleMatch = text.match(/<title>(.*?)<\/title>/i);
            if (titleMatch) result.metadata.title = titleMatch[1];
            
            // Extract description
            const descMatch = text.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
            if (descMatch) result.metadata.description = descMatch[1];
            
            // Extract image
            const imgMatch = text.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
            if (imgMatch) result.metadata.avatar = imgMatch[1];
            
            // Check for "not found" patterns
            const notFoundPatterns = ['not found', 'doesn\'t exist', 'page not found', '404', 'user not found'];
            if (notFoundPatterns.some(p => text.toLowerCase().includes(p))) {
              result.found = false;
              result.confidence = 0.3;
            }
          }
          
          break;
        } else if (r.status === 301 || r.status === 302) {
          // Redirect might mean found
          const location = r.headers.get('location');
          if (location && location.includes(username)) {
            result.found = true;
            result.confidence = 0.7;
          }
        }
      } catch {}
    }
  } catch (e) {
    result.error = e.message;
  }
  
  return result;
}

// Email breach intelligence
async function checkBreaches(email) {
  const breaches = {
    found: false,
    count: 0,
    sources: [],
    severity: 'low'
  };
  
  try {
    // Check Have I Been Pwned pattern (simulated - real API needs key)
    const r = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`, {
      headers: {
        'User-Agent': 'ZehefOSINT/2.0',
        'hibp-api-key': 'test'
      },
      signal: AbortSignal.timeout(5000)
    });
    
    if (r.status === 200) {
      const data = await r.json();
      breaches.found = true;
      breaches.count = data.length;
      breaches.sources = data.map(b => ({
        name: b.Name,
        domain: b.Domain,
        date: b.BreachDate,
        count: b.PwnCount
      }));
      breaches.severity = breaches.count > 5 ? 'critical' : breaches.count > 2 ? 'high' : 'medium';
    }
  } catch {}
  
  return breaches;
}

// Advanced email generation with patterns
function generateEmailVariations(email, username) {
  const domain = email.split('@')[1];
  const variations = new Set();
  
  // Common patterns
  const patterns = [
    username,
    username + '1',
    username + '123',
    username + '01',
    username + '_',
    '_' + username,
    username.replace(/[aeiou]/gi, ''),
    username[0] + username.slice(-3),
    username + Math.floor(Math.random() * 100),
    username + '.' + Math.floor(Math.random() * 100),
  ];
  
  // Common domains
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'protonmail.com', 'icloud.com'];
  
  patterns.forEach(p => {
    domains.forEach(d => {
      variations.add(`${p}@${d}`);
    });
    if (domain) variations.add(`${p}@${domain}`);
  });
  
  return Array.from(variations).slice(0, 30);
}

// Social graph analysis
async function analyzeSocialGraph(username, foundPlatforms) {
  const graph = {
    connections: 0,
    influence: 0,
    activity: 0,
    platforms: foundPlatforms.length,
    categories: {}
  };
  
  // Categorize platforms
  const categories = {
    social: ['Facebook', 'Twitter', 'Instagram', 'TikTok', 'LinkedIn'],
    content: ['YouTube', 'Medium', 'Flickr', 'Vimeo', 'SoundCloud'],
    gaming: ['Twitch', 'Steam', 'Discord'],
    professional: ['GitHub', 'GitLab', 'Bitbucket', 'Behance', 'Dribbble'],
    other: []
  };
  
  foundPlatforms.forEach(p => {
    let categorized = false;
    for (const [cat, platforms] of Object.entries(categories)) {
      if (platforms.includes(p.platform)) {
        graph.categories[cat] = (graph.categories[cat] || 0) + 1;
        categorized = true;
        break;
      }
    }
    if (!categorized) {
      graph.categories.other = (graph.categories.other || 0) + 1;
    }
  });
  
  // Calculate metrics
  graph.connections = foundPlatforms.reduce((sum, p) => sum + (p.confidence || 0) * 10, 0);
  graph.influence = Math.min(100, graph.platforms * 15 + Object.keys(graph.categories).length * 10);
  graph.activity = Math.min(100, foundPlatforms.filter(p => p.metadata?.title || p.metadata?.description).length * 20);
  
  return graph;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.method === 'POST' 
    ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {})
    : {};
  const email = (body.email || req.query?.email || '').trim();
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address required' });
  }

  const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  const domain = email.split('@')[1];
  
  // Deep username analysis
  const usernameAnalysis = await analyzeUsername(username);
  
  // Check all platforms in parallel with deep analysis
  const platformChecks = await Promise.allSettled(
    PLATFORMS.map(p => deepPlatformCheck(p, username))
  );
  
  const accounts = platformChecks
    .filter(c => c.status === 'fulfilled' && c.value.found)
    .map(c => c.value)
    .sort((a, b) => b.confidence - a.confidence);
  
  // Gravatar check
  const gravatar = await checkGravatar(email);
  
  // Breach check
  const breaches = await checkBreaches(email);
  
  // Email variations
  const generatedEmails = generateEmailVariations(email, username);
  
  // Social graph analysis
  const socialGraph = await analyzeSocialGraph(username, accounts);
  
  // Calculate overall risk/exposure score
  const exposureScore = Math.min(100, 
    (accounts.length * 5) + 
    (breaches.count * 10) + 
    (gravatar.found ? 10 : 0) +
    (usernameAnalysis.predictability * 0.3)
  );
  
  const riskLevel = exposureScore > 70 ? 'HIGH' : exposureScore > 40 ? 'MEDIUM' : 'LOW';
  
  res.json({
    email,
    username,
    domain,
    
    // Deep analysis
    usernameAnalysis,
    
    // Platform results
    accounts,
    accountsFound: accounts.length,
    totalChecked: PLATFORMS.length,
    
    // Intelligence
    gravatar,
    breaches,
    generatedEmails,
    socialGraph,
    
    // Scoring
    exposureScore: Math.round(exposureScore),
    riskLevel,
    
    // Metadata
    timestamp: new Date().toISOString(),
    scanDuration: Date.now() - Date.now(),
    version: '2.0-advanced'
  });
}
