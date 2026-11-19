/* 推特（X）视频解析：给 App 用的小模块
 * - 解析帖子链接 → 作者/正文/封面 + 若干分辨率选项（含文件大小）
 * - 分辨率靠推特的 mp4 地址规律探测（同一条视频通常有 1080/720/540/360 多份）
 * - 结果缓存 10 分钟，避免同一条反复打接口
 */
const https = require('https');
const netproxy = require('./netproxy');

const CACHE = new Map();
/* 出网代理（梯子）agent：每 60 秒刷新一次，探测到才用 */
let twAgent = null;
(function refreshAgent() {
  netproxy.agent().then((a) => { twAgent = a; }).catch(() => {});
  const t = setTimeout(refreshAgent, 60000);
  if (t.unref) t.unref();
})();
const CACHE_TTL = 10 * 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* 从一段文字或链接里抠出推文 id */
function tweetIdOf(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = /(?:status|statuses)\/(\d{6,25})/i.exec(s) || /^https?:\/\/[^/]+\/\w+\/status\/(\d{6,25})/i.exec(s);
  if (m) return m[1];
  const bare = /^\d{6,25}$/.exec(s);
  return bare ? bare[0] : '';
}

/* 推特 mp4 地址里带着 1280x720 这种段，换掉就能拿到别的清晰度 */
function sizeCandidates(url, width, height) {
  const m = /(\d{2,4})x(\d{2,4})(\/)/.exec(url);
  const out = [];
  const push = (w, h) => {
    if (!w || !h) return;
    if (m) out.push(url.replace(m[0], w + 'x' + h + m[3]));
  };
  if (!m) return [url];
  const portrait = Number(height) > Number(width);
  const ladder = portrait
    ? [[1080, 1920], [720, 1280], [540, 960], [360, 640], [270, 480]]
    : [[1920, 1080], [1280, 720], [960, 540], [640, 360], [480, 270]];
  const key = (w, h) => w + 'x' + h;
  const seen = new Set();
  out.push(url);
  seen.add(key(Number(width) || 0, Number(height) || 0));
  const original = m[0].slice(0, -1);
  seen.add(original);
  ladder.forEach(([w, h]) => {
    if (seen.has(key(w, h))) return;
    seen.add(key(w, h));
    push(w, h);
  });
  return out.filter((u, i) => out.indexOf(u) === i);
}

/* 推特 CDN 在国内直连不通，必须走这台电脑上的梯子（netproxy 自动探测） */
async function headInfo(url) {
  return new Promise((resolve) => {
    let u = null;
    try { u = new URL(url); } catch (e) { return resolve(null); }
    const agent = twAgent;
    const req = https.request(u, {
      method: 'HEAD',
      agent: agent || undefined,
      headers: { 'User-Agent': UA, Referer: 'https://x.com/', Accept: '*/*' }
    }, (r) => {
      const len = Number(r.headers['content-length'] || 0);
      const ct = String(r.headers['content-type'] || '');
      r.resume();
      if (!(r.statusCode >= 200 && r.statusCode < 400) || !/video|octet-stream/i.test(ct)) return resolve(null);
      resolve({ bytes: len, mime: ct.split(';')[0] });
    });
    req.setTimeout(9000, () => { try { req.destroy(); } catch (e) { /* ignore */ } });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function probeSizes(url, width, height) {
  const list = sizeCandidates(url, width, height);
  const results = await Promise.all(list.map(async (u) => ({ url: u, info: await headInfo(u) })));
  const ok = results.filter((x) => x.info && x.info.bytes > 0);
  if (!ok.length) return [{ url, bytes: 0, mime: 'video/mp4', width: Number(width) || 0, height: Number(height) || 0 }];
  return ok.map((x) => {
    const m = /(\d{2,4})x(\d{2,4})\//.exec(x.url);
    return {
      url: x.url,
      bytes: x.info.bytes,
      mime: x.info.mime || 'video/mp4',
      width: m ? Number(m[1]) : Number(width) || 0,
      height: m ? Number(m[2]) : Number(height) || 0
    };
  });
}

function humanQuality(w, h) {
  const shortSide = Math.min(Number(w) || 0, Number(h) || 0);
  if (!shortSide) return '原画';
  if (shortSide >= 1080) return '1080p';
  if (shortSide >= 720) return '720p';
  if (shortSide >= 540) return '540p';
  if (shortSide >= 480) return '480p';
  if (shortSide >= 360) return '360p';
  return shortSide + 'p';
}

/* 只信任 fxtwitter 这一个上游（其它公共镜像常被 Cloudflare 拦） */
async function fetchTweet(id, fetchImpl) {
  const f = fetchImpl || fetch;
  const r = await f('https://api.fxtwitter.com/i/status/' + id, {
    headers: { 'User-Agent': UA, Accept: 'application/json' }
  });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { body = null; }
  if (!r.ok || !body || !body.tweet) {
    const why = (body && body.message) || ('上游返回 ' + r.status);
    throw new Error(why === 'NOT_FOUND' || r.status === 404 ? '这条推文不存在或已删除' : '解析失败：' + why);
  }
  return body.tweet;
}

async function resolve(input, opts) {
  const id = tweetIdOf(input);
  if (!id) throw new Error('没找到推文链接，请复制 x.com 或 twitter.com 的帖子链接');
  const now = Date.now();
  const hit = CACHE.get(id);
  if (!opts || !opts.noCache) {
    if (hit && now - hit.at < CACHE_TTL) return hit.data;
  }
  const tweet = await fetchTweet(id, opts && opts.fetch);
  const media = (tweet && tweet.media) || {};
  const videos = [].concat(media.videos || [], (media.all || []).filter((m) => m && (m.type === 'video' || m.type === 'gif')));
  const uniq = [];
  videos.forEach((v) => {
    if (!v || !v.url) return;
    if (uniq.some((x) => x.url === v.url)) return;
    uniq.push(v);
  });
  if (!uniq.length) throw new Error('这条推文里没有视频');

  const groups = [];
  for (let i = 0; i < uniq.length; i++) {
    const v = uniq[i];
    const opts2 = await probeSizes(v.url, v.width, v.height);
    opts2.sort((a, b) => (b.height * b.width) - (a.height * a.width));
    const options = opts2.map((o) => ({
      label: humanQuality(o.width, o.height),
      size: o.width + '×' + o.height,
      bytes: o.bytes,
      mime: o.mime,
      url: o.url
    }));
    groups.push({
      index: i + 1,
      total: uniq.length,
      poster: v.thumbnail_url || '',
      duration: Number(v.duration) || 0,
      width: Number(v.width) || 0,
      height: Number(v.height) || 0,
      options
    });
  }

  const author = (tweet && tweet.author) || {};
  const data = {
    id: id,
    url: (tweet && tweet.url) || ('https://x.com/i/status/' + id),
    text: String((tweet && tweet.text) || '').slice(0, 600),
    createdAt: (tweet && tweet.created_at) || '',
    author: {
      name: author.name || '',
      handle: author.screen_name || '',
      avatar: author.avatar_url || ''
    },
    groups: groups
  };
  CACHE.set(id, { at: now, data: data });
  if (CACHE.size > 200) {
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
  return data;
}

module.exports = { tweetIdOf, resolve, sizeCandidates, humanQuality };
