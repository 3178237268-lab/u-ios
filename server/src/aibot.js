'use strict';

/* ---------------- 人机内容生成（接入 AI API） ----------------
   兼容 OpenAI 的 /chat/completions 协议：只要 base 填到 /v1 这一级，
   任何兼容实现（DeepSeek、通义、月之暗面、Ollama、vLLM、one-api 代理…）都能用。
   没有配置 Key 或调用失败时，一律回落到 server.js 里的本地语料，功能不中断。 */

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');
const fs = require('node:fs');

/* ---------------- token 用量统计 ----------------
   AI 每次调用都会把服务端返回的 usage（prompt/completion tokens）记下来，
   按「今天 / 最近 7 天 / 累计 / 按模型 / 按动作」统计，存到 data/ai-usage.json，
   管理台据此显示消耗了多少 token、按单价折算多少钱。 */
let usageFile = '';
const USAGE = { total: { req: 0, prompt: 0, completion: 0 }, days: {}, models: {}, kinds: {} };
const LAST = { model: '', prompt: 0, completion: 0, total: 0, at: 0, ok: true };

function dayKey(ts) {
  const d = new Date(ts || Date.now());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function setUsageFile(p) {
  usageFile = String(p || '');
  if (!usageFile) return;
  try {
    const raw = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    if (raw && raw.total) {
      USAGE.total = raw.total;
      USAGE.days = raw.days || {};
      USAGE.models = raw.models || {};
      USAGE.kinds = raw.kinds || {};
    }
  } catch (e) {
    /* 首次运行没有文件，忽略 */
  }
}

function saveUsage() {
  if (!usageFile) return;
  try {
    fs.writeFileSync(usageFile, JSON.stringify(USAGE));
  } catch (e) {
    /* 写不进去也不影响生成 */
  }
}

function plus(box, prompt, completion) {
  box.req = (box.req || 0) + 1;
  box.prompt = (box.prompt || 0) + prompt;
  box.completion = (box.completion || 0) + completion;
}

function recordUsage(model, prompt, completion, kind) {
  const p = Math.max(0, Math.round(prompt || 0));
  const c = Math.max(0, Math.round(completion || 0));
  const key = dayKey();
  plus(USAGE.total, p, c);
  if (!USAGE.days[key]) USAGE.days[key] = { req: 0, prompt: 0, completion: 0 };
  plus(USAGE.days[key], p, c);
  const m = String(model || '未命名模型');
  if (!USAGE.models[m]) USAGE.models[m] = { req: 0, prompt: 0, completion: 0 };
  plus(USAGE.models[m], p, c);
  const k = String(kind || 'chat');
  if (!USAGE.kinds[k]) USAGE.kinds[k] = { req: 0, prompt: 0, completion: 0 };
  plus(USAGE.kinds[k], p, c);
  LAST.model = m;
  LAST.prompt = p;
  LAST.completion = c;
  LAST.total = p + c;
  LAST.at = Date.now();
  LAST.ok = true;
  const keys = Object.keys(USAGE.days).sort();
  while (keys.length > 60) delete USAGE.days[keys.shift()];
  saveUsage();
}

/* 服务商没回 usage 时按字数粗估（中文约 1.6 字/token） */
function estimateTokens(text) {
  return Math.max(1, Math.round(String(text || '').length / 1.6));
}

function usageStats(prices) {
  const pr = prices || {};
  const pin = Number(pr.in) || 0;
  const pout = Number(pr.out) || 0;
  const cost = function (b) {
    return (b.prompt || 0) / 1e6 * pin + (b.completion || 0) / 1e6 * pout;
  };
  const today = USAGE.days[dayKey()] || { req: 0, prompt: 0, completion: 0 };
  const days = Object.keys(USAGE.days).sort().reverse().slice(0, 7).map(function (d) {
    const b = USAGE.days[d];
    return { day: d, req: b.req || 0, prompt: b.prompt || 0, completion: b.completion || 0, cost: cost(b) };
  });
  const models = Object.keys(USAGE.models).map(function (m) {
    const b = USAGE.models[m];
    return { model: m, req: b.req || 0, prompt: b.prompt || 0, completion: b.completion || 0, cost: cost(b) };
  }).sort(function (a, b) {
    return (b.prompt + b.completion) - (a.prompt + a.completion);
  });
  const kinds = Object.keys(USAGE.kinds).map(function (k) {
    const b = USAGE.kinds[k];
    return { kind: k, req: b.req || 0, prompt: b.prompt || 0, completion: b.completion || 0 };
  });
  return {
    prices: { in: pin, out: pout },
    today: Object.assign({ day: dayKey() }, today, { cost: cost(today) }),
    total: Object.assign({}, USAGE.total, { cost: cost(USAGE.total) }),
    days: days,
    models: models,
    kinds: kinds,
    last: LAST
  };
}

function resetUsage() {
  USAGE.total = { req: 0, prompt: 0, completion: 0 };
  USAGE.days = {};
  USAGE.models = {};
  USAGE.kinds = {};
  LAST.prompt = 0;
  LAST.completion = 0;
  LAST.total = 0;
  LAST.at = 0;
  saveUsage();
  return usageStats();
}

/* 人设池：让每个账号有固定的身份、城市、兴趣，写出来的东西才不像同一个人 */
const PERSONAS = [
  { job: '上班族', city: '杭州', likes: ['通勤', '咖啡', '加班后的夜宵', '周末补觉'] },
  { job: '便利店店员', city: '成都', likes: ['夜班', '煮面', '听播客', '养猫'] },
  { job: '自由摄影师', city: '厦门', likes: ['扫街', '海边', '老相机', '手冲咖啡'] },
  { job: '大学生', city: '武汉', likes: ['图书馆', '篮球', '宿舍做饭', '追剧'] },
  { job: '幼儿园老师', city: '南京', likes: ['手作', '烘焙', '小朋友的日常', '逛公园'] },
  { job: '程序员', city: '深圳', likes: ['改 bug', '爬山', '机械键盘', '外卖'] },
  { job: '外卖骑手', city: '广州', likes: ['城市街角', '雨天', '听歌', '挣够早点回家'] },
  { job: '会计', city: '苏州', likes: ['记账', '绣花', '逛菜场', '整理房间'] },
  { job: '护士', city: '长沙', likes: ['值夜班', '辣味小吃', '跑步', '护肤'] },
  { job: '花店店主', city: '昆明', likes: ['鲜切花', '插花', '晒太阳', '熟客'] },
  { job: '退休教师', city: '青岛', likes: ['散步', '写字', '听戏', '种菜'] },
  { job: '设计师', city: '上海', likes: ['看展', '配色', '骑车', '小馆子'] },
  { job: '快递站老板', city: '郑州', likes: ['搬货', '邻里', '喝茶', '早市'] },
  { job: '厨师', city: '重庆', likes: ['炒菜', '试新调料', '早班', '火锅'] },
  { job: '宝妈', city: '合肥', likes: ['带娃', '做辅食', '散步', '追综艺'] },
  { job: '地铁司机', city: '西安', likes: ['早起', '城墙', '面食', '听相声'] }
];

const TONES = ['说话简短、像随手记一笔', '爱用口语和语气词', '偏理性、偶尔自嘲', '情绪不太外露，只讲事实', '有点幽默，但不油'];

function hashOf(text) {
  let h = 2166136261;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/* 同一个人设始终同一个人：按账号名散列取，不会今天杭州明天成都 */
function personaFor(user) {
  const key = (user && (user.username || user.id)) || 'bot';
  const p = PERSONAS[hashOf(key) % PERSONAS.length];
  const tone = TONES[hashOf(key + 'tone') % TONES.length];
  return {
    job: p.job,
    city: p.city,
    likes: p.likes.slice(),
    tone,
    text: '在' + p.city + '的' + p.job + '，平时喜欢' + p.likes.join('、') + '；说话风格：' + tone
  };
}

/* 去重窗口：最近写过的句子不再复用，避免一眼看出复制粘贴 */
const RECENT_TEXTS = [];
const RECENT_MAX = 400;

function remember(text) {
  RECENT_TEXTS.push(text);
  if (RECENT_TEXTS.length > RECENT_MAX) RECENT_TEXTS.shift();
}

function clean(text) {
  let s = String(text || '').trim();
  /* 模型偶尔会自带引号、前缀、markdown */
  s = s.replace(/^[\s"'“”‘’]+/, '').replace(/[\s"'“”‘’]+$/, '');
  s = s.replace(/^(正文|内容|回答|输出)[:：]\s*/, '');
  s = s.replace(/[*_#>`]+/g, '');
  s = s.replace(/\s*\n+\s*/g, ' ');
  s = s.replace(/\s{2,}/g, ' ');
  return s.slice(0, 200).trim();
}

/* 相似度：不同账号写出来的句子必须不能撞车。
   两个指标取大：字符二元组重合率（Jaccard）+ 最长公共片段占短句的比例。
   中文没有空格，二元组对「老板多给我卧了个蛋」这种整段照抄非常敏感。 */
function normText(text) {
  return String(text || '').replace(/[\s，。！？、～~…,.!?"'“”‘’：:；;（）()【】\[\]《》<>—\-]+/g, '');
}

function bigramSet(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  return set;
}

function jaccardOf(a, b) {
  if (!a.size || !b.size) return 0;
  let same = 0;
  a.forEach(function (x) { if (b.has(x)) same += 1; });
  return same / (a.size + b.size - same);
}

/* 最长公共子串长度（句子都只有几十字，直接双层扫描） */
function lcsLen(a, b) {
  if (!a || !b) return 0;
  let best = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const keep = prev[j];
      if (a[i - 1] === b[j - 1]) {
        prev[j] = diag + 1;
        if (prev[j] > best) best = prev[j];
      } else {
        prev[j] = 0;
      }
      diag = keep;
    }
  }
  return best;
}

function similarity(a, b) {
  const x = normText(a);
  const y = normText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const jac = jaccardOf(bigramSet(x), bigramSet(y));
  const lcs = lcsLen(x, y) / Math.min(x.length, y.length);
  return Math.max(jac, lcs);
}

/* 撞车判定线：二元组重合 42%（评论用），发帖更严 30% 或者有 8 个字连续一样就算撞 */
const SIMILAR_GATE = 0.42;
const POST_GATE = 0.3;
const POST_LCS = 8;

function tooSimilar(text, list, gate, lcsMin) {
  const s = String(text || '').trim();
  const g = Number.isFinite(Number(gate)) ? Number(gate) : SIMILAR_GATE;
  const lmin = Number.isFinite(Number(lcsMin)) ? Number(lcsMin) : 0;
  if (!s || !Array.isArray(list) || !list.length) return { hit: false, score: 0, lcs: 0, with: '' };
  let best = 0;
  let bestLcs = 0;
  let withText = '';
  for (let i = 0; i < list.length; i += 1) {
    const other = String(list[i] || '');
    if (!other) continue;
    const sc = similarity(s, other);
    const nx = normText(s);
    const ny = normText(other);
    const lc = lcsLen(nx, ny);
    if (sc > best) { best = sc; withText = other; }
    if (lc > bestLcs) { bestLcs = lc; if (sc <= best) withText = withText || other; }
  }
  const hit = best >= g || (lmin > 0 && bestLcs >= lmin);
  return { hit: hit, score: Math.round(best * 100) / 100, lcs: bestLcs, with: withText };
}

function uniqueText(text, extra) {
  const s = clean(text);
  if (!s) return '';
  if (RECENT_TEXTS.indexOf(s) >= 0) return '';
  const pool = Array.isArray(extra) ? RECENT_TEXTS.concat(extra) : RECENT_TEXTS;
  const hit = tooSimilar(s, pool);
  if (hit.hit) return '';
  return s;
}

/* ---------------- HTTP ---------------- */

function endpointOf(base) {
  let b = String(base || '').trim().replace(/\/+$/, '');
  if (!b) throw new Error('还没有填写 AI 接口地址');
  if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
  let host = '';
  try {
    host = new URL(b).hostname;
  } catch (e) {
    throw new Error('接口地址不是网址，应形如 https://api.deepseek.com/v1');
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(host)) {
    throw new Error('接口地址填成了账号 ID / Tracking ID（' + host + '），这里要填服务商地址，例如 https://api.deepseek.com/v1');
  }
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host) || /^\[[0-9a-f:]+\]$/i.test(host);
  if (!isIp && host !== 'localhost' && host.indexOf('.') < 0) {
    throw new Error('接口地址不是完整域名（' + host + '），应形如 https://api.deepseek.com/v1');
  }
  if (/\/chat\/completions$/i.test(b)) return b;
  return b + '/chat/completions';
}

function postJson(urlStr, headers, bodyStr, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      reject(new Error('接口地址不合法'));
      return;
    }
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: Object.assign(
          {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr),
            Accept: 'application/json'
          },
          headers || {}
        )
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error('API Key 不对或没有权限（HTTP ' + res.statusCode + '），请到服务商后台重新复制 Key'));
            return;
          }
          if (res.statusCode === 404) {
            reject(new Error('接口地址不对（HTTP 404），确认 Base URL 形如 https://api.deepseek.com/v1'));
            return;
          }
          if (res.statusCode === 429) {
            reject(new Error('请求太频繁或额度不足（HTTP 429），稍后再试或检查账户余额'));
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            if (/image|vision|multimodal|image_url|content type/i.test(text) && res.statusCode >= 400) {
              reject(new Error('当前模型看不了图（HTTP ' + res.statusCode + '）。到「AI 能力与模型 → 看图的模型名」填一个支持图片的模型，例如 qwen-vl-max / gpt-4o-mini / glm-4v-flash / gemini-1.5-flash'));
              return;
            }
            reject(new Error('HTTP ' + res.statusCode + ' ' + text.slice(0, 200)));
            return;
          }
          resolve(text);
        });
      }
    );
    req.setTimeout(timeoutMs || 25000, () => {
      req.destroy(new Error('AI 接口超时'));
    });
    req.on('error', (e) => {
      const code = e && e.code;
      if (code === 'ENOTFOUND') return reject(new Error('找不到域名 ' + u.hostname + '，接口地址可能填错了（应形如 https://api.deepseek.com/v1）'));
      if (code === 'ECONNREFUSED') return reject(new Error('连不上 ' + u.hostname + (u.port ? ':' + u.port : '') + '，服务没开或被网络拦截'));
      if (code === 'ETIMEDOUT' || /timeout/i.test(String((e && e.message) || ''))) return reject(new Error('AI 接口超时'));
      if (code === 'EPROTO' || code === 'CERT_HAS_EXPIRED' || /SSL|TLS|certificate/i.test(String((e && e.message) || ''))) {
        return reject(new Error('和 ' + u.hostname + ' 建立 HTTPS 连接失败，域名可能写错了（应形如 https://api.deepseek.com/v1）'));
      }
      reject(e);
    });
    req.write(bodyStr);
    req.end();
  });
}

function cfgOf(cfg) {
  const c = cfg || {};
  return {
    base: c.base || '',
    key: c.key || '',
    model: c.model || '',
    temp: Number.isFinite(Number(c.temp)) ? Number(c.temp) : 90,
    hint: c.hint || '',
    enabled: c.enabled !== false && !!String(c.base || '').trim()
  };
}

async function chat(cfg, messages, opts) {
  const c = cfgOf(cfg);
  if (!String(c.base || '').trim()) throw new Error('还没有填写 AI 接口地址');
  const ep = endpointOf(c.base);
  if (!c.key) throw new Error('还没有填写 API Key（sk- 开头，在服务商后台创建）');
  if (!c.model) throw new Error('还没有填写模型名');
  let msgs = messages;
  const imgs = (opts && opts.images) || [];
  if (imgs.length) {
    /* 把最后一轮用户消息换成「文字 + 图片」的多模态结构（OpenAI / DeepSeek-VL / Qwen-VL 通用） */
    msgs = messages.map(function (m, i) {
      if (i !== messages.length - 1 || m.role !== 'user') return m;
      const parts = [{ type: 'text', text: String(m.content || '') }];
      imgs.slice(0, 4).forEach(function (u) {
        if (u) parts.push({ type: 'image_url', image_url: { url: String(u) } });
      });
      return { role: 'user', content: parts };
    });
  }
  const body = JSON.stringify({
    model: c.model,
    messages: msgs,
    temperature: Math.min(2, Math.max(0, (opts && opts.temp != null ? Number(opts.temp) : c.temp) / 100)),
    max_tokens: (opts && opts.maxTokens) || 160,
    stream: false
  });
  const raw = await postJson(
    ep,
    { Authorization: 'Bearer ' + c.key },
    body,
    (opts && opts.timeout) || 25000
  );
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('AI 返回的不是 JSON：' + raw.slice(0, 120));
  }
  const pick = data && data.choices && data.choices[0];
  const content =
    (pick && pick.message && (pick.message.content || pick.message.reasoning_content)) ||
    (pick && pick.text) ||
    (data && data.output && data.output.text) ||
    '';
  const text = Array.isArray(content) ? content.map((x) => (x && x.text) || '').join(' ') : content;
  if (!String(text || '').trim()) throw new Error('AI 返回空内容');
  const u = (data && data.usage) || {};
  const pTok = Number(u.prompt_tokens != null ? u.prompt_tokens : u.input_tokens);
  const cTok = Number(u.completion_tokens != null ? u.completion_tokens : u.output_tokens);
  const promptTokens = Number.isFinite(pTok) && pTok > 0 ? pTok : estimateTokens(JSON.stringify(msgs));
  const completionTokens = Number.isFinite(cTok) && cTok > 0 ? cTok : estimateTokens(text);
  recordUsage(c.model, promptTokens, completionTokens, (opts && opts.kind) || 'chat');
  return clean(text);
}

/* ---------------- 提示词 ---------------- */

const SYS = '你是一个中文社交 App 里的普通用户，不是客服、不是营销号、不是 AI 助手。' +
  '写出来的内容必须像真人随手发的一样：口语、具体、有生活细节，长度短，不要标题、不要分点、不要表情堆砌（最多一个），' +
  '不要提到 AI、模型、机器人、助手、算法，不要带任何链接、话题标签或广告，也不要复述别人原话。只输出正文，不要加引号。';

/* 素质分 0-100：越低越没素质（粗话、抬杠、阴阳怪气），越高越客气 */
function mannerLine(persona) {
  const raw = persona && persona.manner;
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(Number(raw))) return '';
  const v = Math.min(100, Math.max(0, Math.round(Number(raw))));
  let desc;
  if (v <= 15) desc = '基本没素质，张口就骂人、带脏字和口头禅，看谁都想怼两句，语气冲、爱用脏话发泄';
  else if (v <= 35) desc = '素质偏低，说话冲，爱嘲讽抬杠，时不时冒脏字，常用“无语”“服了”“什么玩意”“呵呵”这类口气';
  else if (v <= 55) desc = '素质一般，就是普通网友的口气，不算客气也不故意冒犯';
  else if (v <= 75) desc = '素质还可以，说话客气，会讲道理，偶尔自嘲';
  else desc = '素质很高，礼貌周到，措辞讲究，几乎不冒犯别人';
  return '素质分 ' + v + '/100：' + desc + '。';
}

/* 每次强制换一个写作角度：不同账号同时发帖时，场景不会撞在一起 */
const POST_ANGLES = [
  '早晨起床后的一件小事', '路上遇到的一个陌生人', '天气带来的变化和感受',
  '做饭 / 吃饭时的一个细节', '收拾屋子或修东西的过程', '和家人 / 邻居 / 同事的一句对话',
  '养的花草或宠物今天的样子', '排队 / 等车时的观察', '工作里一个小坎和它的解决',
  '买到的一样便宜好用的小东西', '听到的一段声音或一首歌', '算账 / 省钱的一笔小开销',
  '深夜还没睡时想的事', '运动 / 走路之后的感受', '一件旧物翻出来的回忆',
  '计划中的一件小事还没做成', '被人帮了一下，或者帮了别人', '一次失败但不算糟的尝试',
  '一顿特别的宵夜', '窗外的景色和光线', '手机里翻到的老照片', '下雨 / 下雪 / 起风的时刻',
  '在超市或菜市场看到的价格', '一件让人会心一笑的糗事'
];

function postMessages(cfg, persona, recent, avoid) {
  const refs = (recent || []).filter(Boolean).slice(0, 6);
  const bad = (avoid || []).filter(Boolean).slice(0, 8);
  const angle = POST_ANGLES[Math.floor(Math.random() * POST_ANGLES.length)];
  return [
    { role: 'system', content: SYS },
    {
      role: 'user',
      content:
        '你的人设：' + persona.text + '。' + mannerLine(persona) + (cfg.hint ? '额外风格要求：' + cfg.hint + '。' : '') +
        '请写一条 20-60 字的生活动态，第一人称，只写这一件事：「' + angle + '」，要有具体的细节（东西、数量、声音、光线、味道、别人的话），再带一点自己的感受。' +
        (refs.length ? '最近大家在聊：' + refs.join(' / ') + '（只用来感受气氛，不要照着写、不要评论别人）。' : '') +
        (bad.length
          ? '下面是这个站里刚发过的内容，新写的这条绝对不能跟它们像：不要用相同的开头、相同的句式、相同的事件，也不要照抄其中任何一句话或短语（比如某句里的“老板多给我卧了个蛋”“这年头也就这点小温暖”这类说法都不许再用）：\n- ' +
            bad.join('\n- ') +
            '\n必须换一个完全不同的场景、时间、人物和细节。'
          : '')
    }
  ];
}

function commentMessages(cfg, persona, ctx) {
  return [
    { role: 'system', content: SYS },
    {
      role: 'user',
      content:
        '你的人设：' + persona.text + '。' + mannerLine(persona) + (cfg.hint ? '额外风格要求：' + cfg.hint + '。' : '') +
        '帖子内容：「' + String((ctx && ctx.postText) || '').slice(0, 200) + '」。' +
        (((ctx && ctx.images) || []).length
          ? '帖子里还有图片 / 视频，已经一并发给你了：先用眼睛看，认出画面里具体是什么（人、动物、景物、食物、文字、动作），' +
            '评论时带出一个真实看到的细节（例如“这云压得好低”“猫窝在键盘上”“这个角度显腿长”），再顺着它说自己的感受；' +
            '不要写“好看”“不错”“好美”这种放哪都行的空话，也不要像念说明书一样把画面描述一遍。'
          : '') +
        '请写一句 10-30 字的评论：像熟人聊天，顺着内容接一句自己的经历或感受，不要复读原帖，不要问“这是什么”。'
    }
  ];
}

function replyMessages(cfg, persona, ctx) {
  return [
    { role: 'system', content: SYS },
    {
      role: 'user',
      content:
        '你的人设：' + persona.text + '。' + mannerLine(persona) +
        '原帖：「' + String((ctx && ctx.postText) || '').slice(0, 160) + '」。' +
        '你要回复的评论（' + ((ctx && ctx.targetName) || '网友') + '）：「' + String((ctx && ctx.targetText) || '').slice(0, 120) + '」。' +
        '请写一句 6-20 字的回复，直接回应对方，口语一点，可以带一点自己的看法。'
    }
  ];
}

/* 真人来评论 / 回复：把整段对话（帖子 + 全部评论）按顺序喂给模型，让它先理解再回话 */
function threadMessages(cfg, persona, ctx) {
  const c = ctx || {};
  const lines = (c.lines || []).slice(-26).map(function (l) {
    return (l.mine ? '（你）' : '') + (l.name || '网友') + '：' + String(l.text || '').slice(0, 140);
  });
  return [
    { role: 'system', content: SYS },
    {
      role: 'user',
      content:
        '你的人设：' + persona.text + '。' + mannerLine(persona) + (cfg.hint ? '额外风格要求：' + cfg.hint + '。' : '') +
        '帖子内容：「' + String(c.postText || '').slice(0, 200) + '」。' +
        (lines.length ? '下面这条帖子的评论区（按时间顺序，前面标「（你）」的是你自己说过的话）：\n' + lines.join('\n') + '\n' : '') +
        '最后是 ' + (c.targetName || '一位真人网友') + ' 在跟你说话：「' + String(c.targetText || '').slice(0, 200) + '」。' +
        (((c.images) || []).length
          ? '帖子里的图片 / 视频封面也一并发给你了：先看清画面里具体是什么（人、动物、景物、食物、文字、动作），回复时可以点一个真实看到的细节。'
          : '') +
        '先读懂整段对话的来龙去脉（谁在说什么、有没有分歧、玩笑、追问，你自己前面说过什么），再用同一个人的口气回一句 10-40 字的话：' +
        '要接住对方这句话的具体内容，不要答非所问，不要复读对方，不要写「感谢分享」这类客套模板，也不要重复你前面已经说过的句子。'
    }
  ];
}

function dmMessages(cfg, persona, ctx) {
  return [
    { role: 'system', content: SYS },
    {
      role: 'user',
      content:
        '你的人设：' + persona.text + '。' + mannerLine(persona) +
        '你在 App 里第一次私信一位网友，起因是看过他的帖子：「' + String((ctx && ctx.postText) || '').slice(0, 120) + '」。' +
        '请写一句 15-40 字的开场消息，客气、自然、不油腻，不提任何交易、联系方式或链接。'
    }
  ];
}

function captionMessages(cfg, persona, ctx) {
  return [
    { role: 'system', content: SYS },
    {
      role: 'user',
      content:
        '你的人设：' + persona.text + '。' + mannerLine(persona) + (cfg.hint ? '额外风格要求：' + cfg.hint + '。' : '') +
        (ctx && ctx.idea ? '你刚拍 / 画了这样一张图：' + String(ctx.idea).slice(0, 160) + '。' : '') +
        '请配一句 10-40 字的说明，第一人称，像随手发的一样，不要写成广告或标题。'
    }
  ];
}

/* 通用 GET 文本（用来看图搜索等 JSON 接口） */
function getText(urlStr, headers, timeoutMs) {
  return new Promise(function (resolve, reject) {
    let uu;
    try {
      uu = new URL(urlStr);
    } catch (e) {
      return reject(new Error('地址不合法'));
    }
    const lib = uu.protocol === 'http:' ? http : https;
    const req = lib.request(uu, { method: 'GET', headers: Object.assign({ 'User-Agent': 'U-Bot/1.0' }, headers || {}) }, function (res) {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error('接口返回 HTTP ' + res.statusCode));
      }
      let out = '';
      res.setEncoding('utf8');
      res.on('data', function (c) {
        if (out.length < 400000) out += c;
      });
      res.on('end', function () {
        resolve(out);
      });
    });
    req.setTimeout(timeoutMs || 20000, function () {
      req.destroy(new Error('请求超时'));
    });
    req.on('error', function (e) {
      reject(e);
    });
    req.end();
  });
}

/* 通用二进制下载（跟随最多 3 次跳转，限制 16MB） */
function downloadBinary(urlStr, headers, timeoutMs) {
  return new Promise(function (resolve, reject) {
    let hops = 0;
    const go = function (u) {
      let uu;
      try {
        uu = new URL(u);
      } catch (e) {
        return reject(new Error('图片地址不合法'));
      }
      const lib = uu.protocol === 'http:' ? http : https;
      const req = lib.request(
        uu,
        { method: 'GET', headers: Object.assign({ 'User-Agent': 'U-Bot/1.0', Accept: 'image/*,*/*' }, headers || {}) },
        function (res) {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) {
            hops += 1;
            res.resume();
            return go(new URL(res.headers.location, uu).toString());
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error('下载图片失败（HTTP ' + res.statusCode + '）'));
          }
          const chunks = [];
          let size = 0;
          res.on('data', function (c) {
            size += c.length;
            if (size > 16 * 1024 * 1024) {
              req.destroy();
              return reject(new Error('图片超过 16MB'));
            }
            chunks.push(c);
          });
          res.on('end', function () {
            const buf = Buffer.concat(chunks);
            if (!buf.length) return reject(new Error('图片是空的'));
            resolve({ buf: buf, mime: String(res.headers['content-type'] || 'image/jpeg').split(';')[0] });
          });
        }
      );
      req.setTimeout((timeoutMs || 30000), function () {
        req.destroy(new Error('下载图片超时'));
      });
      req.on('error', function (e) {
        reject(e);
      });
      req.end();
    };
    go(urlStr);
  });
}

function pixelSize(size) {
  const m = /^(\d{2,4})x(\d{2,4})$/.exec(String(size || ''));
  if (!m) return { w: 1024, h: 1024 };
  return { w: Math.min(2048, Math.max(256, Number(m[1]))), h: Math.min(2048, Math.max(256, Number(m[2]))) };
}

/* AI 自己画一张图：默认用 pollinations（免费、不要 Key），也能接 OpenAI /images/generations 兼容接口 */
async function genImage(cfg, prompt, size) {
  const c = cfg || {};
  const provider = String(c.provider || 'pollinations');
  const text = String(prompt || '').slice(0, 300) || '日常随拍';
  const px = pixelSize(size);
  const UA_IMG = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'image/*,*/*'
  };
  if (provider === 'pollinations' || !String(c.base || '').trim()) {
    const enc = encodeURIComponent(text);
    const seed = Math.floor(Math.random() * 1e6);
    const q = '?width=' + px.w + '&height=' + px.h + '&nologo=true&seed=' + seed;
    const tries = [
      'https://image.pollinations.ai/prompt/' + enc + q,
      'https://image.pollinations.ai/prompt/' + enc + q + '&model=flux',
      'https://image.pollinations.ai/prompt/' + enc + q + '&model=turbo'
    ];
    let lastErr = null;
    for (let i = 0; i < tries.length; i++) {
      try {
        const got = await downloadBinary(tries[i], UA_IMG, 90000);
        if (got && got.buf && got.buf.length > 2048) {
          recordUsage('image:' + provider, 0, 0, 'image');
          return { buf: got.buf, mime: got.mime || 'image/jpeg', via: provider };
        }
        lastErr = new Error('生成的图片是空的');
      } catch (e) {
        lastErr = e;
      }
    }
    /* 免费绘图服务偶尔整体 503：退回公开图库，保证 AI 还能发出一条配图帖 */
    try {
      const got = await downloadBinary(
        'https://picsum.photos/seed/u' + Math.floor(Math.random() * 1e6) + '/' + px.w + '/' + px.h,
        UA_IMG,
        45000
      );
      if (got && got.buf && got.buf.length > 2048) {
        recordUsage('image:picsum', 0, 0, 'image');
        return { buf: got.buf, mime: got.mime || 'image/jpeg', via: 'picsum' };
      }
    } catch (e) {}
    throw new Error('绘图失败：' + ((lastErr && lastErr.message) || '服务不可用') + '（可在「AI 能力与模型 → 画图 / 找图」里换成 OpenAI 兼容接口）');
  }
  /* OpenAI 兼容：POST {base}/images/generations */
  if (!String(c.key || '').trim()) throw new Error('还没有填写绘图 API Key');
  const base = String(c.base || '').replace(/\/+$/, '');
  const ep = /\/images\/generations$/.test(base) ? base : base + '/images/generations';
  const raw = await postJson(
    ep,
    { Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' },
    JSON.stringify({ model: c.model || 'gpt-image-1', prompt: text, n: 1, size: px.w + 'x' + px.h, response_format: 'b64_json' }),
    90000
  );
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('绘图接口返回的不是 JSON');
  }
  const first = (data && data.data && data.data[0]) || {};
  if (first.b64_json) {
    recordUsage('image:' + provider, 0, 0, 'image');
    return { buf: Buffer.from(String(first.b64_json), 'base64'), mime: 'image/png', via: provider };
  }
  if (first.url) {
    const got = await downloadBinary(first.url, {}, 60000);
    recordUsage('image:' + provider, 0, 0, 'image');
    return { buf: got.buf, mime: got.mime || 'image/png', via: provider };
  }
  throw new Error('绘图接口没有返回图片');
}

/* 让 AI 自己决定搜图关键词：中文正文 → 2~4 个英文词（失败就退回英文标签/正文里的英文） */
const WEB_TAGS = ['city', 'street', 'sunset', 'coffee', 'rain', 'forest', 'ocean', 'night', 'sky', 'flower', 'mountain', 'cat', 'dog', 'food', 'book', 'music', 'train', 'window', 'light', 'river', 'snow', 'beach', 'lake', 'cloud', 'desk', 'shoes', 'bridge', 'sunrise', 'autumn', 'market', 'office', 'garden', 'road', 'home'];

async function searchWords(cfg, text) {
  const t = String(text || '').slice(0, 120);
  const ascii = (t.match(/[A-Za-z]{3,}/g) || []).slice(0, 3);
  try {
    const r = await chat(
      cfg,
      [
        { role: 'system', content: 'You pick photo search keywords for a social post. Reply with 2-4 lowercase English words separated by spaces only, no punctuation, no explanation.' },
        { role: 'user', content: t || 'daily life' }
      ],
      { maxTokens: 16, temp: 20, timeout: 12000, kind: 'query' }
    );
    const w = String(r.text || '').toLowerCase().replace(/[^a-z ]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
    if (w) return w;
  } catch (e) {}
  if (ascii.length) return ascii.join(' ').toLowerCase();
  return WEB_TAGS[Math.floor(Math.random() * WEB_TAGS.length)];
}

/* 从网上找一张图：先用手填的图片地址池，没有就用 Pexels（填了 Key 才走），再退到免费图库 */
async function fetchWebImage(cfg, query) {
  const c = cfg || {};
  const pool = String(c.urls || '')
    .split(/[\s,]+/)
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return /^https?:\/\//.test(s);
    });
  const q = String(query || 'life').slice(0, 40);
  if (pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const got = await downloadBinary(pick, {}, 30000);
    return { buf: got.buf, mime: got.mime || 'image/jpeg', via: 'pool' };
  }
  if (!String(c.key || '').trim()) {
    const UA_IMG2 = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'image/*,*/*'
    };
    const word = /[A-Za-z]{2,}/.test(q)
      ? encodeURIComponent(q.replace(/[^0-9A-Za-z]+/g, ''))
      : WEB_TAGS[Math.floor(Math.random() * WEB_TAGS.length)];
    const free = [
      'https://loremflickr.com/1024/1024/' + (word || 'life') + '?lock=' + Math.floor(Math.random() * 1e6),
      'https://picsum.photos/seed/u' + Math.floor(Math.random() * 1e6) + '/1024/1024'
    ];
    for (let i = 0; i < free.length; i++) {
      try {
        const got = await downloadBinary(free[i], UA_IMG2, 40000);
        if (got && got.buf && got.buf.length > 2048) {
          return { buf: got.buf, mime: got.mime || 'image/jpeg', via: i === 0 ? 'loremflickr' : 'picsum' };
        }
      } catch (e) {}
    }
    throw new Error('网上找图失败：免费图库暂时不可用，可以填 Pexels Key 或图片地址池');
  }
  const raw = await getText(
    'https://api.pexels.com/v1/search?query=' + encodeURIComponent(q) + '&per_page=12&orientation=landscape',
    { Authorization: String(c.key) },
    20000
  );
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('图片搜索返回的不是 JSON');
  }
  const photos = (data && data.photos) || [];
  if (!photos.length) throw new Error('没搜到合适的图（换个词试试）');
  const one = photos[Math.floor(Math.random() * photos.length)];
  const link = (one.src && (one.src.large2x || one.src.large || one.src.medium)) || '';
  if (!link) throw new Error('图片搜索没有给出地址');
  const got = await downloadBinary(link, {}, 30000);
  return { buf: got.buf, mime: got.mime || 'image/jpeg', via: 'pexels' };
}

/* ---------------- 对外接口 ---------------- */

async function compose(opt) {
  const o = opt || {};
  const cfg = cfgOf(o.cfg);
  const persona = o.persona || personaFor({ username: 'bot' });
  const fallback = clean(o.fallback);
  const kind = o.kind;
  if (!cfg.enabled || !cfg.key) {
    return { text: uniqueText(fallback) || fallback, via: 'template' };
  }
  let messages;
  const ctx = o.ctx || {};
  if (kind === 'post') messages = postMessages(cfg, persona, o.recent, ctx.avoid);
  else if (kind === 'comment') messages = commentMessages(cfg, persona, ctx);
  else if (kind === 'reply') messages = replyMessages(cfg, persona, ctx);
  else if (kind === 'thread') messages = threadMessages(cfg, persona, ctx);
  else if (kind === 'dm') messages = dmMessages(cfg, persona, ctx);
  else if (kind === 'caption') messages = captionMessages(cfg, persona, ctx);
  else return { text: fallback, via: 'template' };
  /* 智商 0-100：越高越会说话（温度更放得开、句子更长），越低越短越木 */
  const iq = Number.isFinite(Number(o.iq)) ? Math.min(100, Math.max(0, Number(o.iq))) : 70;
  const temp = Math.round(30 + iq * 1.2);
  const maxTokens = Math.round(40 + iq * 1.5);
  const images = ctx.images || [];
  const avoid = (Array.isArray(ctx.avoid) ? ctx.avoid : [])
    .map(function (x) { return String(x || ''); })
    .filter(Boolean);
  let note = '';
  let clash = '';
  let msgs = messages;
  /* 发帖允许「撞车重写」最多三次：不同账号同时发，句子不能像同一个人写的 */
  const maxTry = kind === 'post' ? 3 : 1;
  for (let attempt = 0; attempt < maxTry; attempt += 1) {
    let raw = '';
    let imgNote = '';
    try {
      raw = await chat(cfg, msgs, { maxTokens: maxTokens, temp: temp, kind: kind, images: images });
    } catch (e) {
      note = String((e && e.message) || e).slice(0, 160);
      /* 带图失败（模型不支持 / 图太大）就退回纯文字再试一次，别让整条评论丢掉 */
      if (!images.length) break;
      try {
        raw = await chat(cfg, msgs, { maxTokens: maxTokens, temp: temp, kind: kind, images: [] });
        imgNote = '看图失败，改纯文字：' + note;
      } catch (e2) {
        note = String((e2 && e2.message) || e2).slice(0, 160);
        break;
      }
    }
    const s0 = clean(raw);
    const pool = avoid.concat(RECENT_TEXTS);
    const hit = kind === 'post' ? tooSimilar(s0, pool, POST_GATE, POST_LCS) : tooSimilar(s0, pool);
    if (s0 && !hit.hit) {
      remember(s0);
      return { text: s0, via: 'ai', note: imgNote || note || (images.length ? '看图后评论（' + images.length + ' 张）' : '') };
    }
    clash = s0 ? '跟别人刚写的内容太像（相似度 ' + hit.score + (hit.lcs >= 8 ? '，有 ' + hit.lcs + ' 个字连续一样' : '') + '）' : '没写出有效内容';
    if (kind !== 'post' || attempt === maxTry - 1) break;
    msgs = messages.concat([
      { role: 'assistant', content: s0 },
      { role: 'user', content: '这条不能用：' + clash + '。换一个完全不同的场景、时间、人物和细节重写，开头三个字必须换掉，上一句里的任何说法都不许再用，只输出正文。' }
    ]);
  }
  if (fallback) {
    const fb = uniqueText(fallback, avoid);
    if (fb) {
      remember(fb);
      return { text: fb, via: 'template', note: note || clash };
    }
  }
  return { text: fallback, via: 'template', note: note || clash };
}

/* 管理台「测试连接」：用最小代价确认地址 / Key / 模型可用 */
async function test(cfg) {
  const c = cfgOf(Object.assign({}, cfg, { enabled: true }));
  const t0 = Date.now();
  const text = await chat(
    c,
    [
      { role: 'system', content: '你是一个测试用的助手。' },
      { role: 'user', content: '回一句 12 字以内的中文，内容是“连接成功”。' }
    ],
    { maxTokens: 40, temp: 30, timeout: 20000 }
  );
  return { model: c.model, ms: Date.now() - t0, sample: text, promptTokens: LAST.prompt, completionTokens: LAST.completion, totalTokens: LAST.total };
}

function stats() {
  return { recent: RECENT_TEXTS.length, personas: PERSONAS.length };
}

module.exports = { compose, test, personaFor, stats, clean, mannerLine, similarity, tooSimilar, SIMILAR_GATE, POST_GATE, POST_LCS, remember, setUsageFile, usageStats, resetUsage, genImage, fetchWebImage, downloadBinary, captionMessages, searchWords, threadMessages };