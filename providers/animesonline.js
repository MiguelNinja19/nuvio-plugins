const BASE = 'https://animesonline.io';
// Add only verified aliases and explicit season-to-absolute mappings.
const anime = {
  '37854': { title: 'One Piece Dublado', slug: 'one-piece-dublado-online', episodes: { '1:1': { absolute: 1, path: '/5831/' } } }
};
const aliases = { tt0388629: '37854' };
function decode(s) {
  return s.replace(/&(amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (raw, key) => {
    const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
    key = key.toLowerCase();
    if (named[key]) return named[key];
    const n = key[1] === 'x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw;
  });
}
function attr(tag, name) {
  const m = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i').exec(tag);
  return m ? decode(m[1] || m[2] || m[3] || '') : '';
}
function normalize(s) {
  return decode(s.replace(/<[^>]*>/g,' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function sitePath(link, pattern) {
  const path = link.replace(/^https:\/\/animesonline\.io(?=\/)/i,'');
  return pattern.test(path) ? path.replace(/\/?$/, '/') : '';
}
function links(html) {
  return Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi), m => ({href:attr(m[1], 'href'), label:normalize(m[2]), title:normalize(attr(m[1], 'title'))}));
}
async function page(path, origin = BASE) {
  try {
    const response = await fetch(origin + path, {redirect:'error'});
    return response.ok ? await response.text() : '';
  } catch (_) { return ''; }
}
function sources(html, origin = BASE) {
  const result = [];
  for (const video of html.matchAll(/<video\b[^>]*>[\s\S]*?<\/video\s*>/gi)) {
    for (const tag of video[0].matchAll(/<(?:video|source)\b[^>]*>/gi)) {
      const raw = attr(tag[0],'src').trim();
      const url = /^\/(?!\/)/.test(raw) ? origin + raw : raw;
      if (!/^https:\/\/[a-z0-9.-]+(?::443)?\/[^\s\\<>]*$/i.test(url)) continue;
      const expiry = /[?&]expire=(\d+)(?=&|#|$)/.exec(url);
      if (expiry && Number(expiry[1]) * 1000 <= Date.now() + 15000) continue;
      const mime = attr(tag[0],'type').toLowerCase().split(';')[0].trim();
      const googleMp4 = /^https:\/\/(?:redirector|rr\d+---[a-z0-9-]+)\.googlevideo\.com\/videoplayback\?/i.test(url) && /[?&]mime=video(?:\/|%2f)mp4(?:&|#|$)/i.test(url);
      if (!googleMp4 && !/\.(?:mp4|m3u8)(?:[?#]|$)/i.test(url) && !['video/mp4','application/vnd.apple.mpegurl','application/x-mpegurl'].includes(mime)) continue;
      if (!result.some(stream => stream.url === url)) result.push({url, name:'Animes Online', title:'Dublado · PT-BR', language:'pt-BR'});
    }
  }
  return result;
}
const PLAYER = 'https://anidrive.click';
function playerPaths(html) {
  const paths = [];
  function add(value) {
    if (typeof value !== 'string') return;
    const m = /^https:\/\/anidrive\.click(\/token\/[a-zA-Z0-9_-]{1,128}\/?(?:\?prime)?)$/.exec(value.trim());
    if (m && !paths.includes(m[1])) paths.push(m[1]);
  }
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attr(m[1], 'type').toLowerCase() !== 'application/ld+json') continue;
    try {
      const doc = JSON.parse(m[2]);
      const nodes = doc['@graph'] || [doc];
      for (const node of nodes) if (node && node['@type'] === 'VideoObject') add(node.embedUrl);
    } catch (_) {}
  }
  const body = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  for (const frame of body.matchAll(/<iframe\b[^>]*>/gi)) {
    add(attr(frame[0], 'src'));
    add(attr(frame[0], 'data-src'));
  }
  return paths.slice(0, 3);
}
function unpackPlayer(html) {
  const decoded = [];
  for (const m of html.matchAll(/\b_[a-f\d]+\(\s*(\[\s*"[A-Za-z0-9+/=]+"(?:\s*,\s*"[A-Za-z0-9+/=]+")*\s*\])\s*,\s*(\[\s*\d+(?:\s*,\s*\d+)*\s*\])\s*,\s*"([A-Za-z0-9+/=]+)"\s*\)/gi)) {
    if (decoded.length >= 4 || m[0].length > 300000) break;
    try {
      const chunks = JSON.parse(m[1]), order = JSON.parse(m[2]);
      if (chunks.length !== order.length || new Set(order).size !== chunks.length || order.some(i => i < 0 || i >= chunks.length)) continue;
      const key = atob(m[3]), bytes = atob(order.map(i => chunks[i]).join(''));
      if (!key.length) continue;
      decoded.push(Array.from(bytes, (byte,i) => String.fromCharCode(byte.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join(''));
    } catch (_) {}
  }
  return decoded;
}
function embeddedSources(html, embedPath, episode) {
  const title = /<title\b[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] || '';
  if (!new RegExp('^one piece dublado (?:episodio )?0*' + episode + '$').test(normalize(title))) return [];
  const items = [];
  for (const text of unpackPlayer(html)) {
    // Only explicit source arrays; ignore arbitrary URLs, download controls and scripts.
    for (const m of text.matchAll(/(?:["']sources["']|\bsources)\s*:\s*(\[[^\[\]]{1,14000}\])/g)) {
      try { const list = JSON.parse(m[1]); items.push(...list.slice(0,16)); } catch (_) {}
    }
  }
  return jsonSources(JSON.stringify({ok:true,slug:embedPath.split(/[/?]/)[2],title,sources:items}), embedPath, episode);
}
// Accept only a literal endpoint issued in the current embed document.
function dataPath(html, embedPath) {
  const base = embedPath.split('?')[0];
  for (const m of html.matchAll(/["']((?:https:\/\/anidrive\.click)?\/token\/[a-zA-Z0-9_-]+\/?\?[^"'<>\s]+)["']/g)) {
    const path = decode(m[1]).replace(PLAYER, '');
    if (path.split('?')[0] === base && /[?&]player_data=1(?:&|$)/.test(path) && /[?&]player_data_token=[a-f0-9]{64}(?:&|$)/i.test(path)) return path;
  }
  return '';
}
function jsonSources(text, embedPath, episode) {
  try {
    const data = JSON.parse(text);
    if (data.ok !== true || data.slug !== embedPath.split(/[/?]/)[2] || !Array.isArray(data.sources)) return [];
    if (typeof data.title !== 'string' || !new RegExp('^one piece dublado (?:episodio )?0*' + episode + '$').test(normalize(data.title))) return [];
    const result = [];
    for (const item of data.sources.slice(0, 16)) {
      if (!item || item.type !== 'video/mp4' || typeof item.file !== 'string') continue;
      const url = item.file;
      if (!/^https:\/\/(?:redirector|rr\d+---[a-z0-9-]+)\.googlevideo\.com\/videoplayback\?[^\s\\<>"']+$/i.test(url)) continue;
      const expiry = /[?&]expire=(\d+)(?:&|$)/.exec(url);
      if (!expiry || Number(expiry[1]) * 1000 <= Date.now() + 15000 || result.some(s => s.url === url)) continue;
      const quality = typeof item.label === 'string' && /^\d{3,4}p$/.test(item.label) ? ' · ' + item.label : '';
      result.push({url, name:'Animes Online', title:'Dublado · PT-BR' + quality, language:'pt-BR'});
    }
    return result;
  } catch (_) { return []; }
}
async function getStreams(contentId, mediaType, season, episode) {
  try {
    if (mediaType !== 'tv' && mediaType !== 'series') return [];
    const id = String(contentId).replace(/^(?:tmdb|imdb):/i,'');
    const entry = anime[aliases[id] || id];
    if (!entry || !entry.episodes) return [];
    const target = entry.episodes[`${Number(season)}:${Number(episode)}`];
    if (!target) return [];
    // ?s= is declared by the form and SearchAction in the saved HTML.
    const listing = await page('/?s=' + encodeURIComponent(entry.title));
    const title = normalize(entry.title);
    const known = '/anime/' + entry.slug + '/';
    const series = links(listing).find(a => sitePath(a.href, /^\/anime\/[a-z0-9-]+\/?$/i) === known && [a.label,a.title].includes(title));
    const detail = await page(series ? sitePath(series.href, /^\/anime\/[a-z0-9-]+\/?$/i) : known);
    const episodeMatch = links(detail).find(a => /^\/\d+\/$/.test(sitePath(a.href, /^\/\d+\/?$/)) && [a.label,a.title].some(label => new RegExp('^' + title + ' (?:episodio )?0*' + target.absolute + '$').test(label)));
    const path = episodeMatch ? sitePath(episodeMatch.href, /^\/\d+\/?$/) : target.path;
    if (!path) return [];
    const html = await page(path);
    const result = sources(html);
    for (const embedPath of playerPaths(html)) {
      const embed = await page(embedPath, PLAYER);
      const endpoint = dataPath(embed, embedPath);
      const streams = [...sources(embed, PLAYER), ...embeddedSources(embed, embedPath, target.absolute)];
      if (endpoint) streams.push(...jsonSources(await page(endpoint, PLAYER), embedPath, target.absolute));
      for (const stream of streams) {
        if (!result.some(item => item.url === stream.url)) result.push(stream);
      }
    }
    return result;
  } catch (_) { return []; }
}
if (typeof module !== 'undefined' && module.exports) module.exports = {getStreams, playerPaths, dataPath, jsonSources, embeddedSources};
else globalThis.getStreams = getStreams;
