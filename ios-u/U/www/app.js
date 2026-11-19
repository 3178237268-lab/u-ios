(function () {
  'use strict';

  /* ---------------- 存储兜底 ----------------
     有些宿主环境把页面放进 sandbox="allow-scripts" 的不透明源 iframe（dsh 文档预览就是这种）：
     localStorage 一访问就抛 SecurityError，indexedDB 直接拿不到。
     早先 boot() 第一行 applyTheme() 就要读 localStorage，抛出去以后整个初始化中断，
     于是永远停在开屏的那个 U 上。这里先探测，能真用就用真的，不能就用内存版顶上。 */
  var memStore = function () {
    var mem = Object.create(null);
    var api = {
      getItem: function (k) { return (k in mem) ? mem[k] : null; },
      setItem: function (k, v) { mem[String(k)] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = Object.create(null); },
      key: function (i) { var ks = Object.keys(mem); return i < ks.length ? ks[i] : null; },
      __memory: true
    };
    Object.defineProperty(api, 'length', { get: function () { return Object.keys(mem).length; } });
    return api;
  };
  var LS = (function () {
    try {
      var real = window.localStorage;
      real.setItem('__u_probe__', '1');   /* 有的环境取属性不抛、写入才抛 */
      real.removeItem('__u_probe__');
      return real;
    } catch (e) {
      return memStore();
    }
  })();
  /* sessionStorage 在不透明源里同样会抛，一起兜底 */
  var SS = (function () {
    try {
      var real = window.sessionStorage;
      real.setItem('__u_probe__', '1');
      real.removeItem('__u_probe__');
      return real;
    } catch (e) {
      return memStore();
    }
  })();

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* 绑定事件前先判空，避免页面结构差异导致 null.addEventListener 崩溃 */
  var $on = function (sel, ev, fn, opts) {
    var el = (sel && sel.addEventListener) ? sel : $(sel);
    if (!el) return null;
    el.addEventListener(ev, fn, opts);
    return el;
  };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmt = function (n) {
    n = n || 0;
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace('.0', '') + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1).replace('.0', '') + '万';
    return String(n);
  };
  var ago = function (ts) {
    var d = Date.now() - ts;
    if (d < 60000) return '刚刚';
    if (d < 3600000) return Math.floor(d / 60000) + '分钟';
    if (d < 86400000) return Math.floor(d / 3600000) + '小时';
    var dt = new Date(ts);
    if (d < 6 * 86400000) return Math.floor(d / 86400000) + '天';
    return (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
  };
  var fullDate = function (ts) {
    var d = new Date(ts);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  /* ---------------- icons ---------------- */
  var svg = function (body, opt) {
    opt = opt || {};
    return '<svg viewBox="0 0 24 24" width="' + (opt.size || 18) + '" height="' + (opt.size || 18) +
      '" fill="' + (opt.fill || 'none') + '" stroke="currentColor" stroke-width="' + (opt.sw || 1.7) +
      '" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  };
  var ICON = {
    reply: svg('<path d="M20.5 11.6a8.2 8.2 0 0 1-12 7.3L4 20.5l1.6-4.4a8.2 8.2 0 1 1 14.9-4.5z"/>'),
    repost: svg('<path d="M17 2.5 21 6.5l-4 4"/><path d="M3 11.5v-2A3 3 0 0 1 6 6.5h15"/><path d="M7 21.5l-4-4 4-4"/><path d="M21 12.5v2a3 3 0 0 1-3 3H3"/>'),
    heart: svg('<path d="M12 20.3c-1.1-.9-6.9-5.3-8.5-8.1a4.9 4.9 0 0 1 1.8-6.7 4.9 4.9 0 0 1 6.7 1.8 4.9 4.9 0 0 1 6.7-1.8 4.9 4.9 0 0 1 1.8 6.7c-1.6 2.8-7.4 7.2-8.5 8.1z"/>'),
    heartFill: svg('<path d="M12 20.3c-1.1-.9-6.9-5.3-8.5-8.1a4.9 4.9 0 0 1 1.8-6.7 4.9 4.9 0 0 1 6.7 1.8 4.9 4.9 0 0 1 6.7-1.8 4.9 4.9 0 0 1 1.8 6.7c-1.6 2.8-7.4 7.2-8.5 8.1z"/>', { fill: 'currentColor', sw: 0 }),
    views: svg('<path d="M3.5 20.5h17"/><path d="M7 20.5V11M12 20.5V4M17 20.5v-6"/>'),
    share: svg('<path d="M12 3.2v11.6"/><path d="M8.2 7l3.8-3.8L15.8 7"/><path d="M5.5 14.5v4.9a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8v-4.9"/>'),
    trash: svg('<path d="M4 6.8h16"/><path d="M9.6 6.8V4.6h4.8v2.2"/><path d="M6.6 6.8l.9 12.1a1.7 1.7 0 0 0 1.7 1.6h5.6a1.7 1.7 0 0 0 1.7-1.6l.9-12.1"/><path d="M10.3 10.6v5.8M13.7 10.6v5.8"/>', { size: 17 }),
    verified: '<svg class="vbadge" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.6 14.6 4l3.4-.3.9 3.3L21.7 9l-1.5 3.1 1.5 3.1-2.8 1.9-.9 3.3-3.4-.3L12 22.4 9.4 20l-3.4.3-.9-3.3L2.3 15.1 3.8 12 2.3 8.9l2.8-1.9.9-3.3L9.4 4z"/><path d="m8.4 12.1 2.4 2.4 4.8-4.9" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: svg('<path d="m9 5 7 7-7 7"/>', { size: 16 }),
    bell: svg('<path d="M18 8.5a6 6 0 1 0-12 0c0 5.2-2 6.5-2 6.5h16s-2-1.3-2-6.5z"/><path d="M10.3 19.5a2 2 0 0 0 3.4 0"/>', { size: 18 })
  };

  var PLAY_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5.2v13.6L19.4 12z"/></svg>';
  var PAUSE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="4.6" width="4.2" height="14.8" rx="1.2"/><rect x="13.8" y="4.6" width="4.2" height="14.8" rx="1.2"/></svg>';

  var EXPAND_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>';

  var ME = null;
  var APP_VERSION = '2.23';
  /* 1.75 只在版本号上升级，不在「官方通知」里生成更新通告 */
  var SHOW_VERSION_NOTICE = false;

  /* 最高权限账号：admin 为 U 官方，admin123 为管理后台管理员；服务器返回 isAdmin 的也一并认作管理员 */
  var ADMIN_NAMES = ['admin', 'admin123'];
  function isAdminName(u) {
    return ADMIN_NAMES.indexOf(String(u || '').toLowerCase()) >= 0;
  }
  function isAdmin() {
    return !!(ME && (isAdminName(ME.username) || ME.official || ME.admin));
  }
  function sameAuthor(a) {
    if (!a || !ME) return false;
    /* 只用当前登录账号重新比对，不信任缓存里写死的 me 标记：
       切换账号后旧帖子的 author.me 仍是 true，会导致能改别人内容 */
    if (a.key && ME.key && a.key === ME.key) return true;
    if (a.remoteId && ME.remoteId && Number(a.remoteId) === Number(ME.remoteId)) return true;
    if (ME.remoteId && String(a.key || '') === 'srv_u' + ME.remoteId) return true;
    if (a.handle && ME.handle && String(a.handle).toLowerCase() === String(ME.handle).toLowerCase()) return true;
    return false;
  }
  function canDeletePost(p) { return isAdmin() || sameAuthor(p && p.author); }
  /* 「服务器接口」只有管理员能看到，其他账号连这一行都不显示 */
  function paintAdminRows() {
    var row = document.getElementById('adminApiRow');
    if (row) row.style.display = isAdmin() ? '' : 'none';
  }

  /* ---------------- privacy / follow ---------------- */
  function visibleToOthers(p) {
    if (!p || p.deleted) return false;
    return true;
  }
  function loadFollows() {
    try { return JSON.parse(LS.getItem('u-follows') || '[]') || []; } catch (e) { return []; }
  }
  function saveFollows(list) { LS.setItem('u-follows', JSON.stringify(list)); }
  function isFollowing(key) {
    var rp = state.remoteUserProfile;
    if (rp && rp.key === key) return !!rp.isFollowing;
    return loadFollows().indexOf(key) >= 0;
  }
  function toggleFollow(key) {
    if (!key) return false;
    var list = loadFollows();
    var i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1); else list.push(key);
    saveFollows(list);
    LS.setItem('u-follows-ts', String(Date.now()));
    return i < 0;
  }
  function remoteAuthorForKey(key) {
    var a = state.userDirectory && state.userDirectory[key];
    return a && a.remoteId ? a : null;
  }
  /* 对方是否也关注了我：服务器账号使用真实关系，本机人机账号使用固定演示关系 */
  function followsMe(key) {
    if (!key) return false;
    var rp = state.remoteUserProfile;
    if (rp && rp.key === key) return !!rp.isFollower;
    if (key === 'u_official' || key === 'bot_u_official') return true;
    return (hashStr('fan|' + key) % 100) < 56;
  }
  function followLabel(key) {
    if (!isFollowing(key)) return '关注';
    return followsMe(key) ? '互相关注' : '已关注';
  }
  /* 拉黑：本机生效，被拉黑用户的帖子不再出现在首页、说说和搜索里 */
  function loadBlocks() {
    try {
      var list = JSON.parse(LS.getItem('u-blocks') || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function isBlockedKey(key) { return !!key && loadBlocks().indexOf(key) >= 0; }
  function isBlockedAuthor(a) { return !!a && isBlockedKey(profileKey(a)); }
  function toggleBlockKey(key) {
    var list = loadBlocks();
    var on = list.indexOf(key) >= 0;
    list = on ? list.filter(function (k) { return k !== key; }) : list.concat(key);
    LS.setItem('u-blocks', JSON.stringify(list));
    if (on) forgetBlockInfo(key);
    return !on;
  }
  /* 拉黑时记住昵称和账号，重开 App 后黑名单仍能显示是谁 */
  function loadBlockInfo() {
    try {
      var m = JSON.parse(LS.getItem('u-blocks-info') || '{}');
      return m && typeof m === 'object' ? m : {};
    } catch (e) { return {}; }
  }
  function rememberBlockInfo(key, a) {
    if (!key || !a) return;
    var m = loadBlockInfo();
    m[key] = { name: a.name || a.nickname || key, handle: a.handle || a.username || '' };
    LS.setItem('u-blocks-info', JSON.stringify(m));
  }
  function forgetBlockInfo(key) {
    var m = loadBlockInfo();
    if (!(key in m)) return;
    delete m[key];
    LS.setItem('u-blocks-info', JSON.stringify(m));
  }
  function blockDisplay(key) {
    var saved = loadBlockInfo()[key];
    if (saved && saved.name) return saved;
    var d = state.userDirectory[key];
    if (d && (d.name || d.nickname)) return { name: d.name || d.nickname, handle: d.handle || d.username || '' };
    for (var i = 0; i < state.posts.length; i++) {
      var a = state.posts[i].author;
      if (a && (a.key === key || profileKey(a) === key)) return { name: a.name || key, handle: a.handle || '' };
    }
    return { name: /^srv_u\d+$/.test(key) ? '用户 ' + key.slice(5) : key, handle: '' };
  }
  function updateBlockSub() {
    var el = $('#blockSub');
    if (!el) return;
    var n = loadBlocks().length;
    el.textContent = n ? '已拉黑 ' + n + ' 人，可随时解除' : '拉黑的用户';
  }
  function renderBlockList() {
    var el = $('#blockList');
    if (!el) return;
    var keys = loadBlocks();
    if (!keys.length) {
      el.innerHTML = '<div class="empty">' +
        '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>' +
        '<h3>黑名单为空</h3><p>在他人主页点右上角「⋯」，<br>即可将对方加入黑名单。</p></div>';
      return;
    }
    el.innerHTML = keys.map(function (key) {
      var info = blockDisplay(key);
      return '<div class="block-row">' +
        '<div class="avatar">' + esc((info.name || 'U').slice(0, 1)) + '</div>' +
        '<div class="block-info"><div class="block-name">' + esc(info.name) + '</div>' +
        '<div class="block-handle">' + (info.handle ? '@' + esc(info.handle) : '已拉黑') + '</div></div>' +
        '<button class="block-unblock" data-unblock="' + esc(key) + '">解除</button>' +
        '</div>';
    }).join('');
  }

  function applyFollowBtn(btn, key) {
    if (!btn) return;
    var on = isFollowing(key);
    btn.classList.toggle('on', on);
    btn.classList.toggle('mutual', on && followsMe(key));
    btn.textContent = on ? followLabel(key) : '关注';
  }
  /* 点击关注：服务器用户同步真实关注关系；已关注时先确认取消 */
  function requestFollowToggle(key, btn) {
    if (!key) return;
    if (!needOnline('关注')) return;
    var remote = remoteAuthorForKey(key);
    var wasFollowing = isFollowing(key);
    var run = function () {
      if (remote && Srv.on()) {
        if (btn) btn.disabled = true;
        srvRetry(function () { return Srv.follow(remote.handle); }).then(function (r) {
          if (btn) btn.disabled = false;
          var rp = state.remoteUserProfile;
          if (rp && rp.key === key) {
            rp.isFollowing = !!r.following;
            rp.followers = r.followers || 0;
            rp.isFollower = !!r.isFollower;
          }
          applyFollowBtn(btn, key);
          if ($('#userSheet').classList.contains('open') && state.userKey === key) {
            paintFollowBtn();
            renderUserStats(key);
            $('#userFollowsYou').style.display = r.isFollower ? 'inline-block' : 'none';
          }
          toast(r.following ? (r.isFollower ? '已关注，双方互相关注' : '已关注') : '已取消关注');
          refreshSrvMe();
        }).catch(function (e) {
          if (btn) btn.disabled = false;
          toast(e.message || '关注操作失败');
        });
        return;
      }
      toggleFollow(key);
      applyFollowBtn(btn, key);
      if ($('#userSheet').classList.contains('open') && state.userKey === key) {
        paintFollowBtn();
        renderUserStats(key);
      }
      if (state.tab === 'profile') renderProfile();
      toast(!wasFollowing ? (followsMe(key) ? '已关注，双方互相关注' : '已关注') : '已取消关注');
    };
    if (!wasFollowing) { run(); return; }
    var a = findAuthor(key) || {};
    confirmDialog({
      title: '取消关注？',
      desc: '是否取消关注 @' + (a.handle || key) + '？',
      okText: '取消关注'
    }).then(function (ok) { if (ok) run(); });
  }
  function paintFollowBtn() {
    var b = $('#userFollowBtn');
    if (!b) return;
    var on = isFollowing(state.userKey);
    b.classList.toggle('on', on);
    b.classList.toggle('mutual', on && followsMe(state.userKey));
    b.textContent = on ? followLabel(state.userKey) : '关注';
  }
  /* 关注/粉丝数字按账号固定生成，关注数同时反映本机真实关注列表 */
  function pseudoStat(key, salt, min, max) {
    var h = hashStr(String(key || 'u') + '|' + salt);
    return min + (h % (max - min + 1));
  }
  /* U 官方粉丝随时间自动增长（沿用本机旧配置，默认关闭） */
  var OFFICIAL_FANS_BASE = 68000;
  var PLUGIN_DEFAULTS = {
    fansOn: false, fansEvery: 1, fansCount: 1
  };
  var pluginCache = null;
  function pluginCfg() {
    if (pluginCache) return pluginCache;
    var cfg = {};
    Object.keys(PLUGIN_DEFAULTS).forEach(function (k) { cfg[k] = PLUGIN_DEFAULTS[k]; });
    try {
      var raw = JSON.parse(LS.getItem('u-plugin') || '{}');
      Object.keys(cfg).forEach(function (k) { if (raw[k] !== undefined) cfg[k] = raw[k]; });
    } catch (e) {}
    pluginCache = cfg;
    return cfg;
  }
  function fansRate() {
    var c = pluginCfg();
    if (!c.fansOn) return 0;
    var every = Math.max(1, Number(c.fansEvery) || 1);
    var count = Math.max(0, Number(c.fansCount) || 0);
    return count / every;
  }
  function officialFans() {
    var base = parseInt(LS.getItem('u-off-base') || '0', 10);
    var extra = parseInt(LS.getItem('u-off-extra') || '0', 10) || 0;
    if (!base || base > Date.now()) {
      base = Date.now();
      LS.setItem('u-off-base', String(base));
    }
    return OFFICIAL_FANS_BASE + extra + Math.floor((Date.now() - base) / 1000 * fansRate());
  }
  /* 官方账号的粉丝数按个位显示，肉眼能看到每秒增长；其他账号沿用万/亿格式 */
  function fansLabel(a, fans) {
    var official = !!(a && (a.official || a.handle === 'u_official'));
    return official ? String(fans) : fmt(fans);
  }
  var fansTicker = null;
  function startFansTicker() {
    if (fansTicker || !ME || !ME.official || state.myCounts) return;
    fansTicker = setInterval(function () {
      if (document.hidden || !ME) return;
      var b = $('#profileContent [data-followlist="fans"] b');
      if (b) b.textContent = fansLabel(ME, officialFans());
    }, 1000);
  }
  function stopFansTicker() {
    if (fansTicker) { clearInterval(fansTicker); fansTicker = null; }
  }
  function renderUserStats(key) {
    var el = $('#userStats');
    if (!el) return;
    var a = findAuthor(key) || {};
    var rp = state.remoteUserProfile;
    if (rp && rp.key === key) {
      var activity = state.userActivity && state.userActivity.key === key ? state.userActivity : null;
      var remotePosts = activity ? activity.posts : [];
      var remoteLikes = remotePosts.reduce(function (n, p) { return n + (p.likes || 0); }, 0);
      el.innerHTML =
        '<button class="statlink" data-followlist="following" data-followkey="' + esc(key) + '"><b>' + fmt(rp.following || 0) + '</b> 关注</button>' +
        '<button class="statlink" data-followlist="fans" data-followkey="' + esc(key) + '"><b>' + fmt(rp.followers || 0) + '</b> 粉丝</button>' +
        '<span><b>' + fmt(rp.user.postCount || remotePosts.length || 0) + '</b> 帖子</span>' +
        '<span><b>' + fmt(remoteLikes) + '</b> 获赞</span>';
      return;
    }
    var list = state.posts.filter(function (p) {
      return !p.deleted && p.author && profileKey(p.author) === key;
    });
    var likes = list.reduce(function (s, p) { return s + (p.likes || 0); }, 0);
    var official = !!(a.official || a.handle === 'u_official');
    var isMe = !!(ME && profileKey(ME) === key);
    var mc = isMe ? state.myCounts : null;
    var following = mc ? mc.following : (isMe ? loadFollows().length : pseudoStat(key, 'following', 18, 320));
    var fans = mc
      ? mc.followers
      : (official
        ? officialFans() + (isFollowing(key) ? 1 : 0)
        : isMe
          ? pseudoStat(key, 'fans', 8, 260) + Math.floor(likes / 10)
          : pseudoStat(key, 'fans', 12, 880) + (isFollowing(key) ? 1 : 0));
    var k = esc(key);
    el.innerHTML =
      '<button class="statlink" data-followlist="following" data-followkey="' + k + '"><b>' + following + '</b> 关注</button>' +
      '<button class="statlink" data-followlist="fans" data-followkey="' + k + '"><b>' + fansLabel(a, fans) + '</b> 粉丝</button>' +
      '<span><b>' + (mc ? mc.postCount : list.length) + '</b> 帖子</span>' +
      '<span><b>' + fmt(likes) + '</b> 获赞</span>';
  }

  /* ---------------- 关注 / 粉丝列表 ---------------- */
  function botList(key, salt, count) {
    var rand = mulberry32(hashStr(String(key) + '|' + salt));
    var pool = BOT_ACCOUNTS.slice();
    var out = [], guard = 0;
    while (out.length < Math.min(count, pool.length) && guard++ < 400) {
      var i = Math.floor(rand() * pool.length);
      var who = pool[i];
      if (out.some(function (o) { return o.handle === who.handle; })) continue;
      out.push({
        key: 'bot_' + who.handle, name: who.name,
        handle: who.handle, bot: true
      });
    }
    return out;
  }
  function followListFor(key, kind) {
    var isMe = !!(ME && profileKey(ME) === key);
    if (isMe && kind === 'following') {
      return loadFollows().map(function (k) { return findAuthor(k); }).filter(Boolean);
    }
    var n = 9 + pseudoStat(key, kind, 0, 8);
    return botList(key, kind, n);
  }
  function followRowHTML(u) {
    var key = profileKey(u) || u.key;
    var mine = !!(ME && profileKey(ME) === key);
    var on = isFollowing(key);
    var mutual = on && followsMe(key);
    return '<div class="frow" data-user="' + esc(key) + '">' +
      '<div class="avatar">' + esc((u.name || 'U').slice(0, 1)) + '</div>' +
      '<div class="fmain">' +
      '<div class="fname">' + esc(u.name || 'U') + (u.verified ? ' ' + ICON.verified : '') + '</div>' +
      '<div class="fhandle">@' + esc(u.handle || key) + '</div>' +
      '</div>' +
      (mine ? '' : '<button class="fbtn' + (on ? ' on' : '') + (mutual ? ' mutual' : '') + '" data-followtoggle="' + esc(key) + '">' +
        (on ? followLabel(key) : '关注') + '</button>') +
      '</div>';
  }
  function renderFollowList() {
    var box = $('#followList');
    if (!box) return;
    var key = state.followKey, kind = state.followKind;
    var handle = followListHandle(key);
    if (handle && Srv.on() && srvToken()) {
      box.innerHTML = '<div class="empty" style="padding:56px 28px"><p>加载中…</p></div>';
      var req = kind === 'following' ? Srv.following(handle) : Srv.followers(handle);
      req.then(function (d) {
        if (state.followKey !== key || state.followKind !== kind) return;
        var users = (d && d.users) || [];
        syncFollowCache(users);
        renderFollowRows(users.map(function (u) { return rememberRemoteUser(u); }).filter(Boolean));
      }).catch(function () { renderFollowRows(followListFor(key, kind)); });
      return;
    }
    renderFollowRows(followListFor(key, kind));
  }
  /* 关注/粉丝列表对应的服务器账号 */
  function followListHandle(key) {
    var su = srvUser();
    if (ME && profileKey(ME) === key && su && su.username) return su.username;
    var ra = remoteAuthorForKey(key);
    return ra ? (ra.handle || ra.username) : '';
  }
  /* 用服务器返回的真实关注关系校准本机关注缓存，列表里按钮状态才准确 */
  function syncFollowCache(users) {
    var list = loadFollows(), changed = false;
    users.forEach(function (u) {
      var k = 'srv_u' + u.id;
      var i = list.indexOf(k);
      if (u.isFollowing && i < 0) { list.push(k); changed = true; }
      if (!u.isFollowing && i >= 0) { list.splice(i, 1); changed = true; }
    });
    if (changed) saveFollows(list);
  }
  function renderFollowRows(list) {
    var box = $('#followList');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<div class="empty" style="padding:56px 28px">' +
        '<p>' + (state.followKind === 'following' ? '还没有关注任何人' : '还没有粉丝') + '</p></div>';
      return;
    }
    box.innerHTML = list.map(followRowHTML).join('');
  }
  function openFollowList(kind, key) {
    state.followKind = kind;
    state.followKey = key || (ME ? profileKey(ME) : 'u');
    $('#followTitle').textContent = kind === 'following' ? '关注' : '粉丝';
    renderFollowList();
    $('#followSheet').classList.add('open');
    $('#followList').scrollTop = 0;
  }

  /* ---------------- theme ---------------- */
  function currentTheme() {
    var t = LS.getItem('u-theme');
    return (t === 'dark' || t === 'light' || t === 'auto') ? t : 'auto';
  }
  function systemPrefersDark() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }
  function effectiveDark() {
    var t = currentTheme();
    if (t === 'auto') return systemPrefersDark();
    return t === 'dark';
  }
  function applyTheme() {
    var dark = effectiveDark();
    document.body.classList.toggle('light', !dark);
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#000000' : '#ffffff');
    paintThemeSeg();
    try {
      if (window.UHost && window.UHost.setTheme) window.UHost.setTheme(dark);
    } catch (e) {}
  }
  function paintThemeSeg() {
    var seg = $('#themeSeg');
    if (!seg) return;
    var t = currentTheme();
    $$('button', seg).forEach(function (b) { b.classList.toggle('on', b.dataset.theme === t); });
  }
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (currentTheme() === 'auto') applyTheme();
    });
  } catch (e) {}

  /* ---------------- notifications (localStorage) ---------------- */
  var UPDATE_NOTICE = 'U 1.8 更新内容\n\n' +
    '· 设置里新增「切换账号」：进二级菜单就能看到这台设备登录过的账号，一键切回\n' +
    '· 「后台服务器地址」也改成二级菜单，点开再改地址、扫描与断开\n' +
    '· 手机返回键/返回手势现在按层返回：黑名单、本地缓存、设置、帖子详情都能一层层退\n' +
    '· 从收藏或历史记录点开帖子，返回回到收藏/历史列表，不再跳回首页；游戏退出回游戏大厅\n' +
    '· 退出登录留在设置页，重新登录还在原处；登录页自动填上次的账号，密码框右侧可显示密码\n' +
    '· 去掉登录后「已连接服务器」的弹窗，只保留必要提示\n' +
    '· 全局动效重做：按钮、卡片、图标线性过渡 + 回弹 + 果冻，按下即反馈\n' +
    '· 开屏只留 U 图标，1.7 秒后进入，不再显示「正在查找服务器」'

  function loadNotifies() {
    try { return JSON.parse(LS.getItem('u-notifs') || '[]') || []; } catch (e) { return []; }
  }
  function saveNotifies(list) { LS.setItem('u-notifs', JSON.stringify(list)); }
  function loadNotifyTrash() {
    try { return JSON.parse(LS.getItem('u-notify-trash') || '[]') || []; } catch (e) { return []; }
  }
  function saveNotifyTrash(list) { LS.setItem('u-notify-trash', JSON.stringify(list)); }

  var VERSION_NOTICES = [
    {
      version: '1.0', days: 50,
      body: 'U 1.0 正式上线\n\n' +
        '· 「为你推荐」展示官方内容\n' +
        '· 「说说」与「备忘录」\n' +
        '· 支持发布图片、视频和文字\n' +
        '· 账号登录、注册与游客登录'
    },
    {
      version: '1.1', days: 35,
      body: 'U 1.1 更新\n\n' +
        '· 图片与视频支持全屏查看，视频可暂停、拖动进度、倍速与长按两倍速\n' +
        '· 帖子详情页与回复功能\n' +
        '· 独立的通知页\n' +
        '· 数据保存在本机，退出 App 后不会丢失'
    },
    {
      version: '1.2', days: 30,
      body: 'U 1.2 更新\n\n' +
        '· 任意一级页面右滑可打开二级菜单：收藏、历史记录、关注、游戏与设置\n' +
        '· 二级菜单头像支持短按进入我的主页、长按放大查看\n' +
        '· 新增修改账号功能，普通用户一个月只能改一次，管理员不限次数\n' +
        '· 昵称与账号全站唯一，其他用户不能重复使用'
    },
    {
      version: '1.3', days: 24,
      body: 'U 1.3 更新\n\n' +
        '· 新增 3D 枪战游戏，自动横屏、小地图与高画质场景\n' +
        '· 游戏内悬浮窗可拖动，半隐藏在侧边，点开可退出游戏\n' +
        '· 返回手势优先关闭游戏；在 App 内连续两次返回才会退出应用\n' +
        '· 移除旧的 2048 小游戏'
    },
    {
      version: '1.4', days: 18,
      body: 'U 1.4 更新\n\n' +
        '· 发帖、图片、视频与评论会自动上传后台服务器，其他手机登录后也能看到\n' +
        '· 点开帖子可进入详情页查看回复，图片与视频支持全屏查看\n' +
        '· 私信支持一对一聊天，可从对方主页发起会话\n' +
        '· 通知支持编辑与删除，新版本通知由管理员确认后发布'
    },
    {
      version: '1.5', days: 6,
      body: 'U 1.5 更新\n\n' +
        '· 服务器删除帖子后，App 会立即同步移除对应内容\n' +
        '· 修复多设备局域网互传时重复出现帖子的问题\n' +
        '· 修复点赞、转帖、评论未上传服务器的问题\n' +
        '· 18+ 视频显示后可再次隐藏\n' +
        '· 搜索新增搜索历史，可单条删除或一键清空\n' +
        '· 私信列表与聊天页头像可进入对方主页\n' +
        '· 他人主页新增拉黑；个人主页新增转帖\n' +
        '· 优化开屏与整体动画，图标更圆润对称'
    },
    {
      version: '1.7', days: 0,
      body: 'U 1.7 更新\n\n' +
        '· 视频封面由服务器生成并下发，不再黑屏\n' +
        '· 全局圆角与纵向留白加大，头像与用户名放大\n' +
        '· 私信会话左滑删除，删后对方再发消息会回来\n' +
        '· 搜索下拉建议与结果页返回键，空框不再弹空下拉\n' +
        '· 「为你推荐」只放 U 官方内容，其余在「说说」\n' +
        '· 首页每 5 秒静默同步，不打断浏览'
    },
    {
      version: '1.8', days: 0,
      body: 'U 1.8 更新\n\n' +
        '· 设置新增「切换账号」与「后台服务器地址」两个二级菜单\n' +
        '· 手机返回键按层返回，收藏/历史/游戏不再退回首页\n' +
        '· 退出登录留在设置页，登录页自动填上次账号并可显示密码\n' +
        '· 去掉「已连接服务器」弹窗\n' +
        '· 全局动画重做：线性过渡 + 回弹 + 果冻\n' +
        '· 开屏只留 U 图标，1.7 秒进入'
    }
  ];

  function seedUpdateNotice() {
    LS.setItem('u-app-ver', APP_VERSION);
    var seeded = (LS.getItem('u-notice-seeded') || '').split(',').filter(Boolean);
    var list = loadNotifies();
    var changed = false;

    VERSION_NOTICES.forEach(function (v) {
      if (seeded.indexOf(v.version) >= 0) return;
      seeded.push(v.version);
      if (list.some(function (n) { return n.version === v.version; })) return;
      var t = Date.now() - v.days * 86400000;
      list.push({
        id: 'ver-' + v.version, title: 'U ' + v.version + ' 更新', body: v.body,
        createdAt: t, published: true, publishedAt: t, version: v.version, update: true
      });
      changed = true;
    });

    if (SHOW_VERSION_NOTICE && seeded.indexOf(APP_VERSION) < 0) {
      seeded.push(APP_VERSION);
      if (!list.some(function (n) { return n.version === APP_VERSION; })) {
        /* 更新通知直接发布，所有用户打开 App 即可在「官方通知」看到 */
        list.push({
          id: 'ver-' + APP_VERSION, title: 'U ' + APP_VERSION + ' 更新', body: UPDATE_NOTICE,
          createdAt: Date.now(), published: true, publishedAt: Date.now(),
          version: APP_VERSION, update: true
        });
        changed = true;
      }
    }

    LS.setItem('u-notice-seeded', seeded.join(','));
    if (changed) saveNotifies(list);
  }

  /* ---------------- accounts / session ---------------- */
  var ADMIN = {
    username: 'admin', password: '123456',
    name: 'U 官方', handle: 'u_official', verified: true, official: true
  };
  /* 第二个内置最高权限账号：管理后台管理员 */
  var ADMIN2 = {
    username: 'admin123', password: 'admin123',
    name: '管理员', handle: 'admin123', verified: false, official: false, admin: true
  };

  function loadAccounts() {
    var list = [];
    try { list = JSON.parse(LS.getItem('u-accounts') || '[]') || []; } catch (e) { list = []; }
    var admin = list.filter(function (a) { return a.username === ADMIN.username; })[0];
    if (!admin) {
      list.unshift({ username: ADMIN.username, password: ADMIN.password, name: ADMIN.name, handle: ADMIN.handle, verified: true, official: true });
    } else {
      /* 内置 U 官方账号固定为 admin / 123456，确保管理员始终能登录 */
      admin.password = ADMIN.password;
      admin.name = ADMIN.name;
      admin.handle = ADMIN.handle;
      admin.verified = true;
      admin.official = true;
    }
    var admin2 = list.filter(function (a) { return a.username === ADMIN2.username; })[0];
    if (!admin2) {
      list.push({ username: ADMIN2.username, password: ADMIN2.password, name: ADMIN2.name, handle: ADMIN2.handle, admin: true });
    } else {
      admin2.password = ADMIN2.password;
      admin2.admin = true;
    }
    LS.setItem('u-accounts', JSON.stringify(list));
    return list;
  }

  function saveAccounts(list) { LS.setItem('u-accounts', JSON.stringify(list)); }

  function loadSession() {
    try { return JSON.parse(LS.getItem('u-session') || 'null'); } catch (e) { return null; }
  }
  function saveSession(s) { LS.setItem('u-session', JSON.stringify(s)); }

  function sessionFromAccount(a) {
    return {
      mode: 'member', key: a.username, username: a.username,
      name: a.name, handle: a.handle,
      verified: !!a.verified, official: !!a.official,
      admin: !!(a.admin || isAdminName(a.username))
    };
  }

  /* ---------------- storage layer (DataAPI) ----------------
     当前实现：本机 IndexedDB。
     之后接入云端时，只需替换 DataAPI 的实现（可映射成苹果端所需的 API 格式），
     页面渲染逻辑无需改动。
  --------------------------------------------------------- */
  var DB = null;

  /* 没有 IndexedDB 的环境（预览沙箱、无痕、存储被禁）用的内存版仓库。
     只实现 DataAPI 用到的那几个方法，返回带 onsuccess 的假请求对象，
     这样 dbAll/dbPut/dbDel/dbClear 和 index().getAll() 都不用改。 */
  function memDB() {
    var KEYPATH = { posts: 'id', notes: 'id', comments: 'id' };
    var stores = { posts: Object.create(null), notes: Object.create(null), comments: Object.create(null) };
    function rows(name) {
      return Object.keys(stores[name] || {}).map(function (k) { return stores[name][k]; });
    }
    function fakeReq(result) {
      var r = { result: result, error: null, onsuccess: null, onerror: null };
      setTimeout(function () { if (typeof r.onsuccess === 'function') r.onsuccess(); }, 0);
      return r;
    }
    function makeStore(name) {
      var keyPath = KEYPATH[name] || 'id';
      return {
        getAll: function () { return fakeReq(rows(name)); },
        put: function (val) { stores[name][val[keyPath]] = val; return fakeReq(val[keyPath]); },
        'delete': function (key) { delete stores[name][key]; return fakeReq(undefined); },
        clear: function () { stores[name] = Object.create(null); return fakeReq(undefined); },
        index: function (field) {
          return {
            getAll: function (key) {
              var hit = rows(name).filter(function (v) { return key === undefined || v[field] === key; });
              return fakeReq(hit);
            }
          };
        }
      };
    }
    return {
      __memory: true,
      objectStoreNames: { contains: function () { return true; } },
      transaction: function (name) {
        var names = Array.isArray(name) ? name : [name];
        return { objectStore: function (n) { return makeStore(n || names[0]); } };
      }
    };
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      var idb;
      try { idb = window.indexedDB; } catch (e) { idb = null; }   /* 不透明源里取属性就会抛 */
      if (!idb) { reject(new Error('IDB_UNAVAILABLE')); return; }

      var done = false;
      var timer = null;
      var settle = function (fn, v) {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        fn(v);
      };
      /* 有的环境 open 既不 success 也不 error（被别的标签页卡住升级锁），超时按不可用处理 */
      timer = setTimeout(function () { settle(reject, new Error('IDB_TIMEOUT')); }, 2500);

      var req;
      try { req = idb.open('u-app-db', 2); } catch (e) { settle(reject, e); return; }
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('posts')) {
          var p = d.createObjectStore('posts', { keyPath: 'id' });
          p.createIndex('createdAt', 'createdAt');
        }
        if (!d.objectStoreNames.contains('notes')) {
          var n = d.createObjectStore('notes', { keyPath: 'id' });
          n.createIndex('updatedAt', 'updatedAt');
        }
        if (!d.objectStoreNames.contains('comments')) {
          var c = d.createObjectStore('comments', { keyPath: 'id' });
          c.createIndex('postId', 'postId');
          c.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = function () { settle(resolve, req.result); };
      req.onerror = function () { settle(reject, req.error || new Error('IDB_ERROR')); };
      req.onblocked = function () { /* 交给上面的超时兜底 */ };
    }).catch(function (err) {
      console.warn('IndexedDB 不可用，本次改用内存存储：', (err && err.message) || err);
      return memDB();
    });
  }

  function reqP(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function dbAll(store) { return reqP(DB.transaction(store).objectStore(store).getAll()); }
  function dbPut(store, val) { return reqP(DB.transaction(store, 'readwrite').objectStore(store).put(val)); }
  function dbDel(store, key) { return reqP(DB.transaction(store, 'readwrite').objectStore(store).delete(key)); }
  function dbClear(store) { return reqP(DB.transaction(store, 'readwrite').objectStore(store).clear()); }

  var DataAPI = {
    listPosts: function () {
      return dbAll('posts').then(function (list) {
        /* 草稿不参与时间线：它只属于草稿箱 */
        return list.filter(function (p) { return !p.draft; })
          .sort(function (a, b) { return b.createdAt - a.createdAt; });
      });
    },
    listDrafts: function () {
      return dbAll('posts').then(function (list) {
        return list.filter(function (p) { return !!p.draft; })
          .sort(function (a, b) { return (b.savedAt || b.createdAt || 0) - (a.savedAt || a.createdAt || 0); });
      });
    },
    createPost: function (input) {
      var author = input.author || {
        key: ME ? ME.key : 'local', name: ME ? ME.name : 'U',
        handle: ME ? ME.handle : 'u_user',
        verified: !!(ME && ME.verified), official: !!(ME && ME.official), me: true
      };
      var build = function (extra) {
        var post = {
          id: uid(),
          author: author,
          text: input.text || '',
          media: input.media || [],
          createdAt: Date.now(),
          likes: author.official ? 180 + Math.floor(Math.random() * 720) : 0,
          liked: false,
          reposts: author.official ? 6 + Math.floor(Math.random() * 34) : 0,
          replies: author.official ? 6 + Math.floor(Math.random() * 9) : 0,
          views: 12 + Math.floor(Math.random() * 180) + (author.official ? 1800 + Math.floor(Math.random() * 4000) : 0),
          private: !!input.private,
          sensitive: !!input.sensitive
        };
        return Object.assign(post, extra || {});
      };
      var save = function (extra) {
        var post = build(extra);
        return dbPut('posts', post).then(function () { return post; });
      };
      if (Srv.on()) {
        return Srv.ensure().then(function () {
          return Srv.publish(input);
        }).then(function (d) {
          var rp = d.post;
          var media = (input.media || []).map(function (m, i) {
            var nm = Object.assign({}, m);
            if (rp.media && rp.media[i]) nm.rid = rp.media[i].id;
            return nm;
          });
          return save({
            id: 'srv_' + rp.id,
            remoteId: rp.id,
            media: media,
            createdAt: Date.parse(rp.createdAt) || Date.now(),
            likes: rp.likeCount || 0,
            replies: rp.commentCount || 0
          });
        }).catch(function (err) {
          console.warn('云端发布失败，已转入草稿箱', err);
          /* 上传被中断（断网、隧道被掐、服务器拒绝）：不再塞进首页/说说 — 那样用户以为发出去了，
             统一转成草稿，由用户自己决定重新发布还是删除 */
          composeProgressReset();
          var why = (err && err.message) ? err.message : '网络异常';
          return makeDraft({
            text: input.text || '', media: input.media || [],
            private: !!input.private, sensitive: !!input.sensitive,
            channel: state.composeChannel, why: why, replaceId: input.draftReplace
          });
        });
      }
      return save();
    },
    updatePost: function (post) { return dbPut('posts', post); },
    deletePost: function (id) {
      var p = null;
      for (var i = 0; i < state.posts.length; i++) if (state.posts[i].id === id) p = state.posts[i];
      if (p && p.remoteId && Srv.canSync()) {
        /* 删除服务器帖子会级联删除其媒体与评论，保证 App 与服务器一致 */
        Srv.removePost(p.remoteId).catch(function (e) { console.warn('云端删除失败', e); });
      }
      /* 同时删除本机该帖子的评论 */
      var jobs = [];
      (state.allComments || []).forEach(function (c) {
        if (c.postId === id) jobs.push(dbDel('comments', c.id));
      });
      state.allComments = (state.allComments || []).filter(function (c) { return c.postId !== id; });
      jobs.push(dbDel('posts', id));
      return Promise.all(jobs);
    },
    listNotes: function () {
      return dbAll('notes').then(function (list) {
        return list.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      });
    },
    saveNote: function (note) { return dbPut('notes', note); },
    deleteNote: function (id) { return dbDel('notes', id); },
    listComments: function (postId) {
      return reqP(DB.transaction('comments').objectStore('comments').index('postId').getAll(postId))
        .then(function (list) { return list.sort(function (a, b) { return a.createdAt - b.createdAt; }); });
    },
    listAllComments: function () {
      return dbAll('comments').then(function (list) {
        return list.sort(function (a, b) { return b.createdAt - a.createdAt; });
      });
    },
    addComment: function (postId, text, author, replyTo, mediaIds, localMedia) {
      var post = null;
      for (var i = 0; i < state.posts.length; i++) if (state.posts[i].id === postId) post = state.posts[i];
      var localSave = function () {
        var c = { id: uid(), postId: postId, text: text, author: author, replyTo: replyTo || null, media: localMedia || null, createdAt: Date.now() };
        return dbPut('comments', c).then(function () { return c; });
      };
      var remoteSave = function () {
        var match = replyTo && /^srv_c(\d+)$/.exec(replyTo.id || '');
        var parentId = match ? Number(match[1]) : null;
        return Srv.comment(post.remoteId, text, parentId, mediaIds).then(function (d) {
          var list = (d && d.comments) || [];
          var last = list[list.length - 1];
          var c = last ? Srv.toComment(last, postId) : {
            id: uid(), postId: postId, text: text, author: author, createdAt: Date.now()
          };
          if (!c.replyTo && replyTo) c.replyTo = replyTo;
          return dbPut('comments', c).then(function () { return c; });
        });
      };
      if (!post || !Srv.on()) return localSave();
      if (!post.remoteId) {
        /* 本机帖子还没上传时，先补传再写评论，避免评论只留在本机 */
        return Srv.pushLocal().then(function () {
          return post.remoteId ? Srv.ensure().then(remoteSave) : localSave();
        }).catch(function () { return localSave(); });
      }
      if (post.remoteId) {
        return srvRetry(remoteSave).catch(function (err) {
          console.warn('回复上传失败，已保存在本机', err);
          toast('未能上传服务器，回复已暂存在本机');
          return localSave();
        });
      }
      /* 本地帖还没有服务器 id：先补传帖子，再发评论，保证其他手机能看到 */
      if (sameAuthor(post.author)) {
        return Srv.ensure().then(function () {
          return Srv.pushLocal();
        }).then(function () {
          if (!post.remoteId) return localSave();
          return remoteSave();
        }).catch(function () { return localSave(); });
      }
      return localSave();
    },
    deleteComment: function (id) { return dbDel('comments', id); },
    clearAll: function () { return Promise.all([dbClear('posts'), dbClear('notes'), dbClear('comments')]); }
  };

  /* ---------------- 后台服务器（Node.js + SQLite） ----------------
     地址与登录状态存 localStorage。未填写地址时完全离线，
     所有数据读写仍走本机 IndexedDB，行为与之前一致。
  ---------------------------------------------------------------- */
  var SRV_KEY = 'u-server';
  var SRV_OFF_KEY = 'u-server-off';
  var SRV_TOKEN_KEY = 'u-server-token';
  var SRV_USER_KEY = 'u-server-user';
  /* 默认后台服务器：进入 App 自动接入，设置里仍可手动改地址 */
  /* 通过局域网地址 / 反代端口打开时，默认就用「当前页面同源」当服务器地址
     （serve-app.js 会把 /api 与 /media 转发到 8787），这样手机上不用手填地址。
     用 127.0.0.1 / 本机 8765 打开时仍回落到热点网关地址。 */
  /* 是否跑在 APK 壳里：壳会注入 UHost 桥接对象，网页端没有 */
  var SRV_IS_APP = (function () {
    try {
      if (window.UHost && typeof window.UHost.localIp === 'function') return true;
      if (/com\.trae\.u|u-app\//i.test(navigator.userAgent || '')) return true;
    } catch (e) { /* 保持网页端行为 */ }
    return false;
  })();
  /* APK 壳用自己本地的 HTTP 服务（127.0.0.1:<随机端口>）把 assets/www 发给 WebView，
     那个地址只有静态文件、没有 /api 与 /media 反代。所以「同源优先」在壳里必须关掉，
     否则 App 会把所有接口都打到壳自己身上——表现就是「手机网页能连、App 连不上」。 */
  function pageIsAppShell() {
    if (!SRV_IS_APP) return false;
    try {
      var h = String(location.hostname || '');
      return !h || h === '127.0.0.1' || h === 'localhost' || h === '::1';
    } catch (e) { return false; }
  }
  /* 默认后台地址：
     电脑网页端（双击 index.html）→ http://127.0.0.2:8787
     手机网页端 / APK 端          → http://192.168.127.1:8787
     这两个只是第一顺位：连不上会依次换 127.0.0.1 / localhost / 热点网关，
     再扫一遍所在局域网找真正在跑的服务器（见 srvFileHeal 与 discoverLanServer）。 */
  var SRV_DESKTOP_DEFAULT = 'http://127.0.0.2:8787';
  var SRV_MOBILE_DEFAULT = 'http://192.168.137.1:17880';
  var SRV_DEFAULT = (function () {
    try {
      if (location.protocol === 'file:') return SRV_IS_APP ? SRV_MOBILE_DEFAULT : SRV_DESKTOP_DEFAULT;
      /* 用 serve-app 起的 8765 / 17880 打开时，同源就有 /api 与 /media 反代，
         直接用当前页面地址当服务器地址最稳（127.0.0.1 也算同源）。 */
      if ((location.protocol === 'http:' || location.protocol === 'https:') && location.hostname &&
          location.port !== '8787' && !pageIsAppShell()) {
        return location.origin;
      }
    } catch (e) { }
    return SRV_IS_APP ? SRV_MOBILE_DEFAULT : SRV_DESKTOP_DEFAULT;
  })();

  /* 各端默认服务器地址：由服务器「网络 / 穿透」下发（手机 App / 手机网页 / 手机公网 /
     电脑网页 / 电脑公网），本地缓存一份，断网/离线时也能用。 */
  var ENV_PORTS_KEY = 'u-env-ports';
  var ENV_PORT_KEYS = ['app', 'mweb', 'mpub', 'dweb', 'dpub'];
  var ENV_PORT_LABELS = { app: '手机App', mweb: '手机网页', mpub: '手机公网', dweb: '电脑网页', dpub: '电脑公网' };
  var envPortsCache = (function () {
    try {
      var raw = JSON.parse(LS.getItem(ENV_PORTS_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) { return {}; }
  })();
  function applyEnvPorts(obj) {
    if (!obj || typeof obj !== 'object') return;
    var next = {};
    ENV_PORT_KEYS.forEach(function (k) {
      var v = String(obj[k] || '').replace(/\/+$/, '');
      if (/^https?:\/\//i.test(v)) next[k] = v;
    });
    envPortsCache = next;
    try { LS.setItem(ENV_PORTS_KEY, JSON.stringify(next)); } catch (e) { /* 忽略 */ }
  }
  /* 本机 / 局域网地址判定：公网页面里如果还存着上次的局域网地址，要当成无效 */
  function hostIsPrivate(h) {
    h = String(h || '').toLowerCase();
    if (!h) return true;
    return h === 'localhost' || h === '::1' || /\.local$/.test(h) || /^127\./.test(h) ||
      /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  }
  function urlHost(u) {
    var m = String(u || '').match(/^https?:\/\/([^:\/]+)/i);
    return m ? m[1].toLowerCase() : '';
  }
  /* 当前环境该用哪一项：APK → 手机 App；手机网页 → 局域网 / 公网；电脑网页 → 局域网 / 公网 */
  /* 注意：这里不能调 envInfo()——envInfo 里要算 base（= srvBase()），
     而 srvBase() 又要调本函数，会无限递归（RangeError: Maximum call stack size exceeded）。
     所以自己就地判断设备/运行方式/网络。 */
  function srvEnvKey() {
    var ua = navigator.userAgent || '';
    var mobile = /Android|iPhone|iPad|iPod|Windows Phone|HarmonyOS|Mobile/i.test(ua);
    var isApp = (typeof SRV_IS_APP !== 'undefined') && SRV_IS_APP;
    var client = isApp ? 'apk' : (location.protocol === 'file:' ? 'file' : 'web');
    var host = '';
    try { host = location.hostname || ''; } catch (e) { host = ''; }
    var pub = location.protocol !== 'file:' && !!host && !hostIsPrivate(host);
    if (client === 'apk') return 'app';
    if (mobile) return pub ? 'mpub' : 'mweb';
    return pub ? 'dpub' : 'dweb';
  }
  function srvEnvDefault() {
    if (location.protocol === 'file:') return '';
    return String(envPortsCache[srvEnvKey()] || '');
  }

  /* 单帖媒体数量上限：由后台「站点设置」下发（默认 9，最高 9）。
     先读本地缓存，/api/config 回来后用 applyMediaMax 覆盖。 */
  var MEDIA_MAX_KEY = 'u-media-max';
  var MEDIA_MAX_DEFAULT = 9;
  var MEDIA_MAX_HARD = 9;
  function applyMediaMax(v) {
    var n = parseInt(v, 10);
    if (!isFinite(n) || n <= 0) n = MEDIA_MAX_DEFAULT;
    n = Math.max(1, Math.min(MEDIA_MAX_HARD, n));
    MEDIA_MAX = n;
    try { LS.setItem(MEDIA_MAX_KEY, String(n)); } catch (e) { /* 忽略 */ }
    return n;
  }
  var MEDIA_MAX = (function () {
    var raw = null;
    try { raw = LS.getItem(MEDIA_MAX_KEY); } catch (e) { raw = null; }
    var n = parseInt(raw, 10);
    if (!isFinite(n) || n <= 0) n = MEDIA_MAX_DEFAULT;
    return Math.max(1, Math.min(MEDIA_MAX_HARD, n));
  })();

  /* APK 原生端会先做一遍局域网发现（上次地址 → UDP 广播 → 扫网段），
     找到后以 ?srv= 形式带进来，这里写进本地配置并清掉「已断开」标记。 */
  (function readSrvParam() {
    try {
      var m = String(location.search || '').match(/[?&]srv=([^&]*)/);
      if (!m || !m[1]) return;
      var url = decodeURIComponent(m[1]).replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
      if (!url || url === 'http://') return;
      LS.setItem(SRV_KEY, url);
      LS.removeItem(SRV_OFF_KEY);
      SS.removeItem(SRV_OFF_KEY);
    } catch (e) { /* 参数异常不影响启动 */ }
  })();

  function srvBase() {
    /* 断开标记只在本次运行内有效：重新打开 App 会再次自动连接默认服务器 */
    if (SS.getItem(SRV_OFF_KEY) === '1') return '';
    if (LS.getItem(SRV_OFF_KEY) === '1') LS.removeItem(SRV_OFF_KEY);
    var saved = String(LS.getItem(SRV_KEY) || '').replace(/\/+$/, '');
    /* APK 壳的原生发现（上次地址 → UDP 广播 → 扫网段）比本地缓存更新：
       壳没把 ?srv= 带进来时直接向桥接要一次结果。 */
    if (!saved && SRV_IS_APP) {
      try {
        var nativeSrv = (window.UHost && UHost.discoveredServer) ? String(UHost.discoveredServer() || '') : '';
        if (/^https?:\/\//i.test(nativeSrv)) {
          saved = nativeSrv.replace(/\/+$/, '');
          LS.setItem(SRV_KEY, saved);
        }
      } catch (e) { /* 没有桥接就不管 */ }
    }
    /* 公网页面（穿透域名）里还存着上次的局域网地址时直接忽略：手机切到流量后
       旧地址必然超时，这时该用当前页面同源（serve-app 已把 /api 与 /media 反代过去）。 */
    try {
      if (saved && /^https?:/.test(location.protocol) && hostIsPrivate(urlHost(saved)) &&
          !hostIsPrivate(location.hostname)) saved = '';
    } catch (e) { /* 忽略 */ }
    /* 页面本身就是服务器发出来的（8765 / 17880 / 任何反代端口）时，同源地址最可靠：
       serve-app.js 已经把 /api 与 /media 反代到 8787，一个端口就能跑。
       这一条必须排在「各端默认地址」前面——否则手机打开 http://IP:8765 会被
       「手机网页默认 http://192.168.137.1:17880」（热点没开就完全不通）带偏，
       表现就是后台 8787 能开、App 页面打不开。 */
    try {
      if ((location.protocol === 'http:' || location.protocol === 'https:') && location.hostname &&
          location.port !== '8787' && !pageIsAppShell()) {
        var origin = location.origin.replace(/\/+$/, '');
        if (origin && origin !== saved) return origin;
      }
    } catch (e) { /* 忽略 */ }
    return saved || srvEnvDefault() || SRV_DEFAULT;
  }
  /* 手机走局域网地址 / 路由器转发时，默认的 192.168.137.1:8787 往往不可达：
     启动后探测一次，失败就切到「当前页面同源」——serve-app.js 会把 /api 与 /media
     反向代理到 8787，所以一个端口就能把 App 跑起来。同一地址只试一次，避免刷新循环。 */
  /* file:// 打开时的候选地址：先按端默认，再试本机回环、热点网关 */
  function srvFileCandidates() {
    var list = [];
    function add(u) {
      u = String(u || '').replace(/\/+$/, '');
      if (!u || !/^https?:\/\//i.test(u)) return;
      if (list.indexOf(u) < 0) list.push(u);
    }
    if (SRV_IS_APP) {
      /* 壳里没有「本机回环服务器」，127.0.0.1 只会打到壳自己，必须跳过 */
      add(envPortsCache.app);
      add('http://192.168.1.217:17880');
      add('http://192.168.137.1:17880');
      add('http://192.168.137.1:8787');
      add(envPortsCache.mpub);   /* 不在同一 Wi-Fi 时退回公网穿透地址 */
      add(envPortsCache.dpub);
    } else {
      add('http://127.0.0.2:8787');
      add('http://127.0.0.1:8787');
      add('http://localhost:8787');
      add('http://192.168.1.217:17880');
      add('http://192.168.137.1:17880');
    }
    return list;
  }
  function srvFileHeal() {
    try {
      /* 双击 index.html（file://）与 APK 壳（127.0.0.1 本地资源服务）都要走这条路 */
      if (location.protocol !== 'file:' && !pageIsAppShell()) return;
      var LIST = srvFileCandidates();
      var cur = srvBase();
      if (SS.getItem('u-srv-file-heal') === cur) return;
      /* 探测带 2.5 秒超时：本机 8787 正常情况下 10ms 内就回，
         存着一个不可达的旧地址时不能像默认那样干等 20 秒。 */
      function probe(url) {
        var ctl = null, timer = 0;
        var opt = { cache: 'no-store' };
        try {
          ctl = new AbortController();
          opt.signal = ctl.signal;
          /* 公网穿透地址（https）比局域网慢得多，给 6 秒；局域网 1.5 秒足够 */
          var wait = /^https:/i.test(url) ? 6000 : 1500;
          timer = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, wait);
        } catch (e) { ctl = null; }
        return fetch(url + '/api/config', opt).then(function (r) {
          if (timer) clearTimeout(timer);
          return r.ok;
        }, function () {
          if (timer) clearTimeout(timer);
          return false;
        });
      }
      probe(cur).then(function (ok) {
        if (ok) return;
        var i = 0;
        (function next() {
          if (i >= LIST.length) {
            /* 固定地址全不通：扫一遍所在局域网，找到就在跑的服务器就切过去刷新 */
            if (SS.getItem('u-srv-lan') === '1') return;
            if (typeof discoverLanServer !== 'function') return;
            SS.setItem('u-srv-lan', '1');
            discoverLanServer(true).then(function (found) {
              SS.removeItem('u-srv-lan');
              if (!found) return;
              LS.setItem(SRV_KEY, found);
              LS.removeItem(SRV_OFF_KEY);
              SS.removeItem(SRV_OFF_KEY);
              toast('已发现局域网服务器 ' + found.replace(/^https?:\/\//, ''));
              setTimeout(function () { location.reload(); }, 800);
            }, function () { SS.removeItem('u-srv-lan'); });
            return;
          }
          var cand = LIST[i++];
          if (cand === cur) return next();
          probe(cand).then(function (good) {
            if (!good) return next();
            SS.setItem('u-srv-file-heal', cand);
            LS.setItem(SRV_KEY, cand);
            LS.removeItem(SRV_OFF_KEY);
            SS.removeItem(SRV_OFF_KEY);
            toast('正在连接 ' + cand.replace(/^https?:\/\//, ''));
            setTimeout(function () { location.reload(); }, 700);
          });
        })();
      });
    } catch (e) { }
  }
  function srvSelfHeal() {
    try {
      if (location.protocol === 'file:' || pageIsAppShell()) { srvFileHeal(); return; }
      if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
      if (!Srv.on()) return;
      var origin = location.origin;
      if (SS.getItem('u-srv-heal') === origin) return;
      var cur = srvBase();
      Srv.ping().then(function () { }, function () {
        if (origin === cur) return;
        SS.setItem('u-srv-heal', origin);
        LS.setItem(SRV_KEY, origin);
        LS.removeItem(SRV_OFF_KEY);
        toast('正在连接 ' + origin.replace(/^https?:\/\//, ''));
        setTimeout(function () { location.reload(); }, 900);
      });
    } catch (e) { }
  }
  function setSrvOff() {
    SS.setItem(SRV_OFF_KEY, '1');
    LS.removeItem(SRV_OFF_KEY);
  }
  function clearSrvOff() {
    SS.removeItem(SRV_OFF_KEY);
    LS.removeItem(SRV_OFF_KEY);
  }

  /* APK 原生端在后台一直找服务器；找到后调用这里热切换，不用重开 App */
  window.__uSetServer = function (url) {
    try {
      if (!url) return;
      var u = String(url).replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
      if (LS.getItem(SRV_KEY) === u) {
        updateSrvStatus('已连接 ' + u);
        return;
      }
      LS.setItem(SRV_KEY, u);
      SS.removeItem(SRV_OFF_KEY);
      LS.removeItem(SRV_OFF_KEY);
      rebaseRemoteMedia();
      updateSrvStatus('已连接 ' + u);
      setTimeout(renderAll, 0);
    } catch (e) { /* 切换失败不影响已有页面 */ }
  };
  function srvToken() { return LS.getItem(SRV_TOKEN_KEY) || ''; }
  function srvUser() {
    try { return JSON.parse(LS.getItem(SRV_USER_KEY) || 'null'); } catch (e) { return null; }
  }

  /* ---------------- 管理台下发的站点配置 ---------------- */

  var SRV_SETTINGS = {
    uploadImageMB: 50,
    uploadVideoMB: 1024,
    allowPost: true,
    allowComment: true,
    hiddenServices: [],
    botCommentPerSec: 0,
    botLikePerSec: 0,
    botPostPerSec: 0
  };
  var mutedToastShown = false;

  function srvSettings() { return SRV_SETTINGS; }

  function loadSrvConfig() {
    if (!Srv.on()) { applyServiceSettings(); return Promise.resolve(SRV_SETTINGS); }
    return Srv.raw('/api/config').then(function (d) {
      /* 公网地址（内网穿透）会随隧道重连变化，设置页里直接显示最新那个 */
      try {
        window.__uTunnelUrl = (d && d.tunnelUrl) || '';
        window.__uTunnelOn = !!(d && d.tunnelRunning);
        if (d && d.envPorts) applyEnvPorts(d.envPorts);
        if (typeof savePort === 'function') savePort(srvBase(), /^https:/i.test(srvBase()) ? 'public' : (/17880|8765/.test(srvBase()) ? 'same' : 'lan'));
        if (typeof updateSrvStatus === 'function') updateSrvStatus();
      } catch (e) { /* 忽略 */ }
      if (d && d.settings) {
        var s = d.settings;
        SRV_SETTINGS = {
          uploadImageMB: Number(s.uploadImageMB) || 50,
          uploadVideoMB: Number(s.uploadVideoMB) || 1024,
          allowPost: s.allowPost !== false,
          allowComment: s.allowComment !== false,
          hiddenServices: Array.isArray(s.hiddenServices) ? s.hiddenServices : [],
          botCommentPerSec: Number(s.botCommentPerSec) || 0,
          botLikePerSec: Number(s.botLikePerSec) || 0,
          botPostPerSec: Number(s.botPostPerSec) || 0,
          mediaMaxPerPost: Number(s.mediaMaxPerPost) || 0,
          botIntervalSec: Number(s.botIntervalSec) || 0
        };
        /* 后台配的单帖媒体上限要立刻生效：发帖面板的计数、九宫格列数都跟着变 */
        if (s.mediaMaxPerPost) applyMediaMax(s.mediaMaxPerPost);
      }
      applyServiceSettings();
      return SRV_SETTINGS;
    }).catch(function () {
      applyServiceSettings();
      return SRV_SETTINGS;
    });
  }

  function refreshSrvMe() {
    if (!srvToken()) return Promise.resolve(null);
    return Srv.raw('/api/me').then(function (d) {
      if (d && d.user) {
        LS.setItem(SRV_USER_KEY, JSON.stringify(d.user));
        /* 关注 / 粉丝 / 帖子数用服务器真实数据，不再按账号生成假数字 */
        if (d.followers != null || d.following != null) {
          state.myCounts = {
            followers: d.followers || 0,
            following: d.following || 0,
            postCount: d.postCount || 0
          };
        }
        applyServiceSettings();
        if (state.tab === 'profile') renderProfile();
        return d.user;
      }
      return null;
    }).catch(function () { return null; });
  }

  function applyServiceSettings() {
    var body = document.body;
    var h = SRV_SETTINGS.hiddenServices || [];
    body.classList.toggle('svc-hide-compose', !SRV_SETTINGS.allowPost || h.indexOf('compose') >= 0);
    body.classList.toggle('svc-hide-search', h.indexOf('search') >= 0);
    body.classList.toggle('svc-hide-notify', h.indexOf('notify') >= 0);
    body.classList.toggle('svc-hide-recommend', h.indexOf('recommend') >= 0);
    body.classList.toggle('svc-hide-talk', h.indexOf('talk') >= 0);
    body.classList.toggle('svc-hide-dm', h.indexOf('dm') >= 0);
    body.classList.toggle('svc-hide-memo', h.indexOf('memo') >= 0);
    body.classList.toggle('svc-hide-lan', h.indexOf('lan') >= 0);
    body.classList.toggle('svc-hide-game', h.indexOf('game') >= 0);
    var hint = document.querySelector('#compose .hint');
    if (hint) {
      hint.innerHTML = '最多 ' + MEDIA_MAX + ' 个 · 图片 / 视频可混合<br>单个视频 ≤ ' + SRV_SETTINGS.uploadVideoMB +
        'MB · 单张图片 ≤ ' + SRV_SETTINGS.uploadImageMB + 'MB';
    }
    /* 当前页面被关闭时自动回到还能用的页面 */
    if (state.tab === 'search' && h.indexOf('search') >= 0) switchTab('feed');
    if (state.tab === 'notify' && h.indexOf('notify') >= 0) switchTab('feed');
    if (state.tab === 'notes' && h.indexOf('memo') >= 0) switchTab('feed');
    if (state.tab === 'dm' && h.indexOf('dm') >= 0) switchTab('feed');
    if (state.tab === 'feed' && h.indexOf('recommend') >= 0) switchTab(h.indexOf('talk') >= 0 ? 'talk' : 'dm');
    if (state.tab === 'talk' && h.indexOf('talk') >= 0) switchTab(h.indexOf('recommend') >= 0 ? 'feed' : 'dm');
    var u = srvUser();
    if (u && u.muted && !mutedToastShown) {
      mutedToastShown = true;
      toast('你已被管理员禁言，暂时不能发帖和评论');
    }
  }

  function canPostNow() {
    if (!needOnline('发帖')) return false;
    if (!SRV_SETTINGS.allowPost) { toast('管理员已关闭全站发帖'); return false; }
    var u = srvUser();
    if (u && u.muted) { toast('你已被禁言，暂时不能发布内容'); return false; }
    return true;
  }

  function canCommentNow() {
    if (!needOnline('评论')) return false;
    if (!SRV_SETTINGS.allowComment) { toast('管理员已关闭全站评论'); return false; }
    var u = srvUser();
    if (u && u.muted) { toast('你已被禁言，暂时不能评论'); return false; }
    return true;
  }

  /* 后台端口被占用时会从 8787 顺延到 8792。连接失败后自动探测，
     找到实际端口就更新地址，避免 App 一直请求已经不可用的 8787。 */
  function probeSrv(url, timeoutMs) {
    return new Promise(function (resolve) {
      var settled = false;
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      function finish(found) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(found ? url : '');
      }
      var timer = setTimeout(function () {
        try { if (controller) controller.abort(); } catch (e) {}
        finish(false);
      }, timeoutMs || 2000);
      fetch(url + '/api/health', {
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      }).then(function (r) {
        if (!r.ok) throw new Error('health');
        return r.json();
      }).then(function (d) { finish(!!(d && d.ok)); }).catch(function () { finish(false); });
    });
  }
  function scanSrvPorts() {
    if (Srv._scanP) return Srv._scanP;
    if (Srv._scanFailedAt && Date.now() - Srv._scanFailedAt < 15000) return Promise.resolve('');
    var m = srvBase().match(/^(https?:\/\/)([^:\/]+)(?::(\d+))?$/i);
    /* 端口顺延探测：本机回环 / 局域网 / 热点地址都值得试一遍 */
    if (!m || !/^(127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|localhost$)/.test(m[2])) return Promise.resolve('');
    var port = Number(m[3] || 8787);
    if (port < 8787 || port > 8792) return Promise.resolve('');
    var jobs = [];
    for (var p = 8787; p <= 8792; p++) {
      if (p !== port) jobs.push(probeSrv(m[1] + m[2] + ':' + p));
    }
    Srv._scanP = Promise.all(jobs).then(function (urls) {
      Srv._scanP = null;
      var found = urls.filter(Boolean)[0] || '';
      if (!found) {
        Srv._scanFailedAt = Date.now();
        /* 默认热点地址不可达时，尝试在手机所在局域网内寻找真正的电脑 IP */
        return discoverLanServer();
      }
      Srv._scanFailedAt = 0;
      LS.setItem(SRV_KEY, found);
      rebaseRemoteMedia();
      updateSrvStatus('已自动连接 ' + found);
      setTimeout(renderAll, 0);
      return found;
    }).catch(function () {
      Srv._scanP = null;
      return '';
    });
    return Srv._scanP;
  }

  /* ---------------- 局域网自动发现服务器 ---------------- */

  function privatePrefixOf(ip) {
    var p = String(ip || '').split('.');
    if (p.length !== 4) return '';
    for (var i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(p[i])) return '';
    }
    if (/^0\./.test(ip)) return '';
    return p.slice(0, 3).join('.');
  }

  function localLanIps() {
    var ips = [];
    try {
      if (window.UHost && UHost.localIp) {
        var ip = String(UHost.localIp() || '');
        if (privatePrefixOf(ip)) ips.push(ip);
      }
    } catch (e) { /* 浏览器环境没有宿主桥接 */ }
    var m = srvBase().match(/^https?:\/\/([^:\/]+)/i);
    if (m && privatePrefixOf(m[1]) && ips.indexOf(m[1]) < 0) ips.push(m[1]);
    return ips;
  }

  function scanLanPrefix(prefix) {
    var found = '';
    var next = 1;
    function worker() {
      if (found || next > 254) return Promise.resolve();
      var ip = prefix + '.' + (next++);
      return probeSrv('http://' + ip + ':8787').then(function (hit) {
        if (hit && !found) found = hit;
        return worker();
      });
    }
    var jobs = [];
    for (var i = 0; i < 32; i++) jobs.push(worker());
    return Promise.all(jobs).then(function () { return found; });
  }

  /* 扫描手机所在 /24 网段，找到正在运行的 U 服务器并自动写回地址 */
  function discoverLanServer(force) {
    if (Srv._discP) return Srv._discP;
    if (!force && Srv._discAt && Date.now() - Srv._discAt < 60000) return Promise.resolve('');
    var prefixes = [];
    localLanIps().forEach(function (ip) {
      var pre = privatePrefixOf(ip);
      if (pre && prefixes.indexOf(pre) < 0) prefixes.push(pre);
    });
    if (!prefixes.length) return Promise.resolve('');
    Srv._discAt = Date.now();
    Srv._discP = Promise.all(prefixes.map(scanLanPrefix)).then(function (lists) {
      Srv._discP = null;
      var found = lists.filter(Boolean)[0] || '';
      if (found) {
        LS.setItem(SRV_KEY, found);
        clearSrvOff();
        rebaseRemoteMedia();
        updateSrvStatus('已自动连接 ' + found);
        setTimeout(renderAll, 0);
      }
      return found;
    }).catch(function () {
      Srv._discP = null;
      return '';
    });
    return Srv._discP;
  }
  /* ---------------- 运行环境识别 + 已知端口（第69轮） ----------------
     用途：认出「手机/电脑、网页/APK/本地文件、局域网/公网」，
     把探测成功过的服务器地址与端口记在本机，设置里可一键回填。 */
  var ENV_KEY = 'u-env';
  var PORTS_KEY = 'u-ports';
  var PORTS_MAX = 8;
  var __envCache = null;
  function envInfo(force) {
    if (__envCache && !force) return __envCache;
    var ua = navigator.userAgent || '';
    /* 只认 UA：桌面 Chrome 的 screen.width 在无头/分屏下会很窄，
       用尺寸推断会把电脑判成手机。安卓 WebView（APK）与手机浏览器 UA 都带 Android/Mobile。 */
    var mobile = /Android|iPhone|iPad|iPod|Windows Phone|HarmonyOS|Mobile/i.test(ua);
    var client = SRV_IS_APP ? 'apk' : (location.protocol === 'file:' ? 'file' : 'web');
    var host = '';
    try { host = location.hostname || ''; } catch (e) { host = ''; }
    var isLocal = !host || host === 'localhost' || /^127\./.test(host) ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    var net = location.protocol === 'file:' ? 'local' : (isLocal ? 'lan' : 'public');
    __envCache = {
      mobile: mobile,
      device: mobile ? 'phone' : 'desktop',
      client: client,
      net: net,
      page: location.protocol === 'file:' ? 'file://' : location.origin,
      ua: ua,
      base: srvBase() || ''
    };
    try { LS.setItem(ENV_KEY, JSON.stringify({ device: __envCache.device, client: client, net: net, page: __envCache.page })); } catch (e) { }
    return __envCache;
  }
  function envLabel(e) {
    e = e || envInfo();
    var dev = e.device === 'phone' ? '手机' : '电脑';
    var cli = e.client === 'apk' ? 'APK' : (e.client === 'file' ? '本地文件' : '网页');
    var nt = e.net === 'public' ? '公网' : (e.net === 'local' ? '离线' : '局域网');
    return dev + ' · ' + cli + ' · ' + nt;
  }
  function portsList() {
    var raw = [];
    try { raw = JSON.parse(LS.getItem(PORTS_KEY) || '[]'); } catch (e) { raw = []; }
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (x) { return x && typeof x.url === 'string' && /^https?:\/\//i.test(x.url); });
  }
  function savePort(url, kind) {
    url = String(url || '').replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(url)) return;
    var list = portsList().filter(function (x) { return x.url !== url; });
    list.unshift({ url: url, kind: kind || 'lan', at: Date.now() });
    if (list.length > PORTS_MAX) list = list.slice(0, PORTS_MAX);
    try { LS.setItem(PORTS_KEY, JSON.stringify(list)); } catch (e) { }
    renderSrvPorts();
  }
  /* 端口 chips：先列服务器下发的五端默认地址，再列本机用过并保存过的地址 */
  function renderSrvPorts() {
    var box = $('#srvPorts');
    if (!box) return;
    var cur = srvBase();
    var seen = {};
    var chips = [];
    ENV_PORT_KEYS.forEach(function (k) {
      var u = String(envPortsCache[k] || '').replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(u) || seen[u]) return;
      seen[u] = 1;
      chips.push('<button class="srv-chip' + (u === cur ? ' on' : '') + '" data-srvport="' + cacheEsc(u) + '" data-srvkind="' + cacheEsc(ENV_PORT_LABELS[k]) + '">' +
        cacheEsc(u.replace(/^https?:\/\//, '')) + '<em>' + cacheEsc(ENV_PORT_LABELS[k]) + '</em></button>');
    });
    portsList().forEach(function (x) {
      if (seen[x.url]) return;
      seen[x.url] = 1;
      var kind = x.kind === 'public' ? '公网' : (x.kind === 'same' ? '同源' : '局域网');
      chips.push('<button class="srv-chip' + (x.url === cur ? ' on' : '') + '" data-srvport="' + cacheEsc(x.url) + '" data-srvkind="' + cacheEsc(kind) + '">' +
        cacheEsc(x.url.replace(/^https?:\/\//, '')) + '<em>' + cacheEsc(kind) + '</em></button>');
    });
    box.innerHTML = chips.join('');
  }
  (function bindSrvPortChips() {
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-srvport]') : null;
      if (!b) return;
      var url = b.getAttribute('data-srvport');
      var inp = $('#srvUrl');
      if (inp) inp.value = url;
      updateSrvStatus('已填入 ' + url + '，点「连接并同步」生效');
      toast('已填入 ' + url.replace(/^https?:\/\//, ''));
    });
  })();
  /* 候选地址：只跑「库里记录的」——本机保存过的地址 + 服务器下发的五端默认 +
     当前地址 + 当前页面同源。不再按 8787-8792 顺延循环，扫到即停。 */
  function srvPortCandidates() {
    var out = [];
    function add(u) {
      u = String(u || '').replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(u)) return;
      if (out.indexOf(u) < 0) out.push(u);
    }
    ENV_PORT_KEYS.forEach(function (k) { add(envPortsCache[k]); });
    portsList().forEach(function (x) { add(x.url); });
    add(srvBase());
    if (location.protocol === 'file:' || pageIsAppShell()) srvFileCandidates().forEach(add);
    else add(location.origin);
    return out;
  }
  function scanAllServers() {
    if (Srv._allP) return Srv._allP;
    var cands = srvPortCandidates();
    var found = '';
    var next = 0;
    function worker() {
      if (found || next >= cands.length) return Promise.resolve();
      var url = cands[next++];
      return probeSrv(url, /^https:/i.test(url) ? 7000 : 2200).then(function (hit) {
        if (hit && !found) found = hit;
        return worker();
      });
    }
    var jobs = [];
    for (var i = 0; i < 12; i++) jobs.push(worker());
    Srv._allP = Promise.all(jobs).then(function () {
      Srv._allP = null;
      return found || '';
    }).catch(function () { Srv._allP = null; return ''; });
    return Srv._allP;
  }
  function applySrvFound(found, msg) {
    if (!found) return;
    var old = srvBase();
    LS.setItem(SRV_KEY, found);
    clearSrvOff();
    if (old && old !== found) {
      LS.removeItem(SRV_TOKEN_KEY);
      LS.removeItem(SRV_USER_KEY);
    }
    var kind = /^https:/i.test(found) ? 'public' : (/17880|8765/.test(found) ? 'same' : 'lan');
    savePort(found, kind);
    var inp = $('#srvUrl');
    if (inp) inp.value = found;
    var e = envInfo(true);
    e.base = found;
    __envCache = e;
    updateSrvStatus(msg || ('已连接 ' + found));
    loadSrvConfig();
  }
  /* APK 壳在后台发现服务器后会把地址推过来（未加载完时会补推一次）：
     直接改地址重连，不刷新页面，比壳第二次启动再带 ?srv= 快一步 */
  window.__uSrvFound = function (url) {
    try {
      var u = String(url || '').replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(u)) return false;
      /* 网页端同源本来就能用，被外层推一个局域网地址过去只会把登录态清掉 */
      if (!SRV_IS_APP && location.protocol !== 'file:' && location.port !== '8787') return false;
      if (u === srvBase()) return false;
      applySrvFound(u, '已连接 ' + u);
      return true;
    } catch (e) {
      return false;
    }
  };
  /* 启动时按识别出的环境把「该用的地址」摆好，并把地址记进端口表 */
  function envAutoBind() {
    var e = envInfo(true);
    var cur = srvBase();
    if (cur) savePort(cur, e.net === 'public' ? 'public' : (location.port === '8787' ? 'lan' : 'same'));
    renderSrvPorts();
    return e;
  }

  /* 要不要在失败后换地址重试：公网页面永远不换（换了就是另一个网络），
     只有本地文件、APK 壳、局域网地址才值得扫描 */
  function srvMayScan() {
    if (location.protocol === 'file:') return true;
    try { if (pageIsAppShell()) return true; } catch (e) { /* 早期调用忽略 */ }
    return hostIsPrivate(location.hostname);
  }

  function srvFetchError(err) {
    var e = new Error('后台未启动或地址不可达：请启动服务器并保持窗口开启，手机需与服务器连接同一网络');
    e.cause = err;
    return e;
  }
  function rebaseRemoteMedia() {
    var base = srvBase();
    if (!base) return;
    (state.posts || []).forEach(function (p) {
      (p.media || []).forEach(function (m) {
        if (m && m.rid && m.src && /^https?:\/\//i.test(m.src)) {
          m.src = m.src.replace(/^https?:\/\/[^\/]+/i, base);
        }
      });
    });
  }

  /* 服务器封禁：锁定整个界面，只显示「该账号已被封禁」弹窗 */
  function handleBanned() {
    if (state.banned) return;
    state.banned = true;
    stopSyncTimer();
    stopBots();
    stopFansTicker();
    LS.removeItem(SRV_TOKEN_KEY);
    LS.removeItem(SRV_USER_KEY);
    if (document.getElementById('bannedOverlay')) return;
    var ov = document.createElement('div');
    ov.id = 'bannedOverlay';
    ov.style.cssText =
      'position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;display:grid;place-items:center;' +
      'background:rgba(5,5,10,.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);';
    ov.innerHTML =
      '<div style="width:min(320px,86vw);background:#1a1a26;border:1px solid rgba(255,255,255,.1);' +
      'border-radius:22px;padding:32px 26px;text-align:center;color:#f2f2f7;' +
      'box-shadow:0 30px 80px rgba(0,0,0,.6)">' +
      '<div style="width:56px;height:56px;margin:0 auto 16px;border-radius:50%;' +
      'background:rgba(255,92,108,.16);color:#ff5c6c;display:grid;place-items:center;' +
      'font-size:30px;font-weight:800">!</div>' +
      '<div style="font-size:18px;font-weight:800;margin-bottom:10px">该账号已被封禁</div>' +
      '<div style="font-size:13px;color:#9696ac;line-height:1.6;margin-bottom:22px">' +
      '你已被管理员封禁，无法进行任何操作。</div>' +
      '<button id="bannedExit" style="width:100%;padding:12px;border:0;border-radius:12px;' +
      'background:var(--accent-grad);color:var(--accent-ink);font-size:14px;font-weight:800;cursor:pointer">退出登录</button>' +
      '</div>';
    document.body.appendChild(ov);
    var btn = document.getElementById('bannedExit');
    if (btn) btn.addEventListener('click', function () {
      var n = document.getElementById('bannedOverlay');
      if (n && n.parentNode) n.parentNode.removeChild(n);
      state.banned = false;
      logout();
    });
  }

  /* 实时监测：定时与服务器同步，服务器删除/封禁等指令优先于本机 */
  var syncTimer = null;
  /* 每 5 秒静默跟服务器同步一次：界面不弹任何提示，数据没变化也不重绘 */
  var SYNC_INTERVAL_MS = 5000;
  /* 慢网（公网隧道）时自动放缓轮询，别让同步把带宽占满，
     网速恢复后自动回到 5 秒 */
  var syncIntervalNow = SYNC_INTERVAL_MS;
  function nextSyncInterval(ms) {
    if (ms > 2500) syncIntervalNow = Math.min(20000, Math.round(syncIntervalNow * 1.6));
    else if (ms < 900) syncIntervalNow = SYNC_INTERVAL_MS;
    return syncIntervalNow;
  }
  function startSyncTimer() {
    if (syncTimer || !Srv.on()) return;
    var run = function () {
      syncTimer = null;
      if (state.banned) return;
      if (!document.hidden && ME && Srv.canSync() && !netIsOffline()) {
        var syncT0 = Date.now();
        Srv.sync().then(function (r) {
          nextSyncInterval(Date.now() - syncT0);
          if (state.banned) return;
          loadSrvConfig();
          refreshSrvMe();
          /* 每 5 秒静默刷新：数据没变化就不重绘，避免列表跳动、打断正在播的视频；
             界面上也不会出现任何提示。每 3 拍（15 秒）兜底重绘一次，防止异步计数漏更新 */
          Srv._tick = (Srv._tick || 0) + 1;
          var noChange = !!(r && r.changed === false);
          if (noChange && Srv._tick % 3 !== 0) return;
          if (state.tab === 'feed') renderFeed();
          if (state.tab === 'talk') renderTalk();
          if (state.tab === 'profile') renderProfile();
          refreshConversations();
          refreshNotifications();
        }).catch(function () {
          /* 同步失败（隧道抖动、服务器重启）：别把间隔拉到最大干等，
             改成 2.5 秒后再试一次——公网恢复通常就在几秒内，快重试用户无感 */
          try { Srv._netFails = (Srv._netFails || 0) + 1; } catch (e) {}
          syncIntervalNow = 2500;
        });
      }
      if (!state.banned) syncTimer = setTimeout(run, syncIntervalNow);
    };
    if (!startSyncTimer.visBound) {
      startSyncTimer.visBound = true;
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = setTimeout(run, 400);
        }
      });
    }
    syncIntervalNow = SYNC_INTERVAL_MS;
    syncTimer = setTimeout(run, syncIntervalNow);
  }
  function stopSyncTimer() {
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  }

  /* data URL（本机抓的视频封面）转成 Blob，用来上传到服务器 */
  function dataUrlToBlob(url) {
    return new Promise(function (resolve) {
      try {
        var m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(String(url || ''));
        if (!m) { resolve(null); return; }
        var mime = m[1] || 'image/jpeg';
        if (m[2]) {
          var bin = atob(m[3]);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: mime }));
        } else {
          resolve(new Blob([decodeURIComponent(m[3])], { type: mime }));
        }
      } catch (e) { resolve(null); }
    });
  }

  /* 大文件上传走 XHR：fetch 没有上传进度，也拿不到「传了多少」的中间状态。
     300MB 的视频在公网要传好几分钟，绝不能像普通接口那样 20 秒就掐断 ——
     只用「停顿看门狗」判断链路是否死掉（120 秒没有任何字节进展才放弃）。 */
  /* 分块上传：公网隧道（serveo / localhost.run）传几百 MB 时经常在中途被掐断，
     整段重传每次又得从 0 开始。这里拆成 8MB 一块追加到同一个临时文件，
     某一块失败只补那一块，传了 290MB 断一次也不会白费。 */
  var UPLOAD_CHUNK = 8 * 1024 * 1024;
  function srvUploadChunks(blob, name, onProgress) {
    var total = Math.ceil(blob.size / UPLOAD_CHUNK);
    var upId = '';
    for (var k = 0; k < 24; k++) upId += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    var sentBase = 0;
    var index = 0;
    function partOnce(i) {
      return new Promise(function (resolve, reject) {
        var start = i * UPLOAD_CHUNK;
        var part = blob.slice(start, Math.min(blob.size, start + UPLOAD_CHUNK));
        var xhr = new XMLHttpRequest();
        var lastTick = Date.now();
        var settled = false;
        var watchdog = setInterval(function () {
          if (settled) return;
          if (Date.now() - lastTick > 45000) {
            try { xhr.abort(); } catch (e) { /* 忽略 */ }
            done(mkErr('第 ' + (i + 1) + ' 块停顿超过 45 秒', true));
          }
        }, 4000);
        function stop() { settled = true; clearInterval(watchdog); }
        function mkErr(msg, retryable) { var err = new Error(msg); err.retryable = !!retryable; return err; }
        function done(err, data) { if (settled) return; stop(); if (err) reject(err); else resolve(data); }
        try {
          xhr.open('POST', srvBase() + '/api/media/chunk', true);
          var token = srvToken();
          if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
          xhr.setRequestHeader('Content-Type', (blob && blob.type) || 'application/octet-stream');
          xhr.setRequestHeader('X-Filename', encodeURIComponent(name || 'upload'));
          xhr.setRequestHeader('X-Upload-Id', upId);
          xhr.setRequestHeader('X-Chunk-Index', String(i));
          xhr.setRequestHeader('X-Chunk-Total', String(total));
          xhr.setRequestHeader('X-Total-Bytes', String(blob.size));
          xhr.upload.onprogress = function (e) {
            lastTick = Date.now();
            if (e.lengthComputable && onProgress) {
              onProgress(Math.min(99, Math.round((sentBase + e.loaded) / blob.size * 100)));
            }
          };
          xhr.onload = function () {
            var data = null;
            try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { data = null; }
            if (xhr.status >= 200 && xhr.status < 300 && data) { done(null, data); return; }
            var msg = (data && (data.error || data.message)) || ('上传失败（' + xhr.status + '）');
            done(mkErr(msg, xhr.status === 0 || xhr.status >= 500));
          };
          xhr.onerror = function () { done(mkErr('第 ' + (i + 1) + ' 块中断', true)); };
          xhr.ontimeout = function () { done(mkErr('第 ' + (i + 1) + ' 块超时', true)); };
          xhr.onabort = function () { done(mkErr('上传已取消', false)); };
          xhr.send(part);
        } catch (e) {
          done(mkErr((e && e.message) || '上传失败', false));
        }
      });
    }
    function step() {
      if (index >= total) return Promise.reject(new Error('分块计数异常'));
      var i = index;
      var tries = 0;
      function attempt() {
        return partOnce(i).then(function (r) {
          if (r && r.id) return r;
          sentBase += Math.min(UPLOAD_CHUNK, blob.size - i * UPLOAD_CHUNK);
          if (onProgress) onProgress(Math.min(99, Math.round(sentBase / blob.size * 100)));
          index = i + 1;
          return step();
        }, function (err) {
          tries++;
          /* 每块最多补 3 次：隧道偶发断流，重传一块 8MB 只要几秒 */
          if (tries > 3 || !err || !err.retryable) throw err;
          return new Promise(function (ok) { setTimeout(ok, 800 * tries); }).then(attempt);
        });
      }
      return attempt();
    }
    if (onProgress) onProgress(0);
    return step();
  }

  function srvUploadXhr(blob, name, onProgress) {
    /* 超过 8MB 一律走分块：断了不用从头再来 */
    if (blob && blob.size > UPLOAD_CHUNK) return srvUploadChunks(blob, name, onProgress);
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var lastTick = Date.now();
      var settled = false;
      var watchdog = setInterval(function () {
        if (settled) return;
        if (Date.now() - lastTick > 120000) {
          try { xhr.abort(); } catch (e) { /* 忽略 */ }
          done(mkErr('上传中断超过 2 分钟，请检查网络后重试', true));
        }
      }, 5000);
      function stop() { settled = true; clearInterval(watchdog); }
      function mkErr(msg, retryable) {
        var err = new Error(msg);
        err.retryable = !!retryable;
        return err;
      }
      function done(err, data) {
        if (settled) return;
        stop();
        if (err) reject(err); else resolve(data);
      }
      try {
        xhr.open('POST', srvBase() + '/api/media', true);
        var token = srvToken();
        if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('Content-Type', (blob && blob.type) || 'application/octet-stream');
        xhr.setRequestHeader('X-Filename', encodeURIComponent(name || 'upload'));
        xhr.upload.onprogress = function (e) {
          lastTick = Date.now();
          if (e.lengthComputable && onProgress) {
            onProgress(Math.min(99, Math.round(e.loaded / e.total * 100)));
          }
        };
        xhr.upload.onload = function () {
          lastTick = Date.now();
          if (onProgress) onProgress(99);
        };
        xhr.onprogress = function () { lastTick = Date.now(); };
        xhr.onload = function () {
          var data = null;
          try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { data = null; }
          if (xhr.status >= 200 && xhr.status < 300 && data && data.id) { done(null, data); return; }
          var msg = (data && (data.error || data.message)) || ('上传失败（' + xhr.status + '）');
          done(mkErr(msg, xhr.status === 0 || xhr.status === 502 || xhr.status === 503 || xhr.status === 504));
        };
        xhr.onerror = function () { done(mkErr('上传中断，网络不稳定时请重试', true)); };
        xhr.ontimeout = function () { done(mkErr('上传超时，请重试', true)); };
        xhr.onabort = function () { done(mkErr('上传已取消', false)); };
        xhr.send(blob);
      } catch (e) {
        done(mkErr((e && e.message) || '上传失败', false));
      }
    });
  }

  var Srv = {
    base: srvBase,
    on: function () { return !!srvBase(); },
    token: srvToken,
    user: srvUser,
    canSync: function () {
      return !!(srvBase() && srvToken() && ME);
    },
    /* 进入 App / 发布前自动取得服务器身份：
       有 token 直接复用；本机账号尝试用同名账号登录服务器，失败则注册；
       游客则申请一个服务器匿名账号。 */
    ensure: function () {
      if (!Srv.on()) return Promise.resolve(null);
      if (srvToken() && srvUser()) return Promise.resolve(srvUser());
      if (Srv._ensureP) return Srv._ensureP;
      var p = null;
      if (ME && ME.mode === 'member' && ME.username) {
        var acc = loadAccounts().filter(function (a) { return a.username === ME.username; })[0];
        if (acc && acc.password) {
          p = Srv.login(acc.username, acc.password).catch(function () {
            return Srv.register(acc.username, acc.password, acc.name);
          }).catch(function () {
            /* 服务器已有同名账号但密码不同：退回游客身份，至少保证内容能上传 */
            return Srv.guest();
          });
        }
      }
      if (!p) p = Srv.guest();
      Srv._ensureP = p.then(function (d) {
        LS.setItem(SRV_TOKEN_KEY, d.token);
        LS.setItem(SRV_USER_KEY, JSON.stringify(d.user));
        Srv._ensureP = null;
        if (ME) {
          ME.remote = true;
          ME.remoteId = d.user.id;
          if (ME.mode === 'guest') {
            ME.name = d.user.nickname;
            ME.handle = d.user.username;
          }
          saveSession(ME);
        }
        return d.user;
      }).catch(function (err) {
        Srv._ensureP = null;
        throw err;
      });
      return Srv._ensureP;
    },
    abs: function (u) {
      if (!u) return '';
      if (/^https?:\/\//i.test(u)) return u;
      return srvBase() + (u.charAt(0) === '/' ? '' : '/') + u;
    },
    raw: function (path, opt) {
      opt = opt || {};
      var method = String(opt.method || 'GET').toUpperCase();
      var headers = Object.assign({}, opt.headers || {});
      if (srvToken()) headers.Authorization = 'Bearer ' + srvToken();
      var body = opt.body;
      var isBinary = false;
      try { isBinary = body instanceof Blob || body instanceof FormData; } catch (e) { isBinary = false; }
      if (body && !isBinary && typeof body !== 'string') {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }
      var request = {
        method: opt.method || 'GET',
        headers: headers,
        body: body,
        cache: 'no-store'
      };
      /* 每条请求都带超时：公网穿透带宽很窄时，fetch 可能挂几十秒不返回，
         界面表现为「服务器连接不到」。 */
      var timeoutMs = opt.timeout || (path === '/api/health' ? 8000 : 20000);
      /* 幂等请求（GET/HEAD 或显式 retry）遇到隧道抖动自动重试 3 次，退避 400ms / 1600ms。
         免费隧道上一两秒的抖动很常见，重试一次就过去了，比直接把错误抛到界面上好。 */
      var idem = /^(GET|HEAD)$/.test(method) || !!opt.retry;
      var attempts = idem ? 3 : 1;
      function send() {
        var ctl = null, timer = 0;
        var req = request;
        try {
          ctl = new AbortController();
          req = Object.assign({}, request, { signal: ctl.signal });
          timer = setTimeout(function () {
            try { ctl.abort(); } catch (e) {}
          }, timeoutMs);
        } catch (e) { ctl = null; }
        return fetch(srvBase() + path, req).then(function (r) {
          if (timer) clearTimeout(timer);
          /* 拿到响应就说明链路通了：清失败计数、收起「未连接」提示 */
          Srv._okAt = Date.now();
          Srv._netFails = 0;
          netMark(true);
          return r;
        }, function (err) {
          if (timer) clearTimeout(timer);
          Srv._netFails = (Srv._netFails || 0) + 1;
          /* 单次抖动不弹「未连接到互联网」，连续两次才算真断，公网上界面不会乱闪 */
          if (Srv._netFails >= 2) netMark(false);
          throw err;
        });
      }
      function sendRetry(n) {
        return send().catch(function (err) {
          if (n >= attempts) throw err;
          return new Promise(function (ok) { setTimeout(ok, n === 1 ? 400 : 1600); }).then(function () { return sendRetry(n + 1); });
        });
      }
      return sendRetry(1).catch(function (err) {
        /* 只有在「本地文件 / APK 壳 / 局域网」时换地址才有意义：
           公网网页上乱换地址会把用户带到一个不同网络的地址，越换越连不上 */
        if (!srvMayScan()) throw srvFetchError(err);
        return scanSrvPorts().then(function (found) {
          if (!found) throw srvFetchError(err);
          return send();
        });
      }).then(function (r) {
        return r.text().then(function (t) {
          var data = null;
          try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
          if (r.status === 403 && data && /封禁|banned/i.test(data.error || '')) {
            handleBanned();
            throw new Error(data.error);
          }
          /* 只有携带 token 的业务接口 401 才算登录失效；
             心跳 / 配置这类公开接口的 401（隧道中转偶尔会插一个自己的错误页）别把登录态清掉 */
          if (r.status === 401 && srvToken() && !/^\/api\/(health|config|discover|find)/.test(path)) {
            LS.removeItem(SRV_TOKEN_KEY);
            LS.removeItem(SRV_USER_KEY);
          }
          if (!r.ok) throw new Error((data && data.error) || ('服务器错误 ' + r.status));
          return data;
        });
      });
    },
    ping: function () { return Srv.raw('/api/health', { timeout: 6000 }); },
    guest: function () { return Srv.raw('/api/guest', { method: 'POST', body: {} }); },
    login: function (u, p) {
      return Srv.raw('/api/login', { method: 'POST', body: { username: u, password: p } });
    },
    register: function (u, p, n) {
      return Srv.raw('/api/register', { method: 'POST', body: { username: u, password: p, nickname: n } });
    },
    updateProfile: function (username, nickname) {
      return Srv.raw('/api/me/profile', { method: 'POST', body: { username: username, nickname: nickname } });
    },
    logout: function () {
      if (!srvToken()) return Promise.resolve();
      return Srv.raw('/api/logout', { method: 'POST' }).catch(function () {});
    },
    /* 给已上传的视频补一张封面（首帧图），成功后别的设备直接看封面 */
    setPoster: function (mediaId, blob, ratio) {
      return Srv.raw('/api/media/' + mediaId + '/poster', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'X-Ratio': String(ratio || 0)
        },
        body: blob
      });
    },
    upload: function (blob, name, onProgress) {
      function once() { return srvUploadXhr(blob, name, onProgress); }
      return once().catch(function (err) {
        /* 网络抖动导致的中断自动补一次，媒体文件本身不变，重传是安全的 */
        /* 分块上传自己会补传单块，这里不再整段重来 */
        if (!err || !err.retryable || (blob && blob.size > UPLOAD_CHUNK)) throw err;
        return new Promise(function (ok) { setTimeout(ok, 1500); }).then(once);
      });
    },
    /* 上传本地媒体 → 发帖，返回服务器帖子对象 */
    /* 上传本地媒体 → 发帖，返回服务器帖子对象。
       视频会额外上传一张封面图（拿到服务器地址），别的用户直接看封面，
       点开播放时才去拉视频本体 */
    publish: function (input) {
      var media = input.media || [];
      var ids = [];
      var chain = Promise.resolve();
      media.forEach(function (m) {
        chain = chain.then(function () {
          if (m.rid) { ids.push({ id: m.rid, poster: '', ratio: m.ratio || 0 }); return; }
          if (!m.blob) return;
          var ext = m.type === 'video' ? '.mp4' : '.jpg';
          var item = { id: '', poster: '', ratio: m.ratio || 0 };
          ids.push(item);
          return Srv.upload(m.blob, 'u-' + m.id + ext, function (pct) {
            if (input.onProgress) input.onProgress(pct, m);
          }).then(function (r) {
            item.id = r.id;
            /* 记住服务器 id：万一后面的发帖请求超时，重试时不会再把大文件传一遍 */
            try { m.rid = r.id; } catch (e) { /* 只读对象也能失败，忽略 */ }
            /* 视频封面：本机抓的首帧图上传成媒体，再把这个媒体 id 绑到视频上 */
            if (m.type !== 'video' || !m.poster || !/^data:/.test(m.poster)) return;
            return dataUrlToBlob(m.poster).then(function (pb) {
              if (!pb) return;
              return Srv.upload(pb, 'p-' + m.id + '.jpg').then(function (pr) { item.poster = pr.id; }).catch(function () {});
            });
          });
        });
      });
      /* 发帖请求本身很小，但走公网隧道时偶尔还是会被掐断：退避重试 3 次，
         媒体已经传完（m.rid 记住了 id），重试不会重复上传大文件。 */
      function createWithRetry(attempt) {
        var list = ids.filter(function (it) { return !!it.id; });
        return Srv.raw('/api/posts', {
          method: 'POST',
          body: { text: input.text || '', private: !!input.private, sensitive: !!input.sensitive, media: list }
        }).catch(function (err) {
          if (attempt >= 2) throw err;
          return new Promise(function (resolve) { setTimeout(resolve, 1200 + attempt * 1800); })
            .then(function () { return createWithRetry(attempt + 1); });
        });
      }
      return chain.then(function () { return createWithRetry(0); });
    },
    removePost: function (remoteId) {
      return Srv.raw('/api/posts/' + remoteId, { method: 'DELETE' });
    },
    /* 改已发布帖子的文字 / 私密 / 18+ 标注：以前只在「媒体全是本地 blob」时整帖重发，
       结果编辑 18+ 之后服务器那份永远不变，别人（和本机重开 App）看到的还是没遮罩的旧状态 */
    updatePost: function (remoteId, patch) {
      return Srv.raw('/api/posts/' + remoteId, { method: 'PATCH', body: patch || {} });
    },
    like: function (remoteId) {
      return Srv.raw('/api/posts/' + remoteId + '/like', { method: 'POST' });
    },
    comments: function (remoteId) {
      return Srv.raw('/api/posts/' + remoteId + '/comments');
    },
    getPost: function (remoteId) { return Srv.raw('/api/posts/' + remoteId); },
    view: function (remoteId) {
      return Srv.raw('/api/posts/' + remoteId + '/view', { method: 'POST' });
    },
    postIds: function () { return Srv.raw('/api/post-ids'); },
    deleteComment: function (commentId) {
      return Srv.raw('/api/comments/' + encodeURIComponent(commentId), { method: 'DELETE' });
    },
    comment: function (remoteId, text, replyTo, mediaIds) {
      var body = { text: text, replyTo: replyTo || null };
      if (mediaIds && mediaIds.length) body.media = mediaIds;
      return Srv.raw('/api/posts/' + remoteId + '/comments', { method: 'POST', body: body });
    },
    search: function (q) { return Srv.raw('/api/search?q=' + encodeURIComponent(q)); },
    userProfile: function (username) { return Srv.raw('/api/users/' + encodeURIComponent(username)); },
    follow: function (username) {
      return Srv.raw('/api/users/' + encodeURIComponent(username) + '/follow', { method: 'POST' });
    },
    followers: function (username) {
      return Srv.raw('/api/users/' + encodeURIComponent(username) + '/followers');
    },
    following: function (username) {
      return Srv.raw('/api/users/' + encodeURIComponent(username) + '/following');
    },
    activity: function (username) { return Srv.raw('/api/users/' + encodeURIComponent(username) + '/activity'); },
    repost: function (remoteId) {
      return Srv.raw('/api/posts/' + remoteId + '/repost', { method: 'POST' });
    },
    notifications: function () { return Srv.raw('/api/notifications'); },
    readNotifications: function (ids) {
      return Srv.raw('/api/notifications/read', { method: 'POST', body: ids ? { ids: ids } : {} });
    },
    conversations: function () { return Srv.raw('/api/conversations'); },
    messages: function (username) { return Srv.raw('/api/messages/' + encodeURIComponent(username)); },
    sendMessage: function (username, text) {
      return Srv.raw('/api/messages/' + encodeURIComponent(username), { method: 'POST', body: { text: text } });
    },
    toLocal: function (rp) {
      var me = srvUser();
      var mine = !!(me && rp.author && rp.author.id === me.id);
      var isOfficial = !!(rp.author && (rp.author.username === ADMIN.username || rp.author.isAdmin));
      var isMainAdmin = !!(rp.author && rp.author.username === ADMIN.username);
      return {
        id: 'srv_' + rp.id,
        remoteId: rp.id,
        author: {
          key: isMainAdmin ? 'u_official' : ('srv_u' + rp.author.id),
          name: isMainAdmin ? ADMIN.name : rp.author.nickname,
          handle: isMainAdmin ? ADMIN.handle : rp.author.username,
          verified: isMainAdmin ? ADMIN.verified : false,
          official: isOfficial,
          me: mine
        },
        text: rp.text || '',
        media: (rp.media || []).map(function (m) {
          var src = Srv.abs(m.url);
          return {
            id: 'srvm_' + m.id,
            rid: m.id,
            type: /^video\//.test(m.mime || '') ? 'video' : 'image',
            src: src,
            /* 服务器上的封面 + 真实宽高比：信息流直接显示封面，不用为了首帧去下载视频 */
            poster: m.poster ? Srv.abs(m.poster) : '',
            size: Number(m.size) || 0,
            ratio: Number(m.ratio) || 0
          };
        }),
        createdAt: Date.parse(rp.createdAt) || Date.now(),
        likes: rp.likeCount || 0,
        liked: !!rp.liked,
        reposts: rp.repostCount || 0,
        reposted: !!rp.reposted,
        replies: rp.commentCount || 0,
        views: rp.viewCount || 0,
        private: !!rp.private,
        sensitive: !!rp.sensitive
      };
    },
    toComment: function (rc, localPostId) {
      var me = srvUser();
      var mine = !!(me && rc.author && rc.author.id === me.id);
      return {
        id: 'srv_c' + rc.id,
        postId: localPostId,
        text: rc.text,
        author: {
          key: 'srv_u' + rc.author.id,
          name: rc.author.nickname,
          handle: rc.author.username,
          me: mine
        },
        replyTo: rc.replyTo ? {
          id: 'srv_c' + rc.replyTo.id,
          name: rc.replyTo.nickname,
          handle: rc.replyTo.username
        } : null,
        /* 回复里的图 / 视频：服务器给的是 /media/<id>，这里补上服务器前缀 */
        media: (rc.media || []).map(function (m) {
          var base = (typeof srvBase === 'function' && srvBase()) || '';
          var url = m.url || ('/media/' + m.id);
          var src = /^https?:/i.test(url) ? url : (url.charAt(0) === '/' ? base + url : url);
          var poster = m.poster || '';
          if (poster && !/^https?:/i.test(poster)) poster = base + poster;
          return {
            id: m.id, rid: m.id,
            type: /^video\//i.test(m.mime || '') ? 'video' : 'image',
            mime: m.mime || '', size: m.size || 0,
            src: src, poster: poster
          };
        }),
        createdAt: Date.parse(rc.createdAt) || Date.now()
      };
    },
    /* 把本机尚未上传的自己的帖子补传到服务器（旧数据迁移） */
    pushLocal: function () {
      if (Srv._pushP) return Srv._pushP;
      var pending = (state.posts || []).filter(function (p) {
        if (!p || p.remoteId || p.deleted || !p.author) return false;
        /* 只上传真实用户自己发布的帖子：人机帖和 U 官方内置帖不传服务器 */
        if (p.author.bot) return false;
        if (p.author.official || p.author.handle === 'u_official') return false;
        /* 上传失败过的帖子 60 秒内不再重试：300MB 的视频不能每 5 秒重传一次 */
        if (p.upFail && Date.now() - p.upFail < 60000) return false;
        return sameAuthor(p.author);
      });
      if (!pending.length) return Promise.resolve(0);
      var done = 0;
      var chain = Promise.resolve();
      pending.slice(0, 20).forEach(function (p) {
        chain = chain.then(function () {
          return pushOnePost(p).then(function () { done++; }, function (err) {
            console.warn('补传失败', err);
            p.upFail = Date.now();
            return dbPut('posts', p).catch(function () {});
          });
        });
      });
      Srv._pushP = chain.then(function () {
        Srv._pushP = null;
        return done;
      }).catch(function (e) {
        Srv._pushP = null;
        console.warn('本机帖子补传失败', e);
        return done;
      });
      return Srv._pushP;
    },
    /* 拉取服务器帖子并合并进本地缓存，返回服务器帖子数量 */
    sync: function () {
      if (!Srv.canSync()) return Promise.resolve(0);
      return Srv.pushLocal().catch(function () { return 0; }).then(function () {
        /* 先校验账号状态：被封禁时触发全局锁定弹窗 */
        return Srv.raw('/api/me').catch(function () { return null; });
      }).then(function () {
        /* 时间线一页 40 条（原来 100 条，公网带宽窄时这一页就是几百 KB），
           再单独拉一页官方帖给「为你推荐」用 —— 机器人帖多的时候官方帖会被挤到 100 条之外。 */
        return Promise.all([
          Srv.raw('/api/posts?limit=40').catch(function () { return null; }),
          Srv.raw('/api/post-ids').catch(function () { return null; }),
          Srv.raw('/api/posts?limit=40&official=1').catch(function () { return null; })
        ]);
      }).then(function (res) {
        var d = res[0];
        var idsData = res[1];
        var offl = res[2];
        var list = (d && d.posts) || [];
        /* 官方帖那页可能有时间线里没抓到的（在 40 条之外），按 id 去重后补进来 */
        if (offl && Array.isArray(offl.posts) && offl.posts.length) {
          var seen = {};
          list.forEach(function (x) { seen[x.id] = 1; });
          offl.posts.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = 1; list.push(x); } });
        }
        var serverIds = {};
        if (idsData && Array.isArray(idsData.ids)) {
          idsData.ids.forEach(function (id) { serverIds[id] = 1; });
        } else {
          list.forEach(function (rp) { serverIds[rp.id] = 1; });
        }

        var jobs = [];
        /* 服务器指令大于本机：服务器已删除的帖子，本机同步删除帖子、媒体与评论 */
        var removedComments = [];
        state.posts = state.posts.filter(function (p) {
          if (p.remoteId && !serverIds[p.remoteId] && !p.deleted) {
            jobs.push(dbDel('posts', p.id));
            /* 记录墓碑，防止局域网里的其他手机把已删帖子又传回来 */
            lanMarkDeleted(p.id);
            lanMarkDeleted('srv_' + p.remoteId);
            if (state.revealed) delete state.revealed[p.id];
            (state.allComments || []).forEach(function (c) {
              if (c.postId === p.id) removedComments.push(c.id);
            });
            return false;
          }
          return true;
        });
        if (removedComments.length) {
          state.allComments = state.allComments.filter(function (c) {
            return removedComments.indexOf(c.id) < 0;
          });
          removedComments.forEach(function (cid) { jobs.push(dbDel('comments', cid)); });
        }

        list.forEach(function (rp) {
          var local = null;
          for (var i = 0; i < state.posts.length; i++) {
            if (state.posts[i].remoteId === rp.id) { local = state.posts[i]; break; }
          }
          if (local) {
            local.likes = rp.likeCount;
            local.liked = !!rp.liked;
            local.reposts = rp.repostCount || 0;
            local.reposted = !!rp.reposted;
            local.replies = rp.commentCount;
            local.views = rp.viewCount || local.views || 0;
            if (rp.author && rp.author.isAdmin && local.author) local.author.official = true;
            jobs.push(DataAPI.updatePost(local));
            return;
          }
          var post = Srv.toLocal(rp);
          state.posts.push(post);
          jobs.push(DataAPI.updatePost(post));
        });
        /* 同一个服务器帖只保留一条本机记录：整帖重发 / 多设备同时同步都会留副本 */
        var seenRemote = {};
        state.posts = state.posts.filter(function (p) {
          if (!p || p.remoteId == null) return true;
          var k = String(p.remoteId);
          if (seenRemote[k]) { jobs.push(dbDel('posts', p.id)); return false; }
          seenRemote[k] = 1;
          return true;
        });
        state.posts.sort(function (a, b) { return b.createdAt - a.createdAt; });
        /* 数据签名：id + 各项计数，签名没变化就说明这 5 秒里没有任何新东西 */
        var sig = list.length + '|' + removedComments.length + '|' + list.map(function (rp) {
          return rp.id + ':' + (rp.likeCount || 0) + ':' + (rp.commentCount || 0) + ':' + (rp.repostCount || 0) + ':' + (rp.viewCount || 0);
        }).join(',');
        var changed = Srv._sig !== sig;
        Srv._sig = sig;
        return Promise.all(jobs).then(function () { return { count: list.length, changed: changed }; });
      });
    }
  };

  /* 服务器操作统一入口：令牌过期时自动重新登录并重试一次，避免点赞/转帖/关注没上传 */
  function srvRetry(fn) {
    return Srv.ensure().then(fn).catch(function (e) {
      if (Srv.on() && !srvToken()) return Srv.ensure().then(fn);
      throw e;
    });
  }

  /* ---------------- state ---------------- */
  var state = {
    posts: [],
    notes: [],
    comments: [],
    allComments: [],
    detailPostId: null,
    viewer: { media: [], index: 0 },
    tab: 'feed',
    feedTab: 'rec',
    notifyTab: 'official',
    dmMsgId: null,
    dmPeer: null,
    dmMessages: [],
    conversations: [],
    remoteNotifications: [],
    userDirectory: {},
    remoteUserProfile: null,
    userActivity: null,
    userTab: 'posts',
    replyTo: null,
    searchSeq: 0,
    composeMedia: [],
    composeChannel: 'talk',
    drafts: [],
    editingDraftId: null,
    editingNote: null,
    editingPostId: null,
    menuPostId: null,
    lastLongPress: 0,
    revealed: {},
    viewed: {},
    viewedOpen: {},
    myCounts: null,
    banned: false
  };
  var urlCache = new Map();
  var urlBytes = new Map();
  var urlMeta = new Map();   /* 本地媒体信息 {name,type,size}，给设置里的存储用量列表用 */

  /* 封面地址统一走这里：服务器返回的是相对地址 /media/<id>，网页版跑在 8765 时直接拼相对地址会 404 */
  function posterSrc(m) {
    var p = m && m.poster;
    if (!p) return '';
    if (/^(blob:|data:)/i.test(p)) return p;
    /* 视频封面统一走缩略图接口：服务端只给不超过 720p 的 JPEG（等比缩放、不放大），
       列表里绝不加载封面原图，省流量也省解码内存 */
    var pm = /\/media\/([a-f0-9]{24})(?:\?.*)?$/.exec(p);
    if (pm) {
      var abs = /^https?:/i.test(p) ? p : (Srv.on() ? Srv.abs(p) : p);
      return abs.replace(/\/media\/([a-f0-9]{24})(?:\?.*)?$/, '/api/media/$1/thumb');
    }
    return Srv.on() ? Srv.abs(p) : p;
  }
  function mediaSrc(m) {
    /* 自动切换服务器端口后，旧缓存里的绝对媒体地址也要跟随新地址 */
    if (m.rid && m.src && srvBase() && /^https?:\/\//i.test(m.src)) {
      m.src = m.src.replace(/^https?:\/\/[^\/]+/i, srvBase());
    }
    if (m.src) {
      /* blob: 地址只在创建它的那次会话里有效，旧数据里的 blob 地址跨启动必失效 */
      if (!/^blob:/i.test(m.src) || urlCache.get(m.id) === m.src) return m.src;
    }
    if (!m.blob) return '';
    if (!urlCache.has(m.id)) {
      try {
        var b = (typeof Blob !== 'undefined' && m.blob instanceof Blob) ? m.blob : new Blob([m.blob]);
        urlCache.set(m.id, URL.createObjectURL(b));
        urlBytes.set(m.id, b.size || 0);
        urlMeta.set(m.id, { name: m.name || '', type: m.type || b.type || '', size: b.size || 0 });
      } catch (e) {
        return '';
      }
    }
    return urlCache.get(m.id);
  }

  /* ---------------- demo content ---------------- */
  function cover(a, b, label, sub) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>' +
      '<rect width="900" height="1100" fill="url(#g)"/>' +
      '<circle cx="720" cy="230" r="180" fill="rgba(255,255,255,.14)"/>' +
      '<circle cx="140" cy="930" r="250" fill="rgba(0,0,0,.16)"/>' +
      (label ? '<text x="70" y="590" font-family="Helvetica,Arial,sans-serif" font-size="190" font-weight="bold" fill="#fff">' + label + '</text>' : '') +
      (sub ? '<text x="76" y="666" font-family="Helvetica,Arial,sans-serif" font-size="42" fill="rgba(255,255,255,.8)">' + sub + '</text>' : '') +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  function migrateDemoCovers() {
    var fixes = {
    };
    var jobs = [];
    Object.keys(fixes).forEach(function (id) {
      var p = null;
      for (var i = 0; i < state.posts.length; i++) if (state.posts[i].id === id) p = state.posts[i];
      if (!p) return;
      var f = fixes[id];
      var changed = false;
      if (f.text && p.text !== f.text) { p.text = f.text; changed = true; }
      if (p.media && p.media[0] && p.media[0].src !== f.src) { p.media[0].src = f.src; changed = true; }
      if (changed) jobs.push(DataAPI.updatePost(p));
    });
    return Promise.all(jobs);
  }

  function defaultOfficialPosts() {
    return [];
  }

  /* 老设备上的官方帖曾经带假数据，一次性清空，改成真实计数 */
  function resetDemoStats() {
    if (LS.getItem('u-demo-stats-reset') === '1') return Promise.resolve(0);
    LS.setItem('u-demo-stats-reset', '1');
    var jobs = [];
    ['demo-3'].forEach(function (id) {
      var p = null;
      for (var i = 0; i < state.posts.length; i++) if (state.posts[i].id === id) p = state.posts[i];
      if (!p) return;
      p.views = 0;
      p.likes = 0;
      p.reposts = 0;
      p.replies = 0;
      jobs.push(DataAPI.updatePost(p));
    });
    return Promise.all(jobs);
  }

  /* 已下线的官方示例帖（demo-1 / demo-2 / demo-3），老设备上一次性删除 */
  function removeRetiredDemo() {
    if (LS.getItem('u-demo-retired2') === '1') return Promise.resolve();
    LS.setItem('u-demo-retired2', '1');
    var retired = ['demo-1', 'demo-2', 'demo-3'];
    var hit = [];
    state.posts = state.posts.filter(function (p) {
      if (retired.indexOf(p.id) >= 0) { hit.push(p.id); return false; }
      return true;
    });
    state.comments = state.comments.filter(function (cm) { return retired.indexOf(cm.postId) < 0; });
    return Promise.all(hit.map(function (id) { return dbDel('posts', id); }));
  }

  function seedIfEmpty() {
    if (LS.getItem('u-seeded') === '1') return Promise.resolve();
    LS.setItem('u-seeded', '1');
    var notes = [
      {
        id: 'demo-note-1',
        title: '欢迎使用 U 备忘录',
        content: '· 点右上角 + 新建\n· 点任意一条即可编辑\n· 所有内容保存在本机，卸载 App 即清除',
        createdAt: Date.now() - 1000 * 60 * 60 * 5,
        updatedAt: Date.now() - 1000 * 60 * 60 * 5
      }
    ];
    return Promise.all(notes.map(function (n) { return dbPut('notes', n); }));
  }

  /* 官方内容兜底：不管换账号、清过数据还是首次登录，缺少就补上，
     保证「为你推荐」对用户和游客都有内容可看 */
  function ensureOfficialPosts() {
    var have = {};
    (state.posts || []).forEach(function (p) {
      if (p && p.author && (p.author.official || p.author.handle === 'u_official')) have[p.id] = 1;
    });
    var missing = defaultOfficialPosts().filter(function (p) { return !have[p.id]; });
    if (!missing.length) return Promise.resolve(0);
    return Promise.all(missing.map(function (p) { return dbPut('posts', p); })).then(function () {
      missing.forEach(function (p) { state.posts.push(p); });
      state.posts.sort(function (a, b) { return b.createdAt - a.createdAt; });
      return missing.length;
    });
  }

  /* ---------------- video player ---------------- */
  var PLAY_RATES = [1, 1.25, 1.5, 2, 0.5];

  function pauseOthers(current) {
    $$('.vplayer video').forEach(function (v) {
      if (v !== current && !v.paused) v.pause();
    });
  }

  /* 离开页面 / 切换菜单时停止所有视频，避免后台继续出声 */
  function pauseAllVideos() {
    $$('video').forEach(function (v) {
      if (!v.paused) {
        try { v.pause(); } catch (e) { /* 忽略 */ }
      }
    });
  }

  /* 部分 Android WebView 在 preload=metadata 时不绘制首帧：
     主动 seek 到极小的位置，让封面直接显示画面而不是黑屏 */

  function fmtTime(t) {
    /* 流媒体/直播的 duration 可能是 Infinity，统一显示为 --:-- */
    if (!isFinite(t) || t < 0) return '--:--';
    t = Math.floor(t);
    var h = Math.floor(t / 3600);
    var m = Math.floor((t % 3600) / 60);
    var s = t % 60;
    var ss = (s < 10 ? '0' : '') + s;
    if (h > 0) {
      var mm = (m < 10 ? '0' : '') + m;
      return h + ':' + mm + ':' + ss;
    }
    return m + ':' + ss;
  }

  /* 离开页面时卸载视频：暂停并移除 src，让浏览器释放已缓冲/下载的媒体数据，
     避免在后台继续占用手机内存与流量。下次点开播放时再按需加载。 */
  /* ---------------- 视频本地缓存 ----------------
     点开视频才下载，退出播放 10 秒后把刚看过的那段从本机删掉。 */
  var VCACHE_NAME = 'u-video-cache-v1';
  var vcacheDropTimers = {};
  function vcacheKey(url) {
    try { return new URL(url, location.href).href; } catch (e) { return ''; }
  }
  function vcacheDrop(url) {
    var key = vcacheKey(url);
    if (!key || !window.caches) return;
    caches.open(VCACHE_NAME).then(function (cache) { return cache.delete(key); }).catch(function () {});
  }
  /* 退出播放 10 秒后再删：这点时间窗内用户可能又点回来，避免反复下载 */
  function vcacheScheduleDrop(urls) {
    (urls || []).forEach(function (url) {
      var key = vcacheKey(url);
      if (!key) return;
      if (vcacheDropTimers[key]) clearTimeout(vcacheDropTimers[key]);
      vcacheDropTimers[key] = setTimeout(function () {
        delete vcacheDropTimers[key];
        vcacheDrop(url);
      }, 10000);
    });
  }

  function releaseVideos(root) {
    var list = root
      ? (root.querySelectorAll ? root.querySelectorAll('video') : [])
      : document.querySelectorAll('video');
    list.forEach(function (v) {
      /* 发布页里的本地预览视频不释放，避免选完文件回来预览消失 */
      if (v.closest && v.closest('#composePreview')) return;
      try {
        v.pause();
        v.removeAttribute('src');
        v.load();
        /* 标记为已释放：错误恢复逻辑不要再把地址补回去，否则等于没有卸载 */
        v.dataset.released = '1';
        if (v.getAttribute('poster')) v.removeAttribute('poster');
      } catch (e) { /* 忽略 */ }
    });
  }

  /* 信息流里的视频默认不写 src（preload=none），只有用户点击播放时才把真实地址填进去开始加载 */
  /* 播放时检测编码是否真的能解出画面：解不出来就在方块上标「格式不支持」，不再是一块黑屏 */
  function watchVideoDecode(video) {
    if (!video || video.dataset.wd) return;
    video.dataset.wd = '1';
    var mark = function () {
      var vp = video.closest ? video.closest('.vplayer') : null;
      if (vp) vp.classList.add('nodecode');
    };
    var check = function () { if (!video.videoWidth || !video.videoHeight) mark(); };
    video.addEventListener('loadeddata', check, { once: true });
    video.addEventListener('error', mark, { once: true });
  }

  function ensureVideoSrc(video) {
    if (!video) return;
    watchVideoDecode(video);
    delete video.dataset.released;
    if (video.src) return;
    var src = video.dataset && video.dataset.src;
    if (src) {
      video.src = src;
      try { video.load(); } catch (e) { /* 忽略 */ }
    }
  }

  function toggleInlineVideo(vp) {
    var video = vp && $('video', vp);
    if (!video) return;
    if (video.paused || video.ended) {
      pauseOthers(video);
      video.muted = false;
      ensureVideoSrc(video);
      /* 点开才缓存：先把要播的这段拉进本地缓存，进度条上的缓存条随之变长 */
      video.play().catch(function () { toast('该视频无法播放'); });
    } else {
      video.pause();
    }
  }

  /* 封面按需加载 + 离开可视区域就释放：
     · 进入视口附近 → 才把 data-poster 挂成 poster（发一次封面请求）
     · 离开视口 → 暂停、卸载视频源、摘掉封面，连接和内存一起放掉 */
  var vpIO = null;
  function attachPosterEl(vp) {
    var v = vp.tagName === 'VIDEO' ? vp : $('video', vp);
    if (!v || !v.dataset.poster) return;
    if (!v.getAttribute('poster')) v.setAttribute('poster', v.dataset.poster);
  }
  function detachPosterEl(vp) {
    var v = $('video', vp);
    if (v && v.getAttribute('poster')) v.removeAttribute('poster');
  }
  function releaseInlineVideo(vp) {
    var v = $('video', vp);
    if (!v) return;
    if (!v.getAttribute('src') && !v.currentSrc) return;
    if (v.paused === false) { try { v.pause(); } catch (e) { /* 忽略 */ } }
    try {
      v.removeAttribute('src');
      v.load();
      v.dataset.released = '1';
    } catch (e) { /* 忽略 */ }
  }
  function viewportGuard(root) {
    var list = $$('.vplayer', root || document).filter(function (vp) {
      return vp.dataset.vpg !== '1' && !(vp.closest && vp.closest('#mvContent'));
    });
    if (!list.length) return;
    if (typeof IntersectionObserver !== 'function') { list.forEach(attachPosterEl); return; }
    if (!vpIO) {
      vpIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var vp = e.target;
          if (e.isIntersecting) { attachPosterEl(vp); return; }
          /* 滚出可视区域：视频（含正在播的）停掉并卸载，封面也摘掉 */
          releaseInlineVideo(vp);
          detachPosterEl(vp);
        });
      }, { rootMargin: '320px 0px' });
    }
    list.forEach(function (vp) { vp.dataset.vpg = '1'; vpIO.observe(vp); });
  }

  function initPlayers(root) {
    viewportGuard(root);
    $$('.vplayer', root || document).forEach(function (vp) {
      if (vp.dataset.init === '1') return;
      vp.dataset.init = '1';

      var video = $('video', vp);
      var stage = $('.vstage', vp);
      if (!video) return;
      var badge = $('.vrate', vp);
      var playBtn = $('[data-vact="play"]', vp);
      var speedBtn = $('.vspeed', vp);
      var track = $('.vtrack', vp);
      var fill = $('.vfill', vp);
      var knob = $('.vknob', vp);
      var timeEl = $('.vtime', vp);
      var bufEl = $('.vbuf', vp);
      if (!badge || !playBtn || !speedBtn || !track || !fill || !knob || !timeEl) {
        /* 网格视频没有控制条：点击画面直接播放/暂停，播放状态用于隐藏封面上的播放按钮 */
        video.addEventListener('play', function () { pauseOthers(video); vp.classList.add('playing'); });
        video.addEventListener('pause', function () { vp.classList.remove('playing'); });
        video.addEventListener('ended', function () { vp.classList.remove('playing'); });
        return;
      }

      var rateIndex = 0, dragging = false, suppressClick = false;
      var pressTimer = null, longPress = false, prevRate = 1;

      /* 缓存条：显示「已经下载到本机、拖过去就能立刻播」的那一段 */
      function paintBuffer(finiteD, cur) {
        if (!bufEl) return;
        if (!finiteD) { bufEl.style.width = '0%'; return; }
        var ranges = null;
        try { ranges = video.buffered; } catch (e) { ranges = null; }
        if (!ranges || !ranges.length) { bufEl.style.width = '0%'; return; }
        var end = 0;
        for (var i = 0; i < ranges.length; i++) {
          /* 当前正在播的那一段优先，其次取最靠后的已缓存点 */
          if (ranges.start(i) <= cur + 0.4 && ranges.end(i) >= cur) { end = ranges.end(i); break; }
          if (ranges.end(i) > end) end = ranges.end(i);
        }
        bufEl.style.width = Math.min(100, (end / finiteD) * 100) + '%';
      }

      function paint() {
        var d = video.duration;
        var finiteD = (typeof d === 'number' && isFinite(d) && d > 0) ? d : 0;
        var cur = video.currentTime || 0;
        if (!isFinite(cur) || cur < 0) cur = 0;
        /* 拖动过程中 currentTime 可能短暂超过时长，避免出现 0:05 / 0:04 */
        if (finiteD && cur > finiteD) cur = finiteD;
        var p = finiteD ? cur / finiteD : 0;
        fill.style.width = (p * 100) + '%';
        knob.style.left = (p * 100) + '%';
        paintBuffer(finiteD, cur);
        /* 时长未知（还没拿到 metadata）时显示 --:--，拿到后会自动刷新 */
        timeEl.textContent = fmtTime(cur) + ' / ' + (finiteD ? fmtTime(finiteD) : '--:--');
      }

      function syncPlayIcon() {
        var playing = !video.paused && !video.ended;
        vp.classList.toggle('playing', playing);
        playBtn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
        /* 查看页中间的大按钮跟着换图标：播放中显示暂停，暂停时显示播放 */
        var bp = vp.querySelector('.vbigplay span');
        if (bp && vp.classList.contains('mv-player')) bp.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
      }

      function toggle() {
        if (video.paused) {
          ensureVideoSrc(video);
          video.play().catch(function () { toast('该视频无法播放'); });
        } else {
          video.pause();
        }
      }

      var pendingSeek = -1;
      function seekAt(clientX) {
        var r = track.getBoundingClientRect();
        if (!r.width) return;
        var p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        var d = video.duration;
        if (isFinite(d) && d > 0) {
          video.currentTime = p * d;
          paint();
        } else {
          /* 还没拿到时长：先只拉取 metadata，等时长出来后再跳到目标位置 */
          pendingSeek = p;
          fill.style.width = (p * 100) + '%';
          knob.style.left = (p * 100) + '%';
          video.preload = 'metadata';
          ensureVideoSrc(video);
        }
      }
      function applyPendingSeek() {
        if (pendingSeek < 0) return;
        var d = video.duration;
        if (!isFinite(d) || d <= 0) return;
        var p = pendingSeek;
        pendingSeek = -1;
        try { video.currentTime = p * d; } catch (e) { /* 忽略 */ }
        paint();
      }

      /* duration 在不同 WebView 上可能晚于 loadedmetadata 才就绪，
         监听多个事件，保证总时长/进度条时间能及时刷新 */
      ['loadedmetadata', 'durationchange', 'loadeddata', 'canplay', 'seeked', 'progress'].forEach(function (ev) {
        video.addEventListener(ev, paint);
      });
      video.addEventListener('loadedmetadata', applyPendingSeek);
      video.addEventListener('durationchange', applyPendingSeek);
      video.addEventListener('timeupdate', paint);
      video.addEventListener('play', function () { pauseOthers(video); syncPlayIcon(); });
      video.addEventListener('pause', syncPlayIcon);
      video.addEventListener('ended', function () { syncPlayIcon(); paint(); });

      playBtn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });

      var inViewer = vp.classList.contains('mv-player');
      stage.addEventListener('click', function () {
        if (suppressClick) { suppressClick = false; return; }
        /* 查看页里点画面只收/展下方按键（由 mvTapToggle 处理），播放/暂停交给中间那颗按钮；
           帖子里的播放器：点画面打开二级查看页（信息流代理里处理） */
        if (!inViewer) return;
      });
      /* 查看页中间那颗大按钮：只有点它本身才切播放/暂停，点别处只弹按钮 */
      var bigPlay = vp.querySelector('.vbigplay');
      if (bigPlay) {
        bigPlay.addEventListener('click', function (e) {
          if (!inViewer) return;
          e.stopPropagation();
          suppressClick = true;
          toggle();
        });
      }

      speedBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        rateIndex = (rateIndex + 1) % PLAY_RATES.length;
        var rate = PLAY_RATES[rateIndex];
        video.playbackRate = rate;
        speedBtn.textContent = rate + 'x';
      });

      track.addEventListener('pointerdown', function (e) {
        dragging = true;
        if (track.setPointerCapture) {
          try { track.setPointerCapture(e.pointerId); } catch (err) {}
        }
        seekAt(e.clientX);
      });
      track.addEventListener('pointermove', function (e) { if (dragging) seekAt(e.clientX); });
      track.addEventListener('pointerup', function () { dragging = false; });
      track.addEventListener('pointercancel', function () { dragging = false; });

      // 长按画面：临时 2 倍速，松手恢复
      stage.addEventListener('pointerdown', function () {
        prevRate = video.playbackRate;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(function () {
          longPress = true;
          suppressClick = true;
          video.playbackRate = 2;
          badge.classList.add('on');
          if (video.paused) { ensureVideoSrc(video); video.play().catch(function () {}); }
        }, 420);
      });
      function endPress() {
        clearTimeout(pressTimer);
        if (longPress) {
          video.playbackRate = prevRate;
          badge.classList.remove('on');
          longPress = false;
          state.lastLongPress = Date.now();
          setTimeout(function () { suppressClick = false; }, 150);
        }
      }
      stage.addEventListener('pointerup', endPress);
      stage.addEventListener('pointercancel', endPress);
      stage.addEventListener('pointerleave', endPress);

      /* 信息流里的视频一律不预读：连 metadata 都不主动去拉，
         只有用户点播放（或拖动进度条）时才把地址填进去，避免自动下载视频 */

      paint();
      syncPlayIcon();
    });
  }

  /* ---------------- render: posts ---------------- */
  function mediaHTML(media, post) {
    if (!media || !media.length) return '';
    var n = Math.min(media.length, MEDIA_MAX);
    /* 1~4 用原来的紧凑九宫格，5 个以上统一切成每行 3 列 */
    var cls = 'pmedia ' + (n > 4 ? 'mm' : 'm' + n);
    /* 遮罩只看「18+ 标注」，和「仅自己可见」是两件事：私密帖别人根本读不到，敏感帖别人能看到但图要挡 */
    var isPrivate = !!(post && post.sensitive);
    var revealedNow = !!(post && state.revealed && state.revealed[post.id]);
    var priv = isPrivate && !revealedNow;
    var inner = media.slice(0, MEDIA_MAX).map(function (m, i) {
      /* 地址可能只存在于 src / url / rid 三者之一（比如编辑保存后的旧帖），
         先统一解析一次，别一看没有 src 就判死成「媒体同步中…」 */
      var src = mediaSrc(m);
      if (!src && m.url) src = m.url;
      if (!src && m.rid && typeof srvBase === 'function' && srvBase()) src = srvBase() + '/media/' + m.rid;
      if (!src) {
        return '<div class="pend" data-midx="' + i + '">媒体同步中…</div>';
      }
      if (m.type === 'video') {
        /* 封面不写 poster 属性（poster 会被浏览器立刻下载，一屏帖子光封面就 1.8MB）；
           先放 data-poster，等这块真的滚到眼前再挂上去 */
        var posterAttr = posterSrc(m) ? ' data-poster="' + posterSrc(m) + '"' : '';
        /* 多附件时视频作为方块封面展示，点击画面直接播放，右下角按钮放大观看 */
        if (n > 1) {
          return '<div class="vplayer vgrid" data-vid="' + m.id + '" data-midx="' + i + '">' +
            '<div class="vstage"><video data-src="' + src + '" data-mid="' + m.id + '"' + posterAttr +
            ' muted playsinline webkit-playsinline preload="none"></video>' +
            '<div class="vbigplay"><span>' + PLAY_ICON + '</span></div>' +
            '<button class="vgexp" data-vact="expand" aria-label="放大观看">' + EXPAND_ICON + '</button>' +
            '</div>' +
            '</div>';
        }
        /* 单视频按真实宽高比展示封面：竖屏限高居中，横屏铺满宽度 */
        var arStyle = '';
        if (m.ratio) {
          arStyle = m.ratio < 1
            ? ' style="aspect-ratio:' + m.ratio + ';height:min(520px,72vh);width:auto;max-width:100%;margin:0 auto;display:block"'
            : ' style="aspect-ratio:' + m.ratio + '"';
        }
        return '<div class="vplayer" data-vid="' + m.id + '" data-midx="' + i + '">' +
          '<div class="vstage">' +
          '<video data-src="' + src + '" data-mid="' + m.id + '"' + posterAttr + arStyle + ' data-size="' + (m.size || 0) + '" data-ratio="' + (m.ratio || 0) + '" playsinline webkit-playsinline preload="none"></video>' +
          '<div class="vbigplay"><span>' + PLAY_ICON + '</span></div>' +
          '<div class="vrate">2x 倍速中</div>' +
          '</div>' +
          '<div class="vctrl">' +
          '<button class="vbtn" data-vact="play" aria-label="播放/暂停">' + PLAY_ICON + '</button>' +
          '<div class="vtrack" data-vact="track"><div class="vbuf"></div><div class="vfill"></div><div class="vknob"></div></div>' +
          '<span class="vtime">0:00 / 0:00</span>' +
          '<button class="vspeed" data-vact="speed">1x</button>' +
          '<button class="vbtn vexpand" data-vact="expand" aria-label="全屏查看">' + EXPAND_ICON + '</button>' +
          '</div></div>';
      }
      return '<img src="' + src + '" alt="" loading="lazy" decoding="async" draggable="false" data-mid="' + m.id + '" data-midx="' + i + '">';
    }).join('');
    var veil = isPrivate
      ? '<div class="pveil' + (revealedNow ? ' hide-mode' : '') + '">' +
        '<span class="pveil-badge">18+ 内容</span>' +
        '<p>可能包含敏感画面，点击「显示」查看</p>' +
        (revealedNow
          ? '<button class="pveil-btn" data-hide="' + post.id + '">隐藏</button>'
          : '<button class="pveil-btn" data-reveal="' + post.id + '">显示</button>') +
        '</div>'
      : '';
    return '<div class="' + cls + (priv ? ' private' : '') + '">' + inner + veil + '</div>';
  }

  function profileKey(a) { return (a && (a.key || a.handle)) || 'u_official'; }
  /* 官方账号在界面上统一显示 @admin：老数据与服务器身份里可能还留着 u_official */
  function isOfficialIdent(a) {
    return !!(a && (a.official || a.handle === 'u_official' || a.handle === 'bot_u_official' ||
      (ADMIN && a.handle === ADMIN.username)));
  }
  function dispHandle(a) { return isOfficialIdent(a) ? ADMIN.username : ((a && a.handle) || ''); }
  /* 搜索结果去重：同一个官方账号（本机身份 + 服务器身份）只留一行，优先留带 remoteId 的那条 */
  function dedupeOfficialUsers(list) {
    var out = [], idx = -1;
    (list || []).forEach(function (a) {
      if (isOfficialIdent(a)) {
        if (idx >= 0) {
          if (!out[idx].remoteId && a.remoteId) out[idx] = a;
          return;
        }
        idx = out.length;
      }
      out.push(a);
    });
    return out;
  }
  var PROFILE_CACHE = null;
  function loadProfiles() {
    if (PROFILE_CACHE) return PROFILE_CACHE;
    try { PROFILE_CACHE = JSON.parse(LS.getItem('u-profiles') || '{}') || {}; }
    catch (e) { PROFILE_CACHE = {}; }
    return PROFILE_CACHE;
  }
  function saveProfiles(m) {
    PROFILE_CACHE = m;
    LS.setItem('u-profiles', JSON.stringify(m));
  }
  function profileOf(a) { return loadProfiles()[profileKey(a)] || {}; }
  function defaultBio(a) {
    if (a && (a.official || a.handle === 'u_official')) return 'U 官方账号 · 发布官方文章';
    if (a && a.bot) return '随手记录生活里的小事。';
    return '随手记录，随手分享。';
  }
  function paintAvatar(el, a) {
    if (!el) return;
    var p = profileOf(a);
    el.classList.toggle('has-img', !!p.avatar);
    if (p.avatar) el.innerHTML = '<img src="' + p.avatar + '" alt="">';
    else el.textContent = ((a && a.name) || 'U').slice(0, 1);
  }
  function readImageFile(file, maxW, maxH, quality) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('read')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode')); };
        img.onload = function () {
          var scale = Math.min(1, maxW / img.width, maxH / img.height);
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          try { resolve(c.toDataURL('image/jpeg', quality || 0.8)); }
          catch (e) { reject(e); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function avatarHTML(a) {
    var p = profileOf(a);
    var k = esc(profileKey(a));
    if (p.avatar) return '<div class="avatar has-img" data-akey="' + k + '"><img src="' + p.avatar + '" alt=""></div>';
    return '<div class="avatar" data-akey="' + k + '">' + esc(((a && a.name) || 'U').slice(0, 1)) + '</div>';
  }

  /* 本机帖：还没上传成功的帖子只有这台设备看得到，界面上必须说清楚，
     并给一个能直接补传的按钮（以前只在后台悄悄重试，用户以为发了） */
  function isLocalOnlyPost(p) {
    if (!p || p.deleted || p.remoteId || !p.author) return false;
    if (p.author.bot) return false;
    if (p.author.official || p.author.handle === 'u_official') return false;
    return sameAuthor(p.author);
  }
  function localOnlyHTML(p) {
    if (!isLocalOnlyPost(p)) return '';
    var hint = Srv.canSync()
      ? '这条帖子还没有上传到服务器，其他设备看不到。'
      : '还没连接服务器，只有这台设备看得到。';
    return '<div class="localonly">' +
      '<div class="lo-h"><b>仅在本机可见</b><span>' + esc(hint) + '</span></div>' +
      '<button class="lo-btn" data-act="reupload">' + (Srv.canSync() ? '立即上传到服务器' : '连接服务器后上传') + '</button>' +
      '</div>';
  }

  function postHTML(p) {
    var a = p.author || ME;
    return '<article class="post" data-id="' + p.id + '">' +
      avatarHTML(a) +
      '<div class="post-main">' +
      '<div class="phead">' +
      '<span class="pname" data-akey="' + esc(profileKey(a)) + '">' + esc(a.name) + '</span>' +
      (a.verified ? ICON.verified : '') +
      '<span class="phandle">@' + esc(dispHandle(a)) + '</span>' +
      '<span class="dot">·</span><span class="ptime">' + ago(p.createdAt) + '</span>' +
      '<button class="pmore" data-act="more">···</button>' +
      '</div>' +
      (p.text ? '<div class="ptext">' + esc(p.text) + '</div>' : '') +
      localOnlyHTML(p) +
      mediaHTML(p.media, p) +
      '<div class="pactions">' +
      '<button data-act="reply">' + ICON.reply + '<span>' + fmt(p.replies) + '</span></button>' +
      '<button class="repost' + (p.reposted ? ' on' : '') + '" data-act="repost">' + ICON.repost + '<span>' + fmt(p.reposts) + '</span></button>' +
      '<button class="like' + (p.liked ? ' on' : '') + '" data-act="like">' +
      (p.liked ? ICON.heartFill : ICON.heart) + '<span>' + fmt(p.likes) + '</span></button>' +
      '<button data-act="views">' + ICON.views + '<span>' + fmt(p.views) + '</span></button>' +
      '<button class="share" data-act="share">' + ICON.share + '</button>' +
      '</div></div></article>';
  }

  function officialPosts() {
    return state.posts.filter(function (p) {
      return !p.deleted && p.author && (p.author.official || p.author.handle === 'u_official');
    });
  }

  function updatePostCountsInDom(p) {
    $$('.post[data-id="' + p.id + '"]').forEach(function (el) {
      var r = el.querySelector('[data-act="reply"] span');
      var l = el.querySelector('[data-act="like"] span');
      var v = el.querySelector('[data-act="views"] span');
      var repost = el.querySelector('[data-act="repost"]');
      if (r) r.textContent = fmt(p.replies);
      if (l) l.textContent = fmt(p.likes);
      if (v) v.textContent = fmt(p.views);
      if (repost) {
        repost.classList.toggle('on', !!p.reposted);
        repost.innerHTML = ICON.repost + '<span>' + fmt(p.reposts) + '</span>';
      }
    });
  }
  function updateDetailStats(p) {
    var cnt = $('#detailReplies');
    if (cnt) cnt.textContent = postComments(p).length;
    var rows = $$('#postBody .detail-stat b');
    if (rows.length >= 3) {
      rows[0].textContent = fmt((p.replies || 0));
      rows[1].textContent = fmt((p.likes || 0));
      rows[2].textContent = fmt((p.views || 0));
    }
  }

  /* 真实浏览量：本次会话第一次看到这条帖子时 +1；服务器帖子同步写回后台 */
  /* 浏览量：列表里刷到就算一次曝光；点开帖子详情再补一次（force=true）。
     服务器端对同一 IP+帖子有 30 分钟去重，所以本地多算一次不会把线上数据刷爆。 */
  function countPostView(p, force) {
    if (!p || !p.id || p.deleted) return;
    if (!force && state.viewed[p.id]) return;
    if (force && state.viewedOpen[p.id]) return;
    if (force) state.viewedOpen[p.id] = 1;
    state.viewed[p.id] = 1;
    p.views = (p.views || 0) + 1;
    updatePostCountsInDom(p);
    updateDetailStats(p);
    if (p.remoteId && srvToken()) {
      Srv.view(p.remoteId).then(function (r) {
        if (r && typeof r.views === 'number') {
          p.views = r.views;
          updatePostCountsInDom(p);
          updateDetailStats(p);
        }
      }).catch(function () {});
      return;
    }
    DataAPI.updatePost(p).catch(function () {});
  }

  function myPosts() {
    return state.posts.filter(function (p) {
      if (p.deleted) return false;
      if (!p.author) return true;
      /* 同样只按当前账号比对，避免切换账号后“我的”里混入上一个账号的内容 */
      return sameAuthor(p.author);
    });
  }

  function renderFeed() {
    var list = $('#feedList');
    var posts = feedPosts();
    if (!posts.length) {
      list.innerHTML = '<div class="empty">' +
        '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12.5h5"/></svg>' +
        '<h3>暂无内容</h3></div>';
      return;
    }
    list.innerHTML = posts.map(postHTML).join('');
    posts.forEach(countPostView);
    initPlayers(list);
    setTimeout(hydrateVideoCovers, 400);
  }

  /* 首页「为你推荐」只放 U 官方 发布的内容：
     官方账号在本机发的帖（author.official / @u_official）与服务器同步下来的官方帖（@admin）都算；
     普通用户、游客、人机发的内容在「说说」页，不进推荐流。
     只认作者身份，不看 channel / remoteId —— 官方帖同步到任何账号上都要看得见。 */
  function isOfficialAuthor(a) {
    if (!a) return false;
    return !!(a.official || a.handle === 'u_official' ||
      (ADMIN && a.handle === ADMIN.username));
  }
  function feedPosts() {
    return state.posts.filter(function (p) {
      if (p.deleted || !p.author) return false;
      if (isBlockedAuthor(p.author)) return false;
      if (!isOfficialAuthor(p.author)) return false;
      if (p.private && !sameAuthor(p.author)) return false;
      return true;
    }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }

  function talkPosts() {
    return state.posts.filter(function (p) {
      return !p.deleted && !isBlockedAuthor(p.author) &&
        !(p.author && (p.author.official || p.author.handle === 'u_official')) &&
        p.channel !== 'feed';
    });
  }

  function renderTalk() {
    var list = $('#talkList');
    var posts = talkPosts();
    if (!posts.length) {
      list.innerHTML = '<div class="empty">' +
        '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L4 20.5l1.5-4.6A8.4 8.4 0 1 1 21 11.5z"/><path d="M8.5 11.5h7M8.5 15h4.5"/></svg>' +
        '<h3>还没有说说</h3><p>点击底部蓝色的 + ，<br>发布你的第一张图片、第一段视频或一句话。</p></div>';
      return;
    }
    list.innerHTML = posts.map(postHTML).join('');
    posts.forEach(countPostView);
    initPlayers(list);
    setTimeout(hydrateVideoCovers, 400);
  }

  /* ---------------- 搜索：帖子与用户名 ---------------- */
  function rememberRemoteUser(u) {
    if (!u || !u.id || !u.username) return null;
    var a = {
      key: 'srv_u' + u.id,
      remoteId: u.id,
      name: u.nickname || u.username,
      handle: u.username,
      verified: u.username === ADMIN.username,
      official: u.username === ADMIN.username
    };
    state.userDirectory[a.key] = a;
    state.userDirectory[a.handle] = a;
    return a;
  }

  function cacheRemotePost(rp, byRemote) {
    if (!rp || !rp.id) return null;
    var local = null;
    if (byRemote) { local = byRemote[String(rp.id)] || null; }
    else {
      for (var i = 0; i < state.posts.length; i++) {
        if (state.posts[i].remoteId === rp.id) { local = state.posts[i]; break; }
      }
    }
    var converted = Srv.toLocal(rp);
    rememberRemoteUser(rp.author);
    if (local) {
      var channel = local.channel;
      Object.keys(converted).forEach(function (k) { local[k] = converted[k]; });
      if (channel) local.channel = channel;
    } else {
      local = converted;
      state.posts.push(local);
    }
    DataAPI.updatePost(local).catch(function () {});
    return local;
  }

  function cacheRemotePosts(list) {
    if (!list || !list.length) return [];
    var byRemote = {};
    state.posts.forEach(function (p) { if (p && p.remoteId != null) byRemote[String(p.remoteId)] = p; });
    return list.map(function (rp) { return cacheRemotePost(rp, byRemote); }).filter(Boolean);
  }

  function renderSearch(q) {
    var box = $('#searchResults');
    if (!box) return;
    q = String(q || '').trim();
    if (!q) {
      box.innerHTML = '<div class="empty"><h3>找点感兴趣的</h3><p>输入帖子内容、昵称或 @用户名。</p></div>';
      return;
    }
    var needle = q.replace(/^@/, '').toLowerCase();
    function matchAuthor(a) {
      return a && (String(a.name || '').toLowerCase().indexOf(needle) >= 0 ||
        String(a.handle || '').toLowerCase().indexOf(needle) >= 0);
    }
    var remote = state.searchResults && state.searchResults.q === q ? state.searchResults : null;
    var userMap = {}, postMap = {};
    Object.keys(state.userDirectory).forEach(function (k) {
      var a = state.userDirectory[k];
      if (a && a.key === k && matchAuthor(a)) userMap[a.key] = a;
    });
    state.posts.forEach(function (p) {
      if (!p || p.deleted || isBlockedAuthor(p.author)) return;
      if (matchAuthor(p.author) && p.author && p.author.key) userMap[p.author.key] = p.author;
      if (String(p.text || '').toLowerCase().indexOf(needle) >= 0 || matchAuthor(p.author)) postMap[p.id] = p;
    });
    (remote ? remote.users : []).forEach(function (a) { userMap[a.key] = a; });
    (remote ? remote.postIds : []).forEach(function (id) {
      var p = findPost(id);
      if (p) postMap[id] = p;
    });
    var users = dedupeOfficialUsers(Object.keys(userMap).map(function (k) { return userMap[k]; })).slice(0, 30);
    var posts = Object.keys(postMap).map(function (k) { return postMap[k]; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 50);
    var kwEl = $('#searchKeyword'), subEl = $('#searchResultSub');
    if (kwEl) kwEl.textContent = '“' + q + '”';
    if (subEl) subEl.textContent = (state.searchLoading === q ? '正在搜索服务器…' : '用户 ' + users.length + ' · 帖子 ' + posts.length);
    var html = '';
    if (users.length) {
      html += '<div class="search-title">用户</div>' + users.map(function (a) {
        return '<button class="search-user" data-akey="' + esc(profileKey(a)) + '">' + avatarHTML(a) +
          '<span class="search-user-main"><b>' + esc(a.name || 'U') + '</b><span>@' + esc(dispHandle(a)) + '</span></span>' +
          ICON.chevron + '</button>';
      }).join('');
    }
    if (posts.length) html += '<div class="search-title">相关帖子</div>' + posts.map(postHTML).join('');
    if (!html) {
      html = '<div class="empty"><h3>没有找到相关内容</h3><p>' +
        (state.searchLoading === q ? '正在搜索服务器…' : '换个关键词试试，也可以输入完整用户名。') + '</p></div>';
    }
    box.innerHTML = html;
    initPlayers(box);
    setTimeout(hydrateVideoCovers, 300);
  }

  /* 搜索下拉：输入时只在搜索框下方预览，点条目才进二级结果页 */
  function searchLocalMatches(q, remote) {
    q = String(q || '').trim();
    var needle = q.replace(/^@/, '').toLowerCase();
    function matchAuthor(a) {
      return a && (String(a.name || '').toLowerCase().indexOf(needle) >= 0 ||
        String(a.handle || '').toLowerCase().indexOf(needle) >= 0);
    }
    var r = (remote && remote.q === q) ? remote : null;
    var userMap = {}, postMap = {};
    Object.keys(state.userDirectory).forEach(function (k) {
      var a = state.userDirectory[k];
      if (a && a.key === k && matchAuthor(a)) userMap[a.key] = a;
    });
    state.posts.forEach(function (p) {
      if (!p || p.deleted || isBlockedAuthor(p.author)) return;
      if (matchAuthor(p.author) && p.author && p.author.key) userMap[p.author.key] = p.author;
      if (String(p.text || '').toLowerCase().indexOf(needle) >= 0 || matchAuthor(p.author)) postMap[p.id] = p;
    });
    (r ? r.users : []).forEach(function (a) { userMap[a.key] = a; });
    (r ? r.postIds : []).forEach(function (id) {
      var p = findPost(id);
      if (p) postMap[id] = p;
    });
    return {
      users: dedupeOfficialUsers(Object.keys(userMap).map(function (k) { return userMap[k]; })).slice(0, 30),
      posts: Object.keys(postMap).map(function (k) { return postMap[k]; })
        .sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 50)
    };
  }

  var SUG_ICON_SEARCH = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg>';
  var SUG_ICON_USER = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.7"></circle><path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0"></path></svg>';
  var SUG_ICON_POST = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 5.5h15v13h-15z"></path><path d="M8 9.5h8M8 13.5h5"></path></svg>';

  function renderSearchSuggest(q, matches) {
    var box = $('#searchSug');
    if (!box) return;
    q = String(q || '').trim();
    if (!q) { box.setAttribute('data-h', ''); box.innerHTML = ''; return; }
    var m = matches || { users: [], posts: [] };
    var html = '<button class="sug-row" data-sgo="' + esc(q) + '">' +
      '<span class="sug-ico">' + SUG_ICON_SEARCH + '</span>' +
      '<span class="sug-main">搜索 <b>' + esc(q) + '</b></span></button>';
    m.users.slice(0, 4).forEach(function (a) {
      var label = a.name || a.handle || 'U';
      html += '<button class="sug-row" data-sgu="' + esc(a.handle || label) + '">' +
        '<span class="sug-ico">' + SUG_ICON_USER + '</span>' +
        '<span class="sug-main"><b>' + esc(label) + '</b><span class="sug-sub">@' + esc(dispHandle(a)) + '</span></span></button>';
    });
    m.posts.slice(0, 4).forEach(function (p) {
      var txt = (p.text || '').trim() || ((p.media && p.media.length) ? '（图片/视频）' : '（无文字）');
      html += '<button class="sug-row" data-sgp="' + esc(q) + '">' +
        '<span class="sug-ico">' + SUG_ICON_POST + '</span>' +
        '<span class="sug-main">' + esc(txt.slice(0, 40)) + '</span></button>';
    });
    /* 内容没变就别重写 DOM：连续输入时省掉整段布局与动画重启 */
    if (box.getAttribute('data-h') === html) return;
    box.setAttribute('data-h', html);
    box.innerHTML = html;
    if (html) openSearchHist(true);
  }

  function suggestSearch(q) {
    q = String(q || '').trim();
    /* 同一个关键词已经算过就直接跳过，避免每次输入重复匹配与重排 */
    if (state.sugQ === q && state.sugDone) return;
    state.sugQ = q;
    state.sugDone = false;
    state.searchSuggest = { q: q, users: [], postIds: [] };
    if (!q) { renderSearchSuggest('', null); return; }
    renderSearchSuggest(q, searchLocalMatches(q, null));
    if (!Srv.on()) { state.sugDone = true; return; }
    var sugCache = state.sugCache || (state.sugCache = {});
    var sugHit = sugCache[q];
    if (sugHit && Date.now() - sugHit.at < 20000) {
      state.searchSuggest = sugHit.res;
      state.sugDone = true;
      renderSearchSuggest(q, searchLocalMatches(q, sugHit.res));
      return;
    }
    state.sugSeq = (state.sugSeq || 0) + 1;
    var seq = state.sugSeq;
    var ready = Srv.canSync() ? Srv.ensure() : Promise.resolve(null);
    ready.then(function () { return Srv.search(q.replace(/^@/, '')); }).then(function (d) {
      if (seq !== state.sugSeq) return;
      var users = ((d && d.users) || []).map(rememberRemoteUser).filter(Boolean);
      var posts = cacheRemotePosts((d && d.posts) || []);
      state.sugDone = true;
      state.searchSuggest = { q: q, users: users, postIds: posts.map(function (p) { return p.id; }) };
      sugCache[q] = { at: Date.now(), res: state.searchSuggest };
      var sugKeys = Object.keys(sugCache);
      if (sugKeys.length > 30) delete sugCache[sugKeys[0]];
      renderSearchSuggest(q, searchLocalMatches(q, state.searchSuggest));
    }).catch(function () {});
  }

  function commitSearch(q) {
    q = String(q || '').trim();
    if (!q) return;
    var inp = $('#searchInput');
    if (inp) inp.value = q;
    addSearchHist(q);
    openSearchHist(false);
    runSearch(q, true);
    var view = $('#viewSearch');
    if (view) view.scrollTop = 0;
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }

  var searchTimer = null;
  function runSearch(q, force) {
    q = String(q || '').trim();
    var viewEl = $('#viewSearch');
    if (!force && viewEl && !viewEl.classList.contains('search-results-mode')) { suggestSearch(q); return; }
    state.searchQuery = q;
    state.searchResults = { q: q, users: [], postIds: [] };
    var seq = ++state.searchSeq;
    if (!q) { state.searchLoading = ''; setSearchMode('home'); renderSearch(''); return; }
    setSearchMode('results');
    state.searchLoading = q;
    renderSearch(q);
    if (!Srv.on()) { state.searchLoading = ''; return; }
    var ready = Srv.canSync() ? Srv.ensure() : Promise.resolve(null);
    ready.then(function () { return Srv.search(q.replace(/^@/, '')); }).then(function (d) {
      if (seq !== state.searchSeq) return;
      var users = ((d && d.users) || []).map(rememberRemoteUser).filter(Boolean);
      var posts = cacheRemotePosts((d && d.posts) || []);
      state.searchResults = { q: q, users: users, postIds: posts.map(function (p) { return p.id; }) };
      state.searchLoading = '';
      renderSearch(q);
    }).catch(function (e) {
      if (seq !== state.searchSeq) return;
      state.searchLoading = '';
      console.warn('搜索失败', e);
      renderSearch(q);
    });
  }

  /* 搜索页两态：home = 热度排行榜 + 搜索历史；results = 搜索结果二级页（带左上角返回） */
  function setSearchMode(mode) {
    var view = $('#viewSearch');
    if (!view) return;
    var results = mode === 'results';
    state.searchMode = results ? 'results' : 'home';
    view.classList.toggle('search-results-mode', results);
    if (results) view.classList.remove('search-hist-open');
  }
  /* 下拉框里必须真的有内容才展开：输入过程中建议还没渲染出来时，别撑出一条空白白框 */
  function searchDropHasContent() {
    var h = $('#searchHist'), s = $('#searchSug');
    if (h && h.children.length) return true;
    if (s && s.children.length) return true;
    return false;
  }
  /* 搜索历史被删光或清空后，已经展开的下拉框要立刻收起来 */
  function refreshSearchDrop() {
    var view = $('#viewSearch');
    if (!view || !view.classList.contains('search-hist-open')) return;
    if (!searchDropHasContent()) openSearchHist(false);
  }
  function openSearchHist(open) {
    var view = $('#viewSearch');
    if (!view) return;
    /* 输入框为空且没有历史/建议时不展开，避免出现一条空白下拉条 */
    view.classList.toggle('search-hist-open', !!open && searchDropHasContent());
  }
  function backToSearchHome() {
    var inp = $('#searchInput');
    if (inp) inp.value = '';
    state.searchQuery = '';
    state.searchResults = { q: '', users: [], postIds: [] };
    state.searchLoading = '';
    clearTimeout(searchTimer);
    setSearchMode('home');
    renderHotRank();
    renderSearchHist();
    renderSearchSuggest('', null);
    renderSearch('');
    var view = $('#viewSearch');
    if (view) view.scrollTop = 0;
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }

  function scheduleSearch(q) {
    clearTimeout(searchTimer);
    if (String(q || '').trim() === state.sugQ && state.sugDone) return;
    searchTimer = setTimeout(function () { suggestSearch(q); }, 200);
  }

  /* 搜索历史：仅记录主动搜索（回车或点历史），最多 12 条，可单条删除或清空 */
  var SEARCH_HIST_KEY = 'u-search-hist';
  function loadSearchHist() {
    try {
      var list = JSON.parse(LS.getItem(SEARCH_HIST_KEY) || '[]');
      return Array.isArray(list) ? list.filter(function (x) { return typeof x === 'string' && x; }).slice(0, 12) : [];
    } catch (e) { return []; }
  }
  function saveSearchHist(list) { LS.setItem(SEARCH_HIST_KEY, JSON.stringify(list.slice(0, 12))); }
  function addSearchHist(q) {
    q = String(q || '').trim();
    if (!q) return;
    var list = loadSearchHist().filter(function (x) { return x !== q; });
    list.unshift(q);
    saveSearchHist(list);
    renderSearchHist();
  }
  /* 热度 = 浏览量 + 点赞×3 + 评论×5，只算看得见的帖子 */
  function hotScore(p) {
    return (p.views || 0) + (p.likes || 0) * 3 + (p.replies || 0) * 5;
  }
  function renderHotRank() {
    var box = $('#hotRank');
    if (!box) return;
    var list = (state.posts || []).filter(function (p) {
      return p && !p.deleted && !p.private && (p.views || p.likes || p.replies);
    });
    list.sort(function (a, b) { return hotScore(b) - hotScore(a); });
    list = list.slice(0, 10);
    if (!list.length) {
      box.innerHTML = '<div class="hot-rank-head"><h3>热度排行榜</h3></div>' +
        '<div class="hot-empty">还没有互动数据，发几条帖子或点点赞就会上榜。</div>';
      return;
    }
    box.innerHTML = '<div class="hot-rank-head"><h3>热度排行榜</h3></div>' +
      '<div class="hot-rank-list">' + list.map(function (p, i) {
        var heat = hotScore(p);
        var txt = (p.text || '').trim() || (p.media && p.media.length ? '（图片/视频）' : '（无文字）');
        var who = isOfficialIdent(p.author) ? ADMIN.username : ((p.author && (p.author.name || p.author.handle)) || '用户');
        return '<button class="hot-item' + (i < 3 ? ' top' + (i + 1) : '') + '" data-hot="' + p.id + '">' +
          '<span class="hot-no">' + (i + 1) + '</span>' +
          '<span class="hot-main"><span class="hot-txt">' + esc(txt.slice(0, 80)) + '</span>' +
          '<span class="hot-meta"><span>@' + esc(who) + '</span><span>浏览 ' + (p.views || 0) + '</span>' +
          '<span>赞 ' + (p.likes || 0) + '</span><span>评论 ' + (p.replies || 0) + '</span></span></span>' +
          '<span class="hot-score">' + heat + '</span></button>';
      }).join('') + '</div>';
  }

  function renderSearchHist() {
    var box = $('#searchHist');
    if (!box) return;
    var list = loadSearchHist();
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="hist-head"><span>搜索历史</span>' +
      '<button class="hist-clear" data-hclear="1">清空</button></div>' +
      list.map(function (q) {
        return '<span class="hist-chip"><span class="hq" data-hq="' + esc(q) + '">' + esc(q) +
          '</span><span class="hx" data-hdel="' + esc(q) + '" aria-label="删除">×</span></span>';
      }).join('');
  }

  /* ---------------- 通知：官方通知 / 消息 / 私信 ---------------- */
  function loadMsgs() {
    try { return JSON.parse(LS.getItem('u-msgs') || '[]') || []; } catch (e) { return []; }
  }
  function saveMsgs(list) { LS.setItem('u-msgs', JSON.stringify(list.slice(0, 50))); }
  function unreadMsgs() {
    var local = loadMsgs().filter(function (m) { return m.type !== 'dm' && !m.read; }).length;
    var remote = (state.remoteNotifications || []).filter(function (m) { return !m.read; }).length;
    return local + remote;
  }
  function unreadDMs() {
    var local = loadMsgs().filter(function (m) { return m.type === 'dm' && !m.read; }).length;
    return local + (state.conversations || []).reduce(function (n, c) { return n + (c.unread || 0); }, 0);
  }
  function msgById(id) {
    var list = loadMsgs();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function pushMsg(m) {
    var list = loadMsgs();
    list.unshift(m);
    saveMsgs(list);
    updateNotifyBadges();
    if (m.type === 'dm' && state.tab === 'dm') renderDMList($('#dmList'));
    else if (m.type !== 'dm' && state.tab === 'notify' && state.notifyTab === 'msg') renderNotify();
  }
  function msgPostText(id) {
    var p = findPost(id);
    if (!p) return '帖子已删除';
    var t = (p.text || '').replace(/\s+/g, ' ').trim();
    return t ? (t.length > 28 ? t.slice(0, 28) + '…' : t) : '（图片/视频）';
  }

  /* 官方通知角标：只提示「有更新」，看过即消失 */
  function hasNewOfficial() {
    var seen = Number(LS.getItem('u-off-seen') || 0);
    var admin = isAdmin();
    return loadNotifies().some(function (n) {
      if (!n.published && !admin) return false;
      return (n.publishedAt || n.createdAt || 0) > seen;
    });
  }
  function markOfficialSeen() {
    LS.setItem('u-off-seen', String(Date.now()));
    updateNotifyBadges();
  }
  function updateNotifyBadges() {
    var md = $('#msgDot');
    if (md) {
      var n = unreadMsgs();
      md.textContent = n > 99 ? '99+' : String(n);
      md.classList.toggle('on', n > 0);
    }
    var od = $('#offDot');
    if (od) od.classList.toggle('on', hasNewOfficial());
    var dn = unreadDMs();
    var tb = $('#dmTabBadge');
    if (tb) {
      tb.textContent = dn > 99 ? '99+' : String(dn);
      tb.classList.toggle('on', dn > 0);
    }
    var nb = $('#ntTabBadge');
    if (nb) {
      var un = unreadMsgs();
      nb.textContent = un > 99 ? '99+' : String(un);
      nb.classList.toggle('on', un > 0);
    }
  }

  /* 点赞 / 评论 / 关注 / 私信：由人机用户持续产生 */
  function botMsgTick() {
    if (!ME || Srv.canSync()) return;
    var mine = myPosts();
    if (!mine.length) return;
    var list = loadMsgs();
    if (list.length && Date.now() - (list[0].createdAt || 0) < 18000) return;
    var post = mine[Math.floor(Math.random() * mine.length)];
    var b = BOT_ACCOUNTS[Math.floor(Math.random() * BOT_ACCOUNTS.length)];
    var user = { name: b.name, handle: b.handle, key: 'bot_' + b.handle };
    var r = Math.random();
    var base = { id: uid(), user: user, postId: post.id, createdAt: Date.now(), read: false };
    if (r < 0.6) {
      base.type = 'follow';
      base.text = '关注了你';
      pushMsg(base);
    } else {
      var dm = BOT_DMS[Math.floor(Math.random() * BOT_DMS.length)];
      base.type = 'dm';
      base.text = dm;
      base.thread = [{ from: 'them', text: dm, at: Date.now() }];
      pushMsg(base);
    }
  }

  function refreshNotifications() {
    if (!Srv.canSync()) { updateNotifyBadges(); return Promise.resolve(state.remoteNotifications || []); }
    if (Srv._notificationsP) return Srv._notificationsP;
    var token = srvToken();
    Srv._notificationsP = Srv.ensure().then(function () { return Srv.notifications(); }).then(function (d) {
      Srv._notificationsP = null;
      if (token !== srvToken() || !ME) return state.remoteNotifications || [];
      var readIds = {};
      (state.remoteNotifications || []).forEach(function (item) { if (item.read) readIds[item.remoteId] = true; });
      state.remoteNotifications = ((d && d.notifications) || []).map(function (n) {
        return {
          id: 'srv_n' + n.id,
          remoteId: n.id,
          remote: true,
          type: n.type,
          user: rememberRemoteUser(n.actor) || { name: 'U', handle: '' },
          postId: n.postId ? 'srv_' + n.postId : null,
          postText: n.postText || '',
          text: n.text || '',
          createdAt: Date.parse(n.createdAt) || Date.now(),
          read: !!n.read || !!readIds[n.id]
        };
      });
      updateNotifyBadges();
      if (state.tab === 'notify' && state.notifyTab === 'msg') renderMsgList($('#notifyList'));
      return state.remoteNotifications;
    }).catch(function (e) {
      Srv._notificationsP = null;
      if (token === srvToken()) console.warn('互动消息同步失败', e);
      return state.remoteNotifications || [];
    });
    return Srv._notificationsP;
  }

  function renderMsgList(box) {
    var list = loadMsgs().filter(function (m) { return m.type !== 'dm'; })
      .concat(state.remoteNotifications || [])
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    if (!list.length) {
      box.innerHTML = '<div class="empty">' + ICON.bell +
        '<h3>暂无互动消息</h3></div>';
      return;
    }
    var icon = { like: '♥', reply: '💬', follow: '＋', dm: '✉' };
    var label = { like: '赞了你的帖子', reply: '评论了你的帖子', follow: '关注了你', dm: '给你发来私信' };
    box.innerHTML = list.map(function (m) {
      var u = m.user || { name: 'U' };
      var sub = m.text || '';
      if (m.type === 'like') {
        if (m.remote) {
          var postText = String(m.postText || '').replace(/\s+/g, ' ').trim();
          sub = postText ? (postText.length > 28 ? postText.slice(0, 28) + '…' : postText) : (m.postId ? '（图片/视频）' : '帖子已删除');
        } else sub = msgPostText(m.postId);
      } else if (m.type === 'reply') sub = String(m.text || '').replace(/^评论了你的帖子：/, '');
      else if (m.type === 'follow') sub = '@' + ((u.handle) || '');
      var attr = m.remote ? ' data-rnid="' + m.remoteId + '"' : ' data-mid="' + esc(m.id) + '"';
      return '<button class="msg-row' + (m.read ? '' : ' unread') + '"' + attr + '>' +
        '<div class="avatar' + (u.official ? ' me' : '') + '">' + esc((u.name || 'U').slice(0, 1)) + '</div>' +
        '<div class="msg-main">' +
        '<div class="msg-head">' + esc(u.name || 'U') + ' <span>' + (label[m.type] || '') + '</span></div>' +
        (sub ? '<div class="msg-sub">' + esc(sub) + '</div>' : '') +
        '<div class="msg-time">' + ago(m.createdAt) + '</div>' +
        '</div>' +
        '<span class="msg-type ' + m.type + '">' + (icon[m.type] || '·') + '</span>' +
        (m.read ? '' : '<span class="msg-dot"></span>') +
        '</button>';
    }).join('');
  }

  var DM_HIDE_KEY = 'u-dm-hidden';
  function dmHidden() {
    try {
      var o = JSON.parse(LS.getItem(DM_HIDE_KEY) || '{}');
      return o && typeof o === 'object' ? o : {};
    } catch (e) { return {}; }
  }
  function dmHiddenSet(key, at) {
    var h = dmHidden();
    h[key] = at || Date.now();
    LS.setItem(DM_HIDE_KEY, JSON.stringify(h));
  }
  function deleteDMEntry(key) {
    if (!key) return;
    if (key.indexOf('mid:') === 0) {
      var mid = key.slice(4);
      saveMsgs(loadMsgs().filter(function (m) { return m.id !== mid; }));
      dmHiddenSet(key, Date.now());
    } else if (key.indexOf('user:') === 0) {
      var handle = key.slice(5);
      saveMsgs(loadMsgs().filter(function (m) {
        return !(m.type === 'dm' && m.user && (m.user.handle === handle || m.user.key === handle));
      }));
      var cut = 0;
      (state.conversations || []).forEach(function (c) {
        var a = rememberRemoteUser(c.user) || {};
        if (a.handle !== handle) return;
        cut = Math.max(cut, Date.parse(c.lastMessage && c.lastMessage.createdAt) || 0);
      });
      dmHiddenSet(key, cut || Date.now());
    }
    var box = $('#dmList');
    if (box) renderDMList(box);
    if (typeof updateNotifyBadges === 'function') updateNotifyBadges();
    toast('已删除该会话');
  }

  function renderDMList(box) {
    if (!box) return;
    var hidden = dmHidden();
    var rows = loadMsgs().filter(function (m) { return m.type === 'dm'; }).map(function (m) {
      return { local: m, at: m.createdAt || 0 };
    }).filter(function (r) { return !hidden['mid:' + r.local.id]; });
    (state.conversations || []).forEach(function (c) {
      rows.push({ remote: c, at: Date.parse(c.lastMessage && c.lastMessage.createdAt) || 0 });
    });
    rows = rows.filter(function (r) {
      if (!r.remote) return true;
      var h = (rememberRemoteUser(r.remote.user) || {}).handle || '';
      var cut = hidden['user:' + h];
      return !cut || r.at > cut;
    });
    rows.sort(function (a, b) { return b.at - a.at; });
    if (!rows.length) {
      box.innerHTML = '<div class="empty">' +
        '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L4 20.5l1.5-4.6A8.4 8.4 0 1 1 21 11.5z"></path><path d="M8.5 11.5h7M8.5 15h4.5"></path></svg>' +
        '<h3>暂无私信</h3></div>';
      return;
    }
    box.innerHTML = rows.map(function (row) {
      var key, inner;
      if (row.local) {
        var m = row.local, u = m.user || { name: 'U' };
        key = 'mid:' + m.id;
        inner = '<button class="msg-row' + (m.read ? '' : ' unread') + '" data-mid="' + m.id + '">' +
          '<div class="avatar">' + esc((u.name || 'U').slice(0, 1)) + '</div>' +
          '<div class="msg-main"><div class="msg-head">' + esc(u.name || 'U') + ' <span>私信</span></div>' +
          '<div class="msg-sub">' + esc(m.text || '') + '</div><div class="msg-time">' + ago(m.createdAt) + '</div></div>' +
          (m.read ? '' : '<span class="msg-dot"></span>') + '</button>';
      } else {
        var c = row.remote, a = rememberRemoteUser(c.user);
        var last = c.lastMessage || {};
        key = 'user:' + (a.handle || '');
        inner = '<button class="msg-row' + (c.unread ? ' unread' : '') + '" data-dm-user="' + esc(a.handle) + '">' +
          '<div class="avatar" data-prof="' + esc(a.key || '') + '">' + esc((a.name || 'U').slice(0, 1)) + '</div>' +
          '<div class="msg-main"><div class="msg-head">' + esc(a.name || 'U') + ' <span>@' + esc(dispHandle(a)) + '</span></div>' +
          '<div class="msg-sub">' + esc((last.fromMe ? '我：' : '') + (last.text || '')) + '</div>' +
          '<div class="msg-time">' + ago(Date.parse(last.createdAt) || Date.now()) + '</div></div>' +
          (c.unread ? '<span class="msg-dot"></span>' : '') + '</button>';
      }
      return '<div class="swipe" data-sw="' + esc(key) + '">' + inner +
        '<button class="swipe-del" type="button" data-dmdel="' + esc(key) + '">删除</button></div>';
    }).join('');
  }

  var SWIPE_W = 92;
  var dmSwipeMovedAt = 0;
  function bindDMSwipe() {
    var list = $('#dmList');
    if (!list || list._swipeBound) return;
    list._swipeBound = true;
    var st = null;
    function closeOthers(keep) {
      Array.prototype.forEach.call(list.querySelectorAll('.swipe.open'), function (el) {
        if (el !== keep) el.classList.remove('open');
      });
    }
    list.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('[data-dmdel]')) return;
      var row = e.target.closest ? e.target.closest('.swipe > .msg-row') : null;
      if (!row) { closeOthers(null); return; }
      var wrap = row.parentNode;
      var open = wrap.classList.contains('open');
      closeOthers(wrap);
      var w0 = wrap.getBoundingClientRect().width || row.getBoundingClientRect().width || 0;
      st = { wrap: wrap, row: row, x: e.clientX, y: e.clientY, id: e.pointerId, w0: w0, base: open ? w0 - SWIPE_W : w0, moved: false, nx: open ? w0 - SWIPE_W : w0 };
      wrap.classList.add('dragging');
    });
    list.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved) {
        if (Math.abs(dx) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          st.wrap.classList.remove('dragging');
          st.row.style.width = '';
          st = null;
          return;
        }
        st.moved = true;
      }
      var nx = st.base + dx;
      if (nx > st.w0) nx = st.w0 + (nx - st.w0) * 0.22;
      if (nx < st.w0 - SWIPE_W) nx = st.w0 - SWIPE_W + (nx - (st.w0 - SWIPE_W)) * 0.22;
      st.nx = nx;
      st.row.style.width = nx + 'px';
      st.wrap.classList.toggle('open', nx < st.w0 - SWIPE_W * 0.5);
    });
    function end(e) {
      if (!st) return;
      var s = st;
      st = null;
      s.wrap.classList.remove('dragging');
      s.row.style.width = '';
      s.wrap.classList.toggle('open', s.nx < s.w0 - SWIPE_W * 0.45);
      if (s.moved) dmSwipeMovedAt = Date.now();
    }
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
    list.addEventListener('click', function (e) {
      var del = e.target.closest ? e.target.closest('[data-dmdel]') : null;
      if (del) {
        e.preventDefault();
        e.stopPropagation();
        deleteDMEntry(del.getAttribute('data-dmdel'));
        return;
      }
      if (Date.now() - dmSwipeMovedAt < 350) { e.preventDefault(); e.stopPropagation(); return; }
      var open = e.target.closest ? e.target.closest('.swipe.open') : null;
      if (open) { e.preventDefault(); e.stopPropagation(); open.classList.remove('open'); }
    }, true);
  }

  function refreshConversations() {
    if (!Srv.canSync()) { updateNotifyBadges(); return Promise.resolve([]); }
    if (Srv._conversationsP) return Srv._conversationsP;
    Srv._conversationsP = Srv.ensure().then(function () { return Srv.conversations(); }).then(function (d) {
      state.conversations = (d && d.conversations) || [];
      state.conversations.forEach(function (c) { rememberRemoteUser(c.user); });
      Srv._conversationsP = null;
      updateNotifyBadges();
      if (state.tab === 'dm') renderDMList($('#dmList'));
      return state.conversations;
    }).catch(function (e) {
      Srv._conversationsP = null;
      console.warn('私信会话同步失败', e);
      return state.conversations || [];
    });
    return Srv._conversationsP;
  }

  /* 版本通知按版本号倒序排列，其余按时间倒序 */
  function noticeVer(n) {
    var m = String(n.title || '').match(/U\s*(\d+(?:\.\d+)*)/);
    return m ? m[1].split('.').map(Number) : null;
  }
  function noticeVerCmp(a, b) {
    var len = Math.max(a.length, b.length);
    for (var i = 0; i < len; i++) {
      var x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return y - x;
    }
    return 0;
  }
  /* 正文开头与标题重复的「U 1.x 更新」一行去掉 */
  function noticeBody(n) {
    return String(n.body || '')
      .replace(/^\s*U\s*\d+(?:\.\d+)*\s*(?:更新|正式上线)[^\n]*\n?/, '')
      .replace(/^\n+/, '');
  }

  function renderNotify() {
    var box = $('#notifyList');
    var admin = isAdmin();
    var tab = state.notifyTab || 'official';
    var add = $('#notifyAddBtn');
    if (add) add.style.display = admin && tab === 'official' ? 'grid' : 'none';
    $$('#notifyTabs .ntab').forEach(function (b) { b.classList.toggle('on', b.dataset.ntab === tab); });
    if (tab === 'msg') {
      renderMsgList(box);
      updateNotifyBadges();
      refreshNotifications();
      return;
    }
    var list = loadNotifies().filter(function (n) { return n.published || admin; })
      .sort(function (a, b) {
        var va = noticeVer(a), vb = noticeVer(b);
        if (va && vb) return noticeVerCmp(va, vb);
        if (va) return -1;
        if (vb) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    if (!list.length) {
      box.innerHTML = '<div class="empty">' + ICON.bell +
        '<h3>暂无官方通知</h3><p>U 有新版本或重要更新时会显示在这里。</p></div>';
      updateNotifyBadges();
      return;
    }
    box.innerHTML = list.map(function (n) {
      return '<div class="notify-item" data-nid="' + n.id + '">' +
        '<div class="notify-ico">' + ICON.bell + '</div>' +
        '<div class="notify-main"><h4>' + esc(n.title) +
        (n.published ? '' : '<span class="nbadge">待发布</span>') +
        (Number(LS.getItem('u-off-seen') || 0) < (n.publishedAt || n.createdAt || 0) ? '<span class="nbadge">新</span>' : '') +
        '</h4>' +
        '<p>' + esc(noticeBody(n)) + '</p>' +
        '<div class="nt">' + fullDate(n.createdAt) + '</div>' +
        (admin ? '<div class="nacts">' +
          (n.published ? '' : '<button class="pub" data-nact="pub" data-nid="' + n.id + '">发布</button>') +
          '<button data-nact="edit" data-nid="' + n.id + '">编辑</button>' +
          '<button class="danger" data-nact="del" data-nid="' + n.id + '">删除</button>' +
          '</div>' : '') +
        '</div></div>';
    }).join('');
    updateNotifyBadges();
  }

  function openMessage(id) {
    var list = loadMsgs();
    var m = null;
    list.forEach(function (x) { if (x.id === id) m = x; });
    if (!m) return;
    if (!m.read) {
      m.read = true;
      saveMsgs(list);
      updateNotifyBadges();
    }
    if (state.tab === 'dm') renderDMList($('#dmList')); else renderNotify();
    if (m.type === 'dm') { openDM(m.id); return; }
    if (m.type === 'follow') {
      openUser((m.user && (m.user.key || ('bot_' + m.user.handle))) || '');
      return;
    }
    var p = findPost(m.postId);
    if (p) openPost(p.id); else toast('帖子已删除');
  }

  function openRemoteNotification(id) {
    id = Number(id);
    var list = state.remoteNotifications || [];
    var m = null;
    for (var i = 0; i < list.length; i++) if (list[i].remoteId === id) { m = list[i]; break; }
    if (!m) return;
    if (!m.read) {
      m.read = true;
      updateNotifyBadges();
      if (state.tab === 'notify' && state.notifyTab === 'msg') renderMsgList($('#notifyList'));
      Srv.readNotifications([id]).catch(function (e) { console.warn('消息已读同步失败', e); });
    }
    if (m.type === 'follow') {
      openUser((m.user && m.user.key) || '');
      return;
    }
    var cached = findPost(m.postId);
    if (cached) { openPost(cached.id); return; }
    if (!m.postId || m.loading) { if (!m.postId) toast('帖子已删除'); return; }
    m.loading = true;
    toast('正在加载原帖…');
    Srv.ensure().then(function () {
      return Srv.getPost(Number(m.postId.slice(4)));
    }).then(function (d) {
      m.loading = false;
      var p = cacheRemotePost(d && d.post);
      if (p) openPost(p.id); else toast('帖子已删除');
    }).catch(function (e) {
      m.loading = false;
      console.warn('通知原帖加载失败', e);
      toast('原帖加载失败，请检查服务器连接');
    });
  }

  function openDM(id, peer) {
    pauseAllVideos();
    releaseVideos(document.body);
    state.dmMsgId = id || null;
    state.dmPeer = null;
    state.dmMessages = [];
    $('#dmText').value = '';
    /* 从搜索 / 用户主页 / 关注列表进入私信时，先收起这些页面，避免私信被盖住 */
    $('#userSheet').classList.remove('open');
    $('#followSheet').classList.remove('open');
    $('#dmSheet').classList.add('open');
    if (peer) {
      var raw = peer.user || peer;
      var a = rememberRemoteUser(raw.id ? raw : {
        id: raw.remoteId, username: raw.handle || raw.username,
        nickname: raw.name || raw.nickname
      });
      if (!a || !a.handle) { toast('无法识别该服务器用户'); return; }
      if (srvUser() && srvUser().id === a.remoteId) { toast('不能给自己发私信'); return; }
      state.dmPeer = a;
      $('#dmTitle').textContent = a.name;
      $('#dmBody').innerHTML = '<div class="empty" style="padding:36px 24px"><p>正在加载私信…</p></div>';
      $('#dmSend').disabled = true;
      Srv.ensure().then(function () { return Srv.messages(a.handle); }).then(function (d) {
        if (!state.dmPeer || state.dmPeer.handle !== a.handle) return;
        state.dmMessages = ((d && d.messages) || []).map(function (m) {
          return { id: 'srv_m' + m.id, from: m.fromMe ? 'me' : 'them', text: m.text, at: Date.parse(m.createdAt) || Date.now() };
        });
        renderDM();
        refreshConversations();
      }).catch(function (e) {
        console.warn('私信加载失败', e);
        $('#dmBody').innerHTML = '<div class="empty" style="padding:36px 24px"><p>私信加载失败，请检查服务器连接。</p></div>';
      });
      return;
    }
    var m = msgById(id);
    $('#dmTitle').textContent = (m && m.user && m.user.name) || '私信';
    var peerUser = m && m.user;
    renderDM();
  }
  function renderDM() {
    var body = $('#dmBody');
    var m = state.dmPeer ? null : msgById(state.dmMsgId);
    if (!state.dmPeer && !m) return;
    var thread = state.dmPeer ? state.dmMessages : (m.thread || []);
    var peer = state.dmPeer || (m && m.user);
    var peerHead = peer ? '<button class="dm-peer-head" data-prof="' + esc(peer.key || '') + '">' +
      '<span class="avatar" style="width:38px;height:38px;font-size:16px">' + esc((peer.name || 'U').slice(0, 1)) + '</span>' +
      '<span class="dm-peer-name">' + esc(peer.name || 'U') +
      (peer.handle ? '<em>@' + esc(peer.handle) + '</em>' : '') + '</span>' +
      '<span class="dm-peer-go">查看主页</span></button>' : '';
    body.innerHTML = peerHead + '<div class="dm-wrap">' +
      (thread.length ? thread.map(function (t) {
        return '<div class="dm-bubble ' + (t.from === 'me' ? 'me' : 'them') + '">' + esc(t.text) +
          '<span class="t">' + ago(t.at) + '</span></div>';
      }).join('') : '<p style="color:var(--dim);font-size:13px">还没有消息，发条私信吧。</p>') +
      '</div>';
    body.scrollTop = body.scrollHeight;
    $('#dmSend').disabled = !$('#dmText').value.trim();
  }
  function sendDM() {
    if (!needOnline('发私信')) { $('#dmSend').disabled = false; return; }
    var txt = $('#dmText').value.trim();
    if (!txt) return;
    if (state.dmPeer) {
      var peer = state.dmPeer;
      $('#dmSend').disabled = true;
      Srv.ensure().then(function () { return Srv.sendMessage(peer.handle, txt); }).then(function (d) {
        var m = d && d.message;
        if (m) state.dmMessages.push({ id: 'srv_m' + m.id, from: 'me', text: m.text, at: Date.parse(m.createdAt) || Date.now() });
        $('#dmText').value = '';
        renderDM();
        refreshConversations();
      }).catch(function (e) {
        console.warn('私信发送失败', e);
        toast(e.message || '私信发送失败');
        $('#dmSend').disabled = false;
      });
      return;
    }
    var list = loadMsgs();
    var m = null;
    list.forEach(function (x) { if (x.id === state.dmMsgId) m = x; });
    if (!m) return;
    m.thread = m.thread || [];
    m.thread.push({ from: 'me', text: txt, at: Date.now() });
    saveMsgs(list);
    $('#dmText').value = '';
    renderDM();
  }

  function myPostsHTML() {
    var mine = myPosts();
    if (!mine.length) {
      return '<div class="empty" style="padding:36px 24px"><p>你还没有发布过内容</p></div>';
    }
    return mine.map(postHTML).join('');
  }

  /* ---------------- render: notes ---------------- */
  function renderNotes() {
    var list = $('#notesList');
    $('#noteCount').textContent = state.notes.length + ' 条笔记';
    if (!state.notes.length) {
      list.innerHTML = '<div class="empty">' +
        '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.8h9.2L19 6.6V21a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 21V4.6A1.8 1.8 0 0 1 6 2.8z"/><path d="M14 2.8v4.6h5"/><path d="M8 12h7M8 15.5h4.5"/></svg>' +
        '<h3>备忘录是空的</h3><p>点右上角的 + ，<br>随手记下一个想法。</p></div>';
      return;
    }
    list.innerHTML = state.notes.map(function (n) {
      var title = n.title || (n.content || '').split('\n')[0] || '无标题';
      var sub = n.title ? n.content : (n.content || '').split('\n').slice(1).join(' ');
      return '<div class="note" data-id="' + n.id + '">' +
        '<div class="note-ico">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.8h9.2L19 6.6V21a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 21V4.6A1.8 1.8 0 0 1 6 2.8z"/><path d="M14 2.8v4.6h5"/><path d="M8 12h7M8 15.5h4.5"/></svg>' +
        '</div><div class="note-main">' +
        '<div class="note-title">' + esc(title) + '</div>' +
        (sub ? '<div class="note-sub">' + esc(sub) + '</div>' : '') +
        '<div class="note-date">' + fullDate(n.updatedAt || n.createdAt) + '</div>' +
        '</div></div>';
    }).join('');
  }

  /* ---------------- render: profile ---------------- */
  function myLikedPosts() {
    return state.posts.filter(function (p) { return !p.deleted && p.liked; });
  }
  function myReplyList() {
    var key = ME ? profileKey(ME) : '';
    return state.allComments.filter(function (c) {
      return c.author && profileKey(c.author) === key;
    });
  }
  function replyCardHTML(c) {
    var p = findPost(c.postId);
    var src = p ? (p.text || ((p.media && p.media.length) ? '[图片 / 视频]' : '')) : '原帖已删除';
    return '<button class="pcomment" data-cpost="' + esc(c.postId) + '">' +
      '<div class="pc-text">' + esc(c.text) + '</div>' +
      (src ? '<div class="pc-quote">原帖：' + esc(src) + '</div>' : '') +
      '<div class="pc-meta">' + ago(c.createdAt) + ' · 点击查看对话</div></button>';
  }
  function profileListHTML(tab) {
    if (tab === 'likes') {
      var liked = myLikedPosts();
      return liked.length ? liked.map(postHTML).join('') :
        '<div class="empty" style="padding:44px 24px"><p>还没有喜欢的帖子</p></div>';
    }
    if (tab === 'replies') {
      var mine = myReplyList();
      return mine.length ? mine.map(replyCardHTML).join('') :
        '<div class="empty" style="padding:44px 24px"><p>还没有回复过别人</p></div>';
    }
    if (tab === 'reposts') {
      var reps = state.posts.filter(function (p) { return !p.deleted && p.reposted; });
      return reps.length ? reps.map(postHTML).join('') :
        '<div class="empty" style="padding:44px 24px"><p>还没有转帖</p></div>';
    }
    return myPostsHTML();
  }

  function renderProfile() {
    var mineList = myPosts();
    var likes = mineList.reduce(function (s, p) { return s + (p.likes || 0); }, 0);
    var mine = mineList.length;
    var c = state.myCounts;
    var following = c ? c.following : loadFollows().length;
    var myKey = ME ? profileKey(ME) : 'u';
    var fans = c
      ? c.followers
      : (ME && ME.official
        ? officialFans()
        : pseudoStat(myKey, 'fans', 8, 260) + Math.floor(likes / 10));
    var postTotal = c ? c.postCount : mine;
    var pt = state.profileTab || 'posts';
    var name = ME ? ME.name : 'U';
    var prof = profileOf(ME);
    $('#profileContent').innerHTML =
      '<div class="banner" id="profileBanner"></div>' +
      '<div class="profile-head">' +
      '<div class="avatar big" id="profileAvatar"></div>' +
      '<div class="pname-big">' + esc(name) + (ME && ME.verified ? ' ' + ICON.verified : '') + '</div>' +
      '<div class="phandle-big">@' + esc(ME ? dispHandle(ME) : 'u_user') + '</div>' +
      '<div class="bio">' + esc(prof.bio || defaultBio(ME)) + '</div>' +
      '<div class="pmeta"><span>' + (ME && ME.official ? '官方账号' : (isAdmin() ? '管理员' : (ME && ME.mode === 'guest' ? '游客模式' : (ME && ME.remote ? '服务器账号' : '本机账号')))) + '</span><span>加入于 2026年11月</span></div>' +
      '<div class="pstats">' +
      '<button class="statlink" data-followlist="following" data-followkey="' + esc(myKey) + '"><b>' + following + '</b> 关注</button>' +
      '<button class="statlink" data-followlist="fans" data-followkey="' + esc(myKey) + '"><b>' + fansLabel(ME, fans) + '</b> 粉丝</button>' +
      '<span><b>' + postTotal + '</b> 帖子</span>' +
      '<span><b>' + state.notes.length + '</b> 备忘录</span>' +
      '<span><b>' + fmt(likes) + '</b> 获赞</span></div>' +
      '<button class="edit-profile" id="editProfileBtn">编辑资料</button>' +
      '</div>' +
      '<button class="notes-card" id="notesRow">' +
      '<span class="notes-ico"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.8h9.2L19 6.6V21a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 21V4.6A1.8 1.8 0 0 1 6 2.8z"></path><path d="M14 2.8v4.6h5"></path><path d="M8 12h7M8 15.5h4.5"></path></svg></span>' +
      '<span class="notes-txt"><b>备忘录</b><em>记录想法、待办和灵感</em></span>' +
      '<span class="notes-count">' + state.notes.length + ' 条</span>' +
      '<span class="chev" style="color:var(--dim);display:flex">' + ICON.chevron + '</span>' +
      '</button>' +
      '<div class="ptabs">' +
      '<button class="ptab' + (pt === 'posts' ? ' on' : '') + (state.profileTabJelly === 'posts' ? ' tab-jelly' : '') + '" data-ptab="posts">帖子</button>' +
      '<button class="ptab' + (pt === 'reposts' ? ' on' : '') + (state.profileTabJelly === 'reposts' ? ' tab-jelly' : '') + '" data-ptab="reposts">转帖</button>' +
      '<button class="ptab' + (pt === 'replies' ? ' on' : '') + (state.profileTabJelly === 'replies' ? ' tab-jelly' : '') + '" data-ptab="replies">回复</button>' +
      '<button class="ptab' + (pt === 'likes' ? ' on' : '') + (state.profileTabJelly === 'likes' ? ' tab-jelly' : '') + '" data-ptab="likes">喜欢</button>' +
      '</div>' +
      '<div class="profile-posts" id="myPosts">' + profileListHTML(pt) + '</div>';

    paintAvatar($('#profileAvatar'), ME);
    if (prof.banner) $('#profileBanner').style.backgroundImage = 'url("' + prof.banner + '")';
    initPlayers($('#myPosts'));
    $on('#notesRow', 'click', function () { switchTab('notes'); });
    $on('#editProfileBtn', 'click', function () { openEditProfile(); });
  }

  /* ---------------- user profile ---------------- */
  function findAuthor(key) {
    if (ME && profileKey(ME) === key) return ME;
    if (state.userDirectory && state.userDirectory[key]) return state.userDirectory[key];
    var found = null;
    state.posts.forEach(function (p) {
      if (found || !p.author) return;
      if (profileKey(p.author) === key) found = p.author;
    });
    if (found) return found;
    var raw = key.replace(/^bot_/, '');
    for (var i = 0; i < BOT_ACCOUNTS.length; i++) {
      if (BOT_ACCOUNTS[i].handle === raw || BOT_ACCOUNTS[i].handle === key) {
        return {
          key: key, name: BOT_ACCOUNTS[i].name,
          handle: BOT_ACCOUNTS[i].handle, bot: true
        };
      }
    }
    return { key: key, name: raw, handle: raw };
  }

  function renderUserActivity(key) {
    var box = $('#userPosts');
    if (!box) return;
    var tab = state.userTab || 'posts';
    $$('#userTabs [data-utab]').forEach(function (b) { b.classList.toggle('on', b.dataset.utab === tab); });
    var activity = state.userActivity && state.userActivity.key === key ? state.userActivity : null;
    var list = [], comments = [];
    if (activity) {
      if (tab === 'comments') comments = activity.comments || [];
      else list = activity[tab] || [];
    } else if (tab === 'posts') {
      list = state.posts.filter(function (p) {
        return !p.deleted && p.author && profileKey(p.author) === key;
      }).sort(function (x, y) { return y.createdAt - x.createdAt; });
    } else if (tab === 'comments') {
      comments = state.allComments.filter(function (c) {
        return c.author && profileKey(c.author) === key;
      });
    }
    var emptyText = { posts: '还没有发布过内容', reposts: '还没有转帖', likes: '还没有喜欢的帖子', comments: '还没有发表评论' }[tab];
    if (tab === 'comments') {
      box.innerHTML = comments.length ? comments.map(replyCardHTML).join('') :
        '<div class="empty" style="padding:40px 24px"><p>' + emptyText + '</p></div>';
    } else {
      box.innerHTML = list.length ? list.map(postHTML).join('') :
        '<div class="empty" style="padding:40px 24px"><p>' + emptyText + '</p></div>';
      initPlayers(box);
      setTimeout(hydrateVideoCovers, 300);
    }
  }

  function openUser(key) {
    if (!key) return;
    pauseAllVideos();
    releaseVideos(document.body);
    var seq = (state.userLoadSeq || 0) + 1;
    state.userLoadSeq = seq;
    state.userKey = key;
    state.remoteUserProfile = null;
    state.userActivity = null;
    state.userTab = 'posts';
    var remote = remoteAuthorForKey(key);
    var a = findAuthor(key);
    var prof = loadProfiles()[key] || {};
    var isSelf = !!(ME && (profileKey(ME) === key ||
      (srvUser() && remote && srvUser().id === remote.remoteId)));

    $('#userNavTitle').textContent = a.name;
    paintAvatar($('#userAvatar'), a);
    $('#userName').innerHTML = esc(a.name) + (a.verified ? ' ' + ICON.verified : '');
    $('#userHandle').textContent = '@' + (dispHandle(a) || key.replace(/^bot_/, ''));
    $('#userBio').textContent = prof.bio || defaultBio(a);
    $('#userMeta').innerHTML = '<span>' + (a.official || a.handle === 'u_official' ? '官方账号' : 'U 用户') + '</span><span>加入于 2026年11月</span>';
    $('#userFollowsYou').style.display = 'none';
    $('#userStats').innerHTML = '';
    renderUserStats(key);
    $('#userEditBtn').style.display = isSelf ? 'inline-flex' : 'none';
    $('#userFollowBtn').style.display = isSelf ? 'none' : 'inline-flex';
    $('#userFollowBtn').disabled = false;
    var isBotUser = !!(a.bot || /^bot_/.test(String(key || '')));
    /* 除自己和人机号外，所有用户主页都显示私信按钮 */
    $('#userDmBtn').style.display = !isSelf && !isBotUser ? 'inline-flex' : 'none';
    $('#userMoreWrap').style.display = isSelf ? 'none' : 'block';
    var blockOn = isBlockedKey(key);
    $('#userMoreMenu').classList.remove('on');
    var blockAction = $('#userBlockAction');
    blockAction.textContent = blockOn ? '取消拉黑' : '拉黑用户';
    blockAction.classList.toggle('danger', !blockOn);
    var blocked = !isSelf && blockOn;
    $('#userSheet').classList.toggle('blocked', blocked);
    paintFollowBtn();
    var coverEl = $('#userCover');
    coverEl.style.backgroundImage = prof.banner ? 'url("' + prof.banner + '")' : '';
    renderUserActivity(key);
    raiseOverSheet($('#userSheet'));
    $('#userSheet').classList.add('open');
    $('#userSheet .sheet-body').scrollTop = 0;
    if (blocked) return;

    if (!remote || !Srv.canSync()) return;
    Srv.ensure().then(function () {
      return Promise.all([Srv.userProfile(remote.handle), Srv.activity(remote.handle)]);
    }).then(function (results) {
      if (seq !== state.userLoadSeq || state.userKey !== key) return;
      var profile = results[0], raw = results[1] || {};
      var updated = rememberRemoteUser(profile.user) || remote;
      var posts = cacheRemotePosts(raw.posts);
      var reposts = cacheRemotePosts(raw.reposts);
      var likes = cacheRemotePosts(raw.likes);
      var comments = (raw.comments || []).map(function (c) { return Srv.toComment(c, 'srv_' + c.postId); });
      state.remoteUserProfile = Object.assign({ key: key }, profile);
      state.userActivity = { key: key, posts: posts, reposts: reposts, likes: likes, comments: comments };
      var selfNow = !!(srvUser() && srvUser().id === updated.remoteId);
      $('#userNavTitle').textContent = updated.name;
      paintAvatar($('#userAvatar'), updated);
      $('#userName').innerHTML = esc(updated.name) + (updated.verified ? ' ' + ICON.verified : '');
      $('#userHandle').textContent = '@' + updated.handle;
      $('#userMeta').innerHTML = '<span>' + (updated.official ? '官方账号' : 'U 用户') + '</span><span>加入于 ' +
        esc((fullDate(Date.parse(profile.user.createdAt) || Date.now()) || '').split(' ')[0]) + '</span>';
      $('#userEditBtn').style.display = selfNow ? 'inline-flex' : 'none';
      $('#userFollowBtn').style.display = selfNow ? 'none' : 'inline-flex';
      $('#userFollowBtn').disabled = false;
      $('#userDmBtn').style.display = selfNow || updated.bot || /^bot_/.test(String(key)) ? 'none' : 'inline-flex';
      $('#userFollowsYou').style.display = profile.isFollower ? 'inline-block' : 'none';
      paintFollowBtn();
      renderUserStats(key);
      renderUserActivity(key);
    }).catch(function (e) {
      if (seq !== state.userLoadSeq) return;
      $('#userFollowBtn').disabled = false;
      console.warn('用户主页加载失败', e);
      if (!state.posts.some(function (p) { return p.author && profileKey(p.author) === key; })) {
        $('#userPosts').innerHTML = '<div class="empty" style="padding:40px 24px"><p>主页加载失败，请检查服务器连接。</p></div>';
      }
    });
  }

  /* ---------------- edit profile ---------------- */
  function openEditProfile(focus) {
    if (!ME) return;
    var prof = loadProfiles()[profileKey(ME)] || {};
    state.editProf = {
      avatar: prof.avatar || '', banner: prof.banner || '', bio: prof.bio || '',
      username: ME.username || ME.handle || ''
    };
    $('#editBio').value = state.editProf.bio;
    paintEditAvatar();
    paintEditCover();
    paintEditUsername(null, true);
    refreshEditUsername();
    $('#editProfileSheet').classList.add('open');
    if (focus === 'cover') pickProfileImage('banner');
  }
  function editUsernameHint(text, warn) {
    var hint = $('#editUsernameHint');
    if (!hint) return;
    hint.textContent = text || '';
    hint.classList.toggle('warn', !!warn);
  }
  function paintEditUsername(info, loading) {
    var input = $('#editUsername');
    if (!input || !state.editProf) return;
    input.value = state.editProf.username || '';
    input.disabled = false;
    if (!ME || ME.mode === 'guest') {
      input.disabled = true;
      editUsernameHint('游客账号不支持修改账号', true);
      return;
    }
    if (!Srv.canSync()) {
      input.disabled = true;
      editUsernameHint('连接服务器后可修改账号', true);
      return;
    }
    if (loading) { editUsernameHint('正在读取修改次数…'); return; }
    if (isAdmin()) { editUsernameHint('管理员可随时修改账号，不限次数'); return; }
    var last = info && info.usernameChangedAt;
    var next = last ? Date.parse(last) + 30 * 86400000 : 0;
    if (next > Date.now()) {
      input.disabled = true;
      editUsernameHint('本月已修改过，下次可修改时间：' + new Date(next).toISOString().slice(0, 10), true);
      return;
    }
    editUsernameHint('普通用户一个月只能修改一次账号');
  }
  function refreshEditUsername() {
    if (!state.editProf || !Srv.canSync()) return;
    Srv.ensure().then(function () { return Srv.raw('/api/me'); }).then(function (d) {
      if (!d || !d.user || !state.editProf) return;
      LS.setItem(SRV_USER_KEY, JSON.stringify(d.user));
      state.editProf.username = d.user.username;
      paintEditUsername(d.user, false);
    }).catch(function () { paintEditUsername(null, false); });
  }
  function paintEditAvatar() {
    var el = $('#editAvatar');
    if (!el || !state.editProf) return;
    if (state.editProf.avatar) {
      el.classList.add('has-img');
      el.innerHTML = '<img src="' + state.editProf.avatar + '" alt="">';
    } else {
      el.classList.remove('has-img');
      el.textContent = ME.name.slice(0, 1);
    }
  }
  function paintEditCover() {
    var p = state.editProf;
    if (!p) return;
    $('#editCoverPrev').style.backgroundImage = p.banner ? 'url("' + p.banner + '")' : '';
    $('#editCoverSub').textContent = p.banner ? '已选择背景图，点此更换' : '选择一张图片作为主页顶部背景';
  }
  function pickProfileImage(target) {
    state.pickTarget = target;
    var input = $('#profilePicker');
    if (!input) return;
    input.value = '';
    input.click();
  }
  /* 账号改名后，本机缓存里的资料、关注、旧帖作者信息一起迁移，避免出现「自己看不到自己帖子」 */
  function renameLocalAccount(oldHandle, newHandle, srvUser) {
    var oldKey = String(oldHandle || '').toLowerCase();
    var newKey = String(newHandle || '').toLowerCase();
    if (!oldKey || !newKey || oldKey === newKey) return;
    var accounts = loadAccounts();
    accounts.forEach(function (a) {
      if (String(a.username || '').toLowerCase() === oldKey) {
        a.username = newKey;
        a.handle = newKey;
      }
    });
    saveAccounts(accounts);
    if (ME) {
      ME.username = newKey;
      ME.handle = newKey;
      if (String(ME.key || '').toLowerCase() === oldKey) ME.key = newKey;
      if (srvUser && srvUser.id) ME.remoteId = srvUser.id;
      saveSession(ME);
    }
    if (srvUser) LS.setItem(SRV_USER_KEY, JSON.stringify(srvUser));
    var profiles = loadProfiles();
    if (profiles[oldKey]) {
      profiles[newKey] = profiles[oldKey];
      delete profiles[oldKey];
      saveProfiles(profiles);
    }
    try {
      var follows = loadFollows().map(function (k) { return k === oldKey ? newKey : k; });
      saveFollows(follows);
    } catch (e) { /* 关注列表异常不影响改名 */ }
    function fixAuthor(a) {
      if (!a) return false;
      var changed = false;
      if (String(a.key || '').toLowerCase() === oldKey) { a.key = newKey; changed = true; }
      if (String(a.handle || '').toLowerCase() === oldKey) { a.handle = newKey; changed = true; }
      return changed;
    }
    var jobs = [];
    (state.posts || []).forEach(function (p) {
      if (fixAuthor(p.author)) jobs.push(dbPut('posts', p));
    });
    (state.allComments || []).forEach(function (c) {
      if (fixAuthor(c.author)) jobs.push(dbPut('comments', c));
    });
    if (jobs.length) Promise.all(jobs).catch(function () {});
  }

  function commitEditProfile(oldKey) {
    var all = loadProfiles();
    var key = profileKey(ME);
    var cur = Object.assign({}, all[oldKey] || all[key] || {});
    cur.bio = $('#editBio').value.trim();
    if (state.editProf.avatar) cur.avatar = state.editProf.avatar; else delete cur.avatar;
    if (state.editProf.banner) cur.banner = state.editProf.banner; else delete cur.banner;
    all[key] = cur;
    if (oldKey && oldKey !== key) delete all[oldKey];
    try { saveProfiles(all); }
    catch (e) { toast('图片太大，保存失败，请换一张'); return; }
    $('#editProfileSheet').classList.remove('open');
    updateChrome();
    renderProfile();
    if ($('#userSheet').classList.contains('open')) openUser(key);
  }

  function saveEditProfile() {
    if (!ME || !state.editProf) return;
    var oldHandle = String(ME.handle || ME.username || '').toLowerCase();
    var input = $('#editUsername');
    var nextName = String(input && input.value || '').trim().toLowerCase();
    if (nextName && nextName !== oldHandle) {
      if (!Srv.canSync()) { toast('修改账号需要连接服务器'); return; }
      if (!/^[a-z0-9_]{2,24}$/.test(nextName)) { toast('账号需为 2-24 位字母、数字或下划线'); return; }
      var btn = $('#editProfileSave');
      btn.disabled = true;
      btn.classList.remove('on');
      Srv.ensure().then(function () { return Srv.updateProfile(nextName); }).then(function (d) {
        var u = d && d.user;
        state.editProf.username = u ? u.username : nextName;
        renameLocalAccount(oldHandle, nextName, u);
        commitEditProfile(oldHandle);
        btn.disabled = false;
        btn.classList.add('on');
        toast('账号已修改为 @' + nextName);
      }).catch(function (err) {
        btn.disabled = false;
        btn.classList.add('on');
        toast((err && err.message) || '账号修改失败');
      });
      return;
    }
    commitEditProfile(oldHandle);
    toast('资料已更新');
  }

  function cacheFmt(n) {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  /* 仍被帖子或编辑面板引用的媒体不能回收，否则正在显示的图片视频会失效 */
  function cacheInUse() {
    var used = {};
    function mark(list) { (list || []).forEach(function (m) { if (m && m.id) used[m.id] = 1; }); }
    (state.posts || []).forEach(function (p) { mark(p.media); });
    mark(state.composeMedia);
    return used;
  }
  function CACHE_LIKE(it) {
    if (!it) return false;
    if (it.scope === 'cache' || it.scope === 'webcache') return true;
    if (it.scope === 'native') return it.where === 'app';
    return false;
  }
  function cacheStats() {
    var used = cacheInUse(), bytes = 0, count = 0;
    if (localMedia && localMedia.length) {
      localMedia.forEach(function (it) {
        if (!CACHE_LIKE(it)) return;
        bytes += it.size || 0;
        count++;
      });
      var prof2 = '';
      try { prof2 = LS.getItem('u-profiles') || ''; } catch (e) { }
      if (prof2) bytes += prof2.length;
      return { bytes: bytes, count: count };
    }
    urlCache.forEach(function (url, id) {
      if (used[id]) return;
      bytes += urlBytes.get(id) || 0;
      count++;
    });
    var prof = '';
    try { prof = LS.getItem('u-profiles') || ''; } catch (e) {}
    if (prof) { bytes += prof.length; count++; }
    return { bytes: bytes, count: count };
  }
  function updateCacheSub() {
    var el = $('#cacheSub');
    if (!el) return;
    var s = cacheStats();
    el.textContent = s.count
      ? ('可释放 ' + cacheFmt(s.bytes) + ' · ' + s.count + ' 项')
      : '暂无缓存，图片视频预览将按需生成';
  }

  /* ---------------- 存储用量 ---------------- */
  function humanBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }
  $on('#storageClear', 'click', doClearAll);

  /* ---------------- 本机缓存（IndexedDB 帖子里的媒体 + 预览缓存） ---------------- */
  var localMedia = [];
  var cacheSel = {};
  function cacheEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* ---------------- 原生缓存扫描（App 私有目录 / 系统「下载/U」/ 相册「Movies/U」） ----------------
     网页端读不到手机文件，但 App 里有桥；有桥就用桥，没有就只统计浏览器自己的缓存。 */
  function scanNativeCache() {
    return new Promise(function (resolve) {
      var host = window.UHost;
      if (!host || typeof host.cacheScan !== 'function') { resolve([]); return; }
      var raw = '';
      try { raw = host.cacheScan() || ''; } catch (e) { raw = ''; }
      if (!raw) { resolve([]); return; }
      var j = null;
      try { j = JSON.parse(raw); } catch (e) { j = null; }
      var list = (j && j.items) || [];
      var out = list.map(function (o) {
        return {
          id: 'n:' + String(o.p || ''),
          path: String(o.p || ''),
          scope: 'native',
          where: String(o.w || 'app'),
          size: Number(o.s) || 0,
          name: String(o.n || '文件'),
          type: String(o.t || 'other'),
          poster: ''
        };
      }).filter(function (it) { return it.path && it.size > 0; });
      resolve(out);
    });
  }
  /* 浏览器 / WebView 的 Cache Storage 里存着的响应体（视频预载、帖子图片等） */
  function scanWebCache() {
    return new Promise(function (resolve) {
      if (!window.caches || !caches.keys) { resolve([]); return; }
      var out = [];
      var jobs = [];
      jobs.push(caches.keys().then(function (names) {
        return Promise.all(names.map(function (name) {
          return caches.open(name).then(function (c) {
            return c.keys().then(function (reqs) {
              return Promise.all(reqs.map(function (req) {
                return c.match(req).then(function (res) {
                  if (!res) return null;
                  var len = Number(res.headers.get('content-length')) || 0;
                  if (len > 0) { out.push({ url: req.url, size: len }); return null; }
                  return res.clone().blob().then(function (b) { out.push({ url: req.url, size: b.size || 0 }); })
                    .catch(function () { });
                }).catch(function () { });
              }));
            });
          }).catch(function () { });
        }));
      }).catch(function () { }));
      Promise.all(jobs).then(function () {
        var items = out.filter(function (o) { return o.size > 0; }).map(function (o) {
          var nm = String(o.url || '').split('?')[0].split('/').pop() || '缓存文件';
          var t = /\.(mp4|m4v|webm|mov)$/i.test(nm) ? 'video'
            : (/\.(jpg|jpeg|png|webp|gif)$/i.test(nm) ? 'image' : 'other');
          return { id: 'w:' + o.url, path: o.url, scope: 'webcache', where: 'web', size: o.size, name: nm, type: t, poster: '' };
        });
        resolve(items);
      }).catch(function () { resolve([]); });
    });
  }

  function localMediaItems() {
    return DataAPI.listPosts().then(function (posts) {
      var items = [], seen = {};
      (posts || []).forEach(function (p) {
        (p.media || []).forEach(function (m) {
          if (!m || !m.id) return;
          var b = m.blob;
          var size = (b && typeof b.size === 'number') ? b.size : (urlBytes.get(m.id) || 0);
          if (!size) return;
          seen[String(m.id)] = 1;
          items.push({
            id: String(m.id), postId: p.id, scope: 'post', size: size, postRemote: !!p.remoteId,
            name: m.name || ((m.type === 'video' ? '视频' : '图片') + ' ' + String(m.id).slice(-6)),
            type: m.type || (b && b.type) || '',
            blob: b || null,
            poster: m.poster ? posterSrc(m) : ''
          });
        });
      });
      urlCache.forEach(function (url, id) {
        if (seen[String(id)]) return;
        var meta = urlMeta.get(id) || {};
        items.push({
          id: String(id), scope: 'cache', size: urlBytes.get(id) || 0,
          name: meta.name || ('预览缓存 ' + String(id).slice(-6)),
          type: meta.type || '',
          url: url,
          poster: meta.poster || ''
        });
      });
      return Promise.all([scanNativeCache(), scanWebCache()]).then(function (more) {
        var seen2 = {};
        items.forEach(function (it) { seen2[String(it.id)] = 1; });
        (more[0] || []).concat(more[1] || []).forEach(function (it) {
          if (seen2[String(it.id)]) return;
          seen2[String(it.id)] = 1;
          items.push(it);
        });
        items.sort(function (a, b) { return b.size - a.size; });
        return items;
      });
    }).catch(function () { return []; });
  }
  /* 本地缓存条目的图片/视频地址：优先用已生成的 blob 地址，没有就现建一个（同一个 blob 只建一次） */
  function cacheItemUrl(it) {
    if (!it) return '';
    var u = urlCache.get(it.id);
    if (u) return u;
    if (it.blob) {
      try { u = URL.createObjectURL(it.blob); urlCache.set(it.id, u); } catch (e) { u = ''; }
      if (u) { urlBytes.set(it.id, it.blob.size || it.size || 0); urlMeta.set(it.id, { name: it.name, type: it.type }); }
      return u;
    }
    return it.url || '';
  }
  function cacheKind(it) {
    var t = String((it && it.type) || '').toLowerCase();
    if (t === 'video' || /^video\//.test(t)) return '视频';
    if (t === 'image' || /^image\//.test(t)) return '图片';
    return '文件';
  }
  function whereText(it) {
    if (!it || !it.scope) return '';
    if (it.scope === 'native') {
      if (it.where === 'movie') return '相册 Movies/U';
      if (it.where === 'download') return '系统下载';
      return 'App 缓存目录';
    }
    if (it.scope === 'webcache') return '网页缓存';
    return it.scope === 'post' ? '帖子里的文件' : '预览缓存';
  }
  function cacheThumbHTML(it) {
    var u = cacheItemUrl(it), kind = cacheKind(it);
    if (kind === '视频') {
      if (it.poster) return '<img src="' + cacheEsc(it.poster) + '" alt=""><i class="cache-play">▶</i>';
      if (u) return '<video src="' + cacheEsc(u) + '#t=1" preload="metadata" muted playsinline></video><i class="cache-play">▶</i>';
      return '<em>视频</em>';
    }
    if (kind === '图片') return u ? '<img src="' + cacheEsc(u) + '" alt="">' : '<em>图片</em>';
    return '<em>文件</em>';
  }
  function openCachePreview(id) {
    var it = null;
    localMedia.forEach(function (x) { if (String(x.id) === String(id)) it = x; });
    if (!it) return;
    var u = cacheItemUrl(it);
    if (!u) { toast('这个文件已经不在本机了'); return; }
    var kind = cacheKind(it);
    var body = $('#cachePrevBody');
    var nameEl = $('#cachePrevName');
    if (!body) return;
    if (!(body.innerHTML && body.getAttribute('data-cid') === String(it.id))) {
      if (kind === '视频') {
        body.innerHTML = '<video id="cachePrevVideo" src="' + cacheEsc(u) + '" controls autoplay playsinline' +
          (it.poster ? ' poster="' + cacheEsc(it.poster) + '"' : '') + '></video>';
      } else if (kind === '图片') {
        body.innerHTML = '<img src="' + cacheEsc(u) + '" alt="">';
      } else {
        body.innerHTML = '<div style="color:#fff;font-size:13.5px;opacity:.8">这种文件不能预览</div>';
      }
      body.setAttribute('data-cid', String(it.id));
    }
    if (nameEl) nameEl.textContent = it.name + ' · ' + humanBytes(it.size);
    $('#cachePrev').classList.add('open');
    var v = $('#cachePrevVideo');
    if (v) { try { v.play().catch(function () {}); } catch (e) {} }
  }
  function closeCachePreview() {
    var box = $('#cachePrev');
    if (!box) return;
    var v = $('#cachePrevVideo');
    if (v) { try { v.pause(); } catch (e) {} }
    box.classList.remove('open');
    var body = $('#cachePrevBody');
    if (body) { body.innerHTML = ''; body.removeAttribute('data-cid'); }
  }
  function localBuckets(items) {
    var out = {
      video: { count: 0, bytes: 0 }, image: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 }, total: { count: 0, bytes: 0 }
    };
    items.forEach(function (it) {
      var t = String(it.type || '').toLowerCase();
      var k = (t === 'video' || /^video\//.test(t)) ? 'video'
        : ((t === 'image' || /^image\//.test(t)) ? 'image' : 'other');
      out[k].count++; out[k].bytes += it.size;
      out.total.count++; out.total.bytes += it.size;
    });
    return out;
  }
  function paintLocalStorage() {
    var lists = $$('#storageList, #cleanStorageList');
    var subs = $$('#storageSub, #cleanStorageSub');
    var bars = $$('#storageBar, #cleanStorageBar');
    if (!lists.length) return;
    var b = localBuckets(localMedia);
    var denom = b.total.bytes || 1;
    var pct = function (n) { return (n > 0 ? Math.max(2, Math.round((n / denom) * 100)) : 0) + '%'; };
    bars.forEach(function (bar) {
      bar.style.display = b.total.bytes ? '' : 'none';
      var fills = bar.querySelectorAll('i');
      if (fills[0]) fills[0].style.width = pct(b.video.bytes);
      if (fills[1]) fills[1].style.width = pct(b.image.bytes);
      if (fills[2]) fills[2].style.width = pct(b.other.bytes);
    });
    var rowsHTML =
      '<div class="stor-row"><span><em class="vid"></em>视频</span><b>' + b.video.count + ' 个 · ' + humanBytes(b.video.bytes) + '</b></div>' +
      '<div class="stor-row"><span><em class="img"></em>图片</span><b>' + b.image.count + ' 个 · ' + humanBytes(b.image.bytes) + '</b></div>' +
      '<div class="stor-row"><span><em class="oth"></em>其他文档</span><b>' + b.other.count + ' 个 · ' + humanBytes(b.other.bytes) + '</b></div>' +
      '<div class="stor-row stor-total"><span>合计</span><b>' + b.total.count + ' 个 · ' + humanBytes(b.total.bytes) + '</b></div>';
    var subText = b.total.count
      ? ('本机保存的视频与图片 · 共 ' + b.total.count + ' 个文件')
      : '本机还没有保存的视频或图片';
    lists.forEach(function (list) { list.innerHTML = rowsHTML; });
    subs.forEach(function (node) { node.textContent = subText; });
  }
  function loadLocalStorage() {
    var clr = $('#storageClear');
    if (clr) clr.style.display = '';
    return localMediaItems().then(function (items) {
      localMedia = items;
      paintLocalStorage();
      updateCacheSub();
      if ($('#cacheSheet') && $('#cacheSheet').classList.contains('open')) renderCacheList();
      return items;
    });
  }
  function renderCacheList() {
    var box = $('#cacheList');
    if (!box) return;
    if (!localMedia.length) {
      box.innerHTML = '<div class="cache-empty">本机还没有保存的视频或图片</div>';
      cacheSel = {};
      paintCacheBar();
      return;
    }
    box.innerHTML = localMedia.map(function (it) {
      var kind = cacheKind(it);
      var on = cacheSel[it.id] ? ' checked' : '';
      var id = cacheEsc(it.id);
      return '<div class="cache-row"><input type="checkbox" data-cid="' + id + '"' + on + '>' +
        '<div class="cache-thumb" data-cprev="' + id + '">' + cacheThumbHTML(it) + '</div>' +
        '<span class="cache-main" data-cprev="' + id + '"><b>' + cacheEsc(it.name) + '</b><em>' + kind +
        ' · ' + cacheEsc(whereText(it)) + '</em></span>' +
        '<span class="cache-size">' + humanBytes(it.size) + '</span></div>';
    }).join('');
    paintCacheBar();
  }
  function paintCacheBar() {
    var n = 0, bytes = 0;
    localMedia.forEach(function (it) { if (cacheSel[it.id]) { n++; bytes += it.size; } });
    var info = $('#cacheSelInfo');
    var btn = $('#cacheDel');
    if (info) info.textContent = n ? ('已选 ' + n + ' 个 · ' + humanBytes(bytes)) : '未选择文件';
    if (btn) { btn.disabled = !n; btn.style.opacity = n ? '' : '.45'; }
  }
  function openCacheSheet() {
    pauseAllVideos();
    $('#cacheSheet').classList.add('open');
    cacheSel = {};
    renderCacheList();
    loadLocalStorage();
  }
  function closeCacheSheet() { closeCachePreview(); $('#cacheSheet').classList.remove('open'); }
  function deleteLocalSelected() {
    var ids = Object.keys(cacheSel).filter(function (k) { return cacheSel[k]; });
    if (!ids.length) return;
    var map = {}; ids.forEach(function (k) { map[k] = 1; });
    var n = ids.length, bytes = 0;
    localMedia.forEach(function (it) { if (map[it.id]) bytes += it.size; });
    confirmDialog({
      title: '删除本地文件？',
      desc: '将从本机删除选中的 ' + n + ' 个文件（' + humanBytes(bytes) + '），服务器上的原文件不受影响。',
      okText: '删除'
    }).then(function (ok) {
      if (!ok) return;
      var nativePaths = [], webKeys = [];
      ids.forEach(function (id) {
        var it = null;
        localMedia.forEach(function (x) { if (String(x.id) === String(id)) it = x; });
        if (!it) return;
        if (String(id).indexOf('n:') === 0) nativePaths.push(String(it.path || '').replace(/^n:/, ''));
        else if (String(id).indexOf('w:') === 0) webKeys.push(String(it.path || ''));
      });
      if (nativePaths.length) {
        try {
          var host = window.UHost;
          if (host && typeof host.cacheDelete === 'function') {
            host.cacheDelete(JSON.stringify(nativePaths.map(function (p) { return 'n:' + p; })));
          }
        } catch (e) { /* 忽略 */ }
      }
      if (webKeys.length && window.caches && caches.keys) {
        caches.keys().then(function (names) {
          return Promise.all(names.map(function (n) {
            return caches.open(n).then(function (c) {
              return Promise.all(webKeys.map(function (u) { return c.delete(u).catch(function () { }); }));
            }).catch(function () { });
          }));
        }).catch(function () { });
      }
      DataAPI.listPosts().then(function (posts) {
        var jobs = [];
        (posts || []).forEach(function (p) {
          var hit = false;
          (p.media || []).forEach(function (m) { if (m && map[String(m.id)]) hit = true; });
          if (!hit) return;
          p.media = (p.media || []).filter(function (m) { return !(m && map[String(m.id)]); });
          jobs.push(dbPut('posts', p));
        });
        ids.forEach(function (id) {
          var u = urlCache.get(id);
          if (u) { try { URL.revokeObjectURL(u); } catch (e) {} }
          urlCache.delete(id); urlBytes.delete(id); urlMeta.delete(id);
        });
        return Promise.all(jobs);
      }).then(function () {
        cacheSel = {};
        toast('已删除 ' + n + ' 个本地文件');
        return DataAPI.listPosts();
      }).then(function (list) {
        state.posts = list.sort(function (a, b) { return b.createdAt - a.createdAt; });
        renderAll();
        updateCacheSub();
        loadLocalStorage();
        renderCacheList();
      }).catch(function () { toast('删除失败，请重试'); });
    });
  }
  $on('#storageOpen', 'click', openCacheSheet);
  $on('#cacheClose', 'click', closeCacheSheet);
  $on('#cacheList', 'change', function (e) {
    var cb = e.target.closest ? e.target.closest('input[data-cid]') : null;
    if (!cb) return;
    cacheSel[cb.getAttribute('data-cid')] = cb.checked;
    paintCacheBar();
  });
  $on('#cacheAll', 'click', function () {
    var allOn = localMedia.length && localMedia.every(function (it) { return cacheSel[it.id]; });
    cacheSel = {};
    if (!allOn) localMedia.forEach(function (it) { cacheSel[it.id] = true; });
    $$('#cacheList input[data-cid]').forEach(function (cb) { cb.checked = !!cacheSel[cb.getAttribute('data-cid')]; });
    paintCacheBar();
  });
  $on('#cacheList', 'click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-cprev]') : null;
    if (!el) return;
    openCachePreview(el.getAttribute('data-cprev'));
  });
  $on('#cachePrevClose', 'click', closeCachePreview);
  $on('#cacheDel', 'click', deleteLocalSelected);
  /* 清理缓存：真正删掉本机缓存的媒体文件（预览缓存、已上传到服务器的帖子附件里的 Blob），
     顺带清掉浏览器缓存与 App 的 WebView 缓存；还没上传的本地文件保留，避免丢内容。 */
  function clearCache() {
    loadLocalStorage().then(function (items) {
      items = items || [];
      var targets = items.filter(function (it) {
        if (CACHE_LIKE(it)) return true;
        return it.scope === 'post' && it.postRemote;
      });
      var nativeIds = targets.filter(function (it) { return it.scope === 'native'; })
        .map(function (it) { return String(it.path || '').replace(/^n:/, ''); });
      var webIds = targets.filter(function (it) { return it.scope === 'webcache'; })
        .map(function (it) { return String(it.path || ''); });
      var keep = items.length - targets.length;
      var bytes = 0;
      targets.forEach(function (it) { bytes += it.size || 0; });
      var prof = '';
      try { prof = LS.getItem('u-profiles') || ''; } catch (e) { /* 忽略 */ }
      bytes += prof.length;
      if (!targets.length && !prof) { toast('暂时没有可清理的缓存'); return; }
      var n = targets.length;
      confirmDialog({
        title: '清理本地缓存？',
        desc: '将删除本机缓存的 ' + n + ' 个文件（' + humanBytes(bytes) + '），帖子文字和服务器上的原文件不受影响' +
          (keep ? '；另有 ' + keep + ' 个还没上传到服务器的文件会保留' : '') + '。',
        okText: '清理'
      }).then(function (ok) {
        if (!ok) return;
        var map = {};
        targets.forEach(function (it) {
          map[it.id] = 1;
          var u = urlCache.get(it.id);
          if (u) { try { URL.revokeObjectURL(u); } catch (e) { /* 忽略 */ } }
          urlCache.delete(it.id); urlBytes.delete(it.id); urlMeta.delete(it.id);
        });
        try { LS.removeItem('u-profiles'); } catch (e) { /* 忽略 */ }
        PROFILE_CACHE = {};
        try {
          var h2 = window.UHost;
          if (nativeIds.length && h2 && typeof h2.cacheDelete === 'function') {
            h2.cacheDelete(JSON.stringify(nativeIds.map(function (p) { return 'n:' + p; })));
          }
        } catch (e) { /* 忽略 */ }
        try {
          if (webIds.length && window.caches && caches.keys) {
            caches.keys().then(function (names) {
              return Promise.all(names.map(function (n) {
                return caches.open(n).then(function (c) {
                  return Promise.all(webIds.map(function (u) { return c.delete(u).catch(function () { }); }));
                }).catch(function () { });
              }));
            }).catch(function () { });
          }
        } catch (e) { /* 忽略 */ }
        var jobs = [];
        jobs.push(DataAPI.listPosts().then(function (posts) {
          return Promise.all((posts || []).map(function (p) {
            if (!p.remoteId) return null;
            var hit = false;
            (p.media || []).forEach(function (m) { if (m && map[String(m.id)]) hit = true; });
            if (!hit) return null;
            /* 云端已经有这份文件：只丢本机 Blob，保留地址，图片视频下次仍然按需重新加载 */
            p.media = (p.media || []).map(function (m) {
              if (!m || !map[String(m.id)]) return m;
              var keep = { id: m.id, type: m.type, name: m.name, ratio: m.ratio || 0 };
              var rid = m.rid || (m.id && /^[a-f0-9]{24}$/.test(String(m.id)) ? m.id : '');
              if (rid) keep.rid = rid;
              var src = m.src || m.url || '';
              if (src && !/^blob:/.test(src) && !/^data:/.test(src)) keep.src = src;
              else if (rid && srvBase()) keep.src = srvBase() + '/media/' + rid;
              if (m.poster && !/^data:/.test(m.poster) && !/^blob:/.test(m.poster)) keep.poster = m.poster;
              return keep;
            });
            return dbPut('posts', p);
          }));
        }).then(function () { return DataAPI.listPosts(); }).then(function (list) {
          state.posts = list.sort(function (a, b) { return b.createdAt - a.createdAt; });
        }).catch(function () { /* 忽略 */ }));
        try {
          if (window.caches && caches.keys) {
            jobs.push(caches.keys().then(function (ks) {
              return Promise.all(ks.map(function (k) { return caches.delete(k); }));
            }).catch(function () { /* 忽略 */ }));
          }
        } catch (e) { /* 忽略 */ }
        try {
          var host = window.UHost;
          if (host && typeof host.clearWebCache === 'function') host.clearWebCache();
        } catch (e) { /* 忽略 */ }
        Promise.all(jobs.map(function (p) { return Promise.resolve(p).catch(function () { }); })).then(function () {
          renderAll();
          updateCacheSub();
          loadLocalStorage();
          toast(n ? ('已清理 ' + n + ' 个缓存文件，释放 ' + humanBytes(bytes)) : '已清理缓存');
        });
      });
    }).catch(function () { toast('清理失败，请重试'); });
  }
  function openSettings() {
    pauseAllVideos();
    releaseVideos(document.body);
    paintThemeSeg();
    $('#lanToggle').checked = LS.getItem('u-lan') === '1';
    $('#lanToggle').disabled = !LAN_SUPPORTED;
    var logoutRow = $('#logoutRow2');
    if (logoutRow) logoutRow.style.display = session ? '' : 'none';
    updateAdminSub();
    updateLanStatus();
    updateCacheSub();
    loadLocalStorage();
    renderSrvPorts();
    paintAbout();
    updateBlockSub();
    updateSettingsSubs();
    $('#srvUrl').value = srvBase();
    updateSrvStatus();
    loadSrvConfig();
    $('#settingsSheet').classList.add('open');
  }
  function closeSettings() {
    $('#settingsSheet').classList.remove('open');
    document.body.classList.remove('auth-settings');
  }
  function updateSrvStatus(msg) {
    var el = $('#srvStatus');
    var el2 = $('#srvSheetStatus');
    /* 设置页那一行最多显示两行小字（第一行地址、第二行公网与环境），超出各自省略号；
       二级页里是完整的多行文本，不受这个限制 */
    function put(t) {
      if (el2) el2.textContent = t;
      if (!el) return;
      var parts = String(t).split('\n');
      el.innerHTML = '<span class="srv-l1">' + esc(parts[0] || '') + '</span>' +
        (parts[1] ? '<span class="srv-l2">' + esc(parts[1]) + '</span>' : '');
    }
    if (!el && !el2) return;
    if (msg) { put(msg); return; }
    var b = srvBase();
    if (!b) { put('自动连接已关闭，数据仅保存在这台手机'); return; }
    var u = srvUser();
    var line;
    if (srvToken() && u) line = '已连接 ' + b + ' · ' + u.nickname;
    else if (typeof ME !== 'undefined' && ME) line = '已连接 ' + b + ' · ' + (ME.nickname || '游客') + '（本机）';
    else line = '自动接入 ' + b + '，登录后开始同步';
    /* 有内网穿透时把公网地址也写出来，方便发给别人 */
    if (window.__uTunnelUrl) line += '\n公网 ' + skipWarn(window.__uTunnelUrl);
    else if (window.__uTunnelOn) line += '\n公网地址获取中…';
    try {
      var nPorts = portsList().length;
      line += '\n' + envLabel() + (nPorts ? ' · 已保存 ' + nPorts + ' 个端口' : '');
    } catch (err) { /* 环境识别失败不影响状态显示 */ }
    put(line);
  }
  function updateAdminSub() {
    var el = $('#adminNotifySub');
    if (!el) return;
    var pending = loadNotifies().filter(function (n) { return !n.published; }).length;
    el.textContent = pending ? (pending + ' 条待发布通知') : '新建、编辑、删除通知';
  }
  function updateSettingsSubs() {
    var acc = $('#accountSecSub');
    if (acc) acc.textContent = (typeof ME !== 'undefined' && ME ? ('@' + (ME.handle || 'u')) : '未登录') + ' · 切换账号、退出登录';
    var g = $('#generalSub');
    if (g) {
      var t = '跟随系统';
      try {
        var v = LS.getItem('u-theme') || 'auto';
        t = v === 'light' ? '浅色' : (v === 'dark' ? '深色' : '跟随系统');
      } catch (e) { /* 忽略 */ }
      g.textContent = '外观：' + t;
    }
    var n = $('#netSub');
    if (n) {
      var b = srvBase();
      n.textContent = b ? ('已连接 ' + b) : '未连接服务器';
    }
  }
  /* 共享数据文件夹：列出并查看服务器上的实际文件 */
  function openFilesSheet() {
    /* 局域网页保持打开，文件页盖在它上面，返回时原地露出 */
    $('#filesSheet').classList.add('open');
    var body = $('#filesBody');
    body.innerHTML = '<div class="lan-empty">正在读取…</div>';
    fetch('/lan/files', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('files'); return r.json(); })
      .then(renderFiles)
      .catch(function () {
        body.innerHTML = '<div class="lan-empty">读取失败，请确认本机局域网服务已启动</div>';
      });
  }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }
  function fmtFileTime(ts) {
    var d = new Date(ts || Date.now());
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fileUrl(f) {
    var p = f.path || '';
    var m = p.match(/^clients\/([^/]+)\/media\/(.+)$/);
    if (m) {
      return '/lan/client/media?client=' + encodeURIComponent(m[1]) +
        '&id=' + encodeURIComponent(m[2]) + '&type=' + f.kind;
    }
    if (p.indexOf('media/') === 0) {
      return '/lan/media?id=' + encodeURIComponent(p.substring(6)) + '&type=' + f.kind;
    }
    return '/lan/file?path=' + encodeURIComponent(p);
  }
  function renderFiles(data) {
    var body = $('#filesBody');
    var files = (data && data.files) || [];
    var html = '<div class="lan-empty" style="padding:14px 4px 10px;text-align:left">' +
      esc((data && data.dir) || '共享目录') + '</div>';
    if (!files.length) {
      html += '<div class="lan-empty">文件夹是空的，发布带图片/视频的帖子后会出现文件</div>';
      body.innerHTML = html;
      return;
    }
    files.sort(function (a, b) { return String(a.path || '').localeCompare(String(b.path || '')); });
    files.forEach(function (f, i) {
      var tag = f.kind === 'image' ? 'IMG' : f.kind === 'video' ? 'VID' : f.kind === 'text' ? 'TXT' : 'FILE';
      html += '<button class="file-row" data-fidx="' + i + '">' +
        '<span class="file-ico">' + tag + '</span>' +
        '<span class="file-main"><span class="file-name">' + esc(f.path || f.name || '') + '</span>' +
        '<span class="file-sub">' + fmtSize(f.size) + ' · ' + fmtFileTime(f.mtime) + '</span></span></button>';
      if (f.kind === 'text') {
        html += '<pre class="file-pre" id="filePre' + i + '" style="display:none"></pre>';
      }
    });
    body.innerHTML = html;
    state.fileList = files;
    $$('#filesBody .file-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = state.fileList[+btn.getAttribute('data-fidx')];
        if (!f) return;
        if (f.kind === 'image' || f.kind === 'video') {
          openViewer({ media: [{ id: f.path, type: f.kind, src: fileUrl(f) }] }, 0);
          return;
        }
        if (f.kind !== 'text') { toast('该文件暂不支持预览'); return; }
        var pre = $('#filePre' + btn.getAttribute('data-fidx'));
        if (!pre) return;
        if (pre.style.display !== 'none') { pre.style.display = 'none'; return; }
        pre.textContent = '读取中…';
        pre.style.display = 'block';
        fetch(fileUrl(f), { cache: 'no-store' })
          .then(function (r) { return r.text(); })
          .then(function (t) { pre.textContent = t.slice(0, 20000); })
          .catch(function () { pre.textContent = '读取失败'; });
      });
    });
  }

  /* 服务器接口页：仅管理员可打开，只列出本机真实可用的接口 */
  function openApiSheet() {
    if (!isAdmin()) { toast('仅管理员可用'); return; }
    /* 设置页保持打开，二级页直接盖在上面 */
    $('#apiSheet').classList.add('open');
    $('#apiBody').innerHTML = '<div class="empty" style="padding:36px 12px"><p>正在读取本机地址…</p></div>';
    fetch('/lan/info', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('info'); return r.json(); })
      .then(renderApiSheet)
      .catch(function () { renderApiSheet(null); });
  }
  function renderApiSheet(info) {
    /* 浏览器里没有原生 /lan/info（那是安卓壳的接口），直接用当前页面地址，别显示占位串 */
    var ip = (info && info.ip) || location.hostname || '当前手机局域网 IP';
    var port = (info && info.port) || location.port || 17880;
    var base = 'http://' + ip + ':' + port;
    var pageUrl = base + '/index.html';
    var dir = info && info.dir ? info.dir : 'Android/data/com.trae.u/files/lan';
    var rows = [
      ['GET', '/lan/info', '设备信息：名称、IP、端口、共享目录'],
      ['GET', '/lan/files', '共享文件夹中的文件清单（名称、大小、时间）'],
      ['GET', '/lan/file?path=', '读取共享文件夹中的文本文件'],
      ['GET', '/lan/peers', '同一 Wi-Fi 下已发现的设备'],
      ['GET', '/lan/snapshot', '读取本机共享的帖子、备忘录与通知'],
      ['POST', '/lan/snapshot', '写入共享快照（JSON）'],
      ['GET', '/lan/media?id=&type=', '读取图片或视频（type=image 或 video）'],
      ['POST', '/lan/media?id=&type=', '上传图片或视频（请求体为文件）'],
      ['GET', '/lan/clients', '读取通过浏览器接入的手机（iPhone 等）'],
      ['GET', '/lan/client/snapshot?client=', '读取某台浏览器设备的快照'],
      ['POST', '/lan/client/snapshot?client=&name=', '写入浏览器设备快照'],
      ['GET', '/lan/client/media?client=&id=&type=', '读取浏览器设备的媒体'],
      ['POST', '/lan/client/media?client=&id=&type=', '上传浏览器设备的媒体']
    ];
    var cards = rows.map(function (r) {
      return '<div style="display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)">' +
        '<span style="flex:0 0 auto;font-size:11px;font-weight:700;color:#fff;background:' +
        (r[0] === 'GET' ? '#bdbdc2' : '#8e8e95') +
        ';border-radius:6px;padding:3px 6px;height:18px;line-height:18px">' + r[0] + '</span>' +
        '<div style="min-width:0"><div style="font-size:13.5px;font-weight:600;word-break:break-all">' + esc(r[1]) + '</div>' +
        '<div style="font-size:12px;color:var(--dim);margin-top:2px">' + esc(r[2]) + '</div></div></div>';
    }).join('');
    $('#apiBody').innerHTML =
      '<div class="settings-card" style="padding:12px 14px">' +
      '<div class="set-title">手机访问地址</div>' +
      '<a class="api-url" id="apiUrl" href="' + esc(pageUrl) + '">' + esc(pageUrl) + '</a>' +
      '<div class="set-sub" style="margin-top:2px">轻按用浏览器打开，长按复制地址</div>' +
      '<div class="set-sub" style="margin-top:8px;word-break:break-all">接口根地址：' + esc(base) + '</div>' +
      '<div class="set-sub" style="margin-top:6px;word-break:break-all">共享文件夹：' + esc(dir) + '</div>' +
      '</div>' +
      '<div class="settings-card" style="padding:12px 14px;margin-top:12px">' +
      '<div class="set-title">远程访问地址（公网）</div>' +
      '<div class="api-url" id="apiRemoteUrl" style="word-break:break-all">检测中…</div>' +
      '<div class="set-sub" style="margin-top:4px">其他手机无需同一 Wi-Fi，用浏览器打开此地址即可连接本机（数据存在本机）</div>' +
      '</div>' +
      '<div class="settings-card" style="padding:4px 14px 10px;margin-top:12px">' + cards + '</div>' +
      '<div class="set-sub" style="padding:12px 4px;line-height:1.6">iPhone / iPad 在同一 Wi-Fi 下用 Safari 打开上面的访问地址，即可与安卓设备互相看到帖子、图片和视频。请保持安卓 App 运行。</div>' +
      '<div class="set-sub" style="padding:0 4px 8px;line-height:1.6">仅管理员可见此页面；以上均为本机已启用的接口。</div>';
    bindApiUrl(pageUrl);
    if (remoteEnabled()) {
      detectPublicIp().then(function (pub) {
        var el = $('#apiRemoteUrl');
        if (!el) return;
        if (!pub) { el.textContent = '无法检测公网 IP，请确认已连接网络'; return; }
        el.textContent = skipWarn('http://' + pub + ':' + port + '/index.html');
      });
    } else {
      var el = $('#apiRemoteUrl');
      if (el) el.textContent = '未开启远程访问（在「互传与远程访问」中开启）';
    }
  }
  /* 手机访问地址：轻按打开系统浏览器，长按复制 */
  function bindApiUrl(url) {
    var link = $('#apiUrl');
    if (!link) return;
    var timer = null, longPress = false;
    var cancel = function () { clearTimeout(timer); timer = null; };
    link.addEventListener('pointerdown', function () {
      longPress = false;
      cancel();
      timer = setTimeout(function () { longPress = true; copyText(url); }, 500);
    });
    link.addEventListener('pointerup', cancel);
    link.addEventListener('pointercancel', cancel);
    link.addEventListener('pointerleave', cancel);
    link.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    link.addEventListener('click', function (e) {
      e.preventDefault();
      cancel();
      if (longPress) { longPress = false; return; }
      openExternal(url);
    });
  }
  /* serveo 免费隧道的专属域名第一次用浏览器打开会先插一页警告（点了 Continue 才进）。
     给它带上这个参数能直接跳过；同一浏览器里一次之后一年内都有效。 */
  function skipWarn(url) {
    var s = String(url || '');
    if (!s) return s;
    if (!/(^|\.)(serveousercontent\.com|serveo\.net)/i.test(s)) return s;
    if (/serveo-skip-browser-warning=/i.test(s)) return s;
    return s + (s.indexOf('?') >= 0 ? '&' : '?') + 'serveo-skip-browser-warning=true';
  }
  function openExternal(url) {
    url = skipWarn(url);
    if (window.UHost && window.UHost.openUrl) {
      try { window.UHost.openUrl(url); return; } catch (e) { /* 用下面的方式兜底 */ }
    }
    var w = window.open(url, '_blank');
    if (!w) toast('请长按复制地址后在浏览器打开');
  }
  /* 清掉本机浏览器里的一切（帖子库、备忘录、回复、账号缓存、设置、缓存文件），
     只保留「服务器地址」与「已保存端口」——否则清完就再也连不回服务器了。 */
  function wipeBrowserData() {
    var jobs = [];
    try { jobs.push(DataAPI.clearAll()); } catch (e) { }
    try {
      urlCache.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { } });
      urlCache.clear();
      urlBytes.clear();
      if (typeof urlMeta !== 'undefined' && urlMeta && urlMeta.clear) urlMeta.clear();
    } catch (e) { }
    try {
      var keepSrv = LS.getItem(SRV_KEY) || '';
      var keepPorts = LS.getItem(PORTS_KEY) || '';
      var keys = [];
      for (var i = 0; i < LS.length; i++) keys.push(LS.key(i));
      keys.forEach(function (k) {
        if (!k || k === SRV_KEY || k === PORTS_KEY) return;
        LS.removeItem(k);
      });
      if (keepSrv) LS.setItem(SRV_KEY, keepSrv); else LS.removeItem(SRV_KEY);
      if (keepPorts) LS.setItem(PORTS_KEY, keepPorts); else LS.removeItem(PORTS_KEY);
      SS.clear();
    } catch (e) { }
    try {
      if (window.caches && caches.keys) {
        jobs.push(caches.keys().then(function (ks) {
          return Promise.all(ks.map(function (k) { return caches.delete(k); }));
        }));
      }
    } catch (e) { }
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
          rs.forEach(function (r) { try { r.unregister(); } catch (e) { } });
        }));
      }
    } catch (e) { }
    return Promise.all(jobs.map(function (p) {
      return Promise.resolve(p).catch(function () { });
    }));
  }
  function doClearAll() {
    confirmDialog({
      title: '清空本机数据？',
      desc: '这台设备恢复出厂：\n· 本机缓存的文件（帖子、图片、视频）、回复、备忘录、账号缓存与全部设置\n· 服务器地址与已保存端口会保留，清完还能连回来\n\n服务器上的帖子、图片、视频、评论与账号都不会被删除。清完自动回到登录页。',
      okText: '清空本机数据'
    }).then(function (ok) {
      if (!ok) return;
      wipeBrowserData().then(function () {
          ME = null;
          session = null;
          state.posts = [];
          state.notes = [];
          state.comments = [];
          state.myCounts = null;
          tabAfterAuth = null;
          try { closePost(); } catch (e) { }
          try { closeViewer(); } catch (e) { }
          try {
            $$('.sheet.open').forEach(function (s) { s.classList.remove('open'); });
          } catch (e) { }
          try { renderAll(); } catch (e) { }
          try { switchTab('feed'); } catch (e) { }
          showAuth();
          toast('本机数据已清空，服务器上的帖子还在，请重新登录');
      });
    });
  }

  function renderAll() {
    renderFeed();
    renderTalk();
    renderNotify();
    renderNotes();
    renderProfile();
  }

  /* ---------------- 登录 / 注册 ---------------- */
  var authMode = 'login';
  var tabAfterAuth = null;   /* 退出登录前所在的页签，重新登录后回到这一页 */
  var pendingSheetAfterAuth = null;  /* 退出登录时开着的二级页，重新登录后自动打开 */
  var ACCOUNTS_KEY = 'u-acc-hist';   /* 这台设备登录过的账号（最多 8 个） */
  var LAST_USER_KEY = 'u-last-user'; /* 上次登录的账号，登录页自动填入 */
  var session = null;
  var bootUserTouched = false;

  function setAuthMode(mode) {
    authMode = mode;
    $$('.auth-tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.authTab === mode);
    });
    var p2 = $('#authPass2');
    if (p2) {
      p2.style.display = mode === 'register' ? 'block' : 'none';
      p2.value = '';
    }
    $('#authPass').setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'current-password');
    $('#authNick').style.display = mode === 'register' ? 'block' : 'none';
    $('#authSubmit').textContent = mode === 'register' ? '注册并登录' : '登录';
    var onSrv = Srv.on();
    var localBtn = $('#localModeBtn');
    if (localBtn) localBtn.style.display = onSrv ? 'block' : 'none';
    $('#authErr').textContent = '';
  }

  function showAuth() {
    authMode = 'login';
    setAuthMode('login');
    document.body.classList.remove('auth-settings');
    $('#authPass').value = '';
    var p0 = $('#authPass');
    if (p0) p0.type = 'password';
    var eye0 = $('#authEye');
    if (eye0) eye0.classList.remove('on');
    var uEl = $('#authUser');
    if (uEl) {
      var lastU = '';
      try { lastU = LS.getItem(LAST_USER_KEY) || ''; } catch (e) { /* 忽略 */ }
      uEl.value = lastU;
    }
    var p2c = $('#authPass2');
    if (p2c) p2c.value = '';
    $('#authNick').value = '';
    $('#authErr').textContent = '';
    $('#authScreen').classList.add('on');
  }

  function updateChrome() {
    if (!ME) return;
    paintAvatar($('#composerAvatar'), ME);
    paintAvatar($('#replyAvatar'), ME);
  }

  function enterApp() {
    ME = session;
    state.myCounts = null;
    updateChrome();
    try { paintAdminRows(); } catch (e) {}
    $('#authScreen').classList.remove('on');
    var wantTab = tabAfterAuth || 'feed';
    tabAfterAuth = null;
    state.tab = wantTab;
    renderAll();
    switchTab(wantTab);
    updateSrvStatus();
    try { rememberAccount(ME); } catch (e) { /* 忽略 */ }
    installBackGuard();
    try { deviceTick(); } catch (e) {}
    if (pendingSheetAfterAuth) {
      var ps = pendingSheetAfterAuth;
      pendingSheetAfterAuth = null;
      setTimeout(function () { if (ps === 'settingsSheet') { try { openSettings(); } catch (e) { /* 忽略 */ } } else { openSheetById(ps); } }, 40);
    }
    resetHomeScrollSoon();
    startBots();
    startMsgTicker();
    startSyncTimer();
    if (lanEnabled()) lanStart();
    checkLanOnEntry();
    if (session && Srv.on()) {
      loadSrvConfig();
      Srv.ensure().then(function () {
        return Srv.sync();
      }).then(function () {
        Srv._netWarned = false;
        renderAll();
        refreshConversations();
        refreshNotifications();
        refreshSrvMe();
        if (state.tab === 'feed') renderFeed();
      }).catch(function (e) {
        console.warn('服务器同步失败', e);
        var msg = e && e.message ? e.message : '服务器连接失败';
        updateSrvStatus(msg);
        if (!Srv._netWarned) {
          Srv._netWarned = true;
          toast('后台未连接，内容先存本机；请确认服务器已启动');
        }
      });
    }
  }

  /* 进入 App 时检查局域网 / 网络状态 */
  function checkLanOnEntry() {
    if (!LAN_SUPPORTED) return;
    var warned = false;
    var warn = function () {
      if (warned) return;
      warned = true;
      netMark(false);
    };
    if (navigator.onLine === false) warn();
    fetch('/lan/info', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('lan');
      return r.json();
    }).catch(warn);
    if (!window.__uOfflineBound) {
      window.__uOfflineBound = true;
      window.addEventListener('offline', function () { warned = false; warn(); });
    }
  }

  function loginUser(username, password) {
    var accounts = loadAccounts();
    var acc = null;
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].username.toLowerCase() === username.toLowerCase()) acc = accounts[i];
    }
    if (!acc) return '账号不存在，请先注册';
    if (acc.password !== password) return '密码不正确';
    session = sessionFromAccount(acc);
    saveSession(session);
    enterApp();
    toast('欢迎回来，' + acc.name);
    return '';
  }

  function registerUser(username, password, nick) {
    username = (username || '').trim();
    if (username.length < 3) return '账号至少 3 个字符';
    if (!/^[A-Za-z0-9_]+$/.test(username)) return '账号只能使用字母、数字或下划线';
    if (!password || password.length < 6) return '密码至少 6 位';
    var accounts = loadAccounts();
    var exists = accounts.some(function (a) {
      return a.username.toLowerCase() === username.toLowerCase();
    });
    if (exists) return '该账号已被注册';
    var nickName = (nick || '').trim() || username;
    if (accounts.some(function (a) { return String(a.name || '').toLowerCase() === nickName.toLowerCase(); })) {
      return '该昵称已被使用';
    }
    var acc = {
      username: username, password: password,
      name: nickName,
      handle: username.toLowerCase(), verified: false, official: false
    };
    accounts.push(acc);
    saveAccounts(accounts);
    session = sessionFromAccount(acc);
    saveSession(session);
    enterApp();
    toast('注册成功，欢迎加入 U');
    return '';
  }

  /* 已填写服务器地址时：账号在服务器注册 / 校验，成功后同步数据 */
  function remoteAuth(mode, username, password, nick) {
    var req = mode === 'register'
      ? Srv.register(username, password, nick)
      : Srv.login(username, password);
    return req.then(function (d) {
      clearSrvOff();
      LS.setItem(SRV_TOKEN_KEY, d.token);
      LS.setItem(SRV_USER_KEY, JSON.stringify(d.user));
      var isOfficialAdmin = (d.user.username === ADMIN.username);
      var acc = {
        username: d.user.username, password: password,
        name: isOfficialAdmin ? ADMIN.name : d.user.nickname,
        handle: isOfficialAdmin ? ADMIN.handle : d.user.username,
        verified: isOfficialAdmin ? ADMIN.verified : false,
        official: isOfficialAdmin ? ADMIN.official : false,
        /* 服务器判定为管理员（如 admin123）时，App 也同步获得最高权限 */
        admin: !!d.user.isAdmin || isAdminName(d.user.username)
      };
      var accounts = loadAccounts().filter(function (a) { return a.username !== acc.username; });
      accounts.push(acc);
      saveAccounts(accounts);
      session = sessionFromAccount(acc);
      session.remote = true;
      session.remoteId = d.user.id;
      saveSession(session);
      enterApp();
      toast(mode === 'register' ? '注册成功' : '欢迎回来，' + d.user.nickname);
      Srv.sync().then(function () {
        renderAll();
        if (state.tab === 'feed') renderFeed();
      }).catch(function (e) { console.warn('同步失败', e); });
      return '';
    }).catch(function (err) {
      var msg = err && err.message ? err.message : '无法连接服务器';
      if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) msg = '无法连接服务器，请检查地址和网络';
      return msg;
    });
  }

  function guestLogin() {
    /* 配了服务器：向服务器申请一个匿名账号，游客发的内容也会存到服务器 */
    if (Srv.on()) {
      toast('正在连接服务器…');
      Srv.guest().then(function (d) {
        clearSrvOff();
        LS.setItem(SRV_TOKEN_KEY, d.token);
        LS.setItem(SRV_USER_KEY, JSON.stringify(d.user));
        session = {
          mode: 'guest', key: d.user.username,
          name: d.user.nickname, handle: d.user.username,
          remote: true, remoteId: d.user.id,
          verified: false, official: false
        };
        saveSession(session);
        enterApp();
        toast('游客登录成功');
        Srv.sync().then(function () { renderAll(); }).catch(function () {});
      }).catch(function () {
        localGuest('服务器不可用，已进入本机游客模式');
      });
      return;
    }
    localGuest('已用游客身份进入');
  }

  function localGuest(msg) {
    var digits = String(Math.floor(10000 + Math.random() * 90000));
    session = {
      mode: 'guest', key: 'guest_' + digits,
      name: '游客' + digits, handle: 'guest_' + digits,
      verified: false, official: false
    };
    saveSession(session);
    enterApp();
    toast(msg);
  }

  /* ─── 二级页面栈：手机的返回键 / 返回手势按层关闭，不再直接跳回首页 ─── */
  var layerStack = [];
  var layerBusy = 0;
  var layerBackPending = false;
  var backGuardAt = 0;
  /* 进 App 后压一条哨兵历史：浏览器的返回手势先落在哨兵上，不会直接退出网页 */
  function installBackGuard() {
    if (window.__uGuard) return;
    window.__uGuard = true;
    try {
      history.replaceState(Object.assign({}, history.state || {}, { uApp: 1 }), '');
      history.pushState({ uApp: 1, uGuard: 1 }, '');
    } catch (e) { /* 忽略 */ }
  }
  function openSheetById(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('open');
    return el;
  }
  function closeSheetById(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }
  function isLayerEl(el) {
    if (!el || el.nodeType !== 1 || !el.classList) return false;
    if (el.classList.contains('sheet')) return true;
    return el.id === 'mediaViewer' || el.id === 'sideDrawer';
  }
  function closeLayerEl(el) {
    if (!el) return;
    if (el.id === 'mediaViewer') { closeViewer(); return; }
    if (el.id === 'postSheet') { closePost(); return; }
    if (el.id === 'cacheSheet') { closeCacheSheet(); return; }
    if (el.id === 'draftSheet') { closeDrafts(); return; }
    if (el.id === 'sideDrawer') { closeSide(); return; }
    if (el.id === 'lobbySheet') { closeLobby(); return; }
    if (el.id === 'tearSheet') { if (window.closeTearGame) { window.closeTearGame(); return; } }
    if (el.id === 'jumpSheet') { if (window.closeJumpGame) { window.closeJumpGame(); return; } }
    if (el.id === 'gameSheet') { if (typeof shooterCloseGame === 'function') { shooterCloseGame(); return; } }
    if (el.id === 'menuSheet') { if (typeof closeMenu === 'function') { closeMenu(); return; } }
    if (el.id === 'filesSheet') {
      el.classList.remove('open');
      var lan = $('#lanSheet');
      if (lan) lan.classList.add('open');
      return;
    }
    el.classList.remove('open');
  }
  /* 帖子详情与个人主页共用同一片区域，后打开的那个必须压在上面：
     从主页点开别人的帖子、又从帖子点开别人的主页，来回都不会被盖住。
     其余弹层（确认框 95 / 大图 90 / 反馈 60）本来就更高，这里只动这两层。 */
  function raiseOverSheet(el) {
    if (!el) return;
    var ids = ['postSheet', 'userSheet'];
    var top = 0;
    for (var i = 0; i < ids.length; i++) {
      var n = document.getElementById(ids[i]);
      if (!n || n === el || !n.classList.contains('open')) continue;
      var z = parseInt(n.style.zIndex || '0', 10) || 0;
      if (z > top) top = z;
    }
    var base = el.id === 'userSheet' ? 35 : 28;
    var z = Math.max(base, top + 1);
    if (z > 60) z = base;   /* 来回点太多次就回落到基准，避免盖过确认框和大图 */
    el.style.zIndex = String(z);
  }
  function layerAdd(el) {
    if (layerStack.indexOf(el) >= 0) return;
    layerStack.push(el);
    if (layerStack.length === 1) {
      try { history.pushState({ uLayer: 1 }, ''); } catch (e) { /* 忽略 */ }
    }
  }
  function layerDrop(el) {
    var i = layerStack.indexOf(el);
    if (i < 0) return;
    layerStack.splice(i, 1);
    if (layerStack.length) return;
    if (layerBackPending) { layerBackPending = false; return; }
    /* 是界面按钮关掉的：把自己压入的那条历史一起弹掉，避免多一次空返回 */
    layerBusy = 1;
    try { history.back(); } catch (e) { layerBusy = 0; }
  }
  (function layerBoot() {
    if (window.MutationObserver) {
      var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var el = muts[i].target;
          if (!isLayerEl(el)) continue;
          if (el.classList.contains('open')) layerAdd(el); else layerDrop(el);
        }
      });
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    }
    window.addEventListener('popstate', function () {
      if (layerBusy) { layerBusy = 0; return; }
      if (!layerStack.length) {
        /* 根级返回：第三方浏览器（VIA、小米、QQ 浏览器）会直接离开网页回到浏览器主页。
           这里把这次返回吃掉并补一条哨兵历史，只有 2 秒内连按两次才真的退出。 */
        var now = Date.now();
        if (now - backGuardAt < 2000) {
          backGuardAt = 0;
          try { history.back(); } catch (e) { /* 忽略 */ }
          return;
        }
        backGuardAt = now;
        try { history.pushState({ uApp: 1, uGuard: 1 }, ''); } catch (e2) { /* 忽略 */ }
        if (typeof toast === 'function') toast('再按一次返回退出应用');
        return;
      }
      var el = layerStack[layerStack.length - 1];
      layerBackPending = true;
      try { closeLayerEl(el); } catch (e) { /* 忽略 */ }
      if (!layerStack.length) return;
      /* 下面还有层，重新占住一条历史，下一次返回还是关这一层 */
      layerBackPending = false;
      try { history.pushState({ uLayer: layerStack.length }, ''); } catch (e2) { /* 忽略 */ }
    });
  })();

  /* ─── 切换账号：记住这台设备登录过的账号 ─── */
  function loadAccountHistory() {
    try {
      var raw = LS.getItem(ACCOUNTS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function saveAccountHistory(list) {
    try { LS.setItem(ACCOUNTS_KEY, JSON.stringify((list || []).slice(0, 8))); } catch (e) { /* 忽略 */ }
  }
  function accountHandle(u) {
    return String((u && (u.handle || u.username || u.key)) || '').replace(/^@/, '').trim();
  }
  function rememberAccount(u) {
    var handle = accountHandle(u);
    if (!handle) return;
    try { LS.setItem(LAST_USER_KEY, handle); } catch (e) { /* 忽略 */ }
    var list = loadAccountHistory();
    var key = handle.toLowerCase();
    for (var i = list.length - 1; i >= 0; i--) {
      if (String(list[i].u || '').toLowerCase() === key) list.splice(i, 1);
    }
    list.unshift({
      u: handle,
      name: String((u && (u.name || u.nickname)) || handle),
      at: Date.now(),
      server: Srv.on() ? srvBase() : ''
    });
    saveAccountHistory(list);
  }
  function forgetAccount(handle) {
    var key = String(handle || '').toLowerCase();
    saveAccountHistory(loadAccountHistory().filter(function (a) { return String(a.u || '').toLowerCase() !== key; }));
  }
  function renderAccountSheet() {
    var box = $('#accountList');
    if (!box) return;
    var list = loadAccountHistory();
    var sub = $('#accountSub');
    if (sub) sub.textContent = list.length ? ('这台设备登录过 ' + list.length + ' 个账号') : '查看这台设备登录过的账号';
    if (!list.length) {
      box.innerHTML = '<div class="acc-empty">还没有登录过的账号<br>登录或注册一次，就会记在这里</div>';
      return;
    }
    var cur = ME ? accountHandle(ME).toLowerCase() : '';
    box.innerHTML = list.map(function (a) {
      var key = String(a.u || '');
      var initial = esc(String(a.name || key || 'U').slice(0, 1).toUpperCase());
      var isCur = key.toLowerCase() === cur;
      return '<div class="acc-row" data-acc="' + esc(key) + '">' +
        '<span class="acc-ava">' + initial + '</span>' +
        '<span class="acc-main"><b>' + esc(a.name || key) + '</b><em>@' + esc(key) +
        (isCur ? ' · 正在使用' : (a.server ? ' · ' + esc(a.server) : '')) + '</em></span>' +
        '<span class="acc-act">' +
        (isCur ? '' : '<button class="acc-go" data-accgo="' + esc(key) + '">切换</button>') +
        '<button data-accdel="' + esc(key) + '">删除</button></span></div>';
    }).join('');
  }
  function openAccountSheet() {
    renderAccountSheet();
    openSheetById('accountSheet');
  }
  function switchToAccount(handle) {
    if (!handle) return;
    try { LS.setItem(LAST_USER_KEY, handle); } catch (e) { /* 忽略 */ }
    closeSheetById('accountSheet');
    pendingSheetAfterAuth = null;
    tabAfterAuth = state.tab || 'feed';
    doSignOut();
    showAuth();
    var uEl = $('#authUser');
    if (uEl) uEl.value = handle;
    toast('已切到 ' + handle + '，输入密码继续');
  }

  /* ─── 设置页新入口与登录页密码眼睛 ─── */
  $on('#srvRow', 'click', function () { openSheetById('serverSheet'); });
  $on('#serverClose', 'click', function () { closeSheetById('serverSheet'); });
  $on('#accountRow', 'click', openAccountSheet);
  $on('#accountClose', 'click', function () { closeSheetById('accountSheet'); });
  $on('#accountList', 'click', function (e) {
    var del = e.target.closest('[data-accdel]');
    if (del) { forgetAccount(del.getAttribute('data-accdel')); renderAccountSheet(); return; }
    var go = e.target.closest('[data-accgo]');
    if (go) { switchToAccount(go.getAttribute('data-accgo')); }
  });
  $on('#authEye', 'click', function (e) {
    var btn = e.target.closest('#authEye');
    if (!btn) return;
    var p = $('#authPass');
    if (!p) return;
    var show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    btn.classList.toggle('on', show);
    btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
    try { p.focus({ preventScroll: true }); } catch (err) { /* 忽略 */ }
  });

  /* 清掉登录态（退出登录与切换账号共用） */
  function doSignOut() {
    if (Srv.on()) {
      try { Srv.logout(); } catch (e) { /* 忽略 */ }
      LS.removeItem(SRV_TOKEN_KEY);
      LS.removeItem(SRV_USER_KEY);
    }
    LS.removeItem('u-session');
    session = null;
    ME = null;
    state.myCounts = null;
    try { paintAdminRows(); } catch (e) {}
    lanStop();
    stopBots();
    stopFansTicker();
    stopSyncTimer();
    closePost();
    closeViewer();
    state.remoteNotifications = [];
    state.conversations = [];
    updateNotifyBadges();
  }

  function logout() {
    confirmDialog({
      title: '退出登录？',
      desc: '是否退出登录？',
      okText: '退出', danger: false
    }).then(function (ok) {
      if (!ok) return;
      tabAfterAuth = state.tab || 'feed';
      /* 不跳首页：退出登录时开着的二级页记下来，重新登录后还在原处 */
      pendingSheetAfterAuth = document.querySelector('.sheet.open, .media-viewer.open') ? 'settingsSheet' : null;
      var openSet = $('#settingsSheet');
      if (openSet && !openSet.classList.contains('open')) pendingSheetAfterAuth = null;
      doSignOut();
      showAuth();
    });
  }

  /* ---------------- 帖子详情 / 回复 ---------------- */
  function openPost(id) {
    pauseAllVideos();
    /* 打开帖子详情时卸载信息流里已加载的视频 */
    releaseVideos(document.body);
    var post = findPost(id);
    if (!post) return;
    countPostView(post, true);
    pushHistory(id);
    /* 不关收藏/历史所在的二级菜单：关掉帖子详情就回到那份列表 */
    state.detailPostId = id;
    state.comments = [];
    state.replyTo = null;
    paintReplyTarget();
    $('#postBody').innerHTML =
      '<div class="detail-wrap">' + postHTML(post) + '</div>' +
      '<div class="detail-stat">' +
      '<span>回复 <b id="detailReplies">' + (post.replies || 0) + '</b></span>' +
      '<span>赞 <b>' + fmt(post.likes) + '</b></span>' +
      '<span>查看 <b>' + fmt(post.views) + '</b></span></div>' +
      '<div class="reply-title">回复</div>' +
      '<div id="commentList"><div class="empty" style="padding:28px 20px"><p>加载中…</p></div></div>';
    paintAvatar($('#replyAvatar'), ME);
    initPlayers($('#postBody'));
    setTimeout(hydrateVideoCovers, 300);
    raiseOverSheet($('#postSheet'));
    $('#postSheet').classList.add('open');
    $('#postBody').scrollTop = 0;

    var loadComments = (post.remoteId && Srv.canSync())
      ? Srv.comments(post.remoteId).then(function (d) {
        return ((d && d.comments) || []).map(function (rc) { return Srv.toComment(rc, id); });
      })
      : DataAPI.listComments(id);
    loadComments.then(function (list) {
      if (state.detailPostId !== id) return;
      state.comments = list;
      renderComments();
      var cnt = $('#detailReplies');
      if (cnt) cnt.textContent = postComments(post).length;
      cmtSig = cmtSignature(postComments(post));
      startCommentPoll(post);
    });
  }

  function closePost() {
    stopCommentPoll();
    releaseVideos($('#postBody'));
    $('#postSheet').classList.remove('open');
    state.detailPostId = null;
    state.comments = [];
    state.replyTo = null;
    replyMediaClear();
    paintReplyTarget();
  }

  /* 回复：X 那种线程排版 —— 头像 + 昵称/账号一行、正文、操作图标贴在右上，不加时间 */
  function commentHTML(c, depth, parentCid) {
    var a = c.author || { name: 'U', handle: 'u' };
    var canDel = !c.bot && canDeletePost({ author: a });
    var isReply = Number(depth || 0) > 0;
    return '<div class="cmt' + (isReply ? ' is-reply' : '') + '" data-cid="' + esc(c.id) + '"' +
      (parentCid ? ' data-parent="' + esc(parentCid) + '"' : '') + '>' +
      '<div class="cmt-av">' + avatarHTML(a) + '</div>' +
      '<div class="cmt-main"><div class="cmt-head">' +
      '<span class="cmt-name" data-akey="' + esc(profileKey(a)) + '">' + esc(a.name) + '</span>' +
      (a.verified ? ICON.verified : '') +
      '<span class="cmt-handle">@' + esc(dispHandle(a) || 'u') + '</span>' +
      (c.createdAt ? '<span class="dot">·</span><span class="cmt-time">' + esc(ago(c.createdAt)) + '</span>' : '') +
      '</div>' +
      (c.replyTo ? '<div class="cmt-to">回复 @' + esc(c.replyTo.handle || c.replyTo.name || 'u') +
        (c.replyTo.name ? '（' + esc(c.replyTo.name) + '）' : '') + '</div>' : '') +
      (c.text ? '<div class="cmt-text">' + esc(c.text) + '</div>' : '') +
      commentMediaHTML(c.media) +
      '<div class="cmt-actions">' +
      '<button class="cmt-btn" data-creply="' + esc(c.id) + '" aria-label="回复">' + ICON.reply + '</button>' +
      (canDel ? '<button class="cmt-btn del" data-cdel="' + esc(c.id) + '" aria-label="删除">' + ICON.trash + '</button>' : '') +
      '</div>' +
      '</div></div>';
  }

  /* 回复里带的图片 / 视频：只放第一个，图片按比例展示、视频带播放控件 */
  function commentMediaHTML(media) {
    var m = media && media[0];
    if (!m) return '';
    var src = m.src || m.url || '';
    if (!src && m.rid) src = (typeof srvBase === 'function' && srvBase() ? srvBase() : '') + '/media/' + m.rid;
    if (!src) return '';
    if (m.type === 'video') {
      return '<div class="cmt-media"><video src="' + esc(src) + '"' +
        (m.poster ? ' poster="' + esc(m.poster) + '"' : '') +
        ' controls preload="metadata" playsinline webkit-playsinline></video></div>';
    }
    return '<div class="cmt-media"><img src="' + esc(src) + '" loading="lazy" alt=""></div>';
  }

  /* ---------------- 回复里的图片 / 视频 ---------------- */
  var REPLY_MEDIA_MAX = 200 * 1024 * 1024;

  function replyChipRender() {
    var chip = $('#replyChip');
    if (!chip) return;
    var m = state.replyMedia;
    if (!m) {
      chip.style.display = 'none';
      chip.innerHTML = '';
      return;
    }
    var thumb = m.type === 'video'
      ? '<div class="ico">▶</div>'
      : '<img src="' + esc(m.url || '') + '" alt="">';
    var label = (m.busy ? '上传中… · ' : '') + (m.name || '附件');
    chip.innerHTML = thumb + '<span>' + esc(label) + '</span>' +
      '<button type="button" data-chipdel="1" aria-label="移除附件">×</button>';
    chip.style.display = 'flex';
  }

  function replyMediaClear() {
    var m = state.replyMedia;
    if (m && m.url && !m.keep) {
      try { URL.revokeObjectURL(m.url); } catch (e) { /* 忽略 */ }
    }
    state.replyMedia = null;
    replyChipRender();
  }

  function replyMediaPick(file) {
    if (!file) return;
    if (!ME) { toast('请先登录'); return; }
    var isVideo = /^video\//i.test(file.type || '');
    if (!isVideo && !/^image\//i.test(file.type || '')) { toast('只支持图片或视频'); return; }
    if (file.size > REPLY_MEDIA_MAX) { toast('文件太大，200MB 以内更稳'); return; }
    if (!Srv.on()) { toast('连上服务器后才能发图片或视频'); return; }
    replyMediaClear();
    var url = '';
    try { url = URL.createObjectURL(file); } catch (e) { url = ''; }
    state.replyMedia = {
      file: file, url: url, id: '', busy: true,
      type: isVideo ? 'video' : 'image',
      name: file.name || (isVideo ? 'video.mp4' : 'image.jpg')
    };
    replyChipRender();
    Srv.upload(file, state.replyMedia.name, function (p) {
      var m = state.replyMedia;
      if (!m || !m.busy) return;
      var chip = $('#replyChip span');
      if (chip) chip.textContent = (p < 100 ? '上传中 ' + p + '%' : '上传完成') + ' · ' + m.name;
    }).then(function (r) {
      var m = state.replyMedia;
      if (!m) return;
      m.id = (r && r.id) || '';
      m.busy = false;
      replyChipRender();
    }).catch(function () {
      toast('附件上传失败，换个小一点的文件再试');
      replyMediaClear();
    });
  }

  function paintReplyTarget() {
    var bar = $('#replyingTo');
    if (!bar) return;
    bar.style.display = state.replyTo ? 'flex' : 'none';
    if (state.replyTo) $('#replyingName').textContent = '@' + (state.replyTo.handle || state.replyTo.name || 'u');
    var input = $('#replyInput');
    if (input) input.placeholder = state.replyTo ? '回复 @' + (state.replyTo.handle || state.replyTo.name || 'u') : '发布你的回复';
    /* 直接评论帖子是「发送」，回复某条回复是「回复」 */
    var btn = $('#replySend');
    if (btn) btn.textContent = state.replyTo ? '回复' : '发送';
  }

  function beginCommentReply(id) {
    var post = findPost(state.detailPostId);
    var c = postComments(post).filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var a = c.author || {};
    state.replyTo = { id: c.id, name: a.name || 'U', handle: a.handle || 'u' };
    paintReplyTarget();
    $('#replyInput').focus();
  }

  /* 自动回复：数量与帖子上的回复数保持一致，且按帖子 id 固定生成 */
  var COMMENT_TEXTS = [
    '这张图好有氛围感。',
    '视频我看了两遍，拍得真好。',
    '同感，最近也是这样。',
    '这个光线下拍出来太舒服了。',
    '在哪拍的？想去看看。',
    '细节做得不错。',
    '已收藏，慢慢看。',
    '哈哈，看到这里笑出声。',
    '支持一下，继续更新。',
    '说得挺对的。',
    '我也有同样的感受。',
    '配文很有意思。',
    '刚点进来就被吸引了。',
    '这个角度可以。',
    '看完心情变好了。',
    '蹲一个后续。',
    '确实，简单反而更好看。',
    '这色调整得挺高级。',
    '路过留个脚印。',
    '学到了，下次试试。'
  ];

  function hashStr(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function autoComments(post, need) {
    if (!post || need <= 0) return [];
    var rand = mulberry32(hashStr(post.id));
    var base = post.createdAt || (Date.now() - 86400000);
    var span = Math.max(60000, Date.now() - base);
    var out = [];
    for (var i = 0; i < need; i++) {
      var who = BOT_ACCOUNTS[Math.floor(rand() * BOT_ACCOUNTS.length)];
      var text = COMMENT_TEXTS[Math.floor(rand() * COMMENT_TEXTS.length)];
      out.push({
        id: 'botc-' + post.id + '-' + i,
        postId: post.id,
        text: text,
        createdAt: base + Math.floor(rand() * span),
        author: {
          key: 'bot_' + who.handle, name: who.name, handle: who.handle, bot: true
        },
        bot: true
      });
    }
    return out;
  }
  function postComments(post) {
    if (!post) return state.comments.slice();
    var real = state.comments.slice();
    var target = Math.max(post.replies || 0, real.length);
    var bots = autoComments(post, target - real.length);
    return real.concat(bots).sort(function (a, b) { return a.createdAt - b.createdAt; });
  }

  /* ---------------- 评论区自动刷新：别人回复你，不用退出帖子 ---------------- */
  var cmtPoll = 0;
  var cmtSig = '';
  function cmtSignature(list) {
    if (!list || !list.length) return '0';
    return list.map(function (c) {
      var rid = c.replyTo ? (c.replyTo.id || c.replyTo.handle || c.replyTo.name || '') : '';
      return c.id + ':' + String(c.text || '').length + ':' + rid;
    }).join('|');
  }
  function stopCommentPoll() {
    if (cmtPoll) { clearInterval(cmtPoll); cmtPoll = 0; }
  }
  function startCommentPoll(post) {
    stopCommentPoll();
    if (!post || !post.remoteId || !Srv.canSync() || netIsOffline()) return;
    var pid = post.id;
    var rid = post.remoteId;
    cmtPoll = setInterval(function () {
      if (document.hidden) return;
      if (state.detailPostId !== pid) { stopCommentPoll(); return; }
      Srv.comments(rid).then(function (d) {
        if (state.detailPostId !== pid) return;
        var list = ((d && d.comments) || []).map(function (rc) { return Srv.toComment(rc, pid); });
        var sig = cmtSignature(list);
        if (sig === cmtSig) return;
        cmtSig = sig;
        var box = $('#postBody');
        var keep = box ? box.scrollTop : 0;
        state.comments = list;
        renderComments();
        var cnt = $('#detailReplies');
        if (cnt) cnt.textContent = postComments(post).length;
        if (box) box.scrollTop = keep;
      }).catch(function () { /* 网络抖动就等下一轮，绝不弹窗 */ });
    }, 1000);
  }

  function renderComments() {
    var box = $('#commentList');
    if (!box) return;
    var list = postComments(findPost(state.detailPostId));
    if (!list.length) {
      box.innerHTML = '<div class="empty" style="padding:34px 24px">' +
        '<h3 style="font-size:16px">还没有回复</h3><p>来发表第一条回复。</p></div>';
      return;
    }
    var byId = {};
    list.forEach(function (c) { byId[String(c.id)] = c; });
    function parentOf(c) {
      var pid = c.replyTo && c.replyTo.id;
      if (pid === undefined || pid === null || pid === '') return null;
      return byId[String(pid)] || null;
    }
    function depthOf(c) {
      var d = 0, cur = c;
      while (d < 20) {
        var p = parentOf(cur);
        if (!p) break;
        d += 1; cur = p;
      }
      return d;
    }
    box.innerHTML = list.map(function (c) {
      var par = parentOf(c);
      return commentHTML(c, par ? depthOf(c) : 0, par ? par.id : '');
    }).join('');
    paintCommentRails(box);
    setTimeout(function () { paintCommentRails(box); }, 160);
    /* 评论里的图 / 视频加载完高度会变，连线跟着重画一次 */
    Array.prototype.forEach.call(box.querySelectorAll('.cmt-media img, .cmt-media video'), function (m) {
      m.addEventListener('load', function () { paintCommentRails(box); });
      m.addEventListener('loadedmetadata', function () { paintCommentRails(box); });
    });
  }

  /* 楼中楼头像之间那条竖线：量出上一层头像中心与本条头像中心，按像素画一段 */
  function paintCommentRails(box) {
    if (!box) return;
    var byCid = {};
    Array.prototype.forEach.call(box.querySelectorAll('.cmt'), function (row) {
      var cid = row.getAttribute('data-cid');
      if (cid) byCid[cid] = row;
    });
    function rootOf(row) {
      var cur = row, guard = 0;
      while (cur && guard < 30) {
        guard += 1;
        var pid = cur.getAttribute('data-parent');
        if (!pid || !byCid[pid]) return cur.getAttribute('data-cid');
        cur = byCid[pid];
      }
      return '';
    }
    Array.prototype.forEach.call(box.querySelectorAll('.cmt.is-reply'), function (row) {
      var pid = row.getAttribute('data-parent') || '';
      var par = pid ? byCid[pid] : null;
      var cAv = row.querySelector('.cmt-av .avatar');
      var rr = row.getBoundingClientRect();
      if (!par || !cAv || !rr.height) { row.style.setProperty('--rail-h', '0px'); return; }
      var pAv = par.querySelector('.cmt-av .avatar');
      if (!pAv) { row.style.setProperty('--rail-h', '0px'); return; }
      var pr = pAv.getBoundingClientRect();
      var cr = cAv.getBoundingClientRect();
      var mid = Math.round(cr.top + cr.height / 2 - rr.top);
      /* 只有紧挨着、同一条对话里的回复才画整段连线；上一层在很远的地方时只画一小段，
         免得一条长线从别人家的评论上穿过去 */
      var prev = row.previousElementSibling;
      var sameThread = !!(prev && prev.classList && prev.classList.contains('cmt') && rootOf(prev) === rootOf(row));
      var top = sameThread ? Math.round(pr.top + pr.height / 2 - rr.top) : mid - 24;
      if (top < -170) top = mid - 24;
      if (!(mid > top + 8)) top = mid - 8;
      row.style.setProperty('--rail-top', top + 'px');
      row.style.setProperty('--rail-h', (mid - top) + 'px');
    });
  }

  function sendReply() {
    var input = $('#replyInput');
    var text = input.value.trim();
    var media = state.replyMedia;
    if (!text && !media) { toast('写点什么，或者发一张图片 / 视频'); return; }
    if (media && media.busy) { toast('附件还在上传，稍等一下'); return; }
    if (!text && media && !media.id) { toast('附件还没传上去，稍等一下'); return; }
    if (!ME) { toast('请先登录'); return; }
    if (!canCommentNow()) return;
    var post = findPost(state.detailPostId);
    if (!post) return;
    var author = {
      key: ME.key, name: ME.name, handle: ME.handle,
      verified: !!ME.verified, official: !!ME.official, me: true
    };
    var replyTo = state.replyTo;
    var mediaIds = media && media.id ? [media.id] : [];
    var localMedia = media ? [{
      id: media.id || media.url, rid: media.id || '', type: media.type,
      src: media.url, mime: (media.file && media.file.type) || ''
    }] : null;
    DataAPI.addComment(post.id, text, author, replyTo, mediaIds, localMedia).then(function (c) {
      state.comments.push(c);
      state.allComments.unshift(c);
      post.replies = (post.replies || 0) + 1;
      DataAPI.updatePost(post);
      input.value = '';
      /* 只在没上传到服务器（纯本机）时保留 blob 地址，否则连预览对象一起回收 */
      if (media) media.keep = !mediaIds.length;
      replyMediaClear();
      state.replyTo = null;
      paintReplyTarget();
      renderComments();
      var cnt = $('#detailReplies');
      if (cnt) cnt.textContent = postComments(post).length;
      var rep = $('#postBody .post .pactions [data-act="reply"] span');
      if (rep) rep.textContent = fmt(post.replies);
      cmtSig = cmtSignature(state.comments);
      renderFeed();
      renderTalk();
      if (state.tab === 'profile') renderProfile();
      toast('回复已发布');
    }).catch(function (err) {
      console.error(err);
      toast('回复失败');
    });
  }

  function deleteComment(id) {
    var c = state.comments.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    confirmDialog({ title: '删除这条回复？', desc: '删除后无法恢复。', okText: '删除' }).then(function (ok) {
      if (!ok) return;
      /* 服务器上的回复（srv_c123）要先删服务端，只删本地的话刷新又会回来 */
      var remote = /^srv_c(\d+)$/.exec(String(id));
      var job = remote ? Srv.deleteComment(remote[1]) : DataAPI.deleteComment(id);
      job.then(function () {
        state.comments = state.comments.filter(function (x) { return x.id !== id; });
        state.allComments = state.allComments.filter(function (x) { return x.id !== id; });
        var p = findPost(c.postId);
        if (p) {
          p.replies = Math.max(0, (p.replies || 0) - 1);
          DataAPI.updatePost(p);
        }
        renderComments();
        cmtSig = cmtSignature(state.comments);
        var cnt = $('#detailReplies');
        if (cnt) cnt.textContent = postComments(p).length;
        if (state.tab === 'profile') renderProfile();
        toast('已删除');
      }).catch(function (err) {
        toast('删除失败：' + ((err && err.message) || '网络不给力，稍后再试'));
      });
    });
  }

  /* ---------------- 图片 / 视频查看 ---------------- */
  /* APK 里请原生一起收起状态栏与导航栏（视频页全屏沉浸，MIUI 底部小白条不再压一条白边） */
  function nativeImmersive(on) {
    try {
      if (window.UHost && typeof window.UHost.setImmersive === 'function') window.UHost.setImmersive(!!on);
    } catch (e) { /* 浏览器里没有这个桥 */ }
  }

  function openViewer(post, index) {
    if (!post || !post.media || !post.media.length) return;
    var total = Math.min(post.media.length, MEDIA_MAX);
    var i = Math.max(0, Math.min(index || 0, total - 1));
    state.viewer = { media: post.media.slice(0, total), index: i, post: post };
    /* 打开大图/视频查看器时，先把信息流里已加载的视频卸掉，释放手机内存与流量 */
    releaseVideos(document.body);
    $('#mediaViewer').style.zIndex = '90';
    $('#mediaViewer').classList.add('open');
    nativeImmersive(true);
    renderViewer();
  }

  function closeViewer() {
    /* 退出播放：记下刚看过的视频，10 秒后把它在本机的缓存删掉 */
    var watched = [];
    document.querySelectorAll('#mvContent video').forEach(function (v) {
      var u = v.currentSrc || v.getAttribute('src') || v.getAttribute('data-src') || '';
      if (u) watched.push(u);
    });
    $('#mediaViewer').classList.remove('open');
    nativeImmersive(false);
    releaseVideos($('#mvContent'));
    vcacheScheduleDrop(watched);
    $('#mvContent').innerHTML = '';
    resetMvZoom();
  }

  /* 大图缩放：双指捏合、双击放大、放大后单指拖动 */
  var mvZoom = { scale: 1, tx: 0, ty: 0 };
  function resetMvZoom() {
    mvZoom = { scale: 1, tx: 0, ty: 0 };
    applyMvZoom(false);
  }
  function applyMvZoom(animate) {
    var img = $('#mvContent>img');
    if (!img) return;
    img.style.transition = animate === false ? 'none' : 'transform .18s ease-out';
    img.style.transform = 'translate(' + mvZoom.tx + 'px,' + mvZoom.ty + 'px) scale(' + mvZoom.scale + ')';
  }
  function clampMvZoom() {
    if (mvZoom.scale < 1) { mvZoom.scale = 1; mvZoom.tx = 0; mvZoom.ty = 0; }
    if (mvZoom.scale > 5) mvZoom.scale = 5;
    /* 放大后限制平移范围，避免把图片拖出屏幕 */
    var stage = $('#mvStage');
    var maxX = stage ? stage.clientWidth * (mvZoom.scale - 1) / 2 : 0;
    var maxY = stage ? stage.clientHeight * (mvZoom.scale - 1) / 2 : 0;
    mvZoom.tx = Math.max(-maxX, Math.min(maxX, mvZoom.tx));
    mvZoom.ty = Math.max(-maxY, Math.min(maxY, mvZoom.ty));
  }

  function renderViewer() {
    var v = state.viewer;
    var m = v.media[v.index];
    if (!m) return;
    $('#mediaViewer').classList.remove('chrome-off');
    var box = $('#mvContent');
    if (m.type === 'video') {
      box.innerHTML = '<div class="vplayer mv-player">' +
        '<div class="vstage">' +
        '<video src="' + mediaSrc(m) + '" data-src="' + mediaSrc(m) + '" data-mid="' + m.id + '"' + (posterSrc(m) ? ' poster="' + posterSrc(m) + '"' : '') +
        ' data-size="' + (m.size || 0) + '" data-ratio="' + (m.ratio || 0) + '" playsinline webkit-playsinline preload="auto"></video>' +
        '<div class="vbigplay"><span>' + PLAY_ICON + '</span></div>' +
        '<div class="vrate">2x 倍速中</div>' +
        '</div>' +
        '<div class="vctrl">' +
        '<button class="vbtn" data-vact="play" aria-label="播放/暂停">' + PLAY_ICON + '</button>' +
        '<div class="vtrack" data-vact="track"><div class="vbuf"></div><div class="vfill"></div><div class="vknob"></div></div>' +
        '<span class="vtime">0:00 / 0:00</span>' +
        '<button class="vspeed" data-vact="speed">1x</button>' +
        '</div></div>';
      initPlayers(box);
      var vid = $('video', box);
      $('#mediaViewer').classList.add('video');
      renderMvOverlay(v.post, m);
      if (vid) { vid.play().catch(function () {}); bindMvVideo(vid); }
    } else {
      $('#mediaViewer').classList.remove('video');
      $('#mvOverlay').innerHTML = '';
      box.innerHTML = '<img src="' + mediaSrc(m) + '" data-mid="' + m.id + '" alt="图片预览" draggable="false">';
    }
    $('#mediaViewer').classList.toggle('vswipe', m.type === 'video' && v.media.length > 1);
    resetMvZoom();
    /* 顶部「1/9」计数已去掉：位置改由底部圆点表示 */
    var mvCountEl = $('#mvCount');
    if (mvCountEl) mvCountEl.remove();
    $('#mvDots').innerHTML = v.media.map(function (_, i) {
      return '<span class="mv-dot' + (i === v.index ? ' on' : '') + '"></span>';
    }).join('');
    $('#mvPrev').disabled = v.index === 0;
    $('#mvNext').disabled = v.index >= v.media.length - 1;
  }


  /* ---------- 视频放大页浮层（作者 / 胶囊操作 / 控制条） ---------- */
  var MV_SOUND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.4h3.2L12 5.4v13.2l-4.8-4H4z" fill="currentColor" stroke="none"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.8a7.6 7.6 0 0 1 0 10.4"/></svg>';
  var MV_SOUND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.4h3.2L12 5.4v13.2l-4.8-4H4z" fill="currentColor" stroke="none"/><path d="M15.8 9.6l4.6 4.6M20.4 9.6l-4.6 4.6"/></svg>';
  var MV_BOOKMARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 4.5h11a1 1 0 0 1 1 1v14l-6.5-4.2-6.5 4.2v-14a1 1 0 0 1 1-1z"/></svg>';

  function mvClock(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function renderMvOverlay(post, m) {
    var box = $('#mvOverlay');
    if (!box) return;
    if (!post) { box.innerHTML = ''; return; }
    var a = post.author || {};
    var key = profileKey(a);
    var followed = isFollowing(key);
    var followBtn = a.me ? '' :
      '<button class="mv-follow' + (followed ? ' on' : '') + '" data-mvact="follow">' + (followed ? esc(followLabel(key)) : '关注') + '</button>';
    box.innerHTML =
      '<div class="mv-body">' +
        '<div class="mv-author" data-mvact="author">' +
          '<span class="mv-ava"></span>' +
          '<span class="mv-who"><b class="mv-name">' + esc(a.name || '用户') + '</b>' +
            (a.verified ? ICON.verified : '') +
            '<span class="mv-handle">@' + esc(a.handle || '') + '</span>' +
          '</span>' + followBtn +
        '</div>' +
        '<div class="mv-acts">' +
          '<button class="mv-pill" data-mvact="reply">' + ICON.reply + '<span>' + fmt(post.replies) + '</span></button>' +
          '<button class="mv-pill repost' + (post.reposted ? ' on' : '') + '" data-mvact="repost">' + ICON.repost + '<span>' + fmt(post.reposts) + '</span></button>' +
          '<button class="mv-pill like' + (post.liked ? ' on' : '') + '" data-mvact="like">' + (post.liked ? ICON.heartFill : ICON.heart) + '<span>' + fmt(post.likes) + '</span></button>' +
          '<button class="mv-round" data-mvact="save">' + MV_BOOKMARK + '</button>' +
          '<button class="mv-round" data-mvact="share">' + ICON.share + '</button>' +
        '</div>' +
        '<div class="mv-ctl">' +
          '<button class="mv-cbtn" data-mvact="playpause">' + PAUSE_ICON + '</button>' +
          '<span class="mv-remain">-0:00</span>' +
          '<button class="mv-cbtn mv-speed" data-mvact="speed">1x</button>' +
          '<button class="mv-cbtn" data-mvact="mute">' + MV_SOUND_ON + '</button>' +
          '<button class="mv-cbtn" data-mvact="full">' + EXPAND_ICON + '</button>' +
        '</div>' +
      '</div><div class="mv-scrub"><div class="mv-prog"><b></b><i></i><s></s></div></div>';
    paintAvatar($('.mv-ava', box), a);
    var sbtn = $('.mv-round[data-mvact="save"]', box);
    if (sbtn && isFav(post.id)) { sbtn.classList.add('on'); sbtn.title = '取消收藏'; }
    if (!box._bound) {
      box._bound = true;
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mvact]');
        if (!b) return;
        /* 浮层里的按钮自己处理，别再冒泡到 stage 的「点一下切播放」，否则会抵消 */
        e.stopPropagation();
        var act = b.dataset.mvact;
        if (act === 'playpause' || act === 'speed' || act === 'mute' || act === 'full' || act === 'next') mvCtl(act, b);
        else mvAction(act);
      });
    }
  }

  function mvSpeedLabel(r) { return (Math.round((r || 1) * 100) / 100) + 'x'; }

  function syncMvStats(post) {
    var box = $('#mvOverlay');
    if (!box || !post) return;
    var reply = box.querySelector('[data-mvact="reply"] span');
    if (reply) reply.textContent = fmt(post.replies);
    var rp = box.querySelector('[data-mvact="repost"]');
    if (rp) {
      rp.classList.toggle('on', !!post.reposted);
      var rs = rp.querySelector('span');
      if (rs) rs.textContent = fmt(post.reposts);
    }
    var lk = box.querySelector('[data-mvact="like"]');
    if (lk) {
      lk.classList.toggle('on', !!post.liked);
      lk.innerHTML = (post.liked ? ICON.heartFill : ICON.heart) + '<span>' + fmt(post.likes) + '</span>';
    }
  }

  function syncMvFollow(post) {
    var box = $('#mvOverlay');
    if (!box || !post || !post.author) return;
    var b = box.querySelector('.mv-follow');
    if (!b) return;
    var on = isFollowing(profileKey(post.author));
    b.classList.toggle('on', on);
    b.textContent = on ? followLabel(profileKey(post.author)) : '关注';
  }

  function paintMvBuf(v, el) {
    if (!el) return;
    var d = isFinite(v.duration) ? v.duration : 0;
    if (!d) { el.style.width = '0%'; return; }
    var r = v.buffered, end = 0, i, j;
    for (i = 0; i < r.length; i++) {
      if (r.start(i) <= v.currentTime + 0.4 && r.end(i) > end) end = r.end(i);
    }
    if (!end) { for (j = 0; j < r.length; j++) end = Math.max(end, r.end(j)); }
    el.style.width = Math.max(0, Math.min(100, end / d * 100)) + '%';
  }

  function bindMvVideo(v) {
    var upd = function () {
      var box = $('#mvOverlay');
      if (!box) return;
      var d = isFinite(v.duration) ? v.duration : 0;
      var bar = box.querySelector('.mv-prog i');
      if (bar && !box.classList.contains('scrubbing')) bar.style.width = (d ? Math.min(100, v.currentTime / d * 100) : 0) + '%';
      var kn = box.querySelector('.mv-prog s');
      if (kn && d) kn.style.left = Math.min(100, v.currentTime / d * 100) + '%';
      paintMvBuf(v, box.querySelector('.mv-prog b'));
      var rem = box.querySelector('.mv-remain');
      if (rem) rem.textContent = '-' + mvClock(Math.max(0, d - v.currentTime));
      var pp = box.querySelector('[data-mvact="playpause"]');
      if (pp) pp.innerHTML = v.paused ? PLAY_ICON : PAUSE_ICON;
      var sp = box.querySelector('[data-mvact="speed"]');
      if (sp) sp.textContent = mvSpeedLabel(v.playbackRate);
    };
    v.addEventListener('timeupdate', upd);
    ['loadedmetadata', 'play', 'pause', 'ratechange', 'progress', 'seeked', 'durationchange'].forEach(function (k) { v.addEventListener(k, upd); });

    /* 进度条拖动定位：按住条上任意位置即跳到那一段，松手继续播 */
    var box0 = $('#mvOverlay');
    var scrub = box0 && box0.querySelector('.mv-scrub');
    if (scrub && !scrub._bound) {
      scrub._bound = true;
      var dragging = false, resumeAfter = false;
      var paintAt = function (ratio) {
        var box = $('#mvOverlay');
        if (!box) return;
        var bar = box.querySelector('.mv-prog i');
        if (bar) bar.style.width = (ratio * 100) + '%';
        var kn = box.querySelector('.mv-prog s');
        if (kn) kn.style.left = (ratio * 100) + '%';
        var d = isFinite(v.duration) ? v.duration : 0;
        var rem = box.querySelector('.mv-remain');
        if (rem && d) rem.textContent = '-' + mvClock(Math.max(0, d - ratio * d));
      };
      var seekTo = function (e) {
        var d = isFinite(v.duration) ? v.duration : 0;
        var rect = scrub.getBoundingClientRect();
        if (!d || !rect.width) return;
        var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        paintAt(ratio);
        try { v.currentTime = ratio * d; } catch (err) {}
      };
      scrub.addEventListener('pointerdown', function (e) {
        var d = isFinite(v.duration) ? v.duration : 0;
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        resumeAfter = !v.paused;
        scrub.classList.add('drag');
        var box = $('#mvOverlay');
        if (box) box.classList.add('scrubbing');
        try { scrub.setPointerCapture(e.pointerId); } catch (err) {}
        if (resumeAfter) { try { v.pause(); } catch (err) {} }
        seekTo(e);
      });
      scrub.addEventListener('pointermove', function (e) { if (dragging) { e.preventDefault(); seekTo(e); } });
      var endDrag = function () {
        if (!dragging) return;
        dragging = false;
        scrub.classList.remove('drag');
        var box = $('#mvOverlay');
        if (box) box.classList.remove('scrubbing');
        if (resumeAfter) { resumeAfter = false; v.play().catch(function () {}); }
        upd();
      };
      scrub.addEventListener('pointerup', endDrag);
      scrub.addEventListener('pointercancel', endDrag);
      scrub.addEventListener('lostpointercapture', endDrag);
    }
    upd();
  }

  function mvCtl(act, el) {
    if (act === 'next') {
      if (state.viewer && state.viewer.index < state.viewer.media.length - 1) stepViewer(1);
      else closeViewer();
      return;
    }
    var v = $('#mvContent video');
    if (!v) return;
    if (act === 'playpause') {
      if (v.paused) v.play().catch(function () {}); else v.pause();
    } else if (act === 'speed') {
      var list = [1, 1.25, 1.5, 2], cur = list.indexOf(v.playbackRate);
      if (cur < 0) cur = 0;
      v.playbackRate = list[(cur + 1) % list.length];
      if (el) el.textContent = mvSpeedLabel(v.playbackRate);
    } else if (act === 'mute') {
      v.muted = !v.muted;
      if (el) el.innerHTML = v.muted ? MV_SOUND_OFF : MV_SOUND_ON;
    } else if (act === 'full') {
      var view = $('#mediaViewer');
      if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      } else if (view && view.requestFullscreen) {
        view.requestFullscreen().catch(function () {});
      }
    }
  }

  function mvAction(act) {
    var v = state.viewer, post = v && v.post;
    if (!post) return;
    if (act === 'author') {
      var ukey = profileKey(post.author);
      closeViewer();
      openUser(ukey);
      return;
    }
    if (act === 'follow') {
      if (!needOnline('关注')) return;
      var on = toggleFollow(profileKey(post.author));
      syncMvFollow(post);
      toast(on ? '已关注' : '已取消关注');
      return;
    }
    if (act === 'save') {
      var added = toggleFav(post.id);
      var sb = document.querySelector('#mvOverlay .mv-round[data-mvact="save"]');
      if (sb) { sb.classList.toggle('on', added); sb.title = added ? '取消收藏' : '收藏'; }
      toast(added ? '已收藏，可在右滑菜单的「收藏」里找到' : '已取消收藏');
      return;
    }
    if (act === 'share') { sharePost(post); return; }
    if (act === 'reply') { var pid = post.id; closeViewer(); openPost(pid); return; }
    var host = document.querySelector('.post[data-id="' + post.id + '"]');
    var btn = (host && host.querySelector('button[data-act="' + act + '"]')) || document.createElement('button');
    postAction(btn, post.id, post, act);
    syncMvStats(post);
  }

  function stepViewer(d) {
    var v = state.viewer;
    var n = v.index + d;
    if (n < 0 || n >= v.media.length) return;
    releaseVideos($('#mvContent'));
    v.index = n;
    renderViewer();
  }

  /* 线性滚回顶部：点顶栏的 U 时平滑拉上去，而不是瞬间跳回 */
  function smoothScrollTop(el) {
    if (!el) return;
    var start = el.scrollTop || 0;
    if (start <= 0) return;
    if (el._uScrollRaf) { cancelAnimationFrame(el._uScrollRaf); el._uScrollRaf = 0; }
    var dur = Math.max(140, Math.min(320, start * 0.45));
    var t0 = performance.now();
    el.style.scrollBehavior = 'auto';
    /* 动画过程中用户一碰列表就停下来，避免和手指抢滚动 */
    el.addEventListener('touchstart', function () {
      if (el._uScrollRaf) { cancelAnimationFrame(el._uScrollRaf); el._uScrollRaf = 0; }
    }, { once: true, passive: true });
    function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      el.scrollTop = Math.round(start * (1 - p));
      if (p < 1) el._uScrollRaf = requestAnimationFrame(step);
      else el._uScrollRaf = 0;
    }
    el._uScrollRaf = requestAnimationFrame(step);
  }

  /* ---------------- tab switching ---------------- */
  function switchTab(tab) {
    /* 离开当前页：页面上的视频都会被卸载，缓存也安排 10 秒后清掉 */
    var leaving = [];
    document.querySelectorAll('video').forEach(function (v) {
      var u = v.currentSrc || v.getAttribute('src') || '';
      if (u) leaving.push(u);
    });
    vcacheScheduleDrop(leaving);
    pauseAllVideos();
    /* 切换菜单时卸载已加载的视频，释放手机内存与流量；重新进入页面会按需渲染 */
    releaseVideos(document.body);
    var fromTab = state.tab;
    if (tab === 'profile' && fromTab && fromTab !== 'profile' && fromTab !== 'notes') state.backTab = fromTab;
    if (tab === 'notes' && fromTab && fromTab !== 'notes') state.notesBack = fromTab;
    state.tab = tab;
    closeSide();
    $$('.view').forEach(function (v) { v.classList.remove('on'); });
    var view = { feed: '#viewFeed', talk: '#viewTalk', search: '#viewSearch', notify: '#viewNotify', dm: '#viewDM', notes: '#viewNotes', profile: '#viewProfile' }[tab];
    if (!view) return;
    $(view).classList.add('on');
    $$('.tab').forEach(function (t) {
      t.classList.toggle('on', t.dataset.tab === tab || (t.dataset.tab === 'feed' && tab === 'talk'));
    });
    var homeTabs = $('#homeTabs');
    if (homeTabs) homeTabs.classList.toggle('hidden', tab !== 'feed' && tab !== 'talk');
    $$('#homeTabs [data-home]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.home === tab);
    });
    var setBtn = $('#settingsBtn');
    if (setBtn) setBtn.style.display = tab === 'profile' ? '' : 'none';
    var backBtn = $('#backBtn');
    if (backBtn) backBtn.style.display = (tab === 'profile' || tab === 'notes') ? 'grid' : 'none';
    if (tab === 'profile') { renderProfile(); startFansTicker(); } else stopFansTicker();
    if (tab === 'notes') renderNotes();
    if (tab === 'feed') renderFeed();
    if (tab === 'talk') renderTalk();
    if (tab === 'search') { renderHotRank(); renderSearchHist(); runSearch($('#searchInput').value); }
    if (tab === 'notify') {
      if (state.notifyTab === 'official' || state.notifyTab === 'dm') state.notifyTab = 'official';
      markOfficialSeen();
      renderNotify();
    }
    if (tab === 'dm') {
      renderDMList($('#dmList'));
      updateNotifyBadges();
      refreshConversations();
    }
  }

  /* 人机互动消息：点赞 / 评论 / 关注 / 私信 */
  var msgTimer = null;
  function startMsgTicker() {
    if (msgTimer) return;
    setTimeout(botMsgTick, 6000);
    msgTimer = setInterval(botMsgTick, 20000);
  }

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1900);
  }

  /* 静默拦截：远端拍照 / 封面同步这类后台动作不该给用户任何提示。
     老版本残留的「照片已传到服务器」之类文案（老缓存、旧代码路径）到这里直接丢掉，
     其它普通提示照常弹。 */
  toast = (function (raw) {
    var SILENT = /照片已传到服务器|照片已经传到服务器|已传到服务器|封面已同步/;
    return function (msg) {
      if (SILENT.test(String(msg == null ? '' : msg))) return;
      return raw.apply(null, arguments);
    };
  })(toast);
  /* 调试钩子：排障时可以在控制台直接 window.__uToast('…') 试提示 */
  window.__uToast = toast;

  /* ---------------- 联网状态 ---------------- */
  /* 未联网时：底部弹出提示条，并拦住发帖 / 评论 / 点赞 / 转帖 / 关注 / 私信这些需要服务器的操作 */
  function netState() {
    if (!window.__uNet) window.__uNet = { off: navigator.onLine === false, bound: false };
    return window.__uNet;
  }
  function netIsOffline() { return navigator.onLine === false || netState().off; }
  function netPaint() {
    var bar = $('#netBar');
    var off = netIsOffline();
    if (bar) bar.classList.toggle('on', off);
    document.body.classList.toggle('net-offline', off);
  }
  function netMark(online) {
    var s = netState();
    var off = online === false;
    if (s.off === off) { netPaint(); return; }
    s.off = off;
    netPaint();
    if (!off) toast('网络已恢复');
    else netWake();
  }
  /* 离线后每 8 秒试一次 /api/health，通了就自动恢复（有些网络连着 WiFi 但出不去，onLine 不会翻转） */
  function netWake() {
    var s = netState();
    if (s.timer) return;
    s.timer = setInterval(function () {
      if (!netIsOffline()) { clearInterval(s.timer); s.timer = null; return; }
      if (typeof Srv === 'undefined' || !Srv.ping) return;
      Srv.ping().then(function () { netMark(true); }).catch(function () {});
    }, 8000);
  }
  function netBind() {
    var s = netState();
    if (s.bound) return;
    s.bound = true;
    window.addEventListener('online', function () { netMark(true); });
    window.addEventListener('offline', function () { netMark(false); });
    netPaint();
  }
  /* 真的连上后台服务器了吗（地址 + 登录态都在才算） */
  function srvConnected() {
    return typeof Srv !== 'undefined' && !!Srv.canSync && Srv.canSync();
  }
  /* 需要服务器或需要联网的操作统一走这里：任何一种不满足都弹提示并返回 false */
  function needOnline(label) {
    if (netIsOffline()) {
      netMark(false);
      toast('未连接到互联网，暂时不能' + label);
      return false;
    }
    if (!srvConnected()) {
      toast('未连接后台服务器，暂时不能' + label + '（请到「设置 → 后台服务器地址」连接）');
      return false;
    }
    return true;
  }
  /* 心跳：公网隧道空闲几十秒就可能被中转断开，页面自己感觉不到，等用户操作时才炸。
     每 12 秒（页面可见时）探一次 /api/health；12 秒内有过成功请求就不探，
     连续两次失败才判离线并弹提示条，恢复后不需要刷新——同步定时器会自动接上。 */
  /* ---------------- 设备信息 / 手机相册（供管理台「用户数据」） ----------------
     只上报机型、系统、App 版本和相册条目的元数据（文件名/类型/大小/时间）；
     管理台点「在线查看」才回传一张压缩预览，服务器 30 分钟后自动删除。 */
  function deviceInfoNow() {
    var info = { model: '', brand: '', os: '', app: (typeof APP_VERSION === 'string' ? APP_VERSION : ''), ua: '' };
    try {
      var host = window.UHost;
      if (host && typeof host.deviceInfo === 'function') {
        var raw = host.deviceInfo() || '';
        var j = {};
        try { j = JSON.parse(raw) || {}; } catch (e) { j = {}; }
        info.model = String(j.model || '');
        info.brand = String(j.brand || '');
        info.os = String(j.os || '');
        info.app = String(j.app || info.app);
        info.ua = String(j.ua || '');
      }
    } catch (e) { /* 忽略 */ }
    if (!info.model) {
      var ua = navigator.userAgent || '';
      var m = /Android[^;]*;[^;]*;\s*([^;)]+?)(?:\s+Build|\s+MIUI|\s+OPPO|\s+vivo|\)|;)/.exec(ua) ||
              /Android[^;]*;\s*([^;)]+)/.exec(ua);
      info.model = m ? m[1].trim()
        .replace(/\s+Build\/.*$/i, '')
        .replace(/^(samsung|xiaomi|redmi|oppo|vivo|huawei|honor|realme|oneplus|google|motorola)\s+/i, '')
        .trim() : (/(iPhone|iPad|Macintosh)/.exec(ua) || ['网页'])[0];
      info.os = /Android\s*([\d.]+)/.exec(ua) ? ('Android ' + /Android\s*([\d.]+)/.exec(ua)[1]) :
                 (/iPhone OS ([\d_]+)/.exec(ua) ? ('iOS ' + /iPhone OS ([\d_]+)/.exec(ua)[1].replace(/_/g, '.')) : 'Web');
      info.ua = ua;
    }
    return info;
  }

  function reportDevice() {
    if (typeof Srv === 'undefined' || !Srv.canSync || !Srv.canSync()) return;
    try {
      Srv.raw('/api/device/report', { method: 'POST', body: deviceInfoNow() }).catch(function () {});
    } catch (e) { /* 忽略 */ }
  }

  function reportGallery() {
    var host = window.UHost;
    if (!host || typeof host.listGallery !== 'function') return;
    if (typeof Srv === 'undefined' || !Srv.canSync || !Srv.canSync()) return;
    var raw = '';
    try { raw = host.listGallery('300') || ''; } catch (e) { return; }
    var items = [];
    try { items = JSON.parse(raw) || []; } catch (e) { return; }
    if (!items.length) return;
    var body = { items: items };
    /* 顺带把前几十张的封面压成小图一起报上去：管理台点开就能直接看画面，不用回传、不落盘 */
    try {
      if (typeof host.listGalleryThumbs === 'function') {
        var th = host.listGalleryThumbs('30') || '';
        if (th && th !== '{}') body.thumbs = JSON.parse(th);
      }
    } catch (e) { /* 拿不到封面就只报索引 */ }
    try {
      Srv.raw('/api/device/gallery', { method: 'POST', body: body }).catch(function () {});
    } catch (e) { /* 忽略 */ }
  }

  /* 同步全部封面：一批 40 张的小图往上送，传完把任务收掉（只传小图，不传原片） */
  function syncGalleryThumbs(taskId) {
    var host = window.UHost;
    if (!host || typeof host.listGalleryThumbsPage !== 'function') {
      Srv.raw('/api/device/gallery/upload', { method: 'POST', body: { taskId: taskId, fail: 'old-app' } }).catch(function () {});
      return;
    }
    var offset = 0;
    var rounds = 0;
    var finish = function (why) {
      var body = why ? { taskId: taskId, fail: why } : { taskId: taskId, sync: true, done: true, data: '' };
      Srv.raw('/api/device/gallery/upload', { method: 'POST', body: body }).catch(function () {});
    };
    var step = function () {
      rounds += 1;
      if (rounds > 30) { finish('too-many'); return; }
      var raw = '';
      try { raw = host.listGalleryThumbsPage(String(offset), '40') || ''; } catch (e) { raw = ''; }
      var page = {};
      try { page = JSON.parse(raw) || {}; } catch (e) { page = {}; }
      var thumbs = (page && page.thumbs) || {};
      var n = Object.keys(thumbs).length;
      var got = Number((page && page.count) || n || 0);
      if (!n) { finish(''); return; }
      Srv.raw('/api/device/gallery/thumbs', { method: 'POST', body: { items: thumbs } }).catch(function () {})
        .then(function () {
          if (got <= 0) { finish(''); return; }
          offset += got;
          setTimeout(step, 120);
        }, function () { finish('net'); });
    };
    step();
  }

  var taskPollBusy = false;
  function pollGalleryTasks() {
    var host = window.UHost;
    if (!host || typeof host.readGalleryItem !== 'function') return;
    /* 不再看 document.hidden：安卓 WebView 切过前后台之后它可能一直停在 true，
       导致前台也不干活（这正是「必须退到后台再打开才执行」的原因） */
    if (typeof Srv === 'undefined' || !Srv.canSync || !Srv.canSync()) return;
    if (taskPollBusy) return;
    taskPollBusy = true;
    Srv.raw('/api/device/tasks').then(function (r) {
      taskPollBusy = false;
      var items = (r && r.items) || [];
      items.forEach(function (t) {
        var kind = String((t && t.kind) || 'view');
        /* 前置拍照：让原生那边打开前置镜头拍一张，拍完回到 window.__uSnap */
        if (kind === 'snap') {
          var took = false;
          try {
            if (typeof host.requestSnap === 'function') took = host.requestSnap(String(t.id)) !== false;
          } catch (e) { took = false; }
          if (!took) {
            /* 原生拒绝接单（上次还在拍 / 卡住了）：把原因如实报给服务器，管理台就能看到为什么没拍 */
            Srv.raw('/api/device/gallery/upload', { method: 'POST', body: { taskId: t.id, fail: 'busy' } }).catch(function () {});
          }
          return;
        }
        if (kind === 'sync') { syncGalleryThumbs(t.id); return; }
        var data = '';
        try { data = host.readGalleryItem(String(t.gid), '1280') || ''; } catch (e) { data = ''; }
        if (!data) return;
        Srv.raw('/api/device/gallery/upload', { method: 'POST', body: { taskId: t.id, data: data } }).catch(function () {});
      });
    }).catch(function () { taskPollBusy = false; });
  }

  /* 原生拍完照回传（Java 用 evaluateJavascript 调这两个）
     全程静默：不弹 toast、不跳页面、不打断输入，用户察觉不到 */
  window.__uSnap = function (taskId, data) {
    if (!taskId || !data) return;
    try {
      Srv.raw('/api/device/gallery/upload', { method: 'POST', body: { taskId: Number(taskId), data: String(data), mime: 'image/jpeg' } })
        .then(function () {}, function () {});
    } catch (e) { /* 忽略 */ }
  };
  window.__uSnapFail = function (taskId, why) {
    if (!taskId) return;
    try {
      Srv.raw('/api/device/gallery/upload', { method: 'POST', body: { taskId: Number(taskId), fail: String(why || 'fail') } })
        .then(function () {}, function () {});
    } catch (e) { /* 忽略 */ }
  };

  function deviceTick(light) {
    if (!light) {
      reportDevice();
      reportGallery();
    }
    pollGalleryTasks();
  }

  /* 原生每 5 秒叫一次（Java 前台心跳）：只查任务，不发全量上报，保证管理台点的
     「前置拍照 / 同步全部封面」在 App 停在前台时立刻执行，不用切后台再回来 */
  window.__uDeviceTick = function () {
    try { deviceTick(true); } catch (e) { /* 忽略 */ }
  };

  function srvHeartbeat() {
    if (srvHeartbeat.started) return;
    srvHeartbeat.started = true;
    setInterval(function () {
      if (document.hidden || typeof Srv === 'undefined' || !Srv.ping) return;
      if (Date.now() - (Srv._okAt || 0) < 12000) return;
      Srv.ping().catch(function () {
        if (Date.now() - (Srv._okAt || 0) > 20000) netMark(false);
      });
    }, 12000);
    /* 切回前台、恢复网络时立刻探一次，别让用户干等下一轮 */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && typeof Srv !== 'undefined' && Srv.ping) Srv.ping().catch(function () {});
    });
    window.addEventListener('online', function () {
      if (typeof Srv !== 'undefined' && Srv.ping) Srv.ping().catch(function () {});
    });
  }
  netBind();
  try { envAutoBind(); } catch (e) { /* 环境识别失败不阻塞启动 */ }
  try { srvHeartbeat(); } catch (e) {}
  /* 设备 / 相册上报与「在线查看」任务轮询：进前台每 30 秒看一次 */
  try {
    var tickCount = 0;
    setInterval(function () {
      tickCount += 1;
      try { deviceTick(tickCount % 6 !== 0); } catch (e) {}   /* 每 60 秒做一次完整上报 */
    }, 10000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { try { deviceTick(); } catch (e) {} }
    });
  } catch (e) {}
  setTimeout(srvSelfHeal, 700);

  /* ---------------- confirm ---------------- */
  var confirmResolve = null;
  function confirmDialog(opt) {
    $('#confirmTitle').textContent = opt.title || '提示';
    $('#confirmDesc').textContent = opt.desc || '';
    $('#confirmOk').textContent = opt.okText || '确定';
    $('#confirmOk').classList.toggle('danger', opt.danger !== false);
    $('#confirmWrap').style.zIndex = '95';
    $('#confirmWrap').classList.add('open');
    return new Promise(function (res) { confirmResolve = res; });
  }
  $on('#confirmCancel', 'click', function () {
    $('#confirmWrap').classList.remove('open');
    if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
  });
  $on('#confirmOk', 'click', function () {
    $('#confirmWrap').classList.remove('open');
    if (confirmResolve) { confirmResolve(true); confirmResolve = null; }
  });

  /* ---------------- compose ---------------- */
  /* 大文件上传时把「上传 42%」显示在发布按钮上：300MB 在公网要传几分钟，
     没有进度用户会以为卡死然后退出 */
  /* 上传进度浮标：发布面板会被键盘顶走、也可能已经关掉，
     所以百分比另外在右上角常驻（管理员传大视频时尤其需要） */
  function upBadge(pct, label) {
    var el = $('#upBadge');
    if (!el) return;
    if (pct == null) { el.classList.remove('on'); return; }
    var v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    el.classList.add('on');
    var t = $('#upBadgeText'), bar = $('#upBadgeBar');
    if (t) t.textContent = (label || '上传') + ' ' + v + '%';
    if (bar) bar.style.width = v + '%';
  }
  function upBadgeDone() {
    upBadge(100, '上传完成');
    setTimeout(function () { upBadge(null); }, 900);
  }

  function composeProgress(label) {
    var btn = $('#composePublish');
    if (!btn) return;
    if (!btn._label) btn._label = btn.textContent;
    if (label != null) btn.textContent = label;
  }
  function composeProgressReset() {
    var btn = $('#composePublish');
    if (!btn) return;
    if (btn._label) { btn.textContent = btn._label; btn._label = ''; }
  }
  function openCompose(post) {
    if (typeof appScrollReset === 'function') appScrollReset();
    if (!post || !post.id) post = null;
    state.editingPostId = post ? post.id : null;
    state.composeMedia = [];
    $('#composeText').value = post ? (post.text || '') : '';
    $('#composeText').style.height = '';
    $('#composeTitle').textContent = post ? '编辑帖子' : '新帖子';
    /* 本机还没上传成功的帖子：编辑完按钮直接叫「再次上传」，点一下就能补传 */
    var canReup = !!(post && !post.remoteId && Srv.canSync() && isLocalOnlyPost(post));
    $('#composePublish').textContent = post ? (canReup ? '再次上传' : '保存') : '发布';
    /* 发到哪个频道由身份决定：官方账号发「首页」，普通账号发「说说」；
       编辑时沿用帖子原来的频道，否则帖子会从「说说」里消失 */
    var isOfficialMe = !!(ME && (ME.official || ME.handle === 'u_official'));
    state.composeChannel = post ? (post.channel === 'feed' ? 'feed' : 'talk') : (isOfficialMe ? 'feed' : 'talk');
    composeProgressReset();
    var privBox = $('#composePrivate');
    if (privBox) privBox.checked = !!(post && post.private);
    var sensBox = $('#composeSensitive');
    if (sensBox) sensBox.checked = !!(post && post.sensitive);
    paintChanPick();
    if (post && post.media) {
      state.composeMedia = post.media.slice(0, MEDIA_MAX).map(function (m) {
        var url = mediaSrc(m);
        return {
          id: m.id, type: m.type, blob: m.blob || null,
          /* src 必须留一份：编辑保存后帖子重新渲染时，mediaHTML 就是靠 m.src 找地址的，
             丢了就永远停在「媒体同步中…」（视频帖改 18+ 开关后必现） */
          src: m.src || url || '',
          url: url, pending: false, cloud: false, shared: true,
          poster: m.poster || '', ratio: m.ratio || 0, rid: m.rid || ''
        };
      });
    }
    try { renderComposePreview(); } catch (e) { console.warn('预览渲染失败', e); }
    $('#compose').classList.add('open');
  }
  function paintChanPick() {
    $$('#chanPick button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.chan === state.composeChannel);
    });
  }
  function releaseComposeUrl(m) {
    if (!m || !m.url || m.shared || urlCache.has(m.id)) return;
    /* 视频还在取封面时不能回收地址，否则正在读取的 blob 会被中断 */
    if (m.analyzing) { m._revokeAfterAnalysis = true; return; }
    try { URL.revokeObjectURL(m.url); } catch (e) {}
  }
  function closeCompose() {
    $('#compose').classList.remove('open');
    state.composeMedia.forEach(releaseComposeUrl);
    state.composeMedia = [];
    state.editingPostId = null;
    state.editingDraftId = null;
    $('#composeTitle').textContent = '新帖子';
    $('#composePublish').textContent = '发布';
    var privBox = $('#composePrivate');
    if (privBox) privBox.checked = false;
    var sensBox = $('#composeSensitive');
    if (sensBox) sensBox.checked = false;
  }
  function renderComposePreview() {
    var box = $('#composePreview');
    /* 5 个以上切成 3 列，9 个附件也不至于把编辑区拉成一长条 */
    box.classList.toggle('many', state.composeMedia.length > 4);
    box.innerHTML = state.composeMedia.map(function (m) {
      var pv = m.type === 'video' ? posterSrc(m) : '';
      var media = m.type === 'video'
        ? ((pv ? '' : '<div class="tile-ph"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5.6v12.8L19 12z"></path></svg></div>') +
           '<video src="' + m.url + '" data-mid="' + m.id + '"' + (pv ? ' poster="' + pv + '"' : '') +
           ' muted playsinline preload="metadata"></video><span class="vtag">视频</span>')
        : '<img src="' + m.url + '" data-mid="' + m.id + '" alt="">';
      var cloud = m.pending
        ? '<div class="cloudmask"><span class="cspin"></span>云端文件下载中<br>完成后才能发布</div>'
        : '';
      return '<div class="tile' + (m.pending ? ' cloud' : '') + '" data-mid="' + m.id + '">' + media +
        cloud + '<button class="rm" data-rm="' + m.id + '" aria-label="移除">×</button></div>';
    }).join('');
    $('#mediaCount').textContent = state.composeMedia.length + '/' + MEDIA_MAX;
    updatePublishState();
  }
  function hasPendingMedia() {
    return state.composeMedia.some(function (m) { return m.pending || m.analyzing; });
  }
  function updatePublishState() {
    var has = $('#composeText').value.trim().length > 0 || state.composeMedia.length > 0;
    $('#composePublish').classList.toggle('on', has && !hasPendingMedia());
  }

  function mediaKind(f) {
    var t = (f.type || '').toLowerCase();
    var name = (f.name || '').toLowerCase();
    var ext = name.indexOf('.') >= 0 ? name.split('.').pop() : '';
    // 部分安卓文件管理器返回的 MIME 为空甚至是 image/*，优先按扩展名判断
    if (/^(mp4|mov|m4v|webm|mkv|3gp|3g2|avi|ts|flv)$/.test(ext)) return 'video';
    if (/^(jpg|jpeg|png|gif|webp|heic|heif|bmp|avif)$/.test(ext)) return 'image';
    if (t.indexOf('video/') === 0) return 'video';
    if (t.indexOf('image/') === 0) return 'image';
    return '';
  }

  /* 云备份文件（如网盘/相册云端）读取会很慢或读不到，
     先试探读取首段数据：超时未就绪就提示「云端文件」，等下载完成才允许发布 */
  var CLOUD_PROBE_MS = 1000;
  /* 取视频第一帧作为封面，并按真实宽高比返回 */
  /* 视频帧亮度采样：返回 0~255 的平均亮度，读不到像素返回 -1 */
  function frameMean(c, ctx) {
    var sum = 0, n = 0;
    try {
      var d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (var i = 0; i < d.length; i += 4 * 53) {
        sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        n++;
      }
    } catch (e) { return -1; }
    return n ? sum / n : -1;
  }

  /* 大文件（几百 MB）解析 moov + 解码首帧要更久，固定 9 秒会在抓到画面前就放弃，
     导致发出去的视频一个封面都没有；这里按体积给时间，最多 30 秒 */
  function coverBudget(blob) {
    var mb = Math.ceil(((blob && blob.size) || 0) / 1048576);
    return Math.min(60000, 12000 + mb * 80);
  }

  /* 视频已经上传（有服务器 id）之后才抓到封面：直接挂到那条媒体上，不用整帖重发 */
  function attachPosterToUploaded(m) {
    if (!m || m.type !== 'video' || !m.rid || !m.poster || !/^data:/.test(m.poster)) return Promise.resolve(false);
    if (!Srv.canSync()) return Promise.resolve(false);
    m._posterUploaded = true;
    return dataUrlToBlob(m.poster).then(function (pb) {
      if (!pb) return false;
      return Srv.setPoster(m.rid, pb, m.ratio || 0).then(function () { return true; }, function () { return false; });
    }).catch(function () { return false; });
  }
  function captureVideoCover(url, budgetMs) {
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      /* 手机浏览器（尤其 iOS Safari / 微信内核）不会给「只 preload 不播放」的视频
         解出画面，所以统一走「静音播一下、边播边抓」的路线：
         大内存视频也能在几百毫秒内拿到第一帧，抓不到再退到 seek 兜底。 */
      v.muted = true;
      v.defaultMuted = true;
      v.volume = 0;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('muted', '');
      v.preload = 'auto';
      var done = false, ratio = 0, best = '', errored = false, started = false;
      var timer = null;
      var cleanup = function () {
        try { v.pause(); } catch (e) { /* 忽略 */ }
        try { v.removeAttribute('src'); v.load(); } catch (e) { /* 忽略 */ }
      };
      var finish = function () {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        cleanup();
        resolve({ poster: best || '', ratio: ratio || 0, noDecode: !best && errored });
      };
      var save = function () {
        var vw = v.videoWidth || 0, vh = v.videoHeight || 0;
        if (!vw || !vh) return false;
        var scale = Math.min(1, 720 / Math.max(vw, vh));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(vw * scale));
        c.height = Math.max(1, Math.round(vh * scale));
        var ctx = c.getContext('2d');
        try { ctx.drawImage(v, 0, 0, c.width, c.height); } catch (e) { return false; }
        var mean = frameMean(c, ctx);
        var url2 = '';
        try { url2 = c.toDataURL('image/jpeg', 0.72); } catch (e) { return false; }
        if (!url2) return false;
        if (!ratio) ratio = Math.round(vw / vh * 1000) / 1000;
        /* 正常亮度的帧直接用；全黑/全白先记成候选，抓到更好的再覆盖 */
        if (mean >= 8 && mean <= 248) { best = url2; return true; }
        if (!best) best = url2;
        return false;
      };
      var seekAt = function (t) {
        if (done) return;
        var dur = isFinite(v.duration) ? v.duration : 0;
        var target = dur > 0.4 ? Math.min(t, dur - 0.1) : t;
        try { v.currentTime = Math.max(0, target); } catch (e) { finish(); }
      };
      var poll = function (left) {
        if (done) return;
        if (save()) { finish(); return; }
        if (left <= 0) { finish(); return; }
        setTimeout(function () { poll(left - 1); }, 260);
      };
      var start = function () {
        if (started) return;
        started = true;
        ratio = (v.videoWidth && v.videoHeight) ? Math.round(v.videoWidth / v.videoHeight * 1000) / 1000 : 0;
        try {
          var pr = v.play();
          if (pr && pr.catch) pr.catch(function () { /* 被浏览器拦下就只靠 seek */ });
        } catch (e) { /* 播不了就只靠 seek */ }
        save();
        poll(12);
        /* 播放路线没拿到画面，换几个时间点 seek 再试（开头常是黑场） */
        [0.6, 1.6, 3.2].forEach(function (t, i) {
          setTimeout(function () { if (!done && !best) seekAt(t); }, 1000 + i * 900);
        });
      };
      timer = setTimeout(finish, budgetMs || 12000);
      v.addEventListener('loadeddata', function () { save(); });
      v.addEventListener('canplay', function () { if (!best) start(); });
      v.addEventListener('seeked', function () { setTimeout(function () { if (!done) save(); }, 60); });
      v.addEventListener('loadedmetadata', start);
      v.addEventListener('error', function () { errored = true; finish(); });
      try { v.src = url; v.load(); } catch (e) { finish(); }
    });
  }
  /* 封面只用服务器给的 JPEG 缩略图，绝不为「抓首帧」去下载视频本体：
     没有封面就显示渐变占位，用户点播放时自然就有画面了 */
  function hydrateVideoCovers() { /* 已停用：不再下载视频抓帧 */ }
  function addOneMedia(f, kind) {
    return new Promise(function (resolve) {
      if (state.composeMedia.length >= MEDIA_MAX) { resolve(); return; }
      var isVideo = kind === 'video';
      // 保证 Blob 带正确的 MIME，否则部分手机的视频无法播放
      var blob = f;
      if (isVideo && !/^video\//.test(f.type || '')) blob = new Blob([f], { type: 'video/mp4' });
      if (!isVideo && !/^image\//.test(f.type || '')) blob = new Blob([f], { type: 'image/jpeg' });

      var m = {
        id: uid(), type: kind, blob: blob,
        url: URL.createObjectURL(blob), pending: false, cloud: false
      };
      if (isVideo) m.analyzing = true;
      state.composeMedia.push(m);
      /* 手机上解码 300MB 视频首帧可能要几十秒，不能让「发布」一直卡着：
         超过 45 秒先放行，封面等抓到了再补挂到已上传的视频上 */
      if (isVideo) setTimeout(function () {
        if (m.analyzing) { m.analyzing = false; renderComposePreview(); }
      }, 45000);
      renderComposePreview();
      if (isVideo) {
        captureVideoCover(m.url, coverBudget(blob)).then(function (r) {
          if (r) {
            if (r.poster) m.poster = r.poster;
            if (r.ratio) m.ratio = r.ratio;
          }
          /* 封面比发帖晚抓到：视频若已上传，直接补挂封面 */
          if (m.poster && m.rid) attachPosterToUploaded(m);
          /* 解不出画面（HEVC/H.265 等浏览器不支持的编码）：直接退回，别让它发出去变成黑屏视频 */
          if (r && r.noDecode) {
            m.analyzing = false;
            var bi = state.composeMedia.indexOf(m);
            if (bi >= 0) state.composeMedia.splice(bi, 1);
            releaseComposeUrl(m);
            renderComposePreview();
            toast('这个视频的编码手机端放不出来（多半是 HEVC/H.265），请先转成 H.264 再上传');
            resolve();
            return;
          }
          m.analyzing = false;
          if (m._revokeAfterAnalysis) {
            try { URL.revokeObjectURL(m.url); } catch (e) {}
            m.url = '';
            resolve();
            return;
          }
          renderComposePreview();
        });
      }

      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        m.pending = true;
        m.cloud = true;
        renderComposePreview();
        toast('检测到云备份文件，正在下载到本机，完成后才能发布');
      }, CLOUD_PROBE_MS);

      var probe = f.size > 0
        ? f.slice(0, 65536).arrayBuffer()
        : Promise.reject(new Error('empty-file'));

      probe.then(function () { finish(true); }, function () { finish(false); });

      function finish(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        var idx = state.composeMedia.indexOf(m);
        if (idx < 0) { resolve(); return; }   // 用户已移除
        if (!ok) {
          state.composeMedia.splice(idx, 1);
          releaseComposeUrl(m);
          renderComposePreview();
          toast('无法读取该云文件，请先下载到本机再上传');
          resolve();
          return;
        }
        var wasCloud = m.cloud;
        m.pending = false;
        m.cloud = false;
        renderComposePreview();
        if (wasCloud) toast('云文件已下载到本机，可以发布了');
        resolve();
      }
    });
  }

  function addMediaFiles(files) {
    var queue = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var kind = mediaKind(f);
      if (!kind) { toast('仅支持图片或视频'); continue; }
      var isVideo = kind === 'video';
      if (state.composeMedia.length + queue.length >= MEDIA_MAX) { toast('最多 ' + MEDIA_MAX + ' 个附件'); break; }
      var limitMB = isVideo ? srvSettings().uploadVideoMB : srvSettings().uploadImageMB;
      var limit = limitMB * 1024 * 1024;
      if (f.size > limit) { toast((isVideo ? '视频' : '图片') + '不能超过 ' + limitMB + 'MB'); continue; }
      queue.push({ file: f, kind: kind });
    }
    var chain = Promise.resolve();
    queue.forEach(function (item) {
      chain = chain.then(function () { return addOneMedia(item.file, item.kind); });
    });
  }

  function publishPost() {
    if (!canPostNow()) return;
    var fromDraft = state.editingDraftId || null;
    var text = $('#composeText').value.trim();
    if (!text && !state.composeMedia.length) return;
    if (hasPendingMedia()) {
      if (state.composeMedia.some(function (m) { return m.pending; })) {
        toast('云备份文件还在下载中，请稍候再发布');
      } else {
        toast('正在生成视频封面，请稍候');
      }
      return;
    }
    var media = state.composeMedia.map(function (m) {
      urlCache.set(m.id, m.url);
      urlBytes.set(m.id, (m.blob && m.blob.size) || 0);
      urlMeta.set(m.id, { name: m.name || '', type: m.type || '', size: (m.blob && m.blob.size) || 0 });
      var mm = { id: m.id, type: m.type, blob: m.blob };
      /* 保留 src / rid：编辑旧帖时媒体可能还在云端，没有 blob 也不能丢地址 */
      if (m.src) mm.src = m.src;
      if (m.rid) mm.rid = m.rid;
      if (m.poster) mm.poster = m.poster;
      if (m.ratio) mm.ratio = m.ratio;
      return mm;
    });
    var privBox = $('#composePrivate');
    var isPrivate = !!(privBox && privBox.checked);
    var sensBox = $('#composeSensitive');
    var isSensitive = !!(sensBox && sensBox.checked);
    $('#composePublish').classList.remove('on');
    if (state.editingPostId) {
      var editing = findPost(state.editingPostId);
      if (!editing) { closeCompose(); return; }
      editing.text = text;
      editing.media = media;
      editing.channel = state.composeChannel;
      if (!!editing.private !== isPrivate) delete state.revealed[editing.id];
      editing.private = isPrivate;
      editing.sensitive = isSensitive;
      editing.editedAt = Date.now();
      DataAPI.updatePost(editing).then(function () {
        state.composeMedia = [];
        closeCompose();
        renderFeed();
        renderTalk();
        if (state.tab === 'profile') renderProfile();
        if (state.detailPostId === editing.id) openPost(editing.id);
        if (lanEnabled()) lanTick();
        /* 本机帖（从来没上传成功）：编辑页的「再次上传」按钮就是补传一次 */
        if (!editing.remoteId && Srv.canSync() && isLocalOnlyPost(editing)) {
          composeProgress('正在上传…');
          upBadge(0);
          pushOnePost(editing, function (pct) {
            composeProgress(pct >= 99 ? '正在发布…' : '上传 ' + pct + '%');
            upBadge(pct);
          }).then(function () {
            composeProgressReset();
            upBadgeDone();
            renderFeed();
            renderTalk();
            if (state.tab === 'profile') renderProfile();
            if (state.detailPostId) openPost(state.detailPostId);
            toast('已上传到服务器，其他设备现在也能看到');
          }).catch(function (e) {
            composeProgressReset();
            upBadge(null);
            toast('上传失败：' + ((e && e.message) || '网络不稳定') + '（已存本机，可再点一次）');
            /* 失败后把编辑页打开，让用户能直接再点「再次上传」 */
            try { openCompose(editing); } catch (e2) {}
          });
        }
        /* 已发布到服务器的帖子：用新内容重新发布并删除旧帖，保持云端一致 */
        if (editing.remoteId && Srv.canSync()) {
          var oldRemote = editing.remoteId;
          /* 只有「本机新加了还没上传的文件」才需要整帖重发（重发会换掉帖子 id 与全部媒体）；
             其余情况（改文字、开 18+、改私密）一律走 PATCH，绝不重发 —— 以前这里判错，
             会把云端媒体丢掉、还留下一条重复帖 */
          var allLocal = (editing.media || []).every(function (m) { return !!m.blob; });
          var hasNewBlob = (editing.media || []).some(function (m) { return !!m.blob && !m.rid; });
          var replaceable = hasNewBlob && allLocal;
          if (hasNewBlob && !allLocal) {
            toast('已发布的帖子还不能追加图片或视频，这次只保存文字和隐私设置');
          }
          if (replaceable) {
            var uploads = (editing.media || []).map(function (m) {
              return { id: m.id, type: m.type, blob: m.blob };
            }).filter(function (m) { return !!m.blob; });
            composeProgress('正在上传…');
            Srv.publish({
              text: text, private: isPrivate, sensitive: isSensitive, media: uploads,
              onProgress: function (pct) { composeProgress(pct >= 99 ? '正在发布…' : '上传 ' + pct + '%'); upBadge(pct); }
            }).then(function (d) {
              composeProgressReset();
              if (!d || !d.post) return;
              editing.remoteId = d.post.id;
              /* 整帖重发会拿到新的服务器 id：本机如果还留着同一个 id 的旧副本，
                 「说说」里就会出现两条一模一样的帖子，这里直接清掉 */
              state.posts = state.posts.filter(function (p) {
                if (!p || p.id === editing.id) return true;
                if (String(p.remoteId) !== String(d.post.id)) return true;
                dbDel('posts', p.id);
                return false;
              });
              (editing.media || []).forEach(function (m, i) {
                if (d.post.media && d.post.media[i]) m.rid = d.post.media[i].id;
              });
              DataAPI.updatePost(editing);
              Srv.removePost(oldRemote).catch(function (e) { console.warn('旧帖删除失败', e); });
            }).catch(function (e) { console.warn('编辑同步失败', e); });
          } else {
            /* 媒体已经在云端（本机没有 blob）时不能整帖重发，但隐私 / 18+ 标注必须同步过去，
               否则只有这台设备自己看得到遮罩 */
            Srv.updatePost(editing.remoteId, {
              text: text, private: isPrivate, sensitive: isSensitive
            }).catch(function (e) { console.warn('编辑同步失败', e); });
          }
        }
      }).catch(function (err) {
        console.error(err);
        $('#composePublish').classList.add('on');
        toast(err && err.message ? err.message : '保存失败，可能是文件太大');
      });
      return;
    }
    var onProg = function (pct) { composeProgress(pct >= 99 ? '正在发布…' : '上传 ' + pct + '%'); upBadge(pct); };
    composeProgress('正在上传…');
    upBadge(0);
    DataAPI.createPost({
      text: text, media: media, private: isPrivate, sensitive: isSensitive,
      onProgress: onProg, draftReplace: fromDraft
    }).then(function (post) {
      composeProgressReset();
      upBadgeDone();
      /* 上传被中断：帖子不进首页/说说，改存草稿箱 */
      if (post && post.draft) {
        closeCompose();
        updateDraftEntry();
        toast('上传中断，已存入草稿箱');
        return;
      }
      if (fromDraft) removeDraft(fromDraft, true);
      state.posts.unshift(post);
      state.composeMedia = [];
      $('#compose').classList.remove('open');
      renderFeed();
      renderTalk();
      if (state.tab === 'profile') renderProfile();
      renderNotes();
      if (ME && ME.official) {
        switchTab('feed');
        $('#viewFeed').scrollTop = 0;
        toast('已发布，官方内容已进入「推荐」');
      } else {
        switchTab('talk');
        $('#viewTalk').scrollTop = 0;
        toast('已发布');
      }
      if (lanEnabled()) lanTick();
    }).catch(function (err) {
      console.error(err);
      upBadge(null);
      composeProgressReset();
      $('#composePublish').classList.add('on');
      toast('保存失败，可能是文件太大');
    });
  }

  /* ---------------- notes editor ---------------- */
  function openNote(note) {
    state.editingNote = note || null;
    $('#noteTitle').value = note ? (note.title || '') : '';
    $('#noteContent').value = note ? (note.content || '') : '';
    $('#noteDelete').style.display = note ? 'block' : 'none';
    $('#noteSheet').classList.add('open');
  }
  function closeNote() {
    $('#noteSheet').classList.remove('open');
    state.editingNote = null;
  }
  function saveNote() {
    var title = $('#noteTitle').value.trim();
    var content = $('#noteContent').value.trim();
    if (!title && !content) { toast('写点什么再保存'); return; }
    var now = Date.now();
    var note = state.editingNote || { id: uid(), createdAt: now };
    if (!title && content) {
      var first = content.split('\n')[0].slice(0, 24);
      title = first;
      content = content.split('\n').slice(1).join('\n').trim();
    }
    note.title = title;
    note.content = content;
    note.updatedAt = now;
    DataAPI.saveNote(note).then(function () {
      return DataAPI.listNotes();
    }).then(function (list) {
      state.notes = list;
      closeNote();
      renderNotes();
      renderProfile();
      toast('已保存');
      if (lanEnabled()) lanTick();
    });
  }

  function deleteNote() {
    if (!state.editingNote) return;
    confirmDialog({ title: '删除这条备忘录？', desc: '删除后无法恢复。', okText: '删除' }).then(function (ok) {
      if (!ok) return;
      DataAPI.deleteNote(state.editingNote.id).then(function () {
        state.notes = state.notes.filter(function (n) { return n.id !== state.editingNote.id; });
        closeNote();
        renderNotes();
        renderProfile();
        toast('已删除');
        if (lanEnabled()) lanTick();
      });
    });
  }

  /* ---------------- post actions ---------------- */
  function findPost(id) {
    for (var i = 0; i < state.posts.length; i++) if (state.posts[i].id === id) return state.posts[i];
    return null;
  }

  function handlePostClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var article = btn.closest('.post');
    if (!article) return;
    var id = article.dataset.id;
    var post = findPost(id);
    if (!post) return;
    postAction(btn, id, post, btn.dataset.act);
  }

  /* 统一的帖子动作：信息流卡片与视频放大页的胶囊按钮共用 */
  /* 单条本机帖补传：pushLocal 与「立即上传」按钮、编辑页的「再次上传」共用 */
  function pushOnePost(p, onProgress) {
    var all = (p.media || []).filter(function (m) { return m && (m.blob || m.rid); }).map(function (m) {
      var mm = { id: m.id, type: m.type, blob: m.blob, ratio: m.ratio || 0 };
      if (m.poster) mm.poster = m.poster;
      if (m.rid) mm.rid = m.rid;
      return mm;
    });
    return Srv.publish({
      text: p.text || '', private: !!p.private, sensitive: !!p.sensitive,
      media: all, onProgress: onProgress
    }).then(function (d) {
      var rp = (d && d.post) || {};
      if (!rp.id) throw new Error('服务器没有返回帖子 id');
      var oldId = p.id;
      p.remoteId = rp.id;
      p.id = 'srv_' + rp.id;
      /* 旧 ID 作废，避免其他手机把旧副本再传回来形成重复帖子 */
      lanMarkDeleted(oldId);
      p.likes = rp.likeCount || p.likes || 0;
      p.replies = rp.commentCount || p.replies || 0;
      p.upFail = 0;
      all.forEach(function (m, i) {
        if (rp.media && rp.media[i]) {
          m.rid = rp.media[i].id;
          if (rp.media[i].poster) m.poster = rp.media[i].poster;
        }
      });
      return dbDel('posts', oldId).then(function () { return dbPut('posts', p); });
    });
  }

  /* 列表里点「立即上传到服务器」 */
  function reuploadPost(p) {
    if (!p || !isLocalOnlyPost(p)) return;
    if (!Srv.canSync()) { toast('请先在设置里连接后台服务器并登录'); return; }
    var btn = $('.post[data-id="' + p.id + '"] [data-act="reupload"]');
    if (btn) { btn.disabled = true; btn.textContent = '正在上传…'; }
    upBadge(0);
    pushOnePost(p, function (pct) {
      upBadge(pct);
      if (btn) btn.textContent = '正在上传 ' + pct + '%';
    }).then(function () {
      upBadgeDone();
      renderFeed();
      renderTalk();
      if (state.tab === 'profile') renderProfile();
      renderNotes();
      toast('已上传到服务器，其他设备现在也能看到');
    }).catch(function (err) {
      upBadge(null);
      if (btn) { btn.disabled = false; btn.textContent = '立即上传到服务器'; }
      toast('上传失败：' + ((err && err.message) || '网络不稳定') + '（仍存在本机）');
    });
  }

  /* ---------------- 草稿箱 ---------------- */
  /* 上传被中断的帖子不进首页/说说，先落到草稿箱：可以继续编辑发布，也可以直接删除一个 */
  function draftCount() { return (state.drafts || []).length; }
  function updateDraftEntry() {
    var n = draftCount();
    var box = $('#draftCount');
    if (box) {
      box.textContent = n ? String(n) : '';
      if (n) box.removeAttribute('hidden'); else box.setAttribute('hidden', '');
    }
    var btn = $('#composeDrafts');
    if (btn) btn.classList.toggle('has', n > 0);
  }
  function makeDraft(input) {
    input = input || {};
    if (input.replaceId) removeDraft(input.replaceId, true);
    var now = Date.now();
    var d = {
      id: 'draft_' + uid(),
      draft: true,
      savedAt: now,
      createdAt: now,
      text: input.text || '',
      /* 媒体整块留下 blob：草稿还没上过服务器，只有本机有原件 */
      media: (input.media || []).map(function (m) {
        return {
          id: m.id, type: m.type, blob: m.blob || null, src: m.src || '',
          poster: m.poster || '', ratio: m.ratio || 0, rid: m.rid || '', name: m.name || ''
        };
      }),
      private: !!input.private,
      sensitive: !!input.sensitive,
      channel: input.channel || state.composeChannel,
      why: input.why || ''
    };
    state.drafts = state.drafts || [];
    state.drafts.unshift(d);
    updateDraftEntry();
    return dbPut('posts', d).then(function () { return d; }, function () { return d; });
  }
  function removeDraft(id, quiet) {
    if (!id) return;
    var had = (state.drafts || []).some(function (d) { return d.id === id; });
    state.drafts = (state.drafts || []).filter(function (d) { return d.id !== id; });
    dbDel('posts', id).catch(function () {});
    try { lanMarkDeleted(id); } catch (e) { /* 忽略 */ }
    updateDraftEntry();
    if (!quiet && had) { renderDraftList(); toast('草稿已删除'); }
  }
  function draftThumbHTML(d) {
    var first = (d.media || [])[0];
    if (!first) return '<div class="draft-thumb">文</div>';
    if (first.type === 'video') {
      var poster = posterSrc(first);
      return '<div class="draft-thumb"><video src="' + mediaSrc(first) + '" muted playsinline preload="metadata"' +
        (poster ? ' poster="' + poster + '"' : '') + '></video></div>';
    }
    return '<div class="draft-thumb"><img src="' + mediaSrc(first) + '" alt=""></div>';
  }
  function renderDraftList() {
    var box = $('#draftList');
    if (!box) return;
    var list = state.drafts || [];
    if (!list.length) {
      box.innerHTML = '<div class="draft-empty">草稿箱是空的<br>发布中断的帖子会自动存到这里</div>';
      return;
    }
    box.innerHTML = list.map(function (d) {
      var n = (d.media || []).length;
      var title = (d.text || '').trim();
      if (!title) title = n ? ('（' + n + ' 个附件）') : '（空白草稿）';
      var meta = [n ? n + ' 个附件' : '纯文字', ago(d.savedAt || d.createdAt)];
      if (d.why) meta.push('上传中断：' + d.why);
      return '<div class="draft-row" data-did="' + d.id + '">' + draftThumbHTML(d) +
        '<div class="draft-main"><div class="draft-title">' + esc(title.slice(0, 80)) + '</div>' +
        '<div class="draft-meta">' + esc(meta.join(' · ').slice(0, 90)) + '</div></div>' +
        '<button class="draft-edit" data-dact="edit" data-did="' + d.id + '">继续</button>' +
        '<button class="draft-del" data-dact="del" data-did="' + d.id + '">删除</button></div>';
    }).join('');
  }
  function openDrafts() {
    renderDraftList();
    updateDraftEntry();
    $('#draftSheet').classList.add('open');
  }
  function closeDrafts() { $('#draftSheet').classList.remove('open'); }
  function editDraft(id) {
    var d = (state.drafts || []).filter(function (x) { return x.id === id; })[0];
    if (!d) { toast('草稿不存在'); return; }
    closeDrafts();
    openCompose({ id: d.id, text: d.text, media: d.media, private: d.private, sensitive: d.sensitive, channel: d.channel });
    /* 草稿不是时间线里的帖子：发布时走「新帖」这条路，成功后把草稿删掉 */
    state.editingPostId = null;
    state.editingDraftId = d.id;
    $('#composeTitle').textContent = '草稿';
    $('#composePublish').textContent = '发布';
    updatePublishState();
  }

  function postAction(btn, id, post, act) {
    if (act === 'reupload') { reuploadPost(post); return; }
    if (act === 'like') {
      if (!needOnline('点赞')) return;
      post.liked = !post.liked;
      post.likes = Math.max(0, (post.likes || 0) + (post.liked ? 1 : -1));
      btn.classList.toggle('on', post.liked);
      btn.innerHTML = (post.liked ? ICON.heartFill : ICON.heart) + '<span>' + fmt(post.likes) + '</span>';
      DataAPI.updatePost(post);
      if (post.remoteId && Srv.on()) {
        srvRetry(function () { return Srv.like(post.remoteId); }).then(function (r) {
          post.liked = r.liked;
          post.likes = r.likeCount;
          DataAPI.updatePost(post);
          $$('.post[data-id="' + post.id + '"] .like').forEach(function (b) {
            b.classList.toggle('on', post.liked);
            b.innerHTML = (post.liked ? ICON.heartFill : ICON.heart) + '<span>' + fmt(post.likes) + '</span>';
          });
        }).catch(function (e) {
          console.warn('点赞同步失败', e);
          post.liked = !post.liked;
          post.likes = Math.max(0, (post.likes || 0) + (post.liked ? 1 : -1));
          DataAPI.updatePost(post);
          $$('.post[data-id="' + post.id + '"] .like').forEach(function (b) {
            b.classList.toggle('on', post.liked);
            b.innerHTML = (post.liked ? ICON.heartFill : ICON.heart) + '<span>' + fmt(post.likes) + '</span>';
          });
          toast('点赞未上传，请检查服务器连接');
        });
      }
      if (state.tab === 'profile') {
        var p2 = $('#myPosts .post[data-id="' + id + '"] .like');
        if (p2) { p2.classList.toggle('on', post.liked); p2.innerHTML = (post.liked ? ICON.heartFill : ICON.heart) + '<span>' + fmt(post.likes) + '</span>'; }
      }
      return;
    }
    if (act === 'repost') {
      if (!canPostNow()) return;
      var before = !!post.reposted;
      var beforeCount = post.reposts || 0;
      post.reposted = !before;
      post.reposts = Math.max(0, beforeCount + (post.reposted ? 1 : -1));
      updatePostCountsInDom(post);
      DataAPI.updatePost(post);
      if (post.remoteId && Srv.on()) {
        btn.disabled = true;
        srvRetry(function () { return Srv.repost(post.remoteId); }).then(function (r) {
          post.reposted = !!r.reposted;
          post.reposts = r.repostCount || 0;
          DataAPI.updatePost(post);
          updatePostCountsInDom(post);
          if (state.userActivity && state.userActivity.key === state.userKey) renderUserActivity(state.userKey);
        }).catch(function (e) {
          post.reposted = before;
          post.reposts = beforeCount;
          DataAPI.updatePost(post);
          updatePostCountsInDom(post);
          toast(e.message || '转帖同步失败');
        }).then(function () { btn.disabled = false; });
      } else if (state.userActivity && state.userActivity.key === state.userKey) renderUserActivity(state.userKey);
      toast(post.reposted ? '已转帖' : '已取消转帖');
      return;
    }
    if (act === 'reply') { openPost(post.id); return; }
    if (act === 'views') { toast('浏览量 ' + fmt(post.views)); return; }
    if (act === 'share') { sharePost(post); return; }
    if (act === 'more') { openMenu(post); return; }
  }

  function sharePost(post) {
    var text = (post.text || '来自 U 的分享') + '\n\n—— 由 U 发布';
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () {});
    } else {
      copyText(text);
    }
  }

  function copyText(text) {
    var done = function () { toast('已复制到剪贴板'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { toast('复制失败'); }
      document.body.removeChild(ta);
    }
  }

  function openMenu(post) {
    state.menuPostId = post.id;
    var del = $('#menuDelete');
    del.style.display = canDeletePost(post) ? 'flex' : 'none';
    var edit = $('#menuEdit');
    if (edit) edit.style.display = sameAuthor(post.author) ? 'flex' : 'none';
    var ft = $('#menuFavText');
    if (ft) ft.textContent = isFav(post.id) ? '取消收藏' : '收藏';
    $('#menuSheet').classList.add('open');
  }
  function closeMenu() {
    $('#menuSheet').classList.remove('open');
    state.menuPostId = null;
  }

  /* ---------------- 收藏 / 历史记录 / 侧边抽屉 ---------------- */
  function loadFavs() {
    try { return JSON.parse(LS.getItem('u-favs') || '[]') || []; } catch (e) { return []; }
  }
  function saveFavs(list) { LS.setItem('u-favs', JSON.stringify(list.slice(0, 200))); }
  function isFav(id) { return loadFavs().indexOf(id) >= 0; }
  function toggleFav(id) {
    var list = loadFavs();
    var i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.unshift(id);
    saveFavs(list);
    var sb = $('#sideFavCount');
    if (sb) sb.textContent = list.length;
    return i < 0;
  }
  function loadHistory() {
    try { return JSON.parse(LS.getItem('u-history') || '[]') || []; } catch (e) { return []; }
  }
  function pushHistory(id) {
    if (!id) return;
    var list = loadHistory().filter(function (x) { return x !== id; });
    list.unshift(id);
    LS.setItem('u-history', JSON.stringify(list.slice(0, 60)));
  }
  function postsByIds(ids) {
    var map = {};
    (state.posts || []).forEach(function (p) { if (p && !p.deleted) map[p.id] = p; });
    return ids.map(function (id) { return map[id]; }).filter(Boolean);
  }
  function openSideList(kind) {
    state.sideListKind = kind;
    $('#sideListTitle').textContent = kind === 'favorites' ? '收藏' : '历史记录';
    var list = postsByIds(kind === 'favorites' ? loadFavs() : loadHistory());
    $('#sideListBody').innerHTML = list.length
      ? list.map(postHTML).join('')
      : '<div class="empty" style="padding:56px 28px"><h3 style="font-size:16px">' +
        (kind === 'favorites' ? '还没有收藏' : '还没有历史记录') + '</h3><p>' +
        (kind === 'favorites' ? '在帖子的「更多」里点收藏。' : '看过的帖子会出现在这里。') + '</p></div>';
    initPlayers($('#sideListBody'));
    $('#sideListSheet').classList.add('open');
    $('#sideListBody').scrollTop = 0;
  }
  function openSide() {
    if (!ME) return;
    paintAvatar($('#sideAvatar'), ME);
    $('#sideName').textContent = ME.name || 'U';
    $('#sideHandle').textContent = '@' + (ME.handle || 'u');
    $('#sideFavCount').textContent = loadFavs().length;
    $('#sideBackdrop').classList.add('open');
    $('#sideDrawer').classList.add('open');
  }
  function closeSide() {
    $('#sideBackdrop').classList.remove('open');
    $('#sideDrawer').classList.remove('open');
  }
  /* ---------------- 历史版本 ---------------- */
  var versionsCache = [];
  function verBase() {
    var b = srvBase();
    return b ? String(b).replace(/\/+$/, '') : '';
  }
  function verDate(ts) {
    var d = new Date(Number(ts) || 0);
    if (!d.getTime()) return '';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function verSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  }
  function renderVersions(items) {
    var box = $('#versionsBody');
    versionsCache = items || [];
    if (!box) return;
    if (!versionsCache.length) {
      box.innerHTML = '<div class="ver-empty">服务器上还没有历史版本<br>管理员在后台「历史版本」里上传 APK 后就会出现在这里</div>';
      return;
    }
    box.innerHTML = versionsCache.map(function (it, i) {
      return '<div class="ver-row" data-vid="' + esc(it.id) + '">' +
        '<div class="ver-main">' +
          '<div class="ver-title">' + esc(it.version || it.id) + (i === 0 ? '<em>最新</em>' : '') + '</div>' +
          '<div class="ver-meta">' + esc(verDate(it.createdAt)) + ' · ' + esc(verSize(it.size)) +
            (it.note ? ' · ' + esc(String(it.note).slice(0, 36)) : '') + '</div>' +
          '<div class="ver-bar" hidden><i></i></div>' +
        '</div>' +
        '<button class="ver-dl" data-vdl="' + esc(it.id) + '">下载</button>' +
      '</div>';
    }).join('');
  }
  function openVersions() {
    var box = $('#versionsBody');
    if (box) box.innerHTML = '<div class="ver-empty">正在读取…</div>';
    var el = $('#versionsSheet');
    if (el) el.classList.add('open');
    var base = verBase();
    if (!base) {
      if (box) box.innerHTML = '<div class="ver-empty">还没有连接后台服务器<br>请到「设置 → 网络 → 互联网设置」里连上服务器</div>';
      return;
    }
    fetch(base + '/api/app/versions', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { renderVersions((d && d.items) || []); })
      .catch(function () {
        if (box) box.innerHTML = '<div class="ver-empty">读取失败，请确认服务器在线后重试</div>';
      });
  }
  function vdlBar(row, pct) {
    var bar = row.querySelector('.ver-bar');
    var fill = row.querySelector('.ver-bar i');
    if (!bar || !fill) return;
    bar.hidden = false;
    fill.style.width = Math.max(1, Math.min(100, Math.round(pct))) + '%';
  }
  function vdlEnd(row, btn) {
    var bar = row.querySelector('.ver-bar');
    if (bar) setTimeout(function () { bar.hidden = true; }, 900);
    if (btn) { btn.disabled = false; btn.textContent = '下载'; }
  }
  function blobToB64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || '');
        var i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      fr.onerror = function () { reject(new Error('读取文件失败')); };
      fr.readAsDataURL(blob);
    });
  }
  /* 文件句柄（File System Access）：浏览器支持 showSaveFilePicker 时，下载时记住句柄，
     之后点「删除」就真能把磁盘上的文件删掉；不支持的浏览器只能清掉列表里的一行。 */
  var FH_DB = 'u-files', FH_STORE = 'fh';
  function fhDb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('no idb')); return; }
      var q = indexedDB.open(FH_DB, 1);
      q.onupgradeneeded = function () { try { q.result.createObjectStore(FH_STORE); } catch (e) { /* 已存在 */ } };
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { rej(q.error || new Error('idb error')); };
    });
  }
  function fhSet(name, handle) {
    return fhDb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(FH_STORE, 'readwrite');
        if (handle) tx.objectStore(FH_STORE).put(handle, name);
        else tx.objectStore(FH_STORE).delete(name);
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    }).catch(function () { return false; });
  }
  function fhGet(name) {
    return fhDb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction(FH_STORE, 'readonly');
        var q = tx.objectStore(FH_STORE).get(name);
        q.onsuccess = function () { res(q.result || null); };
        q.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  function fhCanPick() {
    return !window.UHost && typeof window.showSaveFilePicker === 'function' && !!window.isSecureContext;
  }
  function fhSaveBlob(blob, name) {
    return window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: '安卓安装包', accept: { 'application/vnd.android.package-archive': ['.apk'] } }]
    }).then(function (h) {
      return h.createWritable().then(function (w) {
        return w.write(blob).then(function () { return w.close(); });
      }).then(function () { return fhSet(name, h); });
    });
  }
  function anchorDownload(blob, name) {
    var obj = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = obj;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); } catch (e) { /* 忽略 */ }
      URL.revokeObjectURL(obj);
    }, 4000);
    toast('开始下载 ' + name);
  }
  /** 真正删掉本机安装包文件：App 里走原生桥；浏览器里删 File System Access 记下的句柄 */
  function apkDeleteFile(name, inApp) {
    var host = window.UHost;
    if (inApp) {
      if (host && typeof host.deleteApkEx === 'function') {
        try {
          var res = JSON.parse(host.deleteApkEx(name) || '{}') || {};
          if (res.ok) {
            return Promise.resolve({ ok: true, msg: '已删除 ' + name + (res.media ? '（系统「下载」里的副本也删了）' : '') });
          }
          return Promise.resolve({ ok: false, msg: res.note ? res.note : ('没找到 ' + name + '，可能已经被删过了') });
        } catch (e) { /* 落到旧接口 */ }
      }
      if (host && typeof host.deleteApk === 'function') {
        var ok2 = false;
        try { ok2 = !!host.deleteApk(name); } catch (e) { ok2 = false; }
        return Promise.resolve({ ok: ok2, msg: ok2 ? ('已删除 ' + name) : ('没找到 ' + name + '，可能已经被删过了') });
      }
      return Promise.resolve({ ok: false, msg: '' });
    }
    if (!fhCanPick()) return Promise.resolve({ ok: false, msg: '' });
    return fhGet(name).then(function (h) {
      if (!h || typeof h.remove !== 'function') return { ok: false, msg: '' };
      return h.remove().then(function () {
        return fhSet(name, null).then(function () { return { ok: true, msg: '已从磁盘删除 ' + name }; });
      });
    }).catch(function () { return { ok: false, msg: '' }; });
  }
  function downloadVersion(id, name, row, btn) {
    var base = verBase();
    if (!base) { toast('请先连接后台服务器'); return; }
    if (btn) { btn.disabled = true; btn.textContent = '0%'; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + '/api/app/versions/' + encodeURIComponent(id) + '/apk', true);
    xhr.responseType = 'blob';
    xhr.onprogress = function (e) {
      if (!e.lengthComputable) return;
      var pct = e.total ? (e.loaded / e.total * 100) : 0;
      vdlBar(row, pct);
      if (btn) btn.textContent = Math.round(pct) + '%';
    };
    xhr.onload = function () {
      if (xhr.status !== 200) { vdlEnd(row, btn); toast('下载失败（' + xhr.status + '）'); return; }
      var blob = xhr.response;
      vdlBar(row, 100);
      /* App 里走原生桥存到系统「下载」目录；网页里直接用浏览器下载 */
      if (window.UHost && typeof window.UHost.saveApkBase64 === 'function' && blob && blob.size > 0) {
        blobToB64(blob).then(function (b64) {
          apkRemember({ name: name, size: blob.size || 0, at: Date.now() });
          try { window.UHost.saveApkBase64(b64, name); }
          catch (e) { toast('保存失败，请用浏览器打开网页下载'); }
          vdlEnd(row, btn);
        }).catch(function () { vdlEnd(row, btn); toast('保存失败'); });
        return;
      }
      apkRemember({ name: name, size: blob.size || 0, at: Date.now() });
      if (fhCanPick() && blob && blob.size > 0) {
        fhSaveBlob(blob, name).then(function () {
          toast('已保存 ' + name + '：以后在这里点「删除」会真的删掉文件');
          vdlEnd(row, btn);
        }).catch(function (err) {
          vdlEnd(row, btn);
          if (err && err.name === 'AbortError') { toast('已取消下载'); return; }
          anchorDownload(blob, name);
        });
        return;
      }
      anchorDownload(blob, name);
      vdlEnd(row, btn);
    };
    xhr.onerror = function () { vdlEnd(row, btn); toast('下载失败，请检查网络'); };
    xhr.send();
  }
  function bindVersions() {
    var box = $('#versionsBody');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vdl]');
      if (!b) return;
      var row = b.closest('.ver-row');
      var id = b.getAttribute('data-vdl');
      var it = versionsCache.filter(function (x) { return String(x.id) === String(id); })[0] || {};
      var name = it.file || ('U-' + (it.version || id) + '.apk');
      downloadVersion(id, name, row, b);
    });
  }
  /* ---------------- 已下载的安装包（历史版本右上角入口） ---------------- */
  var APK_LS = 'u-apk-dl';
  function apkRecords() {
    try { return JSON.parse(LS.getItem(APK_LS) || '[]') || []; } catch (e) { return []; }
  }
  function apkRemember(it) {
    if (!it || !it.name) return;
    var list = apkRecords().filter(function (x) { return x && x.name !== it.name; });
    list.unshift(it);
    try { LS.setItem(APK_LS, JSON.stringify(list.slice(0, 20))); } catch (e) { /* 忽略 */ }
  }
  function apkForget(name) {
    var list = apkRecords().filter(function (x) { return x && x.name !== name; });
    try { LS.setItem(APK_LS, JSON.stringify(list)); } catch (e) { /* 忽略 */ }
  }
  function apkTime(ts) {
    var d = new Date(Number(ts) || 0);
    if (!d.getTime()) return '';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function renderApkRows(rows, native) {
    var box = $('#apkBody');
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = '<div class="ver-empty">还没有下载过的安装包<br>' +
        (native ? '在「历史版本」里点「下载」，下好的包会出现在这里，可以直接安装' : '在「历史版本」里点「下载」就会开始下载') + '</div>';
      return;
    }
    box.innerHTML = rows.map(function (r) {
      var act = native
        ? '<button class="ver-dl" data-apkinst="' + esc(r.name) + '">安装</button>'
        : '<button class="ver-dl" data-apkagain="' + esc(r.id || '') + '">重新下载</button>';
      var del = '<button class="ver-del" data-apkdel="' + esc(r.name) + '" data-apknative="' + (native ? '1' : '0') + '" aria-label="删除安装包">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-8 0 1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span>删除</span></button>';
      return '<div class="ver-row">' +
        '<div class="ver-main">' +
          '<div class="ver-title">' + esc(r.name) + '</div>' +
          '<div class="ver-meta">' + esc(apkTime(r.at)) + (r.size ? ' · ' + esc(verSize(r.size)) : '') + '</div>' +
        '</div><div class="ver-act">' + act + del + '</div>' +
      '</div>';
    }).join('');
  }
  function openApkSheet() {
    var box = $('#apkBody');
    if (box) box.innerHTML = '<div class="ver-empty">正在读取…</div>';
    var el = $('#apkSheet');
    if (el) el.classList.add('open');
    var host = window.UHost;
    if (host && typeof host.listApks === 'function') {
      var raw = '';
      try { raw = host.listApks() || ''; } catch (e) { raw = ''; }
      var items = [];
      try { items = JSON.parse(raw) || []; } catch (e) { items = []; }
      if (items && items.length) {
        items.sort(function (a, b) { return (Number(b.at) || 0) - (Number(a.at) || 0); });
        renderApkRows(items, true);
        return;
      }
    }
    renderApkRows(apkRecords(), false);
  }
  function installLocalApk(name) {
    var host = window.UHost;
    if (!host || typeof host.installApk !== 'function') { toast('当前环境不能直接安装，请到文件管理器里打开'); return; }
    try { host.installApk(name); }
    catch (e) { toast('安装失败，请到系统下载目录里手动打开'); }
  }
  /* ---------------- 意见反馈（文字 + 图片 / 视频，存到服务器） ---------------- */
  var fbPending = [];
  var fbBusy = false;
  var FB_MAX = 6;

  function fbMediaLimit(mime) {
    var s = (typeof SRV_SETTINGS === 'object' && SRV_SETTINGS) ? SRV_SETTINGS : {};
    var mb = /^video\//.test(mime) ? (Number(s.uploadVideoMB) || 1024) : (Number(s.uploadImageMB) || 50);
    return mb * 1024 * 1024;
  }

  function fbSetBtn(text, disabled) {
    var btn = $('#fbSend');
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = '提交反馈';
    btn.textContent = text || btn.dataset.label;
    btn.disabled = !!disabled;
  }

  function renderFbPreview() {
    var box = $('#fbPreview');
    var cnt = $('#fbCount');
    if (cnt) cnt.textContent = fbPending.length + '/' + FB_MAX;
    if (!box) return;
    box.innerHTML = fbPending.map(function (f, i) {
      var inner = /^video\//.test(f.mime)
        ? '<video src="' + f.url + '" muted playsinline preload="metadata"></video>'
        : '<img src="' + f.url + '" alt="">';
      return '<div class="fb-cell">' + inner +
        '<button class="rm" data-fbrm="' + i + '" aria-label="移除">×</button></div>';
    }).join('');
  }

  function fbClear() {
    fbPending.forEach(function (f) { try { URL.revokeObjectURL(f.url); } catch (e) {} });
    fbPending = [];
    renderFbPreview();
  }

  function fbAddFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    var added = 0;
    files.forEach(function (file) {
      if (!file) return;
      if (fbPending.length >= FB_MAX) { toast('最多附 ' + FB_MAX + ' 个图片 / 视频'); return; }
      var mime = file.type || '';
      if (!/^(image|video)\//.test(mime)) { toast('只能附加图片或视频'); return; }
      var lim = fbMediaLimit(mime);
      if (file.size > lim) {
        toast((/^video\//.test(mime) ? '视频' : '图片') + '太大，单个不超过 ' + Math.round(lim / 1048576) + 'MB');
        return;
      }
      fbPending.push({ file: file, mime: mime, name: file.name || ('fb-' + Date.now()), url: URL.createObjectURL(file) });
      added++;
    });
    renderFbPreview();
    if (!added && !fbPending.length) renderFbPreview();
  }

  function fbTime(ts) {
    var d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* 反馈状态：未处理 / 已处理，全部以服务器为准；面板开着时每 5 秒对一次，管理员在后台点「已处理」这里立刻变 */
  var fbPoll = 0, fbSig = '';
  function fbSignature(items) {
    return (items || []).map(function (it) {
      return String(it.id) + ':' + String(it.status || '') + ':' + String(it.reply || '').length;
    }).join('|');
  }
  function fbStartPoll() {
    if (fbPoll) return;
    fbPoll = setInterval(function () {
      var sheet = $('#feedbackSheet');
      if (!sheet || !sheet.classList.contains('open')) { clearInterval(fbPoll); fbPoll = 0; return; }
      if (document.hidden) return;
      loadMyFeedback(true);
    }, 5000);
  }
  function fbStatusText(st) { return String(st || '') === 'done' ? '已处理' : '未处理'; }
  function loadMyFeedback(silent) {
    var box = $('#fbList');
    if (!box) return;
    if (typeof Srv === 'undefined' || !Srv.canSync || !Srv.canSync()) {
      box.innerHTML = '<div class="ver-empty">连接服务器后可以看到自己提交过的反馈</div>';
      return;
    }
    Srv.raw('/api/feedback/mine').then(function (r) {
      var items = (r && r.items) || [];
      var sig = fbSignature(items);
      if (silent && sig === fbSig) return;
      fbSig = sig;
      if (!items.length) { box.innerHTML = '<div class="ver-empty">还没有提交过反馈</div>'; return; }
      box.innerHTML = items.map(function (it) {
        var media = (it.media || []).map(function (m) {
          return /^video\//.test(m.mime)
            ? '<video src="' + Srv.abs(m.url) + '" muted playsinline preload="metadata"></video>'
            : '<img src="' + Srv.abs(m.url) + '" alt="" loading="lazy">';
        }).join('');
        return '<div class="fb-item">' +
          (it.text ? '<div class="t">' + esc(it.text) + '</div>' : '') +
          (media ? '<div class="m">' + media + '</div>' : '') +
          '<div class="s"><span class="fb-tag' + (it.status === 'done' ? ' done' : ' new') + '">' + fbStatusText(it.status) + '</span>' +
          '<span>' + fbTime(it.createdAt) + '</span>' +
          (it.reply ? '<span>回复：' + esc(it.reply) + '</span>' : '') + '</div>' +
        '</div>';
      }).join('');
    }, function () {
      box.innerHTML = '<div class="ver-empty">读取失败，稍后再试</div>';
    });
  }

  function sendFeedback() {
    if (fbBusy) return;
    var textEl = $('#fbText');
    var text = textEl ? String(textEl.value || '').trim() : '';
    if (!text && !fbPending.length) { toast('写点内容，或者附一张图片 / 一段视频再提交'); return; }
    if (!needOnline('提交反馈')) return;
    fbBusy = true;
    fbSetBtn('正在上传…', true);
    var items = fbPending.slice();
    var done = [];
    var chain = Promise.resolve();
    items.forEach(function (f, i) {
      chain = chain.then(function () {
        fbSetBtn('上传 ' + (i + 1) + '/' + items.length + ' 0%', true);
        return Srv.upload(f.file, f.name, function (pct) {
          fbSetBtn('上传 ' + (i + 1) + '/' + items.length + ' ' + pct + '%', true);
        }).then(function (r) {
          if (r && r.id) done.push({ id: r.id, mime: r.mime, size: r.size });
        });
      });
    });
    chain.then(function () {
      fbSetBtn('提交中…', true);
      return Srv.raw('/api/feedback', { method: 'POST', body: { text: text, media: done } });
    }).then(function () {
      fbBusy = false;
      fbSetBtn(null, false);
      if (textEl) textEl.value = '';
      fbClear();
      toast('反馈已提交，谢谢！');
      loadMyFeedback();
    }, function (err) {
      fbBusy = false;
      fbSetBtn(null, false);
      toast('提交失败：' + ((err && err.message) || '网络异常'));
    });
  }

  function openFeedbackSheet() {
    var el = $('#feedbackSheet');
    if (!el) { toast('反馈页面没加载出来，请更新到最新版本'); return; }
    $$('.sheet.open, .overlay.open').forEach(function (s) { if (s !== el) s.classList.remove('open'); });
    el.classList.add('open');
    /* WebView 里过渡动画偶尔不跑（停在 translateY(100%)），兜一层内联样式保证一定看得见 */
    el.style.visibility = 'visible';
    el.style.transform = 'none';
    setTimeout(function () { el.style.visibility = ''; el.style.transform = ''; }, 420);
    try { renderFbPreview(); } catch (e) { }
    try { loadMyFeedback(); } catch (e) { }
    try { fbStartPoll(); } catch (e) { }
  }

  function openSubSheet(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('open');
  }

  /* ---------------- 推特视频下载 ----------------
     流程：复制推文链接 → 解析帖子（服务器去问 fxtwitter）→ 选清晰度下载。
     下载记录存本地，右上角按钮随时看进度；完成后可以「打开」「删除」，
     删除会把手机相册 / 浏览器里那份一起删掉。 */
  var TW_LS = 'u-tw-dls';
  var twTimers = {};
  var twBusy = false;

  function twLoad() {
    var arr = null;
    try { arr = JSON.parse(LS.getItem(TW_LS) || '[]'); } catch (e) { arr = null; }
    if (!Array.isArray(arr)) arr = [];
    return arr;
  }
  function twSave(list) {
    try { LS.setItem(TW_LS, JSON.stringify(list.slice(0, 80))); } catch (e) { /* 忽略 */ }
  }
  function twFind(name) {
    var list = twLoad();
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return { list: list, item: list[i], at: i };
    return { list: list, item: null, at: -1 };
  }
  function twPut(item) {
    var r = twFind(item.name);
    var list = r.list;
    if (r.at >= 0) list[r.at] = item; else list.unshift(item);
    twSave(list);
    return list;
  }
  function twBadge() {
    var list = twLoad();
    var n = list.filter(function (it) { return it.state === 'down'; }).length;
    var b = $('#twDlCount');
    if (!b) return;
    if (n > 0) { b.textContent = String(n); b.style.display = ''; }
    else b.style.display = 'none';
  }
  function twPct(it) {
    var total = Number(it.total) || 0;
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((Number(it.got) || 0) / total * 100)));
  }
  function twSizeText(it) {
    var got = Number(it.got) || 0;
    var total = Number(it.total) || 0;
    var pct = twPct(it);
    if (it.state === 'done') return fmtSize(total || got) + ' · 已下载';
    if (it.state === 'error') return it.err || '下载失败';
    if (!got) return it.direct ? '手机直连中…' : '中转连接中…（连不上会自动改用手机直连）';
    if (!total) return '下载中 ' + fmtSize(got);
    return pct + '% · ' + fmtSize(got) + ' / ' + fmtSize(total);
  }
  function twOpen() {
    var el = $('#twSheet');
    if (!el) return;
    $$('.sheet.open, .overlay.open').forEach(function (s) { if (s !== el) s.classList.remove('open'); });
    el.classList.add('open');
    twBadge();
  }
  function twOpenDls() {
    var el = $('#twDlSheet');
    if (!el) return;
    el.classList.add('open');
    twRenderDls();
  }
  function twRenderDls() {
    var box = $('#twDlBody');
    if (!box) return;
    var list = twLoad();
    if (!list.length) {
      box.innerHTML = '<div class="tw-empty">还没有下载过视频<br>在「推特视频下载」里解析一条帖子就能下</div>';
      return;
    }
    var html = '';
    list.forEach(function (it) {
      var done = it.state === 'done';
      html += '<div class="tw-dl" data-twname="' + esc(it.name) + '">' +
        '<div class="tw-dl-main">' +
          '<div class="tw-dl-name">' + esc(it.name) + '</div>' +
          '<div class="tw-dl-meta" data-twmeta="1">' + esc(twSizeText(it)) + '</div>' +
          (it.state === 'down' ? '<div class="tw-dl-bar"><i style="width:' + twPct(it) + '%"></i></div>' : '') +
        '</div>' +
        '<div class="tw-dl-act">' +
          (done ? '<button data-twopen="' + esc(it.name) + '">打开</button>' : '') +
          (done ? '<button data-twplay="' + esc(it.name) + '">播放</button>' : '') +
          (it.state === 'error' ? '<button data-twretry="' + esc(it.name) + '">重试</button>' : '') +
          '<button class="del" data-twdel="' + esc(it.name) + '">删除</button>' +
        '</div>' +
      '</div>';
    });
    box.innerHTML = html;
  }
  function twPaintRow(it) {
    var row = document.querySelector('#twDlBody [data-twname="' + String(it.name).replace(/"/g, '\\"') + '"]');
    if (!row) { twRenderDls(); return; }
    var meta = row.querySelector('[data-twmeta]');
    if (meta) meta.textContent = twSizeText(it);
    var bar = row.querySelector('.tw-dl-bar i');
    if (bar) bar.style.width = twPct(it) + '%';
    twBadge();
  }
  function twDuration(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function twRenderResult(d) {
    var box = $('#twResult');
    if (!box) return;
    var a = (d && d.author) || {};
    var html = '<div class="tw-card">' +
      '<div class="tw-who">' +
        (a.avatar ? '<img src="' + esc(a.avatar) + '" alt="">' : '<img alt="">') +
        '<div class="nm"><b>' + esc(a.name || '推特用户') + '</b><span>@' + esc(a.handle || '') + '</span></div>' +
      '</div>' +
      (d.text ? '<div class="tw-text">' + esc(d.text) + '</div>' : '');
    (d.groups || []).forEach(function (g) {
      if (g.poster) {
        html += '<div class="tw-poster"><img src="' + esc(g.poster) + '" alt="">' +
          (g.duration ? '<span class="tw-dur">' + twDuration(g.duration) + '</span>' : '') + '</div>';
      }
      html += '<div class="tw-opts">';
      (g.options || []).forEach(function (o, i) {
        html += '<div class="tw-opt">' +
          '<span class="q">' + esc(o.label) + '</span>' +
          '<span class="s">' + esc(o.size || '') + (o.bytes ? ' · ' + fmtSize(o.bytes) : '') + '</span>' +
          '<button data-twget="' + g.index + '-' + i + '">下载</button>' +
        '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
    box.setAttribute('data-twjson', '1');
    twCurrent = d;
  }
  var twCurrent = null;

  function twParse() {
    var input = $('#twUrl');
    var btn = $('#twParse');
    var box = $('#twResult');
    var link = input ? String(input.value || '').trim() : '';
    if (!link) { toast('先把推文链接粘进来'); return; }
    if (twBusy) return;
    twBusy = true;
    if (btn) { btn.disabled = true; btn.textContent = '解析中…'; }
    if (box) box.innerHTML = '<div class="tw-empty">正在解析…</div>';
    Srv.raw('/api/twitter/parse', { method: 'POST', body: { url: link } }).then(function (d) {
      twBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = '解析帖子'; }
      if (!d || !d.groups || !d.groups.length) {
        if (box) box.innerHTML = '<div class="tw-empty">这条帖子里没有能下载的视频</div>';
        return;
      }
      twRenderResult(d);
    }).catch(function (e) {
      twBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = '解析帖子'; }
      if (box) box.innerHTML = '<div class="tw-empty">' + esc((e && e.message) || '解析失败，检查一下链接') + '</div>';
    });
  }

  function twProxyUrl(remote) {
    var base = srvBase();
    if (!base) return '';
    return base + '/api/twitter/proxy?u=' + encodeURIComponent(remote) + '&token=' + encodeURIComponent(srvToken());
  }

  function twStart(d, g, o, btn) {
    var name = 'U-' + String((d.author && d.author.handle) || 'x') + '-' + d.id + '-' + String(o.size || 'v').replace(/\D/g, 'x') + '.mp4';
    var r = twFind(name);
    if (r.item && (r.item.state === 'down' || r.item.state === 'done')) { toast('这条已经在列表里了'); return; }
    var item = {
      name: name, label: o.label || '', size: o.size || '', total: Number(o.bytes) || 0, got: 0,
      state: 'down', remote: o.url, at: Date.now()
    };
    twPut(item);
    twBadge(); twRenderDls();
    if (btn) { btn.disabled = true; btn.textContent = '已加入'; }
    var host = window.UHost;
    if (host && typeof host.downloadMedia === 'function') {
      var url = twProxyUrl(o.url);
      var id = '';
      try { id = String(host.downloadMedia(url, name) || ''); } catch (e) { id = ''; }
      if (id) { item.task = id; twPut(item); twPollNative(name); return; }
    }
    twWeb(name);
  }

  /* 中转失败（或一直不动）时改让这台设备直连推特 CDN 再试一次。
     服务器所在网络常常连不上 video.twimg.com，手机挂着加速反而能直连。 */
  function twRetryDirect(it, name) {
    var host = window.UHost;
    if (!host || typeof host.downloadMedia !== 'function') return false;
    it.direct = true; it.got = 0; it.lastAt = Date.now(); twPut(it);
    var id = '';
    try { id = String(host.downloadMedia(it.remote, name) || ''); } catch (e) { id = ''; }
    if (!id) return false;
    it.task = id; it.state = 'down'; it.err = '';
    twPut(it); twRenderDls(); twPollNative(name);
    return true;
  }

  function twPollNative(name) {
    if (twTimers[name]) return;
    twTimers[name] = setInterval(function () {
      var host = window.UHost;
      var r = twFind(name);
      if (!r.item) { clearInterval(twTimers[name]); delete twTimers[name]; return; }
      var it = r.item;
      if (it.state !== 'down') { clearInterval(twTimers[name]); delete twTimers[name]; return; }
      var st = null;
      try { st = JSON.parse(host.downloadState(String(it.task || '')) || '{}'); } catch (e) { st = null; }
      if (!st || !st.state) return;
      var now = Date.now();
      var got = Number(st.got) || 0;
      if (got !== (Number(it.got) || 0)) { it.got = got; it.lastAt = now; }
      else if (!it.lastAt) { it.lastAt = now; }
      it.total = Number(st.total) || it.total || 0;
      if (st.state === 'done') {
        clearInterval(twTimers[name]); delete twTimers[name];
        it.state = 'done'; it.total = it.total || it.got; it.err = '';
        twPut(it); twRenderDls();
        return;
      }
      if (st.state === 'error') {
        clearInterval(twTimers[name]); delete twTimers[name];
        if (!it.direct && twRetryDirect(it, name)) return;
        it.state = 'error';
        it.err = it.direct ? '手机也连不上推特的视频服务器，要能访问推特的网络才能下' : (st.error || '下载失败');
        twPut(it); twRenderDls();
        return;
      }
      /* 一动不动超过 18 秒：多半是中转那头挂住了，别干等 */
      if (now - (it.lastAt || now) > 18000) {
        clearInterval(twTimers[name]); delete twTimers[name];
        if (!it.direct && twRetryDirect(it, name)) return;
        it.state = 'error';
        it.err = it.direct ? '手机也连不上推特的视频服务器，要能访问推特的网络才能下' : '一直连不上，已停止';
        twPut(it); twRenderDls();
        return;
      }
      twPut(it); twPaintRow(it);
    }, 700);
  }

  /* 出错后点「重试」：清掉状态，重新从中转开始（失败会自动再走手机直连） */
  function twRestart(name) {
    var r = twFind(name);
    if (!r.item) return;
    var it = r.item;
    it.state = 'down'; it.got = 0; it.err = ''; it.direct = false; it.task = ''; it.lastAt = Date.now();
    twPut(it); twRenderDls(); twBadge();
    var host = window.UHost;
    if (host && typeof host.downloadMedia === 'function') {
      var id = '';
      try { id = String(host.downloadMedia(twProxyUrl(it.remote), name) || ''); } catch (e) { id = ''; }
      if (id) { it.task = id; twPut(it); twPollNative(name); return; }
    }
    twWeb(name);
  }

  function twSaveBlobWeb(blob, name) {
    if (fhCanPick()) {
      return window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: '视频文件', accept: { 'video/mp4': ['.mp4'] } }]
      }).then(function (h) {
        return h.createWritable().then(function (w) {
          return w.write(blob).then(function () { return w.close(); });
        }).then(function () { return fhSet(name, h); });
      }).catch(function (e) {
        /* 取消选位置也照样下到默认下载目录，省得用户再点一次 */
        anchorDownload(blob, name);
        return true;
      });
    }
    anchorDownload(blob, name);
    return Promise.resolve(true);
  }

  function twWeb(name) {
    var r = twFind(name);
    if (!r.item) return;
    var it = r.item;
    var url = twProxyUrl(it.remote);
    if (!url) { it.state = 'error'; it.err = '没连上服务器'; twPut(it); twRenderDls(); return; }
    fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('服务器返回 ' + res.status);
      var total = Number(res.headers.get('content-length') || 0);
      if (total) { it.total = total; twPut(it); }
      if (!res.body || !res.body.getReader) return res.blob();
      var reader = res.body.getReader();
      var chunks = [];
      var got = 0;
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) return new Blob(chunks, { type: 'video/mp4' });
          chunks.push(step.value);
          got += step.value.length;
          it.got = got;
          twPut(it); twPaintRow(it);
          return pump();
        });
      }
      return pump();
    }).then(function (blob) {
      return twSaveBlobWeb(blob, name).then(function (ok) {
        if (ok === false) {
          it.state = 'error'; it.err = '已取消保存';
        } else {
          it.state = 'done'; it.got = blob.size; it.total = it.total || blob.size;
        }
        twPut(it); twRenderDls();
      });
    }).catch(function (e) {
      /* 中转拿不到（服务器连不上推特 CDN），改让浏览器直连一次 */
      if (!it.direct) {
        it.direct = true; it.got = 0; it.err = ''; it.state = 'down'; twPut(it); twPaintRow(it);
        twWebDirect(it, name);
        return;
      }
      it.state = 'error'; it.err = (e && e.message) || '下载失败';
      twPut(it); twRenderDls();
    });
  }

  /* 浏览器直连推特 CDN（设备挂着加速时可用）；推特 CDN 带 CORS 头，能直接读 */
  function twWebDirect(it, name) {
    fetch(it.remote, { cache: 'no-store', mode: 'cors' }).then(function (res) {
      if (!res.ok) throw new Error('直连返回 ' + res.status);
      var total = Number(res.headers.get('content-length') || 0);
      if (total) { it.total = total; twPut(it); }
      if (!res.body || !res.body.getReader) return res.blob();
      var reader = res.body.getReader();
      var chunks = [];
      var got = 0;
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) return new Blob(chunks, { type: 'video/mp4' });
          chunks.push(step.value);
          got += step.value.length;
          it.got = got;
          twPut(it); twPaintRow(it);
          return pump();
        });
      }
      return pump();
    }).then(function (blob) {
      return twSaveBlobWeb(blob, name).then(function (ok) {
        if (ok === false) { it.state = 'error'; it.err = '已取消保存'; }
        else { it.state = 'done'; it.got = blob.size; it.total = it.total || blob.size; }
        twPut(it); twRenderDls();
      });
    }).catch(function (e) {
      it.state = 'error'; it.err = (e && e.message) || '下载失败';
      twPut(it); twRenderDls();
    });
  }

  /* 「打开」= 打开视频所在的文件夹（手机端用系统「文件」定位到 Movies/U）；
     电脑网页 / 手机网页拿不到真实路径，只能告诉用户文件放在哪。 */
  function twOpenFolder(name) {
    var host = window.UHost;
    if (host && typeof host.openDownloadFolder === 'function') {
      var res = null;
      try { res = JSON.parse(host.openDownloadFolder(name) || '{}'); } catch (e) { res = null; }
      if (res && res.ok) {
        if (res.path) toast('视频在：' + res.path);
        return;
      }
      if (res && res.note) { toast(res.note); return; }
    }
    fhGet(name).then(function (h) {
      if (h) {
        toast('视频保存在你下载时选的位置：' + name + '（浏览器不允许网页打开文件夹）');
        return;
      }
      var ua = String(navigator.userAgent || '');
      if (/Android|iPhone|iPad|Mobile/i.test(ua)) toast('视频在手机的「相册 / Movies/U」里，用「文件」App 打开');
      else toast('浏览器不允许网页打开文件夹；文件在系统「下载」里，文件名 ' + name);
    }).catch(function () {
      toast('文件在系统「下载」里，文件名 ' + name);
    });
  }

  function twOpenFile(name) {
    var host = window.UHost;
    if (host && typeof host.openDownloaded === 'function') {
      var ok = false;
      try { ok = !!host.openDownloaded(name); } catch (e) { ok = false; }
      if (ok) return;
    }
    fhGet(name).then(function (h) {
      if (!h || typeof h.getFile !== 'function') { toast('到手机的「文件」或浏览器下载里打开这个视频'); return; }
      return h.getFile().then(function (f) {
        var obj = URL.createObjectURL(f);
        window.open(obj, '_blank');
        setTimeout(function () { URL.revokeObjectURL(obj); }, 60000);
      });
    }).catch(function () { toast('打不开这个文件，去下载目录里看看'); });
  }

  function twDelete(name) {
    confirmDialog({
      title: '删除视频？',
      desc: '会把这个视频从手机相册 / 下载目录里一起删掉，删了要重新下。',
      okText: '删除'
    }).then(function (yes) {
      if (!yes) return;
      var host = window.UHost;
      var done = function () {
        var list = twLoad().filter(function (it) { return it.name !== name; });
        twSave(list); twRenderDls(); twBadge();
        toast('已删除 ' + name);
      };
      if (host && typeof host.deleteDownloaded === 'function') {
        var res = null;
        try { res = JSON.parse(host.deleteDownloaded(name) || '{}'); } catch (e) { res = null; }
        if (res && res.ok) { done(); return; }
        if (res && res.note) toast(res.note);
        done();
        return;
      }
      fhGet(name).then(function (h) {
        if (h && typeof h.remove === 'function') {
          return h.remove().then(function () { return fhSet(name, null); });
        }
        return null;
      }).then(done).catch(done);
    });
  }

  $on('#twParse', 'click', twParse);
  $on('#twUrl', 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); twParse(); } });
  $on('#twClose', 'click', function () { $('#twSheet').classList.remove('open'); });
  $on('#twDlBtn', 'click', twOpenDls);
  $on('#twDlClose', 'click', function () { $('#twDlSheet').classList.remove('open'); });
  $on('#twResult', 'click', function (e) {
    var btn = e.target.closest('[data-twget]');
    if (!btn || !twCurrent) return;
    var key = String(btn.dataset.twget || '').split('-');
    var gi = (Number(key[0]) || 1) - 1;
    var oi = Number(key[1]) || 0;
    var g = (twCurrent.groups || [])[gi];
    var o = g && (g.options || [])[oi];
    if (!g || !o) return;
    if (!Srv.on()) { needOnline('下载视频'); return; }
    twStart(twCurrent, g, o, btn);
  });
  $on('#twDlBody', 'click', function (e) {
    var openBtn = e.target.closest('[data-twopen]');
    if (openBtn) { twOpenFolder(openBtn.dataset.twopen); return; }
    var playBtn = e.target.closest('[data-twplay]');
    if (playBtn) { twOpenFile(playBtn.dataset.twplay); return; }
    var delBtn = e.target.closest('[data-twdel]');
    if (delBtn) { twDelete(delBtn.dataset.twdel); return; }
    var reBtn = e.target.closest('[data-twretry]');
    if (reBtn) { twRestart(reBtn.dataset.twretry); return; }
  });

  function sideAction(kind) {
    closeSide();
    /* 从二级菜单跳转时收起下层页面，避免新页面被旧的弹层盖住 */
    $$('.sheet.open, .overlay.open').forEach(function (s) { s.classList.remove('open'); });
    if (kind === 'settings') { openSettings(); return; }
    if (kind === 'silk') { openSilk(); return; }
    if (kind === 'game') { openLobby(); return; }
    if (kind === 'jump') { if (window.openJumpGame) window.openJumpGame(); return; }
    if (kind === 'favorites' || kind === 'history') { openSideList(kind); return; }
    if (kind === 'versions') { openVersions(); return; }
    if (kind === 'feedback') { openFeedbackSheet(); return; }
    if (kind === 'twitter') { twOpen(); return; }
  }

  /* ---------------- 小游戏：火线行动（3D 枪战） ---------------- */
  /* ---------------- 游戏设置：键位 / 画质 / 开镜 / 悬浮窗 / 灵敏度 ----------------
     全部存 localStorage，重开 App 也保留。 */
  var SH_CFG_KEY = 'u-shooter-cfg';
  var SH_BINDS_DEFAULT = {
    fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    sprint: 'ShiftLeft', reload: 'KeyR', ads: 'KeyQ', pause: 'Escape'
  };
  var SH_BINDS_LABEL = {
    fwd: '前进', back: '后退', left: '左移', right: '右移',
    sprint: '疾跑', reload: '换弹', ads: '开镜', pause: '暂停'
  };
  /* 大厅：地图 / 枪 / 皮肤。数值集中在表里，后面加图加枪只改这里。 */
  var SH_MAPS = {
    warehouse: { name: '废弃仓库', desc: '冷蓝钢架 · 堆箱多', fog: 0x08111c, fogD: .017, sky: 0x08111c,
      floor: 0xc9d6e6, wall: 0xffffff, dark: 0x18222e, crate: 0x405164, crate2: 0x4b382d,
      neon: 0x22d3ee, neon2: 0xf43f5e, hemiSky: 0x9fd8ff, hemiGround: 0x111a24, sun: 0xfff2d6, sunI: 1.05 },
    street: { name: '霓虹街区', desc: '暖橙路灯 · 开阔路口', fog: 0x141018, fogD: .024, sky: 0x0b0810,
      floor: 0xb9b3ad, wall: 0xe8dccb, dark: 0x241d22, crate: 0x5a4a3c, crate2: 0x3c3a46,
      neon: 0xffa94d, neon2: 0x7c5cff, hemiSky: 0xffc9a1, hemiGround: 0x1a1218, sun: 0xffd7a1, sunI: 1.2 },
    desert: { name: '沙海哨站', desc: '土黄砂石 · 远处沙尘', fog: 0x2a2118, fogD: .034, sky: 0x1a1409,
      floor: 0xd9c19a, wall: 0xe6d3b0, dark: 0x332a1e, crate: 0x7a6242, crate2: 0x5b4a30,
      neon: 0xffb703, neon2: 0xff7043, hemiSky: 0xffd9a8, hemiGround: 0x241d12, sun: 0xffe0b0, sunI: 1.35 }
  };
  var SH_GUNS = {
    rifle: { name: '突击步枪', mag: 30, cd: .105, dmg: 34, head: 95, adsK: .62, len: 1, label: 'M4 · 30 发' },
    smg: { name: '冲锋枪', mag: 40, cd: .062, dmg: 20, head: 60, adsK: .78, len: .8, label: 'SMG · 40 发' },
    sniper: { name: '狙击枪', mag: 5, cd: .72, dmg: 78, head: 200, adsK: .3, len: 1.22, label: 'AWM · 5 发' }
  };
  var SH_SKINS = {
    urban: { name: '城市迷彩', body: 0x4a5560, vest: 0x2f3a44, trim: 0x7d8b98 },
    desert: { name: '沙漠迷彩', body: 0x8a7450, vest: 0x5d4b30, trim: 0xb8a274 },
    forest: { name: '林地迷彩', body: 0x3d4f38, vest: 0x27331f, trim: 0x6d8260 }
  };
  function shGun() { return SH_GUNS[shooter.cfg.gun] || SH_GUNS.rifle; }
  function shMapTheme() { return SH_MAPS[shooter.cfg.map] || SH_MAPS.warehouse; }
  function shSkin() { return SH_SKINS[shooter.cfg.skin] || SH_SKINS.urban; }

  function shLoadCfg() {
    var c = null;
    try { c = JSON.parse(LS.getItem(SH_CFG_KEY) || 'null'); } catch (e) { c = null; }
    c = c || {};
    var binds = {};
    var src = c.binds || {};
    for (var k in SH_BINDS_DEFAULT) {
      binds[k] = (typeof src[k] === 'string' && src[k]) ? src[k] : SH_BINDS_DEFAULT[k];
    }
    return {
      quality: ['low', 'mid', 'high'].indexOf(c.quality) >= 0 ? c.quality : 'mid',
      adsMode: c.adsMode === 'toggle' ? 'toggle' : 'hold',
      floatMode: c.floatMode === 'hide' ? 'hide' : 'show',
      sens: Math.max(0.4, Math.min(3, Number(c.sens) || 1)),
      binds: binds,
      btnPos: (c.btnPos && typeof c.btnPos === 'object') ? c.btnPos : null,
      map: SH_MAPS[c.map] ? c.map : 'warehouse',
      gun: SH_GUNS[c.gun] ? c.gun : 'rifle',
      skin: SH_SKINS[c.skin] ? c.skin : 'urban',
      fov: Math.max(60, Math.min(100, Number(c.fov) || 74))
    };
  }
  function shSaveCfg() {
    try { LS.setItem(SH_CFG_KEY, JSON.stringify(shooter.cfg)); } catch (e) { /* 忽略 */ }
  }
  function shQualityPixelRatio() {
    var dpr = window.devicePixelRatio || 1;
    var cap = shooter.cfg.quality === 'low' ? 0.85 : shooter.cfg.quality === 'mid' ? (shooter.isTouch ? 1.1 : 1.5) : (shooter.isTouch ? 1.5 : 2);
    return Math.min(dpr, cap);
  }
  function shApplyQuality() {
    if (!shooter.renderer || !shooter.T) return;
    var T = shooter.T;
    shooter.renderer.setPixelRatio(shQualityPixelRatio());
    var high = shooter.cfg.quality === 'high';
    var low = shooter.cfg.quality === 'low';
    shooter.renderer.shadowMap.enabled = !low;
    if (shooter.scene) {
      shooter.scene.traverse(function (o) {
        if (o.isMesh && o.material && o.material.isMeshStandardMaterial) {
          o.material.flatShading = low;
          o.material.needsUpdate = true;
        }
      });
    }
    /* 雾和光也按画质收一点，低画质优先流畅 */
    if (shooter.scene && shooter.scene.fog) shooter.scene.fog.density = low ? .028 : (high ? .014 : .017);
    if (shooter.keyLight) {
      shooter.keyLight.castShadow = !low;
      shooter.keyLight.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
      if (shooter.keyLight.shadow.map) {
        shooter.keyLight.shadow.map.dispose();
        shooter.keyLight.shadow.map = null;
      }
    }
    shooterResize();
  }
  function shSetPaused(on) {
    if (on === shooter.paused) return;
    shooter.paused = !!on;
    if (!shooter.stage) return;
    shooter.stage.classList.toggle('paused', shooter.paused);
    if (shooter.paused) {
      shooter.firing = false;
      try { if (document.pointerLockElement === shooter.canvas) document.exitPointerLock(); } catch (e) {}
    } else if (shooter.running) {
      shooter.last = performance.now();
    }
  }
  function shSetAds(on) {
    var stage = shooter.stage;
    shooter.ads = !!on;
    if (stage) stage.classList.toggle('ads', shooter.ads);
    try { shEl.cross && shEl.cross.classList.toggle('ads', shooter.ads); } catch (e) {}
  }
  function shApplyFloatMode() {
    var f = $('#shFloat');
    if (!f) return;
    var hide = shooter.cfg.floatMode === 'hide';
    f.classList.toggle('removed', hide);
    if (hide) f.classList.remove('open');
  }
  /* ---------- 手机按键位置：拖动 HUD 按钮，位置存本地 ---------- */
  var SH_BTN_SEL = { stick: '#shStick', reload: '#shReload', ads: '#shAds', fire: '#shFire' };
  var shLayout = { on: false, key: null, id: null };
  function shBtnOf(key) { return $(SH_BTN_SEL[key]); }
  function shApplyBtnPos() {
    var pos = shooter.cfg.btnPos || {};
    Object.keys(SH_BTN_SEL).forEach(function (k) {
      var el = shBtnOf(k);
      if (!el) return;
      var p = pos[k];
      if (p && isFinite(p.x) && isFinite(p.y)) {
        el.style.left = p.x + '%';
        el.style.top = p.y + '%';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.transform = 'translate(-50%, -50%)';
      } else {
        el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = ''; el.style.transform = '';
      }
    });
  }
  /* 把当前实际渲染位置换算成百分比，作为拖动的起点 */
  function shCaptureBtnPos() {
    var stage = shooter.stage;
    if (!stage) return;
    var r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var pos = {};
    Object.keys(SH_BTN_SEL).forEach(function (k) {
      var el = shBtnOf(k);
      if (!el) return;
      var b = el.getBoundingClientRect();
      pos[k] = {
        x: Math.round(((b.left + b.width / 2 - r.left) / r.width) * 1000) / 10,
        y: Math.round(((b.top + b.height / 2 - r.top) / r.height) * 1000) / 10
      };
    });
    shooter.cfg.btnPos = pos;
    shApplyBtnPos();
  }
  function shSetLayout(on) {
    shLayout.on = !!on;
    shLayout.key = null;
    shLayout.id = null;
    if (!shooter.stage) return;
    shooter.stage.classList.toggle('layout', shLayout.on);
    var bar = $('#shLayoutBar');
    if (bar) bar.classList.toggle('on', shLayout.on);
    if (shLayout.on) {
      shooter.firing = false;
      shSetPaused(true);
      shCaptureBtnPos();
      toast('拖动按键调整位置，完成后点「完成」');
    } else {
      shSaveCfg();
      if (shooter.running) shSetPaused(false);
      toast('按键位置已保存');
    }
  }
  function shBindLayout() {
    var stage = shooter.stage;
    if (!stage || stage.__layoutBound) return;
    stage.__layoutBound = true;
    stage.addEventListener('pointerdown', function (e) {
      if (!shLayout.on) return;
      var hit = null;
      Object.keys(SH_BTN_SEL).forEach(function (k) {
        if (!hit && e.target.closest(SH_BTN_SEL[k])) hit = k;
      });
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      shLayout.key = hit;
      shLayout.id = e.pointerId;
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      var el = shBtnOf(hit);
      if (el) el.classList.add('dragging');
    }, true);
    stage.addEventListener('pointermove', function (e) {
      if (!shLayout.on || e.pointerId !== shLayout.id || !shLayout.key) return;
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x = Math.max(4, Math.min(96, ((e.clientX - r.left) / r.width) * 100));
      var y = Math.max(4, Math.min(96, ((e.clientY - r.top) / r.height) * 100));
      shooter.cfg.btnPos = shooter.cfg.btnPos || {};
      shooter.cfg.btnPos[shLayout.key] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      shApplyBtnPos();
      e.preventDefault();
    }, true);
    function endDrag(e) {
      if (e.pointerId !== shLayout.id) return;
      if (shLayout.key) { var el = shBtnOf(shLayout.key); if (el) el.classList.remove('dragging'); }
      shLayout.key = null;
      shLayout.id = null;
      shSaveCfg();
    }
    stage.addEventListener('pointerup', endDrag, true);
    stage.addEventListener('pointercancel', endDrag, true);
  }

  /* 调试用：只读状态，方便自动化测试与排查手感问题 */
  window.__uShooter = function () {
    return {
      running: !!shooter.running, paused: !!shooter.paused, ads: !!shooter.ads,
      yaw: shooter.yaw, pitch: shooter.pitch, isTouch: !!shooter.isTouch,
      layout: !!(typeof shLayout !== 'undefined' && shLayout.on),
      btnPos: shooter.cfg.btnPos || null, sens: shooter.cfg.sens
    };
  };

  function shPaintCfgUI() {
    $$('#shQuality button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.q === shooter.cfg.quality);
    });
    $$('#shAdsMode button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.ads === shooter.cfg.adsMode);
    });
    $$('#shFloatMode button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.float === shooter.cfg.floatMode);
    });
    var sens = $('#shSens');
    if (sens) { sens.value = shooter.cfg.sens; $('#shSensV').textContent = Number(shooter.cfg.sens).toFixed(2); }
    var fovEl = $('#shFov');
    if (fovEl) { fovEl.value = shooter.cfg.fov; $('#shFovV').textContent = shooter.cfg.fov; }
    var box = $('#shKeys');
    if (box) {
      box.innerHTML = Object.keys(SH_BINDS_LABEL).map(function (k) {
        var code = shooter.cfg.binds[k];
        return '<button data-bind="' + k + '">' + SH_BINDS_LABEL[k] +
          '<b data-code>' + shKeyLabel(code) + '</b></button>';
      }).join('');
    }
  }
  function shKeyLabel(code) {
    if (!code) return '—';
    return String(code)
      .replace(/^Key/, '')
      .replace(/^Digit/, '')
      .replace('ShiftLeft', 'Shift')
      .replace('ShiftRight', 'RShift')
      .replace('Space', '空格')
      .replace('Escape', 'Esc')
      .replace('ArrowUp', '↑').replace('ArrowDown', '↓')
      .replace('ArrowLeft', '←').replace('ArrowRight', '→');
  }
  var shRecordingBind = null;

  var shooter = {
    built: false, running: false, bound: false, loading: false,
    T: null, scene: null, camera: null, renderer: null, stage: null, canvas: null,
    weapon: null, muzzle: null, flash: null, flashLight: null,
    yaw: 0, pitch: 0, time: 0, last: 0, raf: 0, walk: 0,
    hp: 100, ammo: 30, mag: 30, reloadLeft: 0, fireCd: 0, recoil: 0,
    firing: false, keys: {}, look: null, moveX: 0, moveY: 0, stickId: null,
    enemies: [], meshes: [], obstacles: [], blockers: [],
    sparks: null, sparkData: [], tracers: [], wave: 0, score: 0,
    pendingWave: 0, hurtAt: -99, over: false, isTouch: false,
    best: 0, audio: null, noise: null, seed: Math.random(),
    cfg: shLoadCfg(), ads: false, paused: false, keyLight: null, dragLook: null
  };
  var shEl = {};

  function shooterLoadThree() {
    if (shooter.T) return Promise.resolve(shooter.T);
    if (window.THREE && window.THREE.WebGLRenderer) { shooter.T = window.THREE; return Promise.resolve(shooter.T); }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'vendor/three.min.js';
      s.onload = function () {
        if (!window.THREE || !window.THREE.WebGLRenderer) { reject(new Error('3D 引擎不可用')); return; }
        shooter.T = window.THREE;
        resolve(shooter.T);
      };
      s.onerror = function () { reject(new Error('无法加载 vendor/three.min.js')); };
      document.head.appendChild(s);
    });
  }

  function shooterMat(color, rough, metal) {
    return new shooter.T.MeshStandardMaterial({ color: color, roughness: rough, metalness: metal });
  }

  function shooterGlowTexture() {
    var T = shooter.T;
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(.3, 'rgba(255,236,180,.8)');
    gr.addColorStop(1, 'rgba(255,180,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function shooterFloorTexture() {
    var T = shooter.T;
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#151f2b'; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 900; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.035) + ')';
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    g.strokeStyle = 'rgba(72,110,140,.42)'; g.lineWidth = 2;
    for (var x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    for (var y = 0; y <= 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.strokeStyle = 'rgba(251,191,36,.5)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(28, 256); g.lineTo(190, 256); g.stroke();
    g.beginPath(); g.moveTo(322, 256); g.lineTo(484, 256); g.stroke();
    g.strokeStyle = 'rgba(34,211,238,.6)'; g.lineWidth = 3;
    g.strokeRect(226, 190, 60, 132);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(7, 7);
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }

  function shooterRustTexture() {
    var T = shooter.T;
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#3b211c'; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 260; i++) {
      g.fillStyle = 'rgba(' + (90 + Math.random() * 70) + ',' + (40 + Math.random() * 30) + ',28,.22)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 26, 2 + Math.random() * 8);
    }
    g.strokeStyle = 'rgba(10,10,12,.5)'; g.lineWidth = 3;
    for (var x = 16; x < 256; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 1);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  /* 枪械金属：拉丝 + 划痕 + 磨损边缘，贴在机匣和护木上 */
  function shooterMetalTexture() {
    var T = shooter.T;
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#20262e'; g.fillRect(0, 0, 256, 256);
    for (var y = 0; y < 256; y++) {
      g.strokeStyle = 'rgba(255,255,255,' + (.02 + Math.random() * .05) + ')';
      g.beginPath(); g.moveTo(0, y + .5); g.lineTo(256, y + .5); g.stroke();
    }
    for (var i = 0; i < 160; i++) {
      var x = Math.random() * 256, y2 = Math.random() * 256;
      g.strokeStyle = 'rgba(190,205,220,' + (.04 + Math.random() * .12) + ')';
      g.lineWidth = Math.random() * 1.4 + .3;
      g.beginPath(); g.moveTo(x, y2); g.lineTo(x + 6 + Math.random() * 26, y2 + (Math.random() - .5) * 3); g.stroke();
    }
    for (var j = 0; j < 5; j++) {
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 5, 0, 6.283); g.fill();
    }
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1, 1);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  /* 建筑外墙：混凝土板缝 + 窗户 + 空调外机 + 涂鸦 */
  function shooterFacadeTexture() {
    var T = shooter.T;
    var c = document.createElement('canvas'); c.width = 512; c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#2b3846'; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 2600; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (Math.random() * .03) + ')';
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    /* 混凝土板缝 */
    g.strokeStyle = 'rgba(8,14,20,.55)'; g.lineWidth = 4;
    for (var y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    for (var x = 0; x <= 512; x += 170) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    /* 窗 */
    for (var wy = 26; wy < 512; wy += 128) {
      for (var wx = 26; wx < 512; wx += 170) {
        var lit = Math.random();
        g.fillStyle = lit > .62 ? 'rgba(150,220,255,.5)' : 'rgba(10,18,26,.92)';
        g.fillRect(wx, wy, 92, 74);
        g.strokeStyle = 'rgba(120,150,175,.35)'; g.lineWidth = 3;
        g.strokeRect(wx, wy, 92, 74);
        g.beginPath(); g.moveTo(wx + 46, wy); g.lineTo(wx + 46, wy + 74); g.stroke();
        if (lit > .8) {
          g.fillStyle = 'rgba(255,224,170,.5)';
          g.fillRect(wx + 6, wy + 6, 34, 26);
        }
      }
    }
    /* 空调外机 / 管线 */
    g.fillStyle = 'rgba(120,132,145,.75)';
    g.fillRect(330, 300, 54, 40);
    g.strokeStyle = 'rgba(30,40,50,.9)'; g.lineWidth = 2; g.strokeRect(330, 300, 54, 40);
    g.fillStyle = 'rgba(150,160,172,.6)';
    for (var k = 0; k < 4; k++) g.fillRect(336, 306 + k * 8, 42, 3);
    /* 涂鸦 */
    g.strokeStyle = 'rgba(244,63,94,.5)'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(60, 430); g.quadraticCurveTo(120, 386, 168, 432); g.stroke();
    g.strokeStyle = 'rgba(34,211,238,.42)';
    g.beginPath(); g.moveTo(200, 452); g.lineTo(300, 404); g.stroke();
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }

  function shooterAddBox(x, y, z, w, h, d, mat, collide) {
    var T = shooter.T;
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    shooter.scene.add(m);
    if (collide !== false) {
      shooter.obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      shooter.blockers.push(m);
    }
    return m;
  }

  function shooterBuildMap() {
    var T = shooter.T;
    var scene = shooter.scene;

    var TH = shMapTheme();
    var floorMat = new T.MeshStandardMaterial({ map: shooterFloorTexture(), roughness: .58, metalness: .18, color: TH.floor });
    var floor = new T.Mesh(new T.PlaneGeometry(26, 26), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);

    var facadeTex = shooterFacadeTexture(); facadeTex.repeat.set(5, 1.6);
    var wallMat = new T.MeshStandardMaterial({ map: facadeTex, color: TH.wall, roughness: .74, metalness: .14 });
    var wallMat2 = new T.MeshStandardMaterial({ map: facadeTex, color: TH.wall, roughness: .76, metalness: .12 });
    var wallDark = shooterMat(TH.dark, .72, .2);
    var rustMat = new T.MeshStandardMaterial({ map: shooterRustTexture(), roughness: .66, metalness: .16 });
    var crateMat = shooterMat(TH.crate, .55, .2);
    var crateMat2 = shooterMat(TH.crate2, .66, .15);
    var neonCyan = new T.MeshBasicMaterial({ color: TH.neon });
    var neonRed = new T.MeshBasicMaterial({ color: TH.neon2 });
    scene.background = new T.Color(TH.sky);
    scene.fog = new T.FogExp2(TH.fog, TH.fogD);

    shooterAddBox(0, 2.3, -12.6, 26, 4.6, .8, wallMat);
    shooterAddBox(0, 2.3, 12.6, 26, 4.6, .8, wallMat);
    shooterAddBox(-12.6, 2.3, 0, .8, 4.6, 26, wallMat);
    shooterAddBox(12.6, 2.3, 0, .8, 4.6, 26, wallMat);

    shooteraAddNeon(-11.9, 3.1, -4, .06, .1, 3.2, neonCyan);
    shooteraAddNeon(11.9, 2.6, 4, .06, .1, 3.6, neonRed);
    shooteraAddNeon(0, 3.3, -11.9, 4.2, .1, .06, neonCyan);
    shooteraAddNeon(-11.9, 2.2, -8.6, .06, .08, 2.2, neonCyan);
    shooteraAddNeon(-11.9, 2.2, 5.6, .06, .08, 2.2, neonRed);
    shooteraAddNeon(11.9, 2.2, -6.4, .06, .08, 2.4, neonCyan);
    shooteraAddNeon(11.9, 2.2, 8.2, .06, .08, 2.0, neonRed);
    shooteraAddNeon(0, 3.9, 11.9, 4.0, .08, .06, neonRed);

    var panelMat = shooterMat(0x4b6078, .58, .12);
    var ribMat = shooterMat(0x18222e, .7, .15);
    for (var px = -8; px <= 8; px += 4) {
      var panel = new T.Mesh(new T.BoxGeometry(3.5, 2.7, .18), panelMat);
      panel.position.set(px, 2.15, -12.05); panel.receiveShadow = true; scene.add(panel);
      var rib = new T.Mesh(new T.BoxGeometry(.16, 4.1, .26), ribMat);
      rib.position.set(px + 1.85, 2.1, -12.02); scene.add(rib);
    }
    var base = new T.Mesh(new T.BoxGeometry(24, .1, .08), new T.MeshBasicMaterial({ color: 0x22d3ee }));
    base.position.set(0, .32, -12.0); scene.add(base);

    function shooteraAddNeon(x, y, z, w, h, d, mat) {
      var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); scene.add(m);
      var halo = new T.Mesh(new T.PlaneGeometry(w + 1.1, h + 1.1), new T.MeshBasicMaterial({
        map: shooterGlowTexture(), color: mat.color, transparent: true, opacity: .42,
        blending: T.AdditiveBlending, depthWrite: false
      }));
      halo.position.set(x, y, z + (z < 0 ? .07 : -.07));
      if (Math.abs(x) > 5) halo.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(halo);
    }

    shooterAddBox(-4.6, 1.35, -1.2, 5.0, 2.7, 3.1, rustMat);
    shooterAddBox(4.7, 1.2, 5.0, 3.6, 2.4, 2.6, crateMat2);
    shooterAddBox(3.8, .65, -.4, 1.3, 1.3, 1.3, crateMat);
    shooterAddBox(5.0, .45, 1.4, .9, .9, .9, crateMat);
    shooterAddBox(-2.4, .55, 4.9, 1.1, 1.1, 1.1, crateMat2);
    shooterAddBox(0, .6, 3.0, 5.2, 1.2, .38, wallDark);
    shooterAddBox(-7.4, .6, -6.0, 3.4, 1.2, .38, wallDark);
    shooterAddBox(8.2, .55, -6.6, 2.6, 1.1, .34, wallDark);
    shooterAddBox(-7.6, 2.3, 7.4, .85, 4.6, .85, wallMat);
    shooterAddBox(7.6, 2.3, 7.4, .85, 4.6, .85, wallMat);
    shooterAddBox(-7.6, 2.3, -7.4, .85, 4.6, .85, wallMat);
    shooterAddBox(7.6, 2.3, -7.4, .85, 4.6, .85, wallMat);
    shooterAddBox(-1.2, .35, -8.4, 2.2, .7, 1.0, crateMat);
    shooterAddBox(1.6, .35, -8.6, 1.1, .7, 1.0, crateMat2);

    /* ---------- 街景细节：落水管 / 空调 / 电缆 / 二层检修台 / 沙袋 / 油桶 / 路灯 ---------- */
    var pipeMat = shooterMat(0x2f3a46, .55, .55);
    var acMat = shooterMat(0x8693a1, .6, .38);
    for (var pi = 0; pi < 6; pi++) {
      var pipe = new T.Mesh(new T.CylinderGeometry(.075, .075, 4.4, 10), pipeMat);
      pipe.position.set(pi % 2 ? 12.05 : -12.05, 2.2, -9 + pi * 3.6);
      pipe.castShadow = true; scene.add(pipe);
      var clamp = new T.Mesh(new T.BoxGeometry(.1, .12, .34), pipeMat);
      clamp.position.set(pi % 2 ? 12.0 : -12.0, 1.1 + (pi % 3) * 1.2, -9 + pi * 3.6);
      scene.add(clamp);
    }
    for (var ai = 0; ai < 4; ai++) {
      var ac = new T.Mesh(new T.BoxGeometry(.42, .58, .72), acMat);
      ac.position.set(ai % 2 ? 12.0 : -12.0, 2.4 + (ai % 2) * .9, -7 + ai * 4.4);
      ac.castShadow = true; scene.add(ac);
      var fan = new T.Mesh(new T.CylinderGeometry(.22, .22, .04, 14), shooterMat(0x1c242e, .7, .3));
      fan.rotation.z = Math.PI / 2;
      fan.position.set(ai % 2 ? 11.78 : -11.78, 2.4 + (ai % 2) * .9, -7 + ai * 4.4);
      scene.add(fan);
    }
    /* 头顶电缆：几段下垂的细圆柱 */
    var wireMat = shooterMat(0x0d1319, .85, .1);
    for (var wi = 0; wi < 5; wi++) {
      var wire = new T.Mesh(new T.CylinderGeometry(.018, .018, 22, 6), wireMat);
      wire.rotation.z = Math.PI / 2;
      wire.rotation.y = (wi % 2 ? .18 : -.14);
      wire.position.set(0, 4.05 - wi * .12, -8 + wi * 4.2);
      scene.add(wire);
    }
    /* 左侧二层检修台 + 栏杆 */
    shooterAddBox(-10.6, 2.85, 0, 3.4, .18, 21, wallDark, false);
    for (var ri = 0; ri < 10; ri++) {
      var post = new T.Mesh(new T.BoxGeometry(.06, .95, .06), pipeMat);
      post.position.set(-9.0, 3.42, -10 + ri * 2.2); scene.add(post);
    }
    var rail = new T.Mesh(new T.BoxGeometry(.07, .07, 21), pipeMat);
    rail.position.set(-9.0, 3.9, 0); scene.add(rail);
    /* 沙袋掩体 */
    for (var si = 0; si < 3; si++) {
      var bag = new T.Mesh(new T.BoxGeometry(1.5, .32, .5), shooterMat(0x4a4636, .88, .04));
      bag.position.set(-4.9 + si * .12, .16 + si * .3, 6.6 + (si % 2) * .1);
      bag.rotation.y = (Math.random() - .5) * .12;
      bag.castShadow = true; bag.receiveShadow = true; scene.add(bag);
    }
    /* 油桶 */
    for (var bi = 0; bi < 3; bi++) {
      var drum = new T.Mesh(new T.CylinderGeometry(.32, .32, .92, 16), rustMat);
      drum.position.set(6.6 + bi * .78, .46, -2.6 + (bi % 2) * .9);
      drum.castShadow = true; drum.receiveShadow = true; scene.add(drum);
      var ring = new T.Mesh(new T.TorusGeometry(.32, .022, 6, 18), pipeMat);
      ring.rotation.x = Math.PI / 2; ring.position.set(drum.position.x, .72, drum.position.z);
      scene.add(ring);
      shooter.obstacles.push({ minX: drum.position.x - .34, maxX: drum.position.x + .34, minZ: drum.position.z - .34, maxZ: drum.position.z + .34 });
      shooter.blockers.push(drum);
    }
    /* 路灯柱 + 灯罩 */
    for (var li = 0; li < 2; li++) {
      var pole = new T.Mesh(new T.CylinderGeometry(.07, .09, 4.2, 10), pipeMat);
      pole.position.set(li ? 11.2 : -11.2, 2.1, 2.5 - li * 7);
      pole.castShadow = true; scene.add(pole);
      var head = new T.Mesh(new T.ConeGeometry(.34, .3, 12, 1, true), shooterMat(0x39424d, .7, .3));
      head.position.set(pole.position.x, 4.2, pole.position.z); scene.add(head);
      var bulb = new T.Mesh(new T.SphereGeometry(.12, 10, 8), new T.MeshBasicMaterial({ color: 0xffe6b0 }));
      bulb.position.set(pole.position.x, 4.05, pole.position.z); scene.add(bulb);
    }

    for (var i = 0; i < 6; i++) {
      var beam = new T.Mesh(new T.BoxGeometry(25, .18, .18), shooterMat(0x16202b, .5, .8));
      beam.position.set(0, 4.45, -9 + i * 3.6);
      scene.add(beam);
    }

    var shaftMat = new T.MeshBasicMaterial({
      color: 0x67e8f9, transparent: true, opacity: .045, side: T.DoubleSide,
      blending: T.AdditiveBlending, depthWrite: false
    });
    var shaft1 = new T.Mesh(new T.ConeGeometry(2.3, 7.6, 20, 1, true), shaftMat);
    shaft1.position.set(-8, 4.8, -7); scene.add(shaft1);
    var shaft2 = new T.Mesh(new T.ConeGeometry(1.9, 7.2, 20, 1, true), shaftMat);
    shaft2.position.set(8.5, 4.7, 6.5); scene.add(shaft2);

    var starGeo = new T.BufferGeometry();
    var starPos = new Float32Array(260 * 3);
    for (var s = 0; s < 260; s++) {
      var ang = Math.random() * Math.PI * 2, rad = 30 + Math.random() * 26;
      starPos[s * 3] = Math.cos(ang) * rad;
      starPos[s * 3 + 1] = 10 + Math.random() * 26;
      starPos[s * 3 + 2] = Math.sin(ang) * rad;
    }
    starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
    scene.add(new T.Points(starGeo, new T.PointsMaterial({ color: 0x9fd8ff, size: .22, sizeAttenuation: true, transparent: true, opacity: .8, depthWrite: false })));

    var towerMat = shooterMat(0x121b27, .8, .1);
    var winMat = new T.MeshBasicMaterial({ color: 0x6fd8ff });
    for (var tw = 0; tw < 9; tw++) {
      var tx = -24 + tw * 6.2;
      var th = 8 + (tw % 4) * 3.4;
      var tz = -19 - (tw % 3) * 3.5;
      var tower = new T.Mesh(new T.BoxGeometry(3.2, th, 3.2), towerMat);
      tower.position.set(tx, th / 2, tz); scene.add(tower);
      var win = new T.Mesh(new T.BoxGeometry(2.6, .08, .06), winMat);
      win.position.set(tx, th * .72, tz + 1.62); scene.add(win);
      var win2 = new T.Mesh(new T.BoxGeometry(.06, .08, 2.4), winMat);
      win2.position.set(tx + 1.62, th * .52, tz); scene.add(win2);
    }

    var moon = new T.Mesh(new T.SphereGeometry(2.2, 20, 20), new T.MeshBasicMaterial({ color: 0xc7ecff }));
    moon.position.set(-18, 24, -30); scene.add(moon);
    var moonGlow = new T.Mesh(new T.PlaneGeometry(10, 10), new T.MeshBasicMaterial({
      map: shooterGlowTexture(), color: 0x9fd8ff, transparent: true, opacity: .35,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    moonGlow.position.set(-18, 24, -29.9); scene.add(moonGlow);

    var hemi = new T.HemisphereLight(TH.hemiSky, TH.hemiGround, 1.25);
    shooter.hemiLight = hemi;
    scene.add(hemi);
    scene.add(new T.AmbientLight(0x7d95ad, 1.15));
    var sun = new T.DirectionalLight(0xd8ecff, 3.4);
    sun.position.set(9, 16, 7); sun.castShadow = shooter.cfg.quality !== 'low';
    sun.color.setHex(TH.sun); sun.intensity = TH.sunI;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    shooter.keyLight = sun;
    var p1 = new T.PointLight(0x22d3ee, 38, 20, 1.9); p1.position.set(-9, 3.4, -8); scene.add(p1);
    var p2 = new T.PointLight(0xf43f5e, 30, 17, 1.9); p2.position.set(9, 2.8, 7); scene.add(p2);
    var p3 = new T.PointLight(0xffd28a, 20, 14, 1.8); p3.position.set(0, 3.0, 2); scene.add(p3);
    var fill = new T.PointLight(0x9fc7ff, 34, 22, 1.7); fill.position.set(0, 3.6, 6.6); scene.add(fill);
  }

  function shooterBuildWeapon() {
    var T = shooter.T;
    var g = new T.Group();
    var metalMap = shooterMetalTexture(); metalMap.repeat.set(2, 1);
    var metal = new T.MeshStandardMaterial({ color: 0x74828f, roughness: .5, metalness: .42 });
    var poly = new T.MeshStandardMaterial({ color: 0x39424c, roughness: .78, metalness: .14 });
    var steel = new T.MeshStandardMaterial({ color: 0x66727e, roughness: .38, metalness: .62 });
    var accent = new T.MeshBasicMaterial({ color: 0x67e8f9 });
    var sk = shSkin();
    metal.color.setHex(sk.trim);
    poly.color.setHex(sk.vest);

    function box(w, h, d, mat, x, y, z, rx) {
      var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      m.castShadow = true;
      g.add(m);
      return m;
    }
    /* 机匣 + 上机匣导轨 */
    box(.19, .16, .58, metal, 0, 0, -.2);
    box(.16, .05, .5, steel, 0, .105, -.24);
    for (var ri = 0; ri < 9; ri++) box(.09, .022, .026, steel, 0, .135, -.44 + ri * .05);
    /* 抛壳口 + 拉机柄 */
    box(.02, .075, .17, poly, .095, .012, -.14);
    box(.05, .03, .1, steel, .1, .07, .02);
    /* 护木（带散热孔） */
    box(.165, .14, .34, poly, 0, -.005, -.62);
    for (var hi = 0; hi < 4; hi++) box(.17, .028, .05, steel, 0, .015 - hi * .042, -.55);
    /* 枪管 + 消焰器 */
    var barrel = new T.Mesh(new T.CylinderGeometry(.026, .024, .52, 12), steel);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .015, -.95); barrel.castShadow = true; g.add(barrel);
    var brake = new T.Mesh(new T.CylinderGeometry(.042, .036, .1, 12), steel);
    brake.rotation.x = Math.PI / 2; brake.position.set(0, .015, -1.2); g.add(brake);
    for (var bi = 0; bi < 3; bi++) box(.075, .012, .022, poly, 0, .015 + (bi - 1) * .026, -1.22);
    /* 导气箍 + 前准星 */
    box(.06, .08, .06, steel, 0, .05, -.82);
    box(.02, .07, .02, steel, 0, .11, -.8);
    /* 弹匣（两段弯度） */
    var mag1 = new T.Mesh(new T.BoxGeometry(.085, .16, .12), poly);
    mag1.position.set(0, -.15, -.14); mag1.rotation.x = .1; mag1.castShadow = true; g.add(mag1);
    var mag2 = new T.Mesh(new T.BoxGeometry(.082, .16, .11), poly);
    mag2.position.set(0, -.29, -.155); mag2.rotation.x = .28; mag2.castShadow = true; g.add(mag2);
    /* 握把 + 扳机护圈 */
    var grip = new T.Mesh(new T.BoxGeometry(.08, .21, .11), poly);
    grip.position.set(0, -.15, .07); grip.rotation.x = -.32; grip.castShadow = true; g.add(grip);
    var guard = new T.Mesh(new T.TorusGeometry(.05, .008, 6, 14, Math.PI), steel);
    guard.position.set(0, -.085, -.03); guard.rotation.set(0, Math.PI / 2, Math.PI); g.add(guard);
    /* 枪托 + 贴腮板 */
    box(.11, .13, .3, poly, 0, -.005, .26);
    box(.085, .06, .22, metal, 0, .07, .22);
    /* 战术配件：手电 + 激光 */
    var torch = new T.Mesh(new T.CylinderGeometry(.028, .03, .18, 10), steel);
    torch.rotation.x = Math.PI / 2; torch.position.set(-.1, -.02, -.7); g.add(torch);
    var laserDot = new T.Mesh(new T.BoxGeometry(.014, .014, .022), new T.MeshBasicMaterial({ color: 0xff3b6b }));
    laserDot.position.set(-.1, -.055, -.79); g.add(laserDot);
    /* 侧导轨发光条（保留游戏感） */
    box(.012, .03, .3, accent, -.099, -.005, -.6);
    /* 红点镜 */
    box(.06, .08, .1, steel, 0, .17, -.16);
    var lens = new T.Mesh(new T.CircleGeometry(.026, 16), new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .55 }));
    lens.position.set(0, .175, -.21); g.add(lens);
    var dot = new T.Mesh(new T.SphereGeometry(.008, 8, 8), new T.MeshBasicMaterial({ color: 0xff2d55 }));
    dot.position.set(0, .175, -.2); g.add(dot);

    var flashMat = new T.MeshBasicMaterial({
      map: shooterGlowTexture(), color: 0xffd28a, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false
    });
    var flash = new T.Mesh(new T.PlaneGeometry(.55, .55), flashMat);
    flash.position.set(0, .015, -1.28); g.add(flash);
    var flashLight = new T.PointLight(0xffca7a, 0, 5, 2); flashLight.position.set(0, .05, -1.1); g.add(flashLight);

    /* 狙击枪拉长、冲锋枪缩短：整组缩放的视觉差异足够，还不用重建模型 */
    var glen = shGun().len || 1;
    g.position.set(.215, -.265, -.74);
    g.rotation.set(.02, -.09, -.03);
    g.scale.set(.2, .2, .2 * glen);
    shooter.camera.add(g);
    shooter.weapon = g;
    shooter.flash = flash;
    shooter.flashLight = flashLight;
    shooter.muzzle = new T.Object3D(); shooter.muzzle.position.set(0, .015, -1.26 * glen); g.add(shooter.muzzle);
  }

  function shooterBuildSparks() {
    var T = shooter.T;
    var N = 320;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3);
    var col = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) { pos[i * 3 + 1] = -100; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    var mat = new T.PointsMaterial({
      size: .075, vertexColors: true, transparent: true, opacity: .95,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    var pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    shooter.scene.add(pts);
    shooter.sparks = pts;
    shooter.sparkData = [];
    for (var j = 0; j < N; j++) shooter.sparkData.push({ life: 0, vx: 0, vy: 0, vz: 0 });
    shooter.sparkCursor = 0;
  }

  function shooterSpawnSparks(p, color, count) {
    if (!shooter.sparks) return;
    var T = shooter.T;
    var posAttr = shooter.sparks.geometry.attributes.position;
    var colAttr = shooter.sparks.geometry.attributes.color;
    var c = new T.Color(color);
    for (var i = 0; i < count; i++) {
      var idx = shooter.sparkCursor % shooter.sparkData.length;
      shooter.sparkCursor++;
      var d = shooter.sparkData[idx];
      d.life = .25 + Math.random() * .35;
      d.vx = (Math.random() - .5) * 5;
      d.vy = Math.random() * 4 + .6;
      d.vz = (Math.random() - .5) * 5;
      posAttr.setXYZ(idx, p.x, p.y, p.z);
      colAttr.setXYZ(idx, c.r, c.g, c.b);
    }
    posAttr.needsUpdate = true; colAttr.needsUpdate = true;
  }

  function shooterTracer(a, b, color) {
    var T = shooter.T;
    var dir = b.clone().sub(a);
    var len = dir.length();
    if (len < .02) return;
    var geo = new T.CylinderGeometry(.012, .012, len, 6, 1, true);
    var mat = new T.MeshBasicMaterial({
      color: color, transparent: true, opacity: .95,
      blending: T.AdditiveBlending, depthWrite: false
    });
    var m = new T.Mesh(geo, mat);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    shooter.scene.add(m);
    shooter.tracers.push({ mesh: m, life: .075, max: .075 });
  }

  function shooterHealthSprite() {
    var T = shooter.T;
    var c = document.createElement('canvas'); c.width = 72; c.height = 10;
    var ctx = c.getContext('2d');
    var tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    var spr = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(.95, .13, 1);
    spr.position.y = 2.12;
    return { sprite: spr, ctx: ctx, tex: tex, w: 72 };
  }

  function shooterDrawHealth(e) {
    var g = e.bar.ctx, w = e.bar.w;
    g.clearRect(0, 0, w, 10);
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(0, 0, w, 10);
    var k = Math.max(0, e.hp / e.maxHp);
    var grd = g.createLinearGradient(0, 0, w, 0);
    if (k > .5) { grd.addColorStop(0, '#22d3ee'); grd.addColorStop(1, '#34d399'); }
    else if (k > .22) { grd.addColorStop(0, '#fbbf24'); grd.addColorStop(1, '#f97316'); }
    else { grd.addColorStop(0, '#f87171'); grd.addColorStop(1, '#dc2626'); }
    g.fillStyle = grd; g.fillRect(1, 1, Math.max(0, (w - 2) * k), 8);
    e.bar.tex.needsUpdate = true;
  }

  function shooterSpawnEnemy() {
    var T = shooter.T;
    var e = {
      hp: 0, maxHp: 0, speed: 1.25 + shooter.wave * .07, seed: Math.random() * 9,
      dead: false, cd: 2.0 + Math.random() * 1.4, los: false, losT: 0, flash: 0,
      parts: [], mats: [], walk: Math.random() * 6, gun: null
    };
    e.maxHp = 60 + shooter.wave * 18;
    e.hp = e.maxHp;

    /* 每个目标随机一套迷彩，避免一排一模一样的方块人 */
    var PALETTE = [
      { armor: 0x4d5f74, cloth: 0x1c2634, vest: 0x36434f },  /* 城市灰蓝 */
      { armor: 0x6b5f45, cloth: 0x2b2620, vest: 0x4a4232 },  /* 沙漠土黄 */
      { armor: 0x3d4d3d, cloth: 0x202a20, vest: 0x2f3d2e }   /* 林地绿 */
    ];
    var pal = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    var armor = new T.MeshStandardMaterial({ color: pal.armor, roughness: .5, metalness: .3 });
    var cloth = new T.MeshStandardMaterial({ color: pal.cloth, roughness: .82, metalness: .05 });
    var vestM = new T.MeshStandardMaterial({ color: pal.vest, roughness: .64, metalness: .16 });
    var skinM = new T.MeshStandardMaterial({ color: 0x3a3f47, roughness: .85, metalness: .04 });
    var gunMetal = new T.MeshStandardMaterial({ color: 0x14181f, roughness: .4, metalness: .78 });
    var visor = new T.MeshStandardMaterial({ color: 0xff2d55, emissive: 0xff2d55, emissiveIntensity: 3.2, roughness: .2, metalness: .2 });
    e.mats = [armor, cloth, visor];

    var g = new T.Group();

    function part(geo, mat, x, y, z, opt) {
      opt = opt || {};
      var m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (opt.rx) m.rotation.x = opt.rx;
      if (opt.ry) m.rotation.y = opt.ry;
      if (opt.rz) m.rotation.z = opt.rz;
      m.castShadow = true;
      m.userData.enemy = e;
      if (opt.head) m.userData.head = true;
      (opt.parent || g).add(m);
      e.parts.push(m);
      return m;
    }
    function pivot(x, y, z) {
      var pv = new T.Group();
      pv.position.set(x, y, z);
      g.add(pv);
      return pv;
    }

    /* ---------- 躯干 ---------- */
    part(new T.BoxGeometry(.44, .58, .26), vestM, 0, 1.2, 0);              /* 战术背心 */
    part(new T.BoxGeometry(.46, .2, .29), armor, 0, 1.37, .01);            /* 胸甲 */
    part(new T.BoxGeometry(.15, .11, .08), cloth, -.12, 1.13, .15);        /* 弹匣袋 */
    part(new T.BoxGeometry(.15, .11, .08), cloth, .12, 1.13, .15);
    part(new T.BoxGeometry(.1, .14, .1), cloth, .13, 1.27, .14);           /* 对讲机 */
    part(new T.BoxGeometry(.3, .34, .17), cloth, 0, 1.3, -.2);             /* 背包 */
    part(new T.BoxGeometry(.32, .06, .17), armor, 0, 1.44, -.2);           /* 背包顶盖 */
    part(new T.BoxGeometry(.34, .16, .24), cloth, 0, .94, 0);              /* 胯部 */
    part(new T.BoxGeometry(.5, .1, .3), armor, 0, 1.44, 0);                /* 肩甲带 */
    part(new T.BoxGeometry(.37, .07, .25), gunMetal, 0, 1.045, 0);         /* 战术腰带 */
    part(new T.BoxGeometry(.09, .1, .08), vestM, -.13, 1.0, .13);          /* 腰包 */
    part(new T.BoxGeometry(.09, .1, .08), vestM, .13, 1.0, .13);
    part(new T.BoxGeometry(.03, .34, .02), cloth, -.09, 1.24, .135);       /* 胸口织带 */
    part(new T.BoxGeometry(.03, .34, .02), cloth, .09, 1.24, .135);
    part(new T.BoxGeometry(.12, .06, .1), gunMetal, 0, 1.47, .1);          /* 颈前挂件 */

    /* ---------- 头 ---------- */
    part(new T.CylinderGeometry(.068, .082, .1, 10), skinM, 0, 1.52, 0);
    part(new T.SphereGeometry(.122, 18, 14), skinM, 0, 1.63, 0, { head: true });
    part(new T.SphereGeometry(.147, 18, 12, 0, Math.PI * 2, 0, Math.PI * .62), armor, 0, 1.645, -.004, { head: true }); /* 头盔 */
    part(new T.CylinderGeometry(.152, .152, .022, 18), armor, 0, 1.588, .012, { head: true });  /* 头盔檐 */
    part(new T.BoxGeometry(.19, .058, .05), visor, 0, 1.635, .108, { head: true });   /* 护目镜 */
    part(new T.BoxGeometry(.155, .085, .055), cloth, 0, 1.573, .095, { head: true }); /* 战术面罩 */
    part(new T.CylinderGeometry(.012, .012, .15, 6), gunMetal, .095, 1.71, -.03, { head: true }); /* 天线 */

    /* ---------- 腿（带枢轴，能走路） ---------- */
    function leg(sign) {
      var pv = pivot(.12 * sign, .94, 0);
      part(new T.CylinderGeometry(.095, .085, .42, 10), cloth, 0, -.21, 0, { parent: pv });
      part(new T.SphereGeometry(.085, 10, 8), armor, 0, -.42, .01, { parent: pv });          /* 护膝 */
      part(new T.CylinderGeometry(.08, .065, .4, 10), cloth, 0, -.62, 0, { parent: pv });
      part(new T.BoxGeometry(.16, .12, .28), gunMetal, 0, -.86, .04, { parent: pv });        /* 作战靴 */
      return pv;
    }
    var legL = leg(-1), legR = leg(1);

    /* ---------- 手臂（左臂摆动，右臂持枪） ---------- */
    function arm(sign, holdGun) {
      var pv = pivot(.255 * sign, 1.4, 0);
      part(new T.CylinderGeometry(.072, .065, .3, 10), cloth, 0, -.16, 0, { parent: pv });
      part(new T.SphereGeometry(.078, 12, 10), armor, 0, -.02, 0, { parent: pv });   /* 护肩 */
      part(new T.BoxGeometry(.02, .22, .02), cloth, .05 * sign, -.18, .055, { parent: pv }); /* 臂带 */
      var fore = new T.Group(); fore.position.set(0, -.32, 0); pv.add(fore);
      part(new T.CylinderGeometry(.062, .055, .3, 10), cloth, 0, -.14, 0, { parent: fore });
      part(new T.BoxGeometry(.09, .11, .1), gunMetal, 0, -.3, .02, { parent: fore }); /* 战术手套 */
      if (holdGun) { pv.rotation.x = -1.15; pv.rotation.z = -.12; fore.rotation.x = .5; }
      else { pv.rotation.z = .1; }
      return pv;
    }
    var armL = arm(-1, false), armR = arm(1, true);

    /* ---------- 步枪 ---------- */
    var gunGroup = new T.Group();
    gunGroup.position.set(.13, 1.28, .3);
    g.add(gunGroup);
    var gunBody = new T.Mesh(new T.BoxGeometry(.075, .1, .44), gunMetal);
    gunBody.castShadow = true; gunBody.userData.enemy = e; gunGroup.add(gunBody); e.parts.push(gunBody);
    var barrel = new T.Mesh(new T.CylinderGeometry(.022, .02, .34, 10), gunMetal);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .01, .36);
    barrel.userData.enemy = e; gunGroup.add(barrel); e.parts.push(barrel);
    var mag = new T.Mesh(new T.BoxGeometry(.05, .17, .1), cloth);
    mag.position.set(0, -.12, .02); mag.userData.enemy = e; gunGroup.add(mag); e.parts.push(mag);
    var stock = new T.Mesh(new T.BoxGeometry(.06, .09, .2), gunMetal);
    stock.position.set(0, -.01, -.3); stock.userData.enemy = e; gunGroup.add(stock); e.parts.push(stock);
    var optic = new T.Mesh(new T.BoxGeometry(.04, .05, .12), gunMetal);
    optic.position.set(0, .08, .02); optic.userData.enemy = e; gunGroup.add(optic); e.parts.push(optic);
    var tip = new T.Mesh(new T.BoxGeometry(.05, .05, .05), new T.MeshBasicMaterial({ color: 0xff9f43 }));
    tip.position.set(.13, 1.29, .86); tip.userData.enemy = e; g.add(tip); e.parts.push(tip);

    e.group = g; e.gun = gunBody; e.tip = tip;
    e.armL = armL; e.armR = armR; e.legL = legL; e.legR = legR; e.gunGroup = gunGroup;
    e.bar = shooterHealthSprite(); g.add(e.bar.sprite);
    shooterDrawHealth(e);

    var pts = [[-9, 9], [9, 9], [-9, -9], [9, -9], [0, -9.5], [-9.5, 0], [9.5, 0], [0, 9.5], [-2.6, -6.3], [2.6, -6.3], [0, -5.6]];
    var ok = pts.filter(function (p) {
      var dx = p[0] - shooter.playerX, dz = p[1] - shooter.playerZ;
      return Math.sqrt(dx * dx + dz * dz) > 7 && shooterPointFree(p[0], p[1], .9);
    });
    if (!ok.length) ok = [[-9, 9]];
    var p = ok[Math.floor(Math.random() * ok.length)];
    g.position.set(p[0] + (Math.random() - .5) * 1.0, 0, p[1] + (Math.random() - .5) * 1.0);
    g.scale.setScalar(1.04);
    g.rotation.y = Math.atan2(-g.position.x, -g.position.z);
    shooter.scene.add(g);
    shooter.enemies.push(e);
    for (var i = 0; i < e.parts.length; i++) shooter.meshes.push(e.parts[i]);
  }

  function shooterPointFree(x, z, r) {
    for (var i = 0; i < shooter.obstacles.length; i++) {
      var b = shooter.obstacles[i];
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return false;
    }
    return true;
  }

  function shooterMoveCircle(pos, dx, dz, r) {
    var i, b;
    pos.x += dx;
    for (i = 0; i < shooter.obstacles.length; i++) {
      b = shooter.obstacles[i];
      if (pos.x + r > b.minX && pos.x - r < b.maxX && pos.z + r > b.minZ && pos.z - r < b.maxZ) {
        if (dx > 0) pos.x = b.minX - r; else if (dx < 0) pos.x = b.maxX + r;
      }
    }
    pos.z += dz;
    for (i = 0; i < shooter.obstacles.length; i++) {
      b = shooter.obstacles[i];
      if (pos.x + r > b.minX && pos.x - r < b.maxX && pos.z + r > b.minZ && pos.z - r < b.maxZ) {
        if (dz > 0) pos.z = b.minZ - r; else if (dz < 0) pos.z = b.maxZ + r;
      }
    }
    pos.x = Math.max(-11.6, Math.min(11.6, pos.x));
    pos.z = Math.max(-11.6, Math.min(11.6, pos.z));
  }

  function shooterLineOfSight(from, to) {
    var T = shooter.T;
    var dir = to.clone().sub(from);
    var dist = dir.length();
    if (dist < .1) return true;
    dir.normalize();
    var ray = new T.Raycaster(from, dir, .1, dist);
    var hits = ray.intersectObjects(shooter.blockers, false);
    return !hits.length;
  }

  function shooterSpawnWave() {
    shooter.wave++;
    shooter.pendingWave = 0;
    shooter.meshes = [];
    shooter.enemies = [];
    var n = Math.min(2 + shooter.wave, 8);
    for (var i = 0; i < n; i++) shooterSpawnEnemy();
    shooterSetHud();
    shooterShowKill('第 ' + shooter.wave + ' 波 · ' + n + ' 个目标');
  }

  function shooterSetHud() {
    if (!shEl.ammo) return;
    shEl.wave.textContent = String(Math.max(1, shooter.wave));
    shEl.score.textContent = String(shooter.score);
    shEl.best.textContent = String(shooter.best);
    shEl.hp.textContent = String(Math.max(0, Math.round(shooter.hp)));
    shEl.hpBar.style.width = Math.max(0, Math.min(100, shooter.hp)) + '%';
    shEl.ammo.textContent = String(shooter.ammo);
    shEl.ammoState.textContent = shooter.reloadLeft > 0 ? '换弹中…' : (shooter.ammo === 0 ? '弹匣已空' : '突击步枪');
  }

  function shooterShowKill(text) {
    if (!shEl.kill) return;
    shEl.kill.textContent = text;
    shEl.kill.classList.add('on');
    clearTimeout(shooter.killTimer);
    shooter.killTimer = setTimeout(function () { shEl.kill.classList.remove('on'); }, 1400);
  }

  function shooterHitMark() {
    shEl.hit.classList.add('on');
    clearTimeout(shooter.hitTimer);
    shooter.hitTimer = setTimeout(function () { shEl.hit.classList.remove('on'); }, 110);
  }

  function shooterAudioInit() {
    if (shooter.audio) { if (shooter.audio.state === 'suspended') shooter.audio.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      var ctx = new AC();
      var master = ctx.createGain(); master.gain.value = .22; master.connect(ctx.destination);
      shooter.audio = ctx; shooter.master = master;
      var len = Math.floor(ctx.sampleRate * .22);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      shooter.noise = buf;
    } catch (e) { /* 忽略音频失败 */ }
  }

  function shooterSfx(kind) {
    var ctx = shooter.audio;
    if (!ctx || !shooter.master) return;
    var t = ctx.currentTime;
    if (kind === 'shot' || kind === 'enemy') {
      var src = ctx.createBufferSource(); src.buffer = shooter.noise;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = kind === 'shot' ? 2400 : 1100;
      var g = ctx.createGain();
      g.gain.setValueAtTime(kind === 'shot' ? .55 : .2, t);
      g.gain.exponentialRampToValueAtTime(.001, t + .14);
      src.connect(lp); lp.connect(g); g.connect(shooter.master);
      src.start(t); src.stop(t + .16);
      var osc = ctx.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(kind === 'shot' ? 120 : 80, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + .12);
      var og = ctx.createGain(); og.gain.setValueAtTime(.28, t);
      og.gain.exponentialRampToValueAtTime(.001, t + .13);
      osc.connect(og); og.connect(shooter.master);
      osc.start(t); osc.stop(t + .14);
    } else if (kind === 'hit') {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(1350, t); o.frequency.exponentialRampToValueAtTime(900, t + .06);
      var hg = ctx.createGain(); hg.gain.setValueAtTime(.18, t);
      hg.gain.exponentialRampToValueAtTime(.001, t + .07);
      o.connect(hg); hg.connect(shooter.master); o.start(t); o.stop(t + .08);
    } else if (kind === 'reload') {
      var r1 = ctx.createOscillator(); r1.type = 'square';
      r1.frequency.setValueAtTime(180, t); var rg = ctx.createGain();
      rg.gain.setValueAtTime(.1, t); rg.gain.exponentialRampToValueAtTime(.001, t + .05);
      r1.connect(rg); rg.connect(shooter.master); r1.start(t); r1.stop(t + .06);
    }
  }

  function shooterReload() {
    if (!shooter.running || shooter.reloadLeft > 0 || shooter.ammo >= shooter.mag) return;
    shooter.reloadLeft = 1.45;
    shooter.firing = false;
    shooterSfx('reload');
    shooterSetHud();
  }

  function shooterTryShoot() {
    if (!shooter.running || shooter.over || shooter.reloadLeft > 0 || shooter.fireCd > 0) return;
    if (shooter.ammo <= 0) { shooterReload(); return; }
    var T = shooter.T;
    var gun = shGun();
    shooter.ammo--;
    shooter.fireCd = gun.cd;
    shooter.recoil = Math.min(1.5, shooter.recoil + .6);
    shooter.pitch = Math.min(1.25, shooter.pitch + .0035);
    shooterAudioInit();
    shooterSfx('shot');
    if (shooter.flash) { shooter.flash.material.opacity = 1; shooter.flash.rotation.z = Math.random() * 6.28; }
    if (shooter.flashLight) shooter.flashLight.intensity = 14;

    var cam = shooter.camera;
    var dir = new T.Vector3(); cam.getWorldDirection(dir);
    var origin = cam.position.clone();
    var rc = new T.Raycaster(origin, dir, .1, 70);
    var targets = shooter.meshes.concat(shooter.blockers);
    var hits = rc.intersectObjects(targets, false);
    var hit = hits.length ? hits[0] : null;
    var end = hit ? hit.point.clone() : origin.clone().add(dir.multiplyScalar(60));
    var mpos = new T.Vector3(); shooter.muzzle.getWorldPosition(mpos);
    shooterTracer(mpos, end, 0xffe1a3);

    if (hit) {
      var enemy = hit.object.userData.enemy;
      if (enemy && !enemy.dead) {
        var head = !!hit.object.userData.head;
        enemy.hp -= head ? gun.head : gun.dmg;
        enemy.flash = .09;
        shooterDrawHealth(enemy);
        shooterHitMark();
        shooterSfx('hit');
        shooterSpawnSparks(hit.point, head ? 0xffd166 : 0x9ad8ff, 8);
        if (enemy.hp <= 0) shooterKillEnemy(enemy, head);
      } else {
        shooterSpawnSparks(hit.point, 0x9ad8ff, 5);
      }
    }
    if (shooter.ammo === 0) shooterReload();
    shooterSetHud();
  }

  function shooterDisposeEnemy(e) {
    if (!e || e.disposed) return;
    e.disposed = true;
    if (e.group && e.group.parent) shooter.scene.remove(e.group);
    for (var i = 0; i < e.parts.length; i++) {
      if (e.parts[i].geometry) e.parts[i].geometry.dispose();
    }
    for (var j = 0; j < e.mats.length; j++) e.mats[j].dispose();
    if (e.bar) {
      e.bar.tex.dispose();
      if (e.bar.sprite.material) e.bar.sprite.material.dispose();
    }
  }

  function shooterKillEnemy(e, head) {
    if (e.dead) return;
    e.dead = true;
    var idx = shooter.enemies.indexOf(e);
    if (idx >= 0) shooter.enemies.splice(idx, 1);
    for (var i = 0; i < e.parts.length; i++) {
      var mi = shooter.meshes.indexOf(e.parts[i]);
      if (mi >= 0) shooter.meshes.splice(mi, 1);
    }
    var p = e.group.position.clone(); p.y = 1.1;
    shooterSpawnSparks(p, 0xffa94d, 24);
    shooterDisposeEnemy(e);
    var add = head ? 150 : 100;
    shooter.score += add;
    if (shooter.score > shooter.best) { shooter.best = shooter.score; LS.setItem('u-shooter-best', String(shooter.best)); }
    shooterShowKill((head ? '爆头 ' : '击倒 ') + '+' + add);
    shooterSetHud();
  }

  function shooterDamage(n) {
    if (!shooter.running || shooter.over) return;
    shooter.hp -= n;
    shooter.hurtAt = shooter.time;
    if (shooter.hp <= 0) { shooter.hp = 0; shooterGameOver(); return; }
    shEl.dmg.classList.add('on');
    clearTimeout(shooter.dmgTimer);
    shooter.dmgTimer = setTimeout(function () { shEl.dmg.classList.remove('on'); }, 190);
    shooterSetHud();
  }

  function shooterGameOver() {
    shooter.running = false;
    shooter.over = true;
    shooter.firing = false;
    shooter.keys = {};
    if (document.pointerLockElement === shooter.canvas) document.exitPointerLock();
    if (shooter.raf) cancelAnimationFrame(shooter.raf);
    shooter.raf = 0;
    shEl.overTitle.textContent = '行动结束';
    shEl.overSub.textContent = '得分 ' + shooter.score + ' · 坚持到第 ' + Math.max(1, shooter.wave) + ' 波';
    shEl.over.classList.add('on');
    shooterSetHud();
  }

  function shooterReset() {
    var i;
    for (i = 0; i < shooter.enemies.length; i++) shooterDisposeEnemy(shooter.enemies[i]);
    shooter.enemies = []; shooter.meshes = [];
    for (i = 0; i < shooter.tracers.length; i++) {
      if (shooter.tracers[i].mesh.parent) shooter.scene.remove(shooter.tracers[i].mesh);
      shooter.tracers[i].mesh.geometry.dispose(); shooter.tracers[i].mesh.material.dispose();
    }
    shooter.tracers = [];
    if (shooter.sparks) {
      var pa = shooter.sparks.geometry.attributes.position;
      for (i = 0; i < shooter.sparkData.length; i++) { shooter.sparkData[i].life = 0; pa.setY(i, -100); }
      pa.needsUpdate = true;
    }
    shooter.mag = shGun().mag;
    shooter.hp = 100; shooter.ammo = shooter.mag; shooter.reloadLeft = 0;
    shooter.fireCd = 0; shooter.recoil = 0; shooter.wave = 0; shooter.score = 0;
    shooter.pendingWave = 0; shooter.over = false; shooter.hurtAt = -99;
    shooter.yaw = 0; shooter.pitch = 0; shooter.moveX = shooter.moveY = 0;
    shooter.playerX = 0; shooter.playerZ = 9.4;
    shooter.camera.position.set(0, 1.65, 9.4);
    shooter.camera.rotation.set(0, 0, 0);
    shooter.weapon.position.set(.26, -.34, -.98);
    shooter.weapon.rotation.set(0, -.06, 0);
    shooter.flash.material.opacity = 0; shooter.flashLight.intensity = 0;
    shooterSpawnWave();
    shooterSetHud();
  }

  function shooterBegin() {
    if (!shooter.built) return;
    shooterAudioInit();
    shooterReset();
    shEl.start.classList.remove('on');
    shEl.over.classList.remove('on');
    shEl.dmg.classList.remove('on');
    shooter.running = true;
    shooter.paused = false;
    shooter.ads = false;
    if (shooter.stage) { shooter.stage.classList.remove('paused'); shooter.stage.classList.remove('ads'); }
    var optPanel = $('#shOpts'); if (optPanel) optPanel.classList.remove('open');
    shApplyFloatMode();
    shooter.last = performance.now();
    if (!shooter.raf) shooter.raf = requestAnimationFrame(shooterLoop);
    shooterSetHud();
  }

  function shooterStop() {
    shooter.running = false;
    shooter.firing = false;
    shooter.paused = false;
    shooter.ads = false;
    if (shooter.stage) { shooter.stage.classList.remove('paused'); shooter.stage.classList.remove('ads'); }
    var op = $('#shOpts'); if (op) op.classList.remove('open');
    shooter.keys = {};
    shooter.moveX = shooter.moveY = 0;
    if (shooter.raf) cancelAnimationFrame(shooter.raf);
    shooter.raf = 0;
    if (document.pointerLockElement === shooter.canvas) document.exitPointerLock();
    if (shooter.stick) { shEl.knob.style.transform = ''; }
  }

  function shooterResize() {
    if (!shooter.renderer || !shooter.stage) return;
    var w = shooter.stage.clientWidth, h = shooter.stage.clientHeight;
    if (!w || !h) return;
    shooter.renderer.setSize(w, h, false);
    shooter.camera.aspect = w / h;
    shooter.camera.updateProjectionMatrix();
  }

  function shooterLoop(now) {
    if (!shooter.running) { shooter.raf = 0; return; }
    if (shooter.paused) {
      /* 暂停时只保持画面，不推进游戏时间 */
      shooter.last = now;
      shooter.renderer.render(shooter.scene, shooter.camera);
      shooter.raf = requestAnimationFrame(shooterLoop);
      return;
    }
    var dt = Math.min(.1, (now - shooter.last) / 1000 || .016);
    shooter.last = now;
    shooter.time += dt;
    shooter.update(dt);
    shooter.renderer.render(shooter.scene, shooter.camera);
    shooter.raf = requestAnimationFrame(shooterLoop);
  }

  shooter.update = function (dt) {
    var T = shooter.T;
    var moving = false;
    var kb = shooter.cfg.binds;
    var fwd = (shooter.keys[kb.fwd] ? 1 : 0) - (shooter.keys[kb.back] ? 1 : 0) - shooter.moveY;
    var str = (shooter.keys[kb.right] ? 1 : 0) - (shooter.keys[kb.left] ? 1 : 0) + shooter.moveX;
    var len = Math.hypot(fwd, str);
    if (len > 1) { fwd /= len; str /= len; }
    if (Math.abs(fwd) > .02 || Math.abs(str) > .02) moving = true;
    var sprinting = !!(shooter.keys[kb.sprint] || shooter.keys.ShiftRight);
    var speed = (sprinting ? 6.0 : 4.1) * (shooter.ads ? .55 : 1);
    var sy = Math.sin(shooter.yaw), cy = Math.cos(shooter.yaw);
    var dx = (-sy * fwd + cy * str) * speed * dt;
    var dz = (-cy * fwd - sy * str) * speed * dt;
    var pos = { x: shooter.playerX, z: shooter.playerZ };
    shooterMoveCircle(pos, dx, dz, .42);
    shooter.playerX = pos.x; shooter.playerZ = pos.z;

    /* 开镜时拉近视野，手感更像举枪 */
    var gunAds = shGun().adsK || .62;
    var wantFov = shooter.ads ? Math.max(18, shooter.cfg.fov * gunAds) : shooter.cfg.fov;
    if (Math.abs(shooter.camera.fov - wantFov) > .2) {
      shooter.camera.fov += (wantFov - shooter.camera.fov) * Math.min(1, dt * 12);
      shooter.camera.updateProjectionMatrix();
    }

    shooter.walk += moving ? dt * speed * 2.2 : 0;
    var bob = moving ? Math.sin(shooter.walk) * .028 * (shooter.ads ? .35 : 1) : 0;
    shooter.camera.position.set(shooter.playerX, 1.65 + bob, shooter.playerZ);
    shooter.camera.rotation.set(shooter.pitch, shooter.yaw, 0);

    shooter.recoil = Math.max(0, shooter.recoil - dt * 7.5);
    var sway = moving ? Math.sin(shooter.walk * .5) * .012 : 0;
    var wbob = Math.abs(bob) * (shooter.ads ? .18 : .5);
    shooter.weapon.position.set(
      (shooter.ads ? .0 : .13) + sway,
      (shooter.ads ? -.1 : -.14) + wbob - shooter.recoil * .012,
      (shooter.ads ? -.52 : -.72) + shooter.recoil * .07
    );
    shooter.weapon.rotation.set(-shooter.recoil * .055, (shooter.ads ? 0 : -.06), sway * (shooter.ads ? .25 : .8));
    if (shooter.flash) {
      shooter.flash.material.opacity = Math.max(0, shooter.flash.material.opacity - dt * 26);
      if (shooter.flashLight) shooter.flashLight.intensity = Math.max(0, shooter.flashLight.intensity - dt * 220);
    }

    if (shooter.fireCd > 0) shooter.fireCd -= dt;
    if (shooter.reloadLeft > 0) {
      shooter.reloadLeft -= dt;
      if (shooter.reloadLeft <= 0) {
        shooter.reloadLeft = 0; shooter.ammo = shooter.mag; shooterSetHud();
      } else if (Math.floor(shooter.reloadLeft * 10) % 3 === 0) shooterSetHud();
    }
    if (shooter.firing && shooter.fireCd <= 0 && shooter.reloadLeft <= 0) shooterTryShoot();

    if (shooter.hp < 100 && shooter.time - shooter.hurtAt > 6) {
      shooter.hp = Math.min(100, shooter.hp + dt * 5.5);
      shooterSetHud();
    }

    var playerPos = new T.Vector3(shooter.playerX, 1.2, shooter.playerZ);
    for (var i = shooter.enemies.length - 1; i >= 0; i--) {
      var e = shooter.enemies[i];
      if (e.dead) continue;
      var ex = e.group.position.x, ez = e.group.position.z;
      var ddx = shooter.playerX - ex, ddz = shooter.playerZ - ez;
      var dist = Math.hypot(ddx, ddz) || .001;
      var nx = ddx / dist, nz = ddz / dist;
      var forward = dist > 5.2 ? 1 : (dist < 3.2 ? -.55 : 0);
      var strafe = Math.sin(shooter.time * 1.35 + e.seed) * (dist < 7 ? .55 : .2);
      var vx = (nx * forward - nz * strafe) * e.speed * dt;
      var vz = (nz * forward + nx * strafe) * e.speed * dt;
      var ep = { x: ex, z: ez };
      shooterMoveCircle(ep, vx, vz, .46);
      e.group.position.x = ep.x; e.group.position.z = ep.z;
      var walked = Math.hypot(ep.x - ex, ep.z - ez);
      e.walk += dt * (4.5 + walked * 26);
      var swing = Math.sin(e.walk);
      if (e.legL) { e.legL.rotation.x = swing * .55; e.legR.rotation.x = -swing * .55; }
      if (e.armL) { e.armL.rotation.x = -swing * .42; }
      if (e.torsoBob === undefined) e.torsoBob = 0;
      e.group.position.y = Math.abs(Math.cos(e.walk)) * .035;
      if (e.armR) e.armR.rotation.x = -1.15 + Math.sin(e.walk * .5) * .05;
      e.group.rotation.y = Math.atan2(ddx, ddz);

      e.losT -= dt;
      if (e.losT <= 0) {
        var from = new T.Vector3(e.group.position.x, 1.45, e.group.position.z);
        e.los = shooterLineOfSight(from, new T.Vector3(shooter.playerX, 1.3, shooter.playerZ));
        e.losT = .28;
      }
      e.cd -= dt;
      if (e.los && dist < 22 && e.cd <= 0) {
        e.cd = 1.75 + Math.random() * 1.5;
        var muzzle = new T.Vector3(e.group.position.x, 1.25, e.group.position.z).add(new T.Vector3(nx, 0, nz).multiplyScalar(.65));
        var aim = new T.Vector3(shooter.playerX, 1.25, shooter.playerZ);
        aim.x += (Math.random() - .5) * .5; aim.y += (Math.random() - .5) * .3; aim.z += (Math.random() - .5) * .5;
        shooterTracer(muzzle, aim, 0xff6b6b);
        shooterSfx('enemy');
        if (Math.random() < .4) shooterDamage(3 + shooter.wave * 1.2);
      }
      if (e.flash > 0) {
        e.flash -= dt;
        for (var mi2 = 0; mi2 < e.mats.length; mi2++) {
          e.mats[mi2].emissive.setHex(0xffffff);
          e.mats[mi2].emissiveIntensity = e.flash > 0 ? 1.4 : (mi2 === 2 ? 3.2 : 0);
        }
        if (e.flash <= 0) {
          e.mats[0].emissive.setHex(0x000000); e.mats[1].emissive.setHex(0x000000);
          e.mats[2].emissive.setHex(0xff2d55); e.mats[2].emissiveIntensity = 3.2;
        }
      }
      for (var j = 0; j < shooter.enemies.length; j++) {
        if (j === i) continue;
        var o = shooter.enemies[j];
        var ox = e.group.position.x - o.group.position.x;
        var oz = e.group.position.z - o.group.position.z;
        var od = Math.hypot(ox, oz) || .001;
        if (od < .95) {
          e.group.position.x += (ox / od) * (.95 - od) * .5;
          e.group.position.z += (oz / od) * (.95 - od) * .5;
        }
      }
    }

    for (var p = shooter.sparks && shooter.sparkData.length - 1; p >= 0; p--) {
      var sd = shooter.sparkData[p];
      if (sd.life <= 0) continue;
      sd.life -= dt;
      var pa = shooter.sparks.geometry.attributes.position;
      if (sd.life <= 0) { pa.setY(p, -100); }
      else {
        sd.vy -= 9 * dt;
        pa.setXYZ(p, pa.getX(p) + sd.vx * dt, pa.getY(p) + sd.vy * dt, pa.getZ(p) + sd.vz * dt);
      }
    }
    if (shooter.sparks) shooter.sparks.geometry.attributes.position.needsUpdate = true;

    for (var t = shooter.tracers.length - 1; t >= 0; t--) {
      var tr = shooter.tracers[t];
      tr.life -= dt;
      if (tr.life <= 0) {
        if (tr.mesh.parent) shooter.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose(); tr.mesh.material.dispose();
        shooter.tracers.splice(t, 1);
      } else {
        tr.mesh.material.opacity = Math.max(0, tr.life / tr.max);
      }
    }

    if (!shooter.enemies.length && !shooter.pendingWave && !shooter.over) {
      shooter.pendingWave = shooter.time + 2.1;
      shooterShowKill('区域清理完毕 · 准备下一波');
    }
    if (shooter.pendingWave && shooter.time >= shooter.pendingWave) shooterSpawnWave();
  };

  function shooterBuild() {
    var T = shooter.T;
    shooter.stage = $('#shStage');
    shooter.canvas = $('#shCanvas');
    shooter.isTouch = (navigator.maxTouchPoints > 0) &&
      !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (shooter.isTouch) shooter.stage.classList.add('touch');
    var renderer = new T.WebGLRenderer({ canvas: shooter.canvas, antialias: shooter.cfg.quality !== 'low', powerPreference: 'high-performance' });
    renderer.setPixelRatio(shQualityPixelRatio());
    renderer.shadowMap.enabled = shooter.cfg.quality !== 'low';
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.outputColorSpace = T.SRGBColorSpace;
    shooter.renderer = renderer;
    var scene = new T.Scene();
    scene.background = new T.Color(0x08111c);
    scene.fog = new T.FogExp2(0x08111c, .017);
    shooter.scene = scene;
    var cam = new T.PerspectiveCamera(shooter.cfg.fov, 1, .05, 90);
    cam.rotation.order = 'YXZ';
    scene.add(cam);
    shooter.camera = cam;
    shooter.playerX = 0; shooter.playerZ = 9.4;
    shooterBuildMap();
    shooterBuildWeapon();
    shooterBuildSparks();
    shooter.built = true;
    shooterResize();
  }

  function shooterBindUI() {
    shooter.stage = $('#shStage');
    shooter.canvas = $('#shCanvas');
    shEl = {
      start: $('#shStart'), startBtn: $('#shStartBtn'), over: $('#shOver'),
      overTitle: $('#shOverTitle'), overSub: $('#shOverSub'), again: $('#shAgain'),
      wave: $('#shWave'), score: $('#shScore'), best: $('#shBest'), hp: $('#shHp'),
      hpBar: $('#shHpBar'), ammo: $('#shAmmo'), ammoState: $('#shAmmoState'),
      cross: $('#shCross'), hit: $('#shHit'), dmg: $('#shDmg'), kill: $('#shKill'),
      stick: $('#shStick'), knob: $('#shKnob'), fire: $('#shFire'), reload: $('#shReload'), ads: $('#shAds')
    };
    shooter.stick = shEl.stick;
    shooter.best = Number(LS.getItem('u-shooter-best') || 0) || 0;
    shooterSetHud();
    if (shooter.bound) return;
    shooter.bound = true;

    $('#gameClose').addEventListener('click', function () { shooterCloseGame(); });
    shooterBindFloat();
    $('#gameRestart').addEventListener('click', function () {
      if (!shooter.built) return;
      shooterBegin();
    });
    shEl.startBtn.addEventListener('click', function () {
      if (shooter.built && shooter.builtMap !== shooter.cfg.map) shRebuildScene();
      else if (shooter.built && shooter.builtGun !== shooter.cfg.gun + '|' + shooter.cfg.skin) shRebuildWeapon();
      shooter.builtGun = shooter.cfg.gun + '|' + shooter.cfg.skin;
      shApplyFov();
      shooterBegin();
    });
    shEl.again.addEventListener('click', function () { shooterBegin(); });

    shEl.fire.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      shooter.firing = true;
      try { shEl.fire.setPointerCapture(e.pointerId); } catch (err) {}
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      shEl.fire.addEventListener(ev, function () { shooter.firing = false; });
    });
    shEl.reload.addEventListener('click', function (e) { e.stopPropagation(); shooterReload(); });

    var stickCenter = { x: 0, y: 0 };
    shEl.stick.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      shooter.stickId = e.pointerId;
      var r = shEl.stick.getBoundingClientRect();
      stickCenter.x = r.left + r.width / 2; stickCenter.y = r.top + r.height / 2;
      try { shEl.stick.setPointerCapture(e.pointerId); } catch (err) {}
    });
    shEl.stick.addEventListener('pointermove', function (e) {
      if (shooter.stickId !== e.pointerId) return;
      var dx = e.clientX - stickCenter.x, dy = e.clientY - stickCenter.y;
      var d = Math.hypot(dx, dy), max = 40;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      shEl.knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      shooter.moveX = dx / max; shooter.moveY = dy / max;
    });
    function stickEnd(e) {
      if (shooter.stickId !== e.pointerId) return;
      shooter.stickId = null; shooter.moveX = 0; shooter.moveY = 0;
      shEl.knob.style.transform = '';
    }
    shEl.stick.addEventListener('pointerup', stickEnd);
    shEl.stick.addEventListener('pointercancel', stickEnd);

    var lookId = null, lastX = 0, lastY = 0;
    shooter.stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      if (e.target.closest('.sh-tbtn,.sh-stick,.sh-overlay,.sh-top,.sh-float')) return;
      var r = shooter.stage.getBoundingClientRect();
      if (e.clientX - r.left < r.width * .4) return;
      lookId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      try { shooter.stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    shooter.stage.addEventListener('pointermove', function (e) {
      if (e.pointerId !== lookId) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      shooter.yaw -= dx * .0042;
      shooter.pitch = Math.max(-1.2, Math.min(1.2, shooter.pitch - dy * .0042));
    });
    function lookEnd(e) { if (e.pointerId === lookId) lookId = null; }
    shooter.stage.addEventListener('pointerup', lookEnd);
    shooter.stage.addEventListener('pointercancel', lookEnd);

    /* 鼠标视角：进游戏后移动鼠标就转向（不用按住、不用锁指针）；
       左键开火，右键开镜，Esc 暂停、暂停/设置里鼠标照样能动。 */
    function mouseLookBlocked() {
      if (shooter.isTouch || !shooter.running || shooter.paused || shLayout.on) return true;
      var sheet = $('#gameSheet');
      return !(sheet && sheet.classList.contains('open'));
    }
    document.addEventListener('mousemove', function (e) {
      if (mouseLookBlocked()) return;
      var mx = e.movementX || 0, my = e.movementY || 0;
      if (!mx && !my) return;
      var s = .0021 * shooter.cfg.sens * (shooter.ads ? .5 : 1);
      shooter.yaw -= mx * s;
      shooter.pitch = Math.max(-1.2, Math.min(1.2, shooter.pitch - my * s));
    });
    shooter.canvas.addEventListener('mousedown', function (e) {
      if (mouseLookBlocked()) return;
      if (e.button === 2) {
        shSetAds(shooter.cfg.adsMode === 'toggle' ? !shooter.ads : true);
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;
      shooter.firing = true;
      if (shooter.cfg.adsMode === 'hold') shSetAds(true);
      e.preventDefault();
    });
    document.addEventListener('mouseup', function (e) {
      if (shooter.isTouch) return;
      if (e && e.button === 2) {
        if (shooter.cfg.adsMode !== 'toggle' && shooter.ads) shSetAds(false);
        return;
      }
      if (!shooter.running) { shooter.firing = false; return; }
      shooter.firing = false;
      if (shooter.cfg.adsMode === 'hold' && shooter.ads) shSetAds(false);
    });
    shooter.stage.addEventListener('contextmenu', function (e) {
      if (shooter.running) e.preventDefault();
    });
    document.addEventListener('keydown', function (e) {
      if (shRecordingBind) {
        e.preventDefault();
        if (e.code !== 'Escape') {
          shooter.cfg.binds[shRecordingBind] = e.code;
          shSaveCfg();
        }
        shRecordingBind = null;
        shPaintCfgUI();
        return;
      }
      var sheet = $('#gameSheet');
      if (!sheet || !sheet.classList.contains('open') || !shooter.running) return;
      var kb = shooter.cfg.binds;
      if (e.code === kb.pause) { e.preventDefault(); shSetPaused(!shooter.paused); return; }
      if (shooter.paused) return;
      if ([kb.fwd, kb.back, kb.left, kb.right, kb.sprint, 'Space'].indexOf(e.code) >= 0) e.preventDefault();
      if (e.code === kb.reload) { shooterReload(); return; }
      if (e.code === kb.ads) {
        if (shooter.cfg.adsMode === 'toggle') shSetAds(!shooter.ads); else shSetAds(true);
        return;
      }
      shooter.keys[e.code] = true;
    });
    document.addEventListener('keyup', function (e) {
      var kb = shooter.cfg.binds;
      if (e.code === kb.ads && shooter.cfg.adsMode === 'hold') { shSetAds(false); return; }
      shooter.keys[e.code] = false;
    });
    window.addEventListener('resize', function () {
      if (!$('#gameSheet').classList.contains('open')) return;
      shooterResetScroll();
      setTimeout(shooterResize, 120);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && shooter.running) { shooter.firing = false; shSetAds(false); }
    });
    shooter.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* ---------- 触屏开镜 ---------- */
    if (shEl.ads) {
      shEl.ads.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (shooter.cfg.adsMode === 'toggle') shSetAds(!shooter.ads); else shSetAds(true);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        shEl.ads.addEventListener(ev, function () {
          if (shooter.cfg.adsMode === 'hold') shSetAds(false);
        });
      });
    }

    /* ---------- 暂停 / 继续 ---------- */
    function shOpenOpts(on) {
      var p = $('#shOpts');
      if (!p) return;
      p.classList.toggle('open', !!on);
      if (on) { shPaintCfgUI(); shSetPaused(true); }
      else if (shooter.running) shSetPaused(false);
    }
    var optBtn = $('#shOptBtn'), pauseBtn = $('#shPauseBtn');
    if (optBtn) optBtn.addEventListener('click', function (e) { e.stopPropagation(); shOpenOpts(true); });
    if (pauseBtn) pauseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      shSetPaused(!shooter.paused);
      if (shooter.paused) toast('已暂停');
    });
    var optsClose = $('#shOptsClose');
    if (optsClose) optsClose.addEventListener('click', function () { shOpenOpts(false); });
    var resumeBtn = $('#shResume');
    if (resumeBtn) resumeBtn.addEventListener('click', function () { shOpenOpts(false); });
    var quitBtn = $('#shQuit');
    if (quitBtn) quitBtn.addEventListener('click', function () { shOpenOpts(false); shooterCloseGame(); });

    /* ---------- 设置项 ---------- */
    function seg(sel, attr, onPick) {
      $$(sel + ' button').forEach(function (b) {
        b.addEventListener('click', function () {
          onPick(b.dataset[attr]);
          shSaveCfg();
          shPaintCfgUI();
        });
      });
    }
    seg('#shQuality', 'q', function (v) {
      shooter.cfg.quality = v;
      shApplyQuality();
      toast('画质：' + (v === 'low' ? '流畅' : v === 'mid' ? '均衡' : '高清'));
    });
    seg('#shAdsMode', 'ads', function (v) {
      shooter.cfg.adsMode = v;
      if (v === 'hold' && shooter.ads) shSetAds(false);
    });
    seg('#shFloatMode', 'float', function (v) {
      shooter.cfg.floatMode = v;
      shApplyFloatMode();
      if (v === 'hide') toast('悬浮菜单已移除，双击画面可重新唤出');
    });
    var sensInput = $('#shSens');
    if (sensInput) {
      sensInput.addEventListener('input', function () {
        shooter.cfg.sens = Math.max(0.4, Math.min(3, Number(this.value) || 1));
        var v = $('#shSensV'); if (v) v.textContent = shooter.cfg.sens.toFixed(2);
        shSaveCfg();
      });
    }
    var fovInput = $('#shFov');
    if (fovInput) {
      fovInput.addEventListener('input', function () {
        shooter.cfg.fov = Math.max(60, Math.min(100, Math.round(Number(this.value) || 74)));
        var v = $('#shFovV'); if (v) v.textContent = shooter.cfg.fov;
        shApplyFov();
        shSaveCfg();
      });
    }
    function bindLobby(sel, attr, onPick) {
      var box = $(sel);
      if (!box) return;
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-' + attr + ']');
        if (!b) return;
        onPick(b.dataset[attr]);
        shSaveCfg();
        shLobbyRender();
      });
    }
    bindLobby('#shMapOpts', 'map', function (v) {
      shooter.cfg.map = v;
      toast('地图：' + (SH_MAPS[v] ? SH_MAPS[v].name : v));
      /* 大厅里就直接换场景，看得见效果；不重建的话要等点了开始才生效 */
      if (shooter.built) { shRebuildScene(); shLobbyRender(); }
    });
    bindLobby('#shGunOpts', 'gun', function (v) {
      shooter.cfg.gun = v;
      if (shooter.built) { shRebuildWeapon(); shooter.mag = shGun().mag; }
      toast('枪械：' + shGun().name);
    });
    bindLobby('#shSkinOpts', 'skin', function (v) {
      shooter.cfg.skin = v;
      if (shooter.built) shRebuildWeapon();
      toast('皮肤：' + shSkin().name);
    });
    var keysBox = $('#shKeys');
    if (keysBox) {
      keysBox.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-bind]');
        if (!b) return;
        shRecordingBind = b.dataset.bind;
        shPaintCfgUI();
        var live = keysBox.querySelector('button[data-bind="' + shRecordingBind + '"]');
        if (live) live.classList.add('rec');
        live && (live.querySelector('[data-code]').textContent = '按下新键…');
      });
    }
    var keysReset = $('#shKeysReset');
    if (keysReset) {
      keysReset.addEventListener('click', function () {
        shooter.cfg.binds = {};
        for (var k in SH_BINDS_DEFAULT) shooter.cfg.binds[k] = SH_BINDS_DEFAULT[k];
        shSaveCfg(); shPaintCfgUI(); toast('键位已恢复默认');
      });
    }
    var layoutBtn = $('#shLayoutBtn'), layoutDone = $('#shLayoutDone'), layoutReset = $('#shLayoutReset');
    if (layoutBtn) layoutBtn.addEventListener('click', function () { shOpenOpts(false); shSetLayout(true); });
    if (layoutDone) layoutDone.addEventListener('click', function () { shSetLayout(false); });
    if (layoutReset) layoutReset.addEventListener('click', function () {
      shooter.cfg.btnPos = null;
      shApplyBtnPos();
      shSaveCfg();
      toast('按键位置已恢复默认');
    });
    shApplyBtnPos();
    shBindLayout();

    /* 双击画面重新唤出被移除的悬浮菜单 */
    shooter.stage.addEventListener('dblclick', function () {
      if (shooter.cfg.floatMode !== 'hide') return;
      shooter.cfg.floatMode = 'show';
      shSaveCfg(); shApplyFloatMode(); shPaintCfgUI();
      toast('悬浮菜单已恢复');
    });
    shApplyFloatMode();
  }

  function shooterResetScroll() {
    try { window.scrollTo(0, 0); } catch (e) {}
    var app = document.querySelector('.app');
    if (app) app.scrollTop = 0;
    var se = document.scrollingElement;
    if (se) se.scrollTop = 0;
  }

  function shooterSetOrientation(land) {
    try {
      if (window.UHost && typeof UHost.setLandscape === 'function') {
        if (land) UHost.setLandscape(); else UHost.setPortrait();
        return;
      }
      if (land) {
        if (screen.orientation && screen.orientation.lock) {
          var p = screen.orientation.lock('landscape');
          if (p && p.catch) p.catch(function () {});
        }
      } else if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (e) { /* 浏览器不支持时交给系统旋转 */ }
  }

  function shooterCloseGame() {
    var sheet = $('#gameSheet');
    shooterPlaceFloat(false);
    if (sheet) sheet.classList.remove('open');
    document.body.classList.remove('shooter-open');
    shooterStop();
    shooterSetOrientation(false);
  }

  function shooterPlaceFloat(open) {
    var el = $('#shFloat');
    if (!el || !shooter.stage) return;
    var w = shooter.stage.clientWidth, h = shooter.stage.clientHeight;
    if (!w || !h) return;
    var side = shooter.floatSide === 'left' ? 'left' : 'right';
    el.classList.toggle('left', side === 'left');
    el.classList.toggle('right', side === 'right');
    el.classList.toggle('open', !!open);
    var total = el.offsetWidth || 44;
    var left = open
      ? (side === 'left' ? 8 : Math.max(8, w - total - 8))
      : (side === 'left' ? -22 : w - 22);
    var top = parseFloat(el.style.top);
    if (!isFinite(top)) top = h / 2 - 29;
    top = Math.max(8, Math.min(h - 72, top));
    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.style.right = 'auto';
    el.style.transform = 'none';
    shooter.floatOpen = !!open;
  }

  function shooterBindFloat() {
    var el = $('#shFloat'), tab = $('#shFloatTab'), exit = $('#shFloatExit');
    if (!el || !tab) return;
    var drag = null, wasOpen = false;
    tab.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      var r = el.getBoundingClientRect(), sr = shooter.stage.getBoundingClientRect();
      el.style.left = (r.left - sr.left) + 'px';
      el.style.top = (r.top - sr.top) + 'px';
      el.style.right = 'auto';
      el.style.transform = 'none';
      wasOpen = el.classList.contains('open');
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left - sr.left, top: r.top - sr.top, moved: false };
      try { tab.setPointerCapture(e.pointerId); } catch (err) {}
    });
    tab.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) drag.moved = true;
      if (!drag.moved) return;
      el.classList.remove('open');
      var maxX = shooter.stage.clientWidth - 22, maxY = shooter.stage.clientHeight - 72;
      el.style.left = Math.max(-22, Math.min(maxX, drag.left + dx)) + 'px';
      el.style.top = Math.max(8, Math.min(maxY, drag.top + dy)) + 'px';
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var moved = drag.moved;
      drag = null;
      if (!moved) { shooterPlaceFloat(!wasOpen); return; }
      var w = shooter.stage.clientWidth;
      var center = parseFloat(el.style.left) + 22;
      shooter.floatSide = center < w / 2 ? 'left' : 'right';
      shooterPlaceFloat(false);
    }
    tab.addEventListener('pointerup', endDrag);
    tab.addEventListener('pointercancel', endDrag);
    exit.addEventListener('click', function (e) {
      e.stopPropagation();
      shooterCloseGame();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!el.classList.contains('open')) return;
      if (e.target.closest && e.target.closest('#shFloat')) return;
      shooterPlaceFloat(false);
    });
    window.addEventListener('resize', function () {
      if (!$('#gameSheet').classList.contains('open')) return;
      shooterResetScroll();
      setTimeout(function () { shooterPlaceFloat(false); }, 120);
    });
  }

  function shLobbyRender() {
    var box = $('#shMapOpts');
    if (!box) return;
    function fill(el, table, key, cur) {
      var html = '';
      for (var k in table) {
        html += '<button data-' + key + '="' + k + '" class="' + (k === cur ? 'on' : '') + '">' +
          table[k].name + (table[k].label ? '<small>' + table[k].label + '</small>' : (table[k].desc ? '<small>' + table[k].desc + '</small>' : '')) + '</button>';
      }
      el.innerHTML = html;
    }
    fill($('#shMapOpts'), SH_MAPS, 'map', shooter.cfg.map);
    fill($('#shGunOpts'), SH_GUNS, 'gun', shooter.cfg.gun);
    fill($('#shSkinOpts'), SH_SKINS, 'skin', shooter.cfg.skin);
    var note = $('#shLobbyNote');
    if (note) {
      var th = shMapTheme(), gun = shGun(), sk = shSkin();
      note.textContent = th.name + ' · ' + gun.name + '（' + gun.label + '） · ' + sk.name + ' —— 换枪会改射速、伤害和弹匣';
    }
  }

  /* 换地图要重建场景几何；换枪/换皮肤只重建手里的枪 */
  function shRebuildScene() {
    var T = shooter.T;
    if (!T || !shooter.built || !shooter.scene) return;
    var scene = shooter.scene;
    scene.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      if (o.material) {
        var arr = Array.isArray(o.material) ? o.material : [o.material];
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].map && arr[i].map.dispose) arr[i].map.dispose();
          if (arr[i].dispose) arr[i].dispose();
        }
      }
    });
    while (scene.children.length) scene.remove(scene.children[0]);
    shooter.meshes = []; shooter.blockers = []; shooter.obstacles = [];
    shooter.enemies = [];
    var cam = new T.PerspectiveCamera(shooter.cfg.fov, 1, .05, 90);
    cam.rotation.order = 'YXZ';
    scene.add(cam);
    shooter.camera = cam;
    shooter.playerX = 0; shooter.playerZ = 9.4;
    shooterBuildMap();
    shooterBuildWeapon();
    shooterBuildSparks();
    shooter.builtMap = shooter.cfg.map;
    shooterResize();
  }
  function shRebuildWeapon() {
    if (!shooter.weapon) return;
    var w = shooter.weapon;
    w.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
    if (w.parent) w.parent.remove(w);
    shooterBuildWeapon();
  }
  function shApplyFov() {
    if (shooter.camera) {
      shooter.camera.fov = shooter.cfg.fov;
      shooter.camera.updateProjectionMatrix();
    }
  }

  function shooterReady() {
    shooterStop();
    shooterResetScroll();
    shooter.best = Number(LS.getItem('u-shooter-best') || 0) || 0;
    shooterSetHud();
    shEl.start.classList.add('on');
    shEl.over.classList.remove('on');
    shEl.startBtn.disabled = false;
    shEl.startBtn.textContent = '开始行动';
    shLobbyRender();
    shooterResize();
    setTimeout(shooterResize, 360);
  }

  function openGame() {
    document.body.classList.add('shooter-open');
    shooterResetScroll();
    $('#gameSheet').classList.add('open');
    shooterSetOrientation(true);
    shooterBindUI();
    setTimeout(function () { shooterPlaceFloat(false); }, 80);
    setTimeout(function () { shooterPlaceFloat(false); }, 420);
    if (shooter.built) { shooterReady(); return; }
    if (shooter.loading) return;
    shooter.loading = true;
    shEl.start.classList.add('on');
    shEl.startBtn.disabled = true;
    shEl.startBtn.textContent = '正在载入 3D 场景…';
    shooterLoadThree().then(function () {
      shooterBuild();
      shooter.loading = false;
      shooterReady();
    }).catch(function (err) {
      shooter.loading = false;
      shEl.startBtn.textContent = '加载失败';
      var card = shEl.start.querySelector('.sh-card');
      var old = card.querySelector('.sh-error');
      if (old) old.remove();
      var p = document.createElement('div'); p.className = 'sh-error';
      p.textContent = '3D 引擎加载失败：' + (err && err.message ? err.message : '未知错误');
      card.appendChild(p);
    });
  }

  /* ---------------- 游戏大厅：火线行动 / 跳一跳 / 丝袜 / 可撕丝袜 ---------------- */
  function openLobby() {
    var s = $('#lobbySheet');
    if (!s) return;
    s.classList.add('open');
  }

  function closeLobby() {
    var s = $('#lobbySheet');
    if (s) s.classList.remove('open');
  }

  /* 大厅 DOM 在主脚本之后才解析，这里用 document 事件委托，避免绑定时机问题 */
  document.addEventListener('click', function (e) {
    if (e.target.closest('#lobbyClose')) { closeLobby(); return; }
    var card = e.target.closest && e.target.closest('#lobbySheet [data-lb]');
    if (!card) return;
    var kind = card.getAttribute('data-lb');
    /* 大厅不关：游戏关掉后直接露出大厅，返回键也是一层层退 */
    if (kind === 'fire') { openGame(); return; }
    if (kind === 'jump') { if (window.openJumpGame) window.openJumpGame(); return; }
    if (kind === 'silk') { openSilk(); return; }
    if (kind === 'tear') { if (window.openTearGame) window.openTearGame(); }
  });

  /* ---------------- 丝袜实验室（雨丝 3D 版） ---------------- */
  var yusi = { url: '', started: false };

  var SILK_BODY_KEY = 'u.silk.body.v1';

  function yusiBody() {
    var d = { thick: 1, len: 1, foot: 1, bare: false, upper: false, bust: 1, shoe: 0 };
    try {
      var o = JSON.parse(LS.getItem(SILK_BODY_KEY) || '{}');
      if (typeof o.thick === 'number') d.thick = o.thick;
      if (typeof o.len === 'number') d.len = o.len;
      if (typeof o.foot === 'number') d.foot = o.foot;
      if (typeof o.bust === 'number') d.bust = o.bust;
      if (typeof o.shoe === 'number') d.shoe = o.shoe | 0;
      d.bare = !!o.bare;
      d.upper = !!o.upper;
    } catch (e) { /* 忽略 */ }
    return d;
  }

  /* three r187 / 3D 模型 / 应用脚本这三份共 1.7MB 的文本放在 vendor/ 下用 <script src> 按需加载：
     首页因此从 2.4MB 降到 700KB，内网穿透、手机流量都明显更快，浏览器还能缓存这几份大文件。 */
  function yusiVendor(name) {
    try { return new URL('vendor/' + name, location.href).href; } catch (e) { return 'vendor/' + name; }
  }

  function yusiDocUrl() {
    var tpl = document.getElementById('yusiHtml');
    var boot = document.getElementById('yusiBoot');
    if (!tpl || !boot) return '';
    var body = yusiBody();
    var html = tpl.textContent.replace('<!--YUSI_SCRIPTS-->', function () {
      return '<script>window.__YUSI_BODY=' + JSON.stringify(body) + ';<\/script>' +
             '<script>' + boot.textContent + '<\/script>' +
             '<script src="' + yusiVendor('yusi-mesh.js') + '"><\/script>' +
             '<script src="' + yusiVendor('yusi-three-187.js') + '"><\/script>' +
             '<script src="' + yusiVendor('yusi-app.js') + '"><\/script>';
    });
    return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  }

  function yusiReload() {
    var frame = $('#yusiFrame');
    if (!frame) return;
    var old = yusi.url;
    yusi.url = yusiDocUrl();
    if (!yusi.url) { toast('体型应用失败'); return; }
    yusi.started = true;
    frame.src = yusi.url;
    frame.style.display = 'block';
    if (old) setTimeout(function () { try { URL.revokeObjectURL(old); } catch (e) {} }, 4000);
  }

  (function bindSilkTune() {
    var btn = $('#silkBodyBtn');
    var panel = $('#silkTune');
    if (!btn || !panel) return;
    var body = yusiBody();
    var thick = $('#tuneThick'), len = $('#tuneLen'), foot = $('#tuneFoot');
    var bust = $('#tuneBust');
    var bare = $('#tuneBare'), upper = $('#tuneUpper');
    var shoeWrap = $('#tuneShoes');

    function fill() {
      thick.value = body.thick; len.value = body.len; foot.value = body.foot;
      if (bust) bust.value = body.bust;
      bare.checked = body.bare; upper.checked = body.upper;
      $('#tuneThickV').textContent = Number(body.thick).toFixed(2);
      $('#tuneLenV').textContent = Number(body.len).toFixed(2);
      $('#tuneFootV').textContent = Number(body.foot).toFixed(2);
      if (bust) $('#tuneBustV').textContent = Number(body.bust).toFixed(2);
      if (shoeWrap) {
        var k = body.shoe | 0;
        Array.prototype.forEach.call(shoeWrap.children, function (b) {
          b.classList.toggle('on', (+b.getAttribute('data-shoe') | 0) === k);
        });
      }
    }
    fill();

    btn.onclick = function () { body = yusiBody(); fill(); panel.classList.add('open'); };
    panel.addEventListener('click', function (e) {
      if (e.target.closest('[data-tune-close]')) panel.classList.remove('open');
    });

    function save() {
      LS.setItem(SILK_BODY_KEY, JSON.stringify(body));
      yusiReload();
      toast('已应用体型');
    }
    thick.addEventListener('input', function () {
      body.thick = +this.value; $('#tuneThickV').textContent = body.thick.toFixed(2);
    });
    len.addEventListener('input', function () {
      body.len = +this.value; $('#tuneLenV').textContent = body.len.toFixed(2);
    });
    foot.addEventListener('input', function () {
      body.foot = +this.value; $('#tuneFootV').textContent = body.foot.toFixed(2);
    });
    if (bust) bust.addEventListener('input', function () {
      body.bust = +this.value; $('#tuneBustV').textContent = body.bust.toFixed(2);
    });
    thick.addEventListener('change', save);
    len.addEventListener('change', save);
    foot.addEventListener('change', save);
    if (bust) bust.addEventListener('change', save);
    bare.addEventListener('change', function () { body.bare = this.checked; save(); });
    upper.addEventListener('change', function () { body.upper = this.checked; save(); });
    if (shoeWrap) shoeWrap.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-shoe]');
      if (!b) return;
      body.shoe = +b.getAttribute('data-shoe') | 0;
      fill();
      save();
    });
    var reset = $('#tuneReset');
    if (reset) reset.addEventListener('click', function () {
      body = { thick: 1, len: 1, foot: 1, bare: false, upper: false, bust: 1, shoe: 0 };
      fill();
      save();
      toast('已恢复默认体型');
    });
  })();

  function openSilk() {
    var sheet = $('#silkSheet');
    if (!sheet) return;
    sheet.classList.add('open');
    var frame = $('#yusiFrame');
    if (!frame) return;
    if (!yusi.started) {
      yusi.url = yusiDocUrl();
      if (!yusi.url) { toast('丝袜页面加载失败'); return; }
      frame.src = yusi.url;
      yusi.started = true;
    }
    frame.style.display = 'block';
  }

  function closeSilk() {
    var sheet = $('#silkSheet');
    if (sheet) sheet.classList.remove('open');
    var frame = $('#yusiFrame');
    if (frame) frame.style.display = 'none';
  }

  (function bindSilk() {
    var back = $('#silkClose');
    if (back) back.onclick = closeSilk;
  })();

  /* ---------------- notification editor (admin) ---------------- */
  function openNotifyEditor(id) {
    if (!isAdmin()) return;
    var n = null;
    if (id) {
      n = loadNotifies().filter(function (x) { return x.id === id; })[0] || null;
    }
    state.editingNotify = n ? n.id : null;
    $('#notifyTitle').value = n ? n.title : '';
    $('#notifyBody').value = n ? n.body : '';
    $('#notifySheet').classList.add('open');
  }
  function closeNotifyEditor() {
    $('#notifySheet').classList.remove('open');
    state.editingNotify = null;
  }
  function saveNotifyEditor() {
    var title = $('#notifyTitle').value.trim();
    var body = $('#notifyBody').value.trim();
    if (!title && !body) { toast('写点什么再保存'); return; }
    var list = loadNotifies();
    if (state.editingNotify) {
      list.forEach(function (n) {
        if (n.id !== state.editingNotify) return;
        n.title = title || '通知';
        n.body = body;
        n.editedAt = Date.now();
      });
    } else {
      list.push({ id: uid(), title: title || '通知', body: body, createdAt: Date.now(), published: true });
    }
    saveNotifies(list);
    closeNotifyEditor();
    renderNotify();
    updateAdminSub();
    toast('通知已保存');
    if (lanEnabled()) lanTick();
  }
  function publishNotify(id) {
    var list = loadNotifies();
    list.forEach(function (n) {
      if (n.id !== id) return;
      n.published = true;
      n.publishedAt = Date.now();
    });
    saveNotifies(list);
    renderNotify();
    updateAdminSub();
    toast('通知已发布');
    if (lanEnabled()) lanTick();
  }
  function deleteNotify(id) {
    confirmDialog({ title: '删除这条通知？', desc: '删除后可在「设置 → 数据恢复」中找回。', okText: '删除' })
      .then(function (ok) {
        if (!ok) return;
        var all = loadNotifies();
        var n = all.filter(function (x) { return x.id === id; })[0];
        if (n) {
          var trash = loadNotifyTrash();
          if (!trash.some(function (x) { return x.id === id; })) trash.push(n);
          saveNotifyTrash(trash);
        }
        saveNotifies(all.filter(function (x) { return x.id !== id; }));
        lanMarkDeleted(id);
        renderNotify();
        updateAdminSub();
        toast('已删除');
        if (lanEnabled()) lanTick();
      });
  }

  /* 恢复被删除的 U 官方帖子与通知 */
  function restoreOfficialData() {
    confirmDialog({
      title: '恢复 U 官方内容？',
      desc: '将恢复被删除的 U 官方帖子与通知，其他用户的帖子不受影响。',
      okText: '恢复'
    }).then(function (ok) {
      if (!ok) return;
      var count = 0;
      var revived = [];
      var jobs = [];

      state.posts.forEach(function (p) {
        var official = p.author && (p.author.official || p.author.handle === 'u_official');
        if (official && p.deleted) {
          delete p.deleted;
          revived.push(p.id);
          jobs.push(DataAPI.updatePost(p));
          count++;
        }
      });

      var trash = loadNotifyTrash();
      var list = loadNotifies();
      trash.forEach(function (n) {
        if (!n || !n.id) return;
        revived.push(n.id);
        if (list.some(function (x) { return x.id === n.id; })) return;
        list.push(n);
        count++;
      });
      saveNotifies(list);
      LS.removeItem('u-notify-trash');

      defaultOfficialPosts().forEach(function (p) {
        if (state.posts.some(function (x) { return x.id === p.id; })) return;
        state.posts.push(p);
        revived.push(p.id);
        jobs.push(dbPut('posts', p));
        count++;
      });

      var dead = lanTombstones().filter(function (t) { return revived.indexOf(t.id) < 0; });
      LS.setItem('u-deleted', JSON.stringify(dead));

      Promise.all(jobs).then(function () {
        state.posts.sort(function (a, b) { return b.createdAt - a.createdAt; });
        renderFeed();
        renderTalk();
        renderNotify();
        if (state.tab === 'profile') renderProfile();
        updateAdminSub();
        toast(count ? '已恢复 ' + count + ' 项内容' : '没有可恢复的内容');
      });
    });
  }

  /* ---------------- 说说随机内容 ---------------- */
  var BOT_ACCOUNTS = [
    { name: '晚风', handle: 'wanfeng_7' },
    { name: '阿柚', handle: 'ayou_22' },
    { name: '小满', handle: 'xiaoman_03' },
    { name: '林间', handle: 'linjian_9' },
    { name: '橘子汽水', handle: 'orangesoda' },
    { name: '南岸', handle: 'nanan_11' },
    { name: '一只胖橘', handle: 'fatcat_5' },
    { name: '十七', handle: 'shiqi_17' },
    { name: '慢慢', handle: 'manman_28' },
    { name: '白露', handle: 'bailu_06' },
    { name: '阿衡', handle: 'aheng_33' },
    { name: '小时光', handle: 'xiaoshiguang' }
  ];
  var BOT_DMS = [
    '在吗？刚看到你发的帖子',
    '你好，方便交流一下吗？',
    '你的内容很有意思，已经关注了',
    '嗨，最近怎么样？',
    '想问问你那张照片是哪里拍的'
  ];
  var BOT_TEXTS = [
    '今天下班路上看到一只橘猫蹲在便利店门口，等人投喂。',
    '终于把拖了一周的报表做完了，奖励自己一杯冰美式。',
    '早上误了地铁，结果在站台捡到五块钱，心情突然好起来。',
    '楼下新开的面馆味道不错，就是排队有点久。',
    '周末打算去江边走走，有一起的吗？',
    '刚看完一部老电影，后劲有点大。',
    '今天拍了张很喜欢的照片，光线刚好。',
    '谁懂啊，周一的闹钟永远比平时响得早。',
    '把房间收拾了一遍，整个人都清爽了。',
    '在便利店纠结了五分钟，最后还是拿了原味酸奶。',
    '晚饭做了番茄炒蛋，稍微有点咸。',
    '马上要降温了，记得添衣。',
    '耳机随机播到一首很久没听的歌，瞬间回到大学。',
    '今天的晚霞好看得不像话。',
    '工作的间隙抬头，发现窗外的树已经黄了一半。',
    '地铁上看到有人在看纸质书，久违的安静。',
    '刚跑完三公里，腿有点软，但心情很好。',
    '新买的杯子到了，喝水都变勤快了。',
    '周五的下午，时间过得特别慢。',
    '路过小学门口，听见放学的铃声。',
    '把去年的照片翻出来看，变化还挺大。',
    '今天多云，适合什么也不做。',
    '咖啡喝多了，晚上又睡不着。',
    '尝试自己做了一次咖喱，意外地成功。',
    '收拾书架翻出一张旧车票，愣了半天。',
    '雨停之后空气很好，下楼走了两圈。',
    '刚刚把手机相册整理了一遍，删掉好多截图。',
    '室友做了红烧肉，整个屋子都是香味。'
  ];
  var botTimer = null;

  function botCover() {
    var palettes = [
      ['#1b2a33', '#0d1117'], ['#2b2118', '#12100c'], ['#1f2a20', '#0c110d'],
      ['#2a1f2c', '#120d13'], ['#1a2233', '#0c1017'], ['#33241c', '#140f0b']
    ];
    var p = palettes[Math.floor(Math.random() * palettes.length)];
    return cover(p[0], p[1], '', '');
  }

  function addBotPost() {
    if (!ME) return;
    var who = BOT_ACCOUNTS[Math.floor(Math.random() * BOT_ACCOUNTS.length)];
    var text = BOT_TEXTS[Math.floor(Math.random() * BOT_TEXTS.length)];
    var media = [];
    if (Math.random() < 0.26) {
      media = [{ id: uid(), type: 'image', src: botCover() }];
    }
    var post = {
      id: uid(),
      author: {
        key: 'bot_' + who.handle, name: who.name, handle: who.handle,
        verified: false, official: false, bot: true
      },
      text: text,
      media: media,
      createdAt: Date.now(),
      likes: Math.floor(Math.random() * 42),
      liked: false,
      reposts: Math.floor(Math.random() * 8),
      replies: Math.floor(Math.random() * 5),
      views: 20 + Math.floor(Math.random() * 380)
    };
    state.posts.unshift(post);
    dbPut('posts', post);
    trimBots();
    if (state.tab === 'talk') renderTalk();
  }

  /* 内容指纹：同一帖子可能在本机 / 服务器 / 局域网里以不同 ID 存在 */
  function postContentKey(p) {
    var a = (p && p.author) || {};
    return [
      String(a.handle || a.key || '').toLowerCase(),
      Number(p && p.createdAt) || 0,
      String((p && p.text) || '').trim(),
      ((p && p.media) || []).map(function (m) { return m.type || ''; }).join(',')
    ].join('|');
  }

  /* 启动或局域网同步后，合并内容相同的重复帖子，优先保留已上传服务器的版本 */
  function dedupePosts() {
    var keep = {}, order = [], drops = [];
    state.posts.forEach(function (p) {
      var key = postContentKey(p);
      var cur = keep[key];
      if (!cur) { keep[key] = p; order.push(p); return; }
      if (!cur.remoteId && p.remoteId) {
        var idx = order.indexOf(cur);
        if (idx >= 0) order[idx] = p;
        keep[key] = p;
        drops.push(cur);
      } else {
        drops.push(p);
      }
    });
    if (!drops.length) return false;
    drops.forEach(function (p) { dbDel('posts', p.id); });
    state.posts = order.sort(function (a, b) { return b.createdAt - a.createdAt; });
    return true;
  }

  function trimBots() {
    var bots = state.posts.filter(function (p) { return p.author && p.author.bot; });
    if (bots.length <= 40) return;
    bots.sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(40).forEach(function (p) {
      state.posts = state.posts.filter(function (x) { return x.id !== p.id; });
      dbDel('posts', p.id);
    });
  }

  /* 人机频率由服务器下发：每秒评论 / 点赞 / 发帖次数，支持小数 */
  var botRateAcc = { post: 0, like: 0, comment: 0 };
  function botRates() {
    var s = srvSettings();
    return {
      post: Math.max(0, Number(s.botPostPerSec) || 0),
      like: Math.max(0, Number(s.botLikePerSec) || 0),
      comment: Math.max(0, Number(s.botCommentPerSec) || 0)
    };
  }
  function botRatePosts() {
    var mine = myPosts();
    var list = mine.slice();
    officialPosts().forEach(function (p) { if (list.indexOf(p) < 0) list.push(p); });
    if (list.length) return list;
    return state.posts.filter(function (p) { return !p.deleted; });
  }
  function botGrowPost(post, field) {
    post[field] = (post[field] || 0) + 1;
    DataAPI.updatePost(post);
    updatePostCountsInDom(post);
    if (state.detailPostId === post.id) {
      var sc = $('#postBody').scrollTop;
      if (field === 'replies') renderComments();
      $('#postBody').scrollTop = sc;
      updateDetailStats(post);
    }
  }
  function startBots() {
    if (botTimer) return;
    var tick = function () {
      botTimer = null;
      var rates = botRates();
      if (!document.hidden && ME) {
        var targets = null;
        var pick = function () {
          if (!targets) targets = botRatePosts();
          if (!targets.length) return null;
          return targets[Math.floor(Math.random() * targets.length)];
        };
        botRateAcc.post += rates.post;
        botRateAcc.like += rates.like;
        botRateAcc.comment += rates.comment;
        var nPost = Math.floor(botRateAcc.post);
        if (nPost) {
          botRateAcc.post -= nPost;
          for (var i = 0; i < nPost; i++) addBotPost();
        }
        var nLike = Math.floor(botRateAcc.like);
        if (nLike) {
          botRateAcc.like -= nLike;
          for (var j = 0; j < nLike; j++) {
            var lp = pick();
            if (!lp) break;
            botGrowPost(lp, 'likes');
          }
        }
        var nComment = Math.floor(botRateAcc.comment);
        if (nComment) {
          botRateAcc.comment -= nComment;
          for (var k = 0; k < nComment; k++) {
            var cp = pick();
            if (!cp) break;
            botGrowPost(cp, 'replies');
          }
        }
      }
      botTimer = setTimeout(tick, 1000);
    };
    botTimer = setTimeout(tick, 1000);
  }
  function stopBots() {
    if (botTimer) { clearTimeout(botTimer); botTimer = null; }
  }

  /* ---------------- 局域网互传 ---------------- */
  /* 安卓 App 内是本机模式；iPhone 用 Safari 打开 http://安卓IP:端口 时走浏览器客户端模式 */
  var LAN_IS_LOCAL = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  var LAN_IS_CLIENT = !LAN_IS_LOCAL;
  var LAN_SUPPORTED = LAN_IS_LOCAL
    ? (+location.port >= 17871 && +location.port <= 17874)
    : /^https?:$/.test(location.protocol);
  var LAN = {
    timer: null,
    peers: [],
    clients: 0,
    devices: {},
    info: null,
    uploaded: {},
    pulling: {},
    device: (function () {
      var d = LS.getItem('u-device');
      if (!d) { d = 'dev_' + Math.random().toString(36).slice(2, 10); LS.setItem('u-device', d); }
      return d;
    })(),
    name: (function () {
      var n = LS.getItem('u-device-name');
      if (!n) {
        var ua = navigator.userAgent || '';
        n = /iPad/i.test(ua) ? 'iPad'
          : (/iPhone|iPod/i.test(ua) ? 'iPhone'
          : (/Android/i.test(ua) ? '安卓设备' : '浏览器设备'));
        LS.setItem('u-device-name', n);
      }
      return n;
    })()
  };

  function lanEnabled() { return LAN_SUPPORTED && LS.getItem('u-lan') === '1'; }
  function lanTombstones() {
    var list = [];
    try { list = JSON.parse(LS.getItem('u-deleted') || '[]') || []; } catch (e) { list = []; }
    var cut = Date.now() - 7 * 86400000;
    list = list.filter(function (t) { return t.ts > cut; });
    LS.setItem('u-deleted', JSON.stringify(list));
    return list;
  }
  function lanMarkDeleted(id) {
    var list = lanTombstones();
    if (!list.some(function (t) { return t.id === id; })) list.push({ id: id, ts: Date.now() });
    LS.setItem('u-deleted', JSON.stringify(list));
  }
  function lanSnapshot() {
    var tombs = lanTombstones().map(function (t) { return t.id; });
    var posts = state.posts.filter(function (p) {
      return !p.deleted && visibleToOthers(p);
    }).map(function (p) {
      return {
        id: p.id, remoteId: p.remoteId || 0, text: p.text || '', createdAt: p.createdAt, editedAt: p.editedAt || 0,
        likes: p.likes || 0, liked: false, reposts: p.reposts || 0,
        replies: p.replies || 0, views: p.views || 0, author: p.author,
        channel: p.channel === 'feed' ? 'feed' : '',
        private: !!p.private,
        sensitive: !!p.sensitive,
        media: (p.media || []).map(function (m) {
          var mm = { id: m.id, type: m.type };
          /* 人机帖封面是内联 SVG，直接随快照同步；普通图片视频走媒体接口 */
          if (!m.blob && m.src && /^data:/i.test(m.src)) mm.src = m.src;
          if (m.poster) mm.poster = m.poster;
          if (m.ratio) mm.ratio = m.ratio;
          return mm;
        })
      };
    });
    var notes = state.notes.map(function (n) {
      return { id: n.id, title: n.title, content: n.content, createdAt: n.createdAt, updatedAt: n.updatedAt };
    });
    var comments = state.allComments.filter(function (c) { return !c.deleted; }).map(function (c) {
      return {
        id: c.id, postId: c.postId, text: c.text || '', createdAt: c.createdAt,
        author: c.author
      };
    });
    return JSON.stringify({
      device: LAN.device, name: LAN.name,
      user: ME ? { key: ME.key, name: ME.name, handle: ME.handle } : null,
      follows: ME ? loadFollows() : [],
      followsAt: parseInt(LS.getItem('u-follows-ts') || '0', 10) || 0,
      ts: Date.now(), posts: posts, notes: notes, comments: comments,
      notifs: loadNotifies(), deleted: tombs
    });
  }
  /* 本机模式写入 /lan/snapshot；浏览器模式写入 /lan/client/snapshot */
  function lanSnapUrl(base) {
    return LAN_IS_CLIENT
      ? base + '/lan/client/snapshot?client=' + encodeURIComponent(LAN.device) +
        '&name=' + encodeURIComponent(LAN.name)
      : base + '/lan/snapshot';
  }
  function lanMediaUrl(base, id, type, clientId) {
    if (clientId) {
      return base + '/lan/client/media?client=' + encodeURIComponent(clientId) +
        '&id=' + encodeURIComponent(id) + '&type=' + encodeURIComponent(type);
    }
    return base + '/lan/media?id=' + encodeURIComponent(id) +
      '&type=' + encodeURIComponent(type);
  }
  function lanUploadMedia() {
    if (!LAN_SUPPORTED) return Promise.resolve();
    var jobs = [];
    state.posts.forEach(function (p) {
      if (p.deleted || (p.author && p.author.bot)) return;
      (p.media || []).forEach(function (m) {
        if (!m.blob || LAN.uploaded[m.id]) return;
        LAN.uploaded[m.id] = 1;
        var url = lanMediaUrl('', m.id, m.type, LAN_IS_CLIENT ? LAN.device : null);
        jobs.push(fetch(url, {
          method: 'POST', body: m.blob
        }).then(function (r) {
          if (!r.ok) throw new Error('upload failed');
        }).catch(function () {
          delete LAN.uploaded[m.id];   // 失败下次重试
        }));
      });
    });
    return Promise.all(jobs);
  }
  function lanPush() {
    fetch(lanSnapUrl(''), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: lanSnapshot()
    }).catch(function () {});
  }
  /* 记录局域网中见过的设备与用户，供「局域网互传」页展示用户名 */
  function lanRemember(key, data) {
    var d = LAN.devices[key] || {};
    Object.assign(d, data, { key: key, ts: Date.now() });
    LAN.devices[key] = d;
    if ($('#lanSheet') && $('#lanSheet').classList.contains('open')) renderLanDevices();
  }
  function lanAvatarChar(name) {
    name = (name || 'U').trim();
    return (name.charAt(0) || 'U').toUpperCase();
  }
  function renderLanDevices() {
    var box = $('#lanDevices');
    if (!box) return;
    var html = '';
    var meName = ME ? ME.name : '未登录';
    var meSub = (ME && ME.handle ? '@' + dispHandle(ME) + ' · ' : '') + '本机 · ' +
      (LAN_IS_CLIENT ? LAN.name : 'Android App');
    html += '<div class="lan-dev"><div class="lan-av">' + esc(lanAvatarChar(meName)) + '</div>' +
      '<div class="lan-dev-main"><div class="lan-dev-name">' + esc(meName) + '</div>' +
      '<div class="lan-dev-sub">' + esc(meSub) + '</div></div>' +
      '<span class="lan-badge self">本机</span></div>';
    if (!LAN_SUPPORTED) {
      html += '<div class="lan-empty">当前环境不支持局域网互传</div>';
    } else if (!lanEnabled()) {
      html += '<div class="lan-empty">互传已关闭，开启后可看到同一 Wi-Fi 下的设备</div>';
    } else {
      var cut = Date.now() - 10 * 60000;
      var list = [];
      Object.keys(LAN.devices).forEach(function (k) {
        var d = LAN.devices[k];
        if (d && d.ts >= cut) list.push(d);
      });
      list.sort(function (a, b) { return b.ts - a.ts; });
      if (!list.length) {
        html += '<div class="lan-empty">正在寻找设备…<br>请确认其他设备已打开 App / 页面并连接同一 Wi-Fi</div>';
      }
      list.forEach(function (d) {
        var u = d.user || {};
        var title = u.name || (d.kind === 'client' ? (d.name || '浏览器设备') : '安卓设备');
        var bits = [];
        if (u.handle) bits.push('@' + u.handle);
        bits.push(d.kind === 'client' ? (d.name || '浏览器设备') : '安卓设备');
        if (d.kind === 'host' && d.ip) bits.push(d.ip);
        var online = d.ts >= Date.now() - 5 * 60000;
        html += '<div class="lan-dev"><div class="lan-av">' + esc(lanAvatarChar(title)) + '</div>' +
          '<div class="lan-dev-main"><div class="lan-dev-name">' + esc(title) + '</div>' +
          '<div class="lan-dev-sub">' + esc(bits.join(' · ')) + '</div></div>' +
          '<span class="lan-badge' + (online ? '' : ' off') + '">' + (online ? '已连接' : '未连接') + '</span></div>';
      });
    }
    box.innerHTML = html;
  }
  function lanPullMedia(base, post, clientId) {
    (post.media || []).forEach(function (m) {
      if (m.src || m.blob || LAN.pulling[m.id]) return;
      LAN.pulling[m.id] = 1;
      fetch(lanMediaUrl(base, m.id, m.type, clientId))
        .then(function (r) {
          if (!r.ok) throw new Error('media');
          return r.blob();
        })
        .then(function (b) {
          m.blob = new Blob([b], { type: m.type === 'video' ? 'video/mp4' : 'image/jpeg' });
          delete LAN.pulling[m.id];
          dbPut('posts', post);
          if (state.tab === 'talk') renderTalk();
          if (state.tab === 'feed') renderFeed();
          if (state.detailPostId === post.id) openPost(post.id);
        })
        .catch(function () {
          delete LAN.pulling[m.id];   // 对方离线时下个周期重试
        });
    });
  }
  function lanPull(src) {
    var base = src.base || '';
    var clientId = src.kind === 'client' ? src.id : null;
    var url = clientId
      ? base + '/lan/client/snapshot?client=' + encodeURIComponent(clientId)
      : base + '/lan/snapshot';
    fetch(url).then(function (r) { return r.json(); }).then(function (snap) {
      if (!snap) return;
      lanRemember(src.kind + '|' + (src.base || '') + '|' + (src.id || ''), {
        kind: src.kind, id: src.id || '', base: src.base || '',
        name: snap.name || '', user: snap.user || null
      });
      if (!snap.posts) return;
      var changed = false;
      var dead = {};
      var tombs = lanTombstones();
      tombs.forEach(function (t) { dead[t.id] = 1; });
      (snap.deleted || []).forEach(function (id) {
        dead[id] = 1;
        lanMarkDeleted(id);
        if (!state.posts.some(function (p) { return p.id === id; })) return;
        state.posts = state.posts.filter(function (p) { return p.id !== id; });
        dbDel('posts', id);
        changed = true;
      });
      snap.posts.forEach(function (rp) {
        if (!rp || !rp.id || dead[rp.id]) return;
        if (rp.remoteId && dead['srv_' + rp.remoteId]) return;
        var local = state.posts.filter(function (p) {
          return p.id === rp.id || (rp.remoteId && p.remoteId === rp.remoteId);
        })[0];
        if (!local) {
          /* 同一内容可能因旧 ID 与新服务器 ID 并存，按内容去重，避免出现双倍帖子 */
          var ckey = postContentKey(rp);
          var dup = state.posts.filter(function (p) { return postContentKey(p) === ckey; })[0];
          if (dup) {
            if (dup.remoteId && !rp.remoteId) lanMarkDeleted(rp.id);
            return;
          }
        }
        if (local) {
          /* 同一条帖子以较大计数为准，修复点赞/评论数在设备间不同步 */
          var bumped = false;
          ['likes', 'reposts', 'replies', 'views'].forEach(function (k) {
            var v = Number(rp[k]) || 0;
            if (v > (Number(local[k]) || 0)) { local[k] = v; bumped = true; }
          });
          /* 首页 / 说说 归属也跟随同步（以编辑时间较新的为准，避免被旧快照覆盖） */
          var rpChan = rp.channel === 'feed' ? 'feed' : '';
          if (rpChan !== (local.channel === 'feed' ? 'feed' : '') &&
              (rp.editedAt || 0) > (local.editedAt || 0)) {
            local.channel = rpChan;
            bumped = true;
          }
          if (local.text !== rp.text && (rp.editedAt || 0) > (local.editedAt || 0)) {
            local.text = rp.text || '';
            local.editedAt = rp.editedAt;
            local.author = rp.author || local.author;
            bumped = true;
          }
          /* 隐私标记随编辑时间同步 */
          if (!!rp.private !== !!local.private && (rp.editedAt || 0) > (local.editedAt || 0)) {
            local.private = !!rp.private;
            delete state.revealed[local.id];
            bumped = true;
          }
          /* 18+ 标注以服务器为准（本地编辑会 PATCH 上去，别的设备也要跟着变） */
          if (!!rp.sensitive !== !!local.sensitive) {
            local.sensitive = !!rp.sensitive;
            delete state.revealed[local.id];
            bumped = true;
          }
          if (bumped) {
            dbPut('posts', local);
            changed = true;
            updatePostCountsInDom(local);
          }
          return;
        }
        var post = {
          id: rp.id, text: rp.text || '', createdAt: rp.createdAt || Date.now(),
          likes: rp.likes || 0, liked: false, reposts: rp.reposts || 0,
          replies: rp.replies || 0, views: rp.views || 0,
          channel: rp.channel === 'feed' ? 'feed' : '',
          private: !!rp.private,
          sensitive: !!rp.sensitive,
          author: rp.author || { name: 'U', handle: 'u' },
          media: (rp.media || []).map(function (m) {
            var mm = { id: m.id, type: m.type };
            if (m.src && /^data:/i.test(m.src)) mm.src = m.src;
            if (m.poster) mm.poster = m.poster;
            if (m.ratio) mm.ratio = m.ratio;
            return mm;
          })
        };
        state.posts.push(post);
        dbPut('posts', post);
        changed = true;
        lanPullMedia(base, post, clientId);
      });
      /* 评论同步：按 id 去重后合并到本机 */
      var commentsChanged = false;
      var cseen = {};
      state.allComments.forEach(function (c) { cseen[c.id] = 1; });
      (snap.comments || []).forEach(function (rc) {
        if (!rc || !rc.id || !rc.postId || cseen[rc.id] || dead[rc.postId]) return;
        var c = {
          id: rc.id, postId: rc.postId, text: rc.text || '',
          createdAt: rc.createdAt || Date.now(),
          author: rc.author || { name: 'U', handle: 'u' }
        };
        state.allComments.push(c);
        cseen[c.id] = 1;
        dbPut('comments', c);
        commentsChanged = true;
      });
      if (commentsChanged) {
        changed = true;
        if (state.detailPostId) {
          state.comments = state.allComments.filter(function (c) {
            return c.postId === state.detailPostId;
          }).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
          renderComments();
          var dpc = findPost(state.detailPostId);
          if (dpc) updateDetailStats(dpc);
        }
      }
      /* 关注同步：同一账号在多台设备登录时，以较新的关注列表为准 */
      if (ME && snap.user && snap.user.key === ME.key && Array.isArray(snap.follows)) {
        var localTs = parseInt(LS.getItem('u-follows-ts') || '0', 10) || 0;
        if ((snap.followsAt || 0) > localTs) {
          saveFollows(snap.follows);
          LS.setItem('u-follows-ts', String(snap.followsAt || 0));
          changed = true;
        }
      }
      (snap.notes || []).forEach(function (rn) {
        if (!rn || !rn.id) return;
        var local = state.notes.filter(function (n) { return n.id === rn.id; })[0];
        if (local && (local.updatedAt || 0) >= (rn.updatedAt || 0)) return;
        if (local) Object.assign(local, rn); else state.notes.push(rn);
        dbPut('notes', rn);
        changed = true;
      });
      var notifChanged = false;
      var nlist = loadNotifies();
      var before = JSON.stringify(nlist);
      nlist = nlist.filter(function (n) { return !dead[n.id]; });
      (snap.notifs || []).forEach(function (rn) {
        if (!rn || !rn.id || dead[rn.id]) return;
        var local = nlist.filter(function (n) { return n.id === rn.id; })[0];
        if (!local) { nlist.push(rn); return; }
        var lt = local.editedAt || local.publishedAt || 0;
        var rt = rn.editedAt || rn.publishedAt || 0;
        if (rt > lt) {
          local.title = rn.title;
          local.body = rn.body;
          local.editedAt = rn.editedAt;
        }
        if (rn.published && !local.published) {
          local.published = true;
          local.publishedAt = rn.publishedAt;
        }
      });
      if (JSON.stringify(nlist) !== before) {
        saveNotifies(nlist);
        notifChanged = true;
      }
      if (notifChanged) {
        updateAdminSub();
        if (state.tab === 'notify') renderNotify();
      }
      if (changed) {
        dedupePosts();
        state.posts.sort(function (a, b) { return b.createdAt - a.createdAt; });
        if (state.tab === 'feed') renderFeed();
        if (state.tab === 'talk') renderTalk();
        if (state.tab === 'notes') renderNotes();
        if (state.tab === 'profile') renderProfile();
      }
      /* 对已存在但缺媒体的帖子持续重试，避免对方晚启动时永久显示“同步中” */
      state.posts.forEach(function (p) {
        if (p.deleted) return;
        (p.media || []).forEach(function (m) {
          if (!m.src && !m.blob) lanPullMedia(base, p, clientId);
        });
      });
    }).catch(function () {});
  }
  function lanTick() {
    if (!lanEnabled()) return;
    lanUploadMedia().then(lanPush);
    var sources = [];
    var seen = {};
    function add(src) {
      if (src.kind === 'client' && src.id === LAN.device) return;
      var key = src.kind + '|' + (src.base || '') + '|' + (src.id || '');
      if (seen[key]) return;
      seen[key] = 1;
      sources.push(src);
    }
    function loadClients(base) {
      return fetch(base + '/lan/clients').then(function (r) { return r.json(); }).then(function (list) {
        list = list || [];
        if (!base) LAN.clients = list.length;
        list.slice(0, 20).forEach(function (c) {
          if (!c || !c.id) return;
          if (LAN_IS_CLIENT && !base && c.id === LAN.device) return;  // 不在列表里重复显示自己
          lanRemember('client|' + (base || '') + '|' + c.id, {
            kind: 'client', id: c.id, base: base || '', name: c.name || ''
          });
          add({ base: base, kind: 'client', id: c.id });
        });
      }).catch(function () {
        if (!base) LAN.clients = 0;
      });
    }
    function loadPeers(base) {
      return fetch(base + '/lan/peers').then(function (r) { return r.json(); }).then(function (list) {
        list = list || [];
        if (!base) LAN.peers = list;
        list.slice(0, 8).forEach(function (p) {
          if (!p || !p.ip) return;
          var pb = 'http://' + p.ip + ':' + p.port;
          lanRemember('host|' + pb + '|', { kind: 'host', base: pb, ip: p.ip, port: p.port });
          add({ base: pb, kind: 'host' });
          loadClients(pb);   // 对方安卓机接入的 iPhone 数据
        });
      }).catch(function () {
        if (!base) LAN.peers = [];
      });
    }
    /* 浏览器模式（iPhone）：先读取安卓主机自己的共享数据 */
    if (LAN_IS_CLIENT) add({ base: '', kind: 'host' });
    Promise.all([loadPeers(''), loadClients('')]).then(function () {
      sources.forEach(lanPull);
      updateLanStatus();
      if ($('#lanSheet') && $('#lanSheet').classList.contains('open')) renderLanDevices();
    });
  }
  function updateLanStatus() {
    var el = $('#lanStatus');
    if (!el) return;
    if (!LAN_SUPPORTED) { el.textContent = '仅 Android App 或同一 Wi-Fi 的浏览器内支持'; return; }
    if (!lanEnabled()) { el.textContent = '已关闭'; return; }
    if (LAN_IS_CLIENT) {
      var same = Math.max(LAN.peers.length + 1, LAN.clients || 0);
      el.textContent = same > 1
        ? ('已连接 ' + location.hostname + ' · 同网 ' + same + ' 台设备')
        : ('已连接 ' + location.hostname + ' · 正在同步数据');
      return;
    }
    var extra = LAN.clients ? ('、' + LAN.clients + ' 台浏览器设备') : '';
    el.textContent = (LAN.peers.length || LAN.clients)
      ? ('已开启 · 发现 ' + LAN.peers.length + ' 台设备' + extra)
      : '已开启 · 正在寻找同一 Wi-Fi 下的设备';
  }
  function lanStart() {
    if (LAN.timer) return;
    lanLoadInfo();
    lanTick();
    LAN.timer = setInterval(lanTick, 7000);
  }
  function lanLoadInfo() {
    if (!LAN_SUPPORTED) return;
    fetch('/lan/info').then(function (r) { return r.json(); }).then(function (info) {
      LAN.info = info || null;
      var el = $('#lanDir');
      if (el && info && info.dir) el.textContent = info.dir;
    }).catch(function () {});
  }
  function lanStop() {
    if (LAN.timer) { clearInterval(LAN.timer); LAN.timer = null; }
  }

  /* ---------------- 远程访问（公网） ---------------- */
  function remoteEnabled() { return LS.getItem('u-remote') === '1'; }
  function detectPublicIp() {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (ip) { if (!done) { done = true; resolve(ip || null); } };
      var urls = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/ip/',
        'https://ifconfig.me/ip'
      ];
      var pending = urls.length;
      urls.forEach(function (u) {
        fetch(u, { cache: 'no-store' }).then(function (r) {
          if (!r.ok) throw 0;
          return r.text();
        }).then(function (t) {
          try {
            var ip = t;
            if (t && t.trim().charAt(0) === '{') {
              var obj = JSON.parse(t);
              ip = obj.ip || obj.query || '';
            }
            ip = (ip || '').trim();
            if (/^[\d.]{7,}$/.test(ip)) finish(ip);
            else throw 0;
          } catch (e) { throw 0; }
        }).catch(function () {
          if (--pending <= 0) finish(null);
        });
      });
      setTimeout(function () { finish(null); }, 6000);
    });
  }
  function setRemoteBox() {
    var box = $('#remoteBox');
    if (box) box.style.display = remoteEnabled() ? 'block' : 'none';
    var tg = $('#remoteToggle');
    if (tg) tg.checked = remoteEnabled();
  }
  function refreshRemote() {
    var sub = $('#remoteSub'), url = $('#remoteUrl');
    if (!remoteEnabled()) return;
    if (sub) sub.textContent = '正在检测公网地址…';
    if (url) url.textContent = '—';
    Promise.all([
      LAN.info ? Promise.resolve(LAN.info) : fetch('/lan/info').then(function (r) { return r.json(); }).catch(function () { return null; }),
      detectPublicIp()
    ]).then(function (arr) {
      var info = arr[0], pub = arr[1];
      var port = (info && info.port) ? info.port : 17880;
      if (!pub) {
        if (sub) sub.textContent = '无法自动检测公网 IP，请确认已连接网络';
        if (url) url.textContent = 'http://<你的公网IP>:' + port;
        return;
      }
      var pageUrl = 'http://' + pub + ':' + port + '/index.html';
      if (sub) sub.textContent = '其他手机浏览器打开此地址即可访问';
      if (url) url.textContent = pageUrl;
      url.dataset.url = pageUrl;
    });
  }

  /* 旧数据里 Blob 可能没有 MIME，补正后才能正常播放 */
  function fixMediaTypes() {
    var jobs = [];
    state.posts.forEach(function (p) {
      var changed = false;
      (p.media || []).forEach(function (m) {
        if (!m.blob) return;
        if (m.type !== 'video' && /^video\//.test(m.blob.type || '')) {
          m.type = 'video';
          changed = true;
        }
        if (m.type === 'video' && !/^video\//.test(m.blob.type || '')) {
          m.blob = new Blob([m.blob], { type: 'video/mp4' });
          changed = true;
        } else if (m.type === 'image' && !/^image\//.test(m.blob.type || '')) {
          m.blob = new Blob([m.blob], { type: 'image/jpeg' });
          changed = true;
        }
      });
      if (changed) jobs.push(DataAPI.updatePost(p));
    });
    return Promise.all(jobs);
  }

  /* 旧版本把 Blob 的临时地址存进了 src，重启后地址失效会报 ERR_ABORTED。
     有 Blob 的直接清掉 src；没有 Blob 的换成占位图，避免继续请求失效地址 */
  function fixStaleMediaSrc() {
    var jobs = [];
    state.posts.forEach(function (p) {
      var changed = false;
      (p.media || []).forEach(function (m) {
        if (m.src && /^blob:/i.test(m.src)) {
          changed = true;
          if (m.blob) {
            delete m.src;
          } else {
            m.type = 'image';
            m.src = cover('#141416', '#0b0b0d', '', '');
          }
        }
        if (m.poster && /^blob:/i.test(m.poster)) {
          delete m.poster;
          changed = true;
        }
      });
      if (changed) jobs.push(DataAPI.updatePost(p));
    });
    return Promise.all(jobs);
  }
  function openAvatarZoom(a) {
    if (!a) return;
    var old = document.querySelector('.avatar-zoom');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var prof = profileOf(a) || {};
    var src = prof.avatar || cover('#171719', '#8d8d93', esc((a.name || 'U').slice(0, 1)), '');
    var ov = document.createElement('div');
    ov.className = 'avatar-zoom';
    ov.innerHTML = '<img src="' + src + '" alt="">';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('in'); });
    ov.addEventListener('click', function () {
      ov.classList.remove('in');
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 220);
    });
  }

  function paintAbout() {
    var e = envInfo(true);
    var list = portsList();
    var ver = $('#aboutVer');
    if (ver) ver.textContent = '版本 ' + APP_VERSION + ' · ' + (e.client === 'apk' ? 'Android APK' : (e.client === 'file' ? '本地文件' : '网页端'));
    var sub = $('#aboutSub');
    if (sub) sub.textContent = '版本 ' + APP_VERSION + ' · ' + envLabel(e);
    var box = $('#aboutEnv');
    if (!box) return;
    var rows = [
      ['设备', e.device === 'phone' ? '手机 / 平板' : '电脑'],
      ['运行方式', e.client === 'apk' ? 'APK（安卓壳）' : (e.client === 'file' ? '双击本地 index.html' : '浏览器网页')],
      ['网络', e.net === 'public' ? '公网访问' : (e.net === 'local' ? '离线（file://）' : '局域网')],
      ['当前服务器', srvBase() || '未连接'],
      ['已保存端口', list.length ? list.map(function (x) { return x.url.replace(/^https?:\/\//, ''); }).join('、') : '还没有记录'],
      ['本页地址', e.page]
    ];
    box.innerHTML = rows.map(function (r) {
      return '<div><span>' + r[0] + '</span><b>' + cacheEsc(r[1]) + '</b></div>';
    }).join('');
  }
  function openAbout() {
    paintAbout();
    $('#aboutSheet').classList.add('open');
  }

  /* ---------------- events ---------------- */
  function bind() {
    function jellySwitch(b) {
      b.classList.remove('tab-jelly');
      void b.offsetWidth;
      b.classList.add('tab-jelly');
      setTimeout(function () { b.classList.remove('tab-jelly'); }, 470);
    }
    $on('#homeTabs', 'click', function (e) {
      var b = e.target.closest('[data-home]');
      if (!b) return;
      jellySwitch(b);
      switchTab(b.dataset.home);
    });
    /* 点击/聚焦搜索框才显示搜索历史 */
    $on('#viewSearch', 'pointerdown', function (e) {
      if (!e.target.closest('.search-box')) return;
      openSearchHist(true);
      var kv = ($('#searchInput') || {}).value || '';
      if (kv.trim()) suggestSearch(kv);
    });
    $on('#searchInput', 'focus', function () {
      openSearchHist(true);
      if (this.value.trim()) suggestSearch(this.value);
    });
    /* 二级结果页里点结果区域就收起下拉框 */
    $on('#searchResults', 'click', function () { openSearchHist(false); });
    $on('#searchBack', 'click', function () { backToSearchHome(); });
    $on('#searchInput', 'input', function () {
      if (this.value.trim()) openSearchHist(true); else openSearchHist(false);
      scheduleSearch(this.value);
    });
    $on('#searchInput', 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      clearTimeout(searchTimer);
      commitSearch(this.value);
      this.blur();
    });
    $on('#searchSug', 'click', function (e) {
      var row = e.target.closest('[data-sgo],[data-sgu],[data-sgp]');
      if (!row) return;
      commitSearch(row.getAttribute('data-sgo') || row.getAttribute('data-sgu') || row.getAttribute('data-sgp') || '');
    });
    $on('#composeBtn', 'click', function () { openCompose(); });
    /* 聚焦输入框/勾选框时浏览器会把 .app 内部滚一点，藏在下面的 sheet 就露出来了 —— 立刻归零 */
    function appScrollReset() {
      var a = document.getElementById('app');
      if (a && (a.scrollTop || a.scrollLeft)) { a.scrollTop = 0; a.scrollLeft = 0; }
    }
    document.addEventListener('focusin', appScrollReset, true);
    document.addEventListener('focusout', function () { setTimeout(appScrollReset, 0); }, true);
    window.addEventListener('resize', appScrollReset);
    $on('#composeClose', 'click', closeCompose);
    $on('#composePublish', 'click', publishPost);
    $on('#composeDrafts', 'click', openDrafts);
    $on('#draftClose', 'click', closeDrafts);
    $on('#draftList', 'click', function (e) {
      var b = e.target.closest('[data-dact]');
      if (!b) return;
      var id = b.dataset.did;
      if (b.dataset.dact === 'del') { removeDraft(id); return; }
      if (b.dataset.dact === 'edit') editDraft(id);
    });
    $on('#chanPick', 'click', function (e) {
      var b = e.target.closest('[data-chan]');
      if (!b) return;
      state.composeChannel = b.dataset.chan;
      paintChanPick();
    });
    $on('#composeText', 'input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 220) + 'px';
      updatePublishState();
    });
    $on('#pickMedia', 'click', function () { $('#filePicker').click(); });
    $on('#filePicker', 'change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (files.length) addMediaFiles(files);
    });
    $on('#composePreview', 'click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (b) {
        var mid = b.dataset.rm;
        state.composeMedia = state.composeMedia.filter(function (m) {
          if (m.id === mid) {
            /* 编辑已有帖子时，媒体 URL 与信息流共用，不能回收，否则原帖图片/视频会 ERR_ABORTED */
            releaseComposeUrl(m);
            return false;
          }
          return true;
        });
        renderComposePreview();
        return;
      }
      /* 点缩略图：全屏查看，可双指/双击放大 */
      var tile = e.target.closest('.tile');
      if (!tile) return;
      var idx = -1;
      for (var i = 0; i < state.composeMedia.length; i++) {
        if (state.composeMedia[i].id === tile.dataset.mid) { idx = i; break; }
      }
      if (idx >= 0) {
        var cm = state.composeMedia[idx];
        if (!cm || (!cm.blob && !cm.src)) { toast('媒体还在准备中，请稍候'); return; }
        openViewer({ media: state.composeMedia }, idx);
      }
    });

    $on('#newNoteBtn', 'click', function () { openNote(null); });
    $on('#noteClose', 'click', closeNote);
    $on('#noteSave', 'click', saveNote);
    $on('#noteDelete', 'click', deleteNote);
    $on('#notesList', 'click', function (e) {
      var row = e.target.closest('.note');
      if (!row) return;
      var id = row.dataset.id;
      var note = state.notes.filter(function (n) { return n.id === id; })[0];
      if (note) openNote(note);
    });

    /* 18+ 遮罩的显示/隐藏：手机上没有 hover，只能靠这一条状态机来回切。
       以前「隐藏」只有 12px 文字、点一下还会顺带打开详情，等于按不到。 */
    function applyVeil(rid, reveal) {
      if (!rid) return;
      if (reveal) state.revealed[rid] = true;
      else delete state.revealed[rid];
      /* 同一条帖子在首页 / 说说 / 我的 / 详情里可能同时存在好几份 DOM，
         以前 break 只更新第一份（往往是隐藏视图里那份），眼前这份反而不变，看起来就是「点了没反应」。 */
      var list = document.querySelectorAll('.post');
      for (var i = 0; i < list.length; i++) {
        var host = list[i];
        if (host.dataset.id !== rid) continue;
        var boxes = host.querySelectorAll('.pmedia');
        for (var j = 0; j < boxes.length; j++) {
          var box = boxes[j];
          var veil = box.querySelector('.pveil');
          if (!veil) continue;
          box.classList.toggle('private', !reveal);
          veil.classList.toggle('hide-mode', !!reveal);
          var btn = veil.querySelector('.pveil-btn');
          if (btn) {
            btn.textContent = reveal ? '隐藏' : '显示';
            if (reveal) { btn.setAttribute('data-hide', rid); btn.removeAttribute('data-reveal'); }
            else { btn.setAttribute('data-reveal', rid); btn.removeAttribute('data-hide'); }
          }
        }
      }
      /* 揭示后视频要重新挂载懒加载，否则封面停在模糊帧 */
      if (typeof hydrateVideoCovers === 'function') hydrateVideoCovers();
    }


    document.addEventListener('click', function (e) {
      var profEl = e.target.closest('[data-prof]');
      if (profEl) {
        if (profEl.dataset.prof) openUser(profEl.dataset.prof);
        return;
      }
      if (e.target.closest('#profileAvatar')) { openAvatarZoom(ME); return; }
      if (e.target.closest('#userAvatar')) { openAvatarZoom(findAuthor(state.userKey)); return; }
      var ptab = e.target.closest('[data-ptab]');
      if (ptab) {
        state.profileTab = ptab.dataset.ptab;
        state.profileTabJelly = ptab.dataset.ptab;
        renderProfile();
        setTimeout(function () { state.profileTabJelly = null; }, 620);
        return;
      }
      var cpost = e.target.closest('[data-cpost]');
      if (cpost) {
        var cpostId = cpost.dataset.cpost;
        if (findPost(cpostId)) { openPost(cpostId); return; }
        var remoteMatch = /^srv_(\d+)$/.exec(cpostId);
        if (!remoteMatch || !Srv.on()) { toast('原帖已删除'); return; }
        cpost.disabled = true;
        var ready = Srv.canSync() ? Srv.ensure() : Promise.resolve(null);
        ready.then(function () { return Srv.getPost(Number(remoteMatch[1])); }).then(function (d) {
          var p = cacheRemotePost(d && d.post);
          if (p) openPost(p.id); else toast('原帖已删除');
        }).catch(function (err) {
          console.warn('原帖加载失败', err);
          toast('原帖加载失败，请检查服务器连接');
        }).then(function () { cpost.disabled = false; });
        return;
      }
      var hdel = e.target.closest('[data-hdel]');
      if (hdel) {
        var hv = hdel.dataset.hdel;
        saveSearchHist(loadSearchHist().filter(function (x) { return x !== hv; }));
        renderSearchHist();
        refreshSearchDrop();
        return;
      }
      if (e.target.closest('[data-hclear]')) {
        saveSearchHist([]);
        renderSearchHist();
        refreshSearchDrop();
        return;
      }
      var hotItem = e.target.closest('[data-hot]');
      if (hotItem) { openPost(hotItem.dataset.hot); return; }
      var hq = e.target.closest('[data-hq]');
      if (hq) {
        var qv = hq.dataset.hq;
        $('#searchInput').value = qv;
        addSearchHist(qv);
        runSearch(qv);
        return;
      }
      var akey = e.target.closest('[data-akey]');
      if (akey) { openUser(akey.dataset.akey); return; }
      var article = e.target.closest('.post');
      if (!article) return;
      var id = article.dataset.id;
      var post = findPost(id);

      var reveal = e.target.closest('[data-reveal]');
      if (reveal) {
        applyVeil(reveal.dataset.reveal, true);
        return;
      }

      var hide = e.target.closest('[data-hide]');
      if (hide) {
        applyVeil(hide.dataset.hide, false);
        return;
      }

      /* 点遮罩本身也算「显示」，但不能再往下走，否则会顺带把详情页顶上来。
         手机上一个手指按住 12px 的「隐藏」文字几乎按不中，这条分支是主要入口。 */
      var veilTap = e.target.closest('.pveil');
      if (veilTap) {
        var veilHost = veilTap.closest('.post');
        if (veilHost) applyVeil(veilHost.dataset.id, true);
        return;
      }

      if (e.target.closest('button[data-act]')) { handlePostClick(e); return; }

      if (post) {
        var expand = e.target.closest('[data-vact="expand"]');
        if (expand) { openViewer(post, +expand.closest('.vplayer').dataset.midx); return; }
        if (e.target.closest('.vctrl')) return;
        var stage = e.target.closest('.vstage');
        if (stage) {
          if (Date.now() - state.lastLongPress < 350) return;
          var vpHit = stage.closest('.vplayer');
          /* 多附件里的视频方块：直接开查看器。在 1:1 小方格里就地播放大视频又卡又看不清 */
          if (vpHit && vpHit.classList.contains('vgrid')) { openViewer(post, +vpHit.dataset.midx); return; }
          /* 单视频：点击就地播放/暂停，需要放大时用右下角的放大按钮 */
          toggleInlineVideo(vpHit);
          return;
        }
        var img = e.target.closest('.pmedia img');
        if (img) { openViewer(post, +img.dataset.midx); return; }
      }

      if (state.detailPostId !== id) openPost(id);
    });

    /* 登录 / 注册 */
    $$('.auth-tabs button').forEach(function (b) {
      b.addEventListener('click', function () { setAuthMode(b.dataset.authTab); });
    });
    $on('#authSubmit', 'click', function () {
      var u = $('#authUser').value.trim();
      var p = $('#authPass').value;
      if (!u) { $('#authErr').textContent = '请输入账号'; return; }
      if (!p) { $('#authErr').textContent = '请输入密码'; return; }
      if (authMode === 'register') {
        var p2 = $('#authPass2');
        var p2v = p2 ? p2.value : '';
        if (!p2v) { $('#authErr').textContent = '请再输一次密码'; return; }
        if (p2v !== p) { $('#authErr').textContent = '两次输入的密码不一致'; return; }
        if (p.length < 6) { $('#authErr').textContent = '密码至少 6 位'; return; }
      }
      if (Srv.on()) {
        $('#authErr').textContent = '正在连接服务器…';
        $('#authSubmit').disabled = true;
        remoteAuth(authMode, u, p, $('#authNick').value).then(function (err) {
          $('#authSubmit').disabled = false;
          if (err) $('#authErr').textContent = err;
          else $('#authErr').textContent = '';
        });
        return;
      }
      var err = authMode === 'register'
        ? registerUser(u, p, $('#authNick').value)
        : loginUser(u, p);
      if (err) $('#authErr').textContent = err;
    });
    $on('#authPass', 'keydown', function (e) {
      if (e.key === 'Enter') $('#authSubmit').click();
    });
    $on('#authPass2', 'keydown', function (e) {
      if (e.key === 'Enter') $('#authSubmit').click();
    });
    $on('#guestBtn', 'click', guestLogin);
    $on('#localModeBtn', 'click', function () {
      setSrvOff();
      LS.removeItem(SRV_KEY);
      LS.removeItem(SRV_TOKEN_KEY);
      LS.removeItem(SRV_USER_KEY);
      setAuthMode(authMode);
      toast('已切回本机登录');
    });

    /* 帖子详情 */
    $on('#postBack', 'click', closePost);
    $on('#replySend', 'click', sendReply);
  $on('#replyAttach', 'click', function () {
    var f = $('#replyFile');
    if (f) f.click();
  });
  $on('#replyFile', 'change', function (e) {
    var f = e.target.files && e.target.files[0];
    try { e.target.value = ''; } catch (err) { /* 忽略 */ }
    if (f) replyMediaPick(f);
  });
  $on('#replyChip', 'click', function (e) {
    if (e.target.closest('[data-chipdel]')) replyMediaClear();
  });
    $on('#replyInput', 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendReply(); }
    });
    $on('#postBody', 'click', function (e) {
      var b = e.target.closest('[data-creply]');
      if (!b) return;
      e.stopPropagation();
      beginCommentReply(b.dataset.creply);
    });
    $on('#replyCancel', 'click', function () {
      state.replyTo = null;
      paintReplyTarget();
      $('#replyInput').focus();
    });

    /* 图片 / 视频查看 */
    $on('#mvClose', 'click', closeViewer);
    $on('#mvPrev', 'click', function () { stepViewer(-1); });
    $on('#mvNext', 'click', function () { stepViewer(1); });
    var mvStartX = null;
    var mvPan = null;
    var mvPinch = null;
    var mvLastTap = 0;
    function mvDist(t) {
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
    }
    $on('#mvStage', 'touchstart', function (e) {
      if (e.touches.length !== 2 || !e.target.closest('.mv-content>img')) return;
      mvStartX = null;
      mvPan = null;
      mvPinch = { dist: mvDist(e.touches), scale: mvZoom.scale };
    }, { passive: true });
    $on('#mvStage', 'touchmove', function (e) {
      if (!mvPinch || e.touches.length !== 2) return;
      mvZoom.scale = mvPinch.scale * (mvDist(e.touches) / mvPinch.dist);
      clampMvZoom();
      applyMvZoom(false);
    }, { passive: true });
    $on('#mvStage', 'touchend', function (e) {
      if (e.touches.length < 2) mvPinch = null;
      if (mvZoom.scale <= 1.01) resetMvZoom();
    });
    $on('#mvStage', 'pointerdown', function (e) {
      if (mvPinch) return;
      if (!e.target.closest('.mv-content>img')) { mvStartX = null; mvPan = null; return; }
      mvStartX = e.clientX;
      mvPan = { x: e.clientX, y: e.clientY, tx: mvZoom.tx, ty: mvZoom.ty, moved: false };
    });
    $on('#mvStage', 'pointermove', function (e) {
      if (!mvPan || mvPinch) return;
      var dx = e.clientX - mvPan.x;
      var dy = e.clientY - mvPan.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) mvPan.moved = true;
      if (mvZoom.scale <= 1) return;
      mvZoom.tx = mvPan.tx + dx;
      mvZoom.ty = mvPan.ty + dy;
      clampMvZoom();
      applyMvZoom(false);
    });
    $on('#mvStage', 'pointerup', function (e) {
      var start = mvStartX;
      var moved = !!(mvPan && mvPan.moved);
      mvStartX = null;
      mvPan = null;
      if (start === null) return;
      if (moved) {
        var dx = e.clientX - start;
        /* 放大状态下拖动是平移图片，不切图 */
        if (mvZoom.scale <= 1.01 && Math.abs(dx) > 50) { stepViewer(dx < 0 ? 1 : -1); return; }
      }
      /* 双击：未放大时放大，已放大时还原 */
      var now = Date.now();
      if (now - mvLastTap < 300) {
        mvLastTap = 0;
        if (mvZoom.scale > 1.01) { resetMvZoom(); return; }
        var stage = $('#mvStage');
        var rect = stage.getBoundingClientRect();
        var cx = e.clientX - rect.left - rect.width / 2;
        var cy = e.clientY - rect.top - rect.height / 2;
        mvZoom.scale = 2.4;
        mvZoom.tx = -cx * (mvZoom.scale - 1);
        mvZoom.ty = -cy * (mvZoom.scale - 1);
        clampMvZoom();
        applyMvZoom(true);
      } else {
        mvLastTap = now;
      }
    });
    $on('#mvStage', 'wheel', function (e) {
      if (!e.target.closest('.mv-content>img')) return;
      e.preventDefault();
      mvZoom.scale = mvZoom.scale * (e.deltaY < 0 ? 1.15 : 0.87);
      clampMvZoom();
      applyMvZoom(false);
    }, { passive: false });
    /* 多视频帖：左右滑动 / 滚轮 / 方向键切换，不再用左右按钮 */
    var mvSwipe = null;
    var mvWheelAcc = 0, mvWheelAt = 0;
    var mvTap = null, mvSuppressClick = false;
    function mvSwipeOn() { return $('#mediaViewer').classList.contains('vswipe'); }
    function mvSwipeSkip(t) {
      return !!(t && t.closest && t.closest('.mv-ctl,.mv-scrub,.mv-author,.mv-acts,.mv-x,.mv-nav,#mvClose,#mvCount,.vbigplay'));
    }
    function mvContentW() {
      var b = $('#mvContent');
      return (b && b.getBoundingClientRect().width) || 360;
    }
    /* 跟手：内容 1:1 跟随手指（横向），只做轻微淡出 */
    function mvSwipePaint(dx, animate) {
      var b = $('#mvContent');
      if (!b) return;
      var w = mvContentW();
      b.style.transition = animate ? 'transform .26s cubic-bezier(.22,1,.36,1),opacity .2s ease-out' : 'none';
      b.style.transform = 'translateX(' + dx + 'px)';
      b.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / (w * 1.4)));
    }
    /* 提交切换：旧内容滑出 → 换内容 → 新内容从反方向滑入 */
    function mvSwipeCommit(dir) {
      var b = $('#mvContent');
      var out = mvContentW() + 30;
      if (b) {
        b.style.transition = 'transform .18s cubic-bezier(.32,0,.67,0),opacity .18s linear';
        b.style.transform = 'translateX(' + (dir > 0 ? -out : out) + 'px)';
        b.style.opacity = '.18';
      }
      setTimeout(function () {
        stepViewer(dir);
        var nb = $('#mvContent');
        if (!nb) return;
        var w = (nb.getBoundingClientRect().width || 360) + 30;
        nb.style.transition = 'none';
        nb.style.transform = 'translateX(' + (dir > 0 ? w : -w) + 'px)';
        nb.style.opacity = '.18';
        void nb.offsetWidth;
        nb.style.transition = 'transform .26s cubic-bezier(.22,1,.36,1),opacity .22s ease-out';
        nb.style.transform = 'translateX(0)';
        nb.style.opacity = '1';
      }, 175);
    }
    function mvSwipeEnd(commit) {
      var s = mvSwipe;
      mvSwipe = null;
      if (!s) return;
      if (!s.moved) { mvSwipePaint(0, true); return; }
      var dx = s.dx || 0, vel = s.vx || 0;
      var dir = dx < 0 ? 1 : -1;
      if (Math.abs(vel) > 0.45) dir = vel < 0 ? 1 : -1;
      var far = Math.abs(dx) > 76 || Math.abs(vel) > 0.45;
      var v0 = state.viewer;
      var ok = !!(commit && far && v0);
      if (ok) {
        var target = v0.index + dir;
        if (target < 0 || target >= v0.media.length) ok = false;
      }
      if (ok) mvSwipeCommit(dir);
      else mvSwipePaint(0, true);
    }
    /* 点画面：只收起 / 展开下方按键，不动播放状态（暂停走控制条的播放键） */
    function mvTapToggle() {
      var wv = $('#mediaViewer');
      if (!wv.classList.contains('video')) return false;
      wv.classList.toggle('chrome-off');
      return true;
    }
    $on('#mvStage', 'pointerdown', function (e) {
      mvSuppressClick = false;
      if (mvSwipeSkip(e.target)) { mvTap = null; return; }
      mvTap = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
      if (!mvSwipeOn()) return;
      mvSwipe = { x: e.clientX, y: e.clientY, dx: 0, moved: false, lastX: e.clientX, lastT: Date.now(), vx: 0 };
    });
    $on('#mvStage', 'pointermove', function (e) {
      if (mvTap && (Math.abs(e.clientX - mvTap.x) > 10 || Math.abs(e.clientY - mvTap.y) > 10)) mvTap.moved = true;
      if (!mvSwipe) return;
      var dx = e.clientX - mvSwipe.x, dy = e.clientY - mvSwipe.y;
      if (!mvSwipe.moved) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.05) mvSwipe.moved = true;
        else return;
      }
      var now = Date.now();
      mvSwipe.vx = (e.clientX - mvSwipe.lastX) / Math.max(1, now - mvSwipe.lastT);
      mvSwipe.lastX = e.clientX;
      mvSwipe.lastT = now;
      mvSwipe.dx = dx;
      mvSwipePaint(dx, false);
    });
    $on('#mvStage', 'pointerup', function () {
      var t = mvTap;
      mvTap = null;
      mvSwipeEnd(true);
      if (!t || t.moved) return;
      if (Date.now() - t.t > 420) return;
      if (mvTapToggle()) mvSuppressClick = true;
    });
    $on('#mvStage', 'pointercancel', function () { mvTap = null; mvSwipeEnd(false); });
    $on('#mvStage', 'pointerleave', function () { mvTap = null; mvSwipeEnd(false); });
    /* 指画面点一下时，拦掉播放器自带的「点一下切播放/暂停」，交给上面的开关统一处理 */
    $on('#mvStage', 'click', function (e) {
      if (!mvSuppressClick) return;
      mvSuppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
    $on('#mvStage', 'wheel', function (e) {
      if (!mvSwipeOn()) return;
      if (e.target.closest && e.target.closest('.mv-scrub')) return;
      e.preventDefault();
      mvWheelAcc += e.deltaY;
      var now = Date.now();
      if (now - mvWheelAt < 200) return;
      if (Math.abs(mvWheelAcc) < 38) return;
      var wd = mvWheelAcc > 0 ? 1 : -1;
      mvWheelAcc = 0;
      mvWheelAt = now;
      stepViewer(wd);
    }, { passive: false });
    document.addEventListener('keydown', function (e) {
      if (!mvSwipeOn() || !$('#mediaViewer').classList.contains('open')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); stepViewer(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); stepViewer(-1); }
    });

    $on('#menuFav', 'click', function () {
      var p = findPost(state.menuPostId);
      if (p) {
        var added = toggleFav(p.id);
        toast(added ? '已收藏' : '已取消收藏');
      }
      closeMenu();
    });
    $on('#menuCopy', 'click', function () {
      var p = findPost(state.menuPostId);
      if (p) copyText(p.text || '');
      closeMenu();
    });
    $on('#menuEdit', 'click', function () {
      var p = findPost(state.menuPostId);
      closeMenu();
      if (p && sameAuthor(p.author)) openCompose(p);
    });
    $on('#menuDelete', 'click', function () {
      var id = state.menuPostId;
      closeMenu();
      var p = findPost(id);
      if (!p) return;
      var official = p.author && (p.author.official || p.author.handle === 'u_official');
      confirmDialog({
        title: '删除这条帖子？',
        desc: official ? '删除后可在「设置 → 数据恢复」中找回。' : '删除后无法恢复。',
        okText: '删除'
      }).then(function (ok) {
        if (!ok) return;
        /* 服务器同步过来的帖（有 remoteId）必须走 DELETE /api/posts/:id，
           否则别人和管理台还看得见；只有纯本机的种子帖才是「打个标记」。 */
        var onServer = !!(p.remoteId && typeof Srv !== 'undefined' && Srv.canSync());
        if (official && !onServer) {
          p.deleted = true;
          lanMarkDeleted(id);
          DataAPI.updatePost(p).then(function () {
            if (state.detailPostId === id) closePost();
            renderFeed();
            renderTalk();
            if (state.tab === 'profile') renderProfile();
            toast('已删除');
            if (lanEnabled()) lanTick();
          });
          return;
        }
        DataAPI.deletePost(id).then(function () {
          state.posts = state.posts.filter(function (x) { return x.id !== id; });
          lanMarkDeleted(id);
          if (state.detailPostId === id) closePost();
          renderFeed();
          renderTalk();
          if (state.tab === 'profile') renderProfile();
          toast('已删除');
          if (lanEnabled()) lanTick();
        });
      });
    });
    $on('#menuCancel', 'click', closeMenu);
    $on('#menuSheet', 'click', function (e) {
      if (e.target === this) closeMenu();
    });

    /* 首页右滑抽屉 / 收藏 / 历史记录 */
    var sideOpenedAt = 0;
    $on('#sideBackdrop', 'click', function () {
      /* 刚用手势打开时，手指抬起产生的 click 会落在遮罩上，忽略它避免刚打开就关闭 */
      if (Date.now() - sideOpenedAt < 420) return;
      closeSide();
    });
    $on('#sideListBack', 'click', function () { $('#sideListSheet').classList.remove('open'); });
    var sideTapHandled = 0;
    document.addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('[data-side]') : null;
      if (!item) return;
      sideTapHandled = Date.now();
      sideAction(item.dataset.side);
    });
    /* 抽屉是滑动打开的，安卓 WebView 里紧接着的那次点击偶尔被吞掉（click 不触发），
       这里用 pointerup 兜底：260ms 内没有等到 click 就自己执行一次。 */
    document.addEventListener('pointerup', function (e) {
      var item = e.target.closest ? e.target.closest('[data-side]') : null;
      if (!item) return;
      var t0 = Date.now();
      setTimeout(function () {
        if (sideTapHandled >= t0) return;
        sideTapHandled = Date.now();
        sideAction(item.dataset.side);
      }, 260);
    }, true);
    /* 抽屉内长按按钮会触发系统原生文字选择 / 拖拽，右侧会闪灰色竖条：屏蔽原生长按行为 */
    (function () {
      var d = $('#sideDrawer');
      if (!d) return;
      ['contextmenu', 'selectstart', 'dragstart'].forEach(function (ev) {
        d.addEventListener(ev, function (e) { e.preventDefault(); });
      });
    })();

    /* 抽屉头像：短按进入我的主页，长按放大头像 */
    var sideAvatarTimer = null;
    var sideAvatarLong = false;
    function clearSideAvatarTimer() {
      if (sideAvatarTimer) { clearTimeout(sideAvatarTimer); sideAvatarTimer = null; }
      $('#sideAvatar').classList.remove('long');
    }
    function showAvatarZoom() {
      if (!ME) return;
      openAvatarZoom(ME);
    }
    function openMyProfile() {
      closeSide();
      $$('.sheet.open').forEach(function (s) { s.classList.remove('open'); });
      switchTab('profile');
      var v = $('#viewProfile');
      if (v) v.scrollTop = 0;
    }
    $on('#sideAvatar', 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      sideAvatarLong = false;
      clearSideAvatarTimer();
      $('#sideAvatar').classList.add('long');
      sideAvatarTimer = setTimeout(function () {
        sideAvatarTimer = null;
        sideAvatarLong = true;
        $('#sideAvatar').classList.remove('long');
        showAvatarZoom();
      }, 520);
    });
    $on('#sideAvatar', 'pointerup', function () {
      clearSideAvatarTimer();
      if (sideAvatarLong) setTimeout(function () { sideAvatarLong = false; }, 650);
    });
    $on('#sideAvatar', 'pointerleave', clearSideAvatarTimer);
    $on('#sideAvatar', 'pointercancel', function () {
      clearSideAvatarTimer();
      sideAvatarLong = false;
    });
    $on('#sideAvatar', 'contextmenu', function (e) { e.preventDefault(); });
    $on('#sideAvatar', 'click', function (e) {
      e.preventDefault();
      if (sideAvatarLong) { sideAvatarLong = false; return; }
      openMyProfile();
    });
    /* 放大头像关闭后，下一次短按立即恢复正常 */
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.avatar-zoom')) sideAvatarLong = false;
    }, true);
    /* 任意界面右滑打开二级菜单：只认横向位移明显大于纵向的拖动，
       输入框、图片/视频查看器和游戏画面不抢手势。 */
    var sideStart = null;
    var SIDE_DX = 52;   // 打开抽屉所需的最小横向位移
    function sideBlockedTarget(t) {
      return !!(t && t.closest && t.closest('input,textarea,select,[contenteditable="true"],#mediaViewer,#gameSheet,.swipe'));
    }
    /* 只有一级页面（首页/说说/搜索/通知/私信）允许右滑拉出二级菜单；
       设置、收藏、历史、游戏、帖子详情等二级界面不再响应右滑 */
    var SIDE_ALLOWED_TABS = { feed: 1, talk: 1, search: 1, notify: 1, dm: 1 };
    function sideCanStart() {
      if (state.banned) return false;
      if (!SIDE_ALLOWED_TABS[state.tab]) return false;
      if (document.querySelector('#dmList .swipe.open')) return false;
      if ($('#sideDrawer').classList.contains('open')) return false;
      if (document.querySelector('.avatar-zoom')) return false;
      if (document.querySelector('.sheet.open, .overlay.open, #mediaViewer.open')) return false;
      return true;
    }
    /* 起点在会话行上时不参与抽屉手势；起点在别处时先收起已展开的会话行 */
    function sideCloseOpenSwipe() {
      var opened = document.querySelectorAll('#dmList .swipe.open');
      if (!opened.length) return false;
      Array.prototype.forEach.call(opened, function (el) { el.classList.remove('open'); });
      return true;
    }
    function sideCheck(x, y) {
      if (!sideStart) return;
      var dx = x - sideStart.x;
      var ady = Math.abs(y - sideStart.y);
      /* 明显的纵向滚动 / 向左拖动：放弃本次手势 */
      if (dx < -12 || ady > dx * 1.4 + 26) { sideStart = null; return; }
      if (dx >= SIDE_DX && dx > ady * 1.2) {
        sideStart = null;
        sideOpenedAt = Date.now();
        openSide();
      }
    }
    document.addEventListener('touchstart', function (e) {
      if (sideBlockedTarget(e.target)) { sideStart = null; return; }
      if (sideCloseOpenSwipe()) { sideStart = null; return; }
      if (!sideCanStart() || e.touches.length !== 1) { sideStart = null; return; }
      var t = e.touches[0];
      sideStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!sideStart || !e.touches.length) return;
      var t = e.touches[0];
      var dx = t.clientX - sideStart.x;
      var dy = Math.abs(t.clientY - sideStart.y);
      sideCheck(t.clientX, t.clientY);
      /* 横向拖动时抢下手势：否则浏览器 / WebView 会当成「后退」边缘滑动，页面直接被弹走 */
      if (dx > 10 && dx > dy * 1.2 && e.cancelable) e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchend', function () { sideStart = null; });
    document.addEventListener('touchcancel', function () { sideStart = null; });

    /* 桌面 / 浏览器预览：鼠标按住向右拖也能打开 */
    var sideMouseDown = false;
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (sideBlockedTarget(e.target)) return;
      if (sideCloseOpenSwipe()) return;
      if (!sideCanStart()) return;
      sideMouseDown = true;
      sideStart = { x: e.clientX, y: e.clientY };
    });
    document.addEventListener('pointermove', function (e) {
      if (!sideMouseDown || e.pointerType !== 'mouse') return;
      sideCheck(e.clientX, e.clientY);
    });
    document.addEventListener('pointerup', function () {
      sideMouseDown = false;
      sideStart = null;
    });

    $on('#aboutClose', 'click', function () { $('#aboutSheet').classList.remove('open'); });

    /* 用户主页 / 编辑资料 */
    $on('#userBack', 'click', function () {
      $('#userMoreMenu').classList.remove('on');
      $('#userSheet').classList.remove('open');
    });
    $on('#userSheet .sheet-body', 'click', function () { $('#userMoreMenu').classList.remove('on'); });
    $on('#userMoreBtn', 'click', function (e) {
      e.stopPropagation();
      $('#userMoreMenu').classList.toggle('on');
    });
    $on('#userBlockAction', 'click', function () {
      var key = state.userKey;
      if (!key) return;
      var on = toggleBlockKey(key);
      if (on) rememberBlockInfo(key, blockDisplay(key));
      var btn = $('#userBlockAction');
      btn.textContent = on ? '取消拉黑' : '拉黑用户';
      btn.classList.toggle('danger', !on);
      $('#userMoreMenu').classList.remove('on');
      updateBlockSub();
      renderBlockList();
      toast(on ? '已拉黑，ta 的内容将不再显示' : '已解除拉黑');
      renderFeed();
      renderTalk();
      if (state.tab === 'search') runSearch($('#searchInput').value);
      /* 拉黑后立即收起主页内容，只保留解除拉黑入口 */
      openUser(key);
    });
    $on('#userUnblockBtn', 'click', function () {
      var key = state.userKey;
      if (!key) return;
      toggleBlockKey(key);
      updateBlockSub();
      renderBlockList();
      renderFeed();
      renderTalk();
      if (state.tab === 'search') runSearch($('#searchInput').value);
      toast('已解除拉黑');
      openUser(key);
    });
    $on('#followBack', 'click', function () { $('#followSheet').classList.remove('open'); });
    /* 关注 / 粉丝列表：点数字打开列表，点行进入主页，点按钮关注 */
    document.addEventListener('click', function (e) {
      var stat = e.target.closest('[data-followlist]');
      if (stat) {
        openFollowList(stat.dataset.followlist, stat.dataset.followkey);
        return;
      }
      var fb = e.target.closest('[data-followtoggle]');
      if (fb) {
        e.stopPropagation();
        requestFollowToggle(fb.dataset.followtoggle, fb);
        return;
      }
      var row = e.target.closest('#followList .frow');
      if (row) {
        var uk = row.dataset.user;
        $('#followSheet').classList.remove('open');
        openUser(uk);
      }
    });
    $on('#userEditBtn', 'click', function () { openEditProfile(); });
    $on('#userFollowBtn', 'click', function () {
      if (!state.userKey) return;
      requestFollowToggle(state.userKey, $('#userFollowBtn'));
    });
    $on('#userTabs', 'click', function (e) {
      var b = e.target.closest('[data-utab]');
      if (!b) return;
      state.userTab = b.dataset.utab;
      jellySwitch(b);
      renderUserActivity(state.userKey);
    });
    $on('#userDmBtn', 'click', function () {
      var key = state.userKey;
      var peer = remoteAuthorForKey(key);
      if (peer) { openDM(null, peer); return; }
      var a = findAuthor(key);
      var handle = a && a.handle;
      if (!handle || !Srv.on()) { toast('该用户暂不支持服务器私信'); return; }
      toast('正在打开私信…');
      Srv.ensure().then(function () { return Srv.userProfile(handle); }).then(function (p) {
        var raw = p && p.user;
        if (!raw) throw new Error('找不到该用户');
        openDM(null, rememberRemoteUser(raw) || raw);
      }).catch(function (e) {
        toast((e && e.message) || '私信加载失败');
      });
    });
    $on('#editProfileClose', 'click', function () { $('#editProfileSheet').classList.remove('open'); });
    $on('#editProfileSave', 'click', saveEditProfile);
    $on('#editAvatarBtn', 'click', function () { pickProfileImage('avatar'); });
    $on('#editCoverBtn', 'click', function () { pickProfileImage('banner'); });
    $on('#profilePicker', 'change', function (e) {
      var f = e.target.files && e.target.files[0];
      var target = state.pickTarget;
      if (!f || !target || !state.editProf) return;
      var isAvatar = target === 'avatar';
      readImageFile(f, isAvatar ? 320 : 1200, isAvatar ? 320 : 420, isAvatar ? 0.86 : 0.72)
        .then(function (url) {
          state.editProf[isAvatar ? 'avatar' : 'banner'] = url;
          if (isAvatar) paintEditAvatar(); else paintEditCover();
        })
        .catch(function () { toast('这张图片无法读取，请换一张'); });
    });

    /* 设置 */
    $on('#settingsClose', 'click', closeSettings);
    $on('#settingsBtn', 'click', openSettings);
    $on('#backBtn', 'click', function () {
      if (state.tab === 'notes') {
        switchTab(state.notesBack === 'profile' ? 'profile' : 'feed');
        return;
      }
      switchTab(state.backTab && state.backTab !== 'profile' && state.backTab !== 'notes' ? state.backTab : 'feed');
    });
    $on('#authGear', 'click', function () {
      document.body.classList.add('auth-settings');
      openSettings();
    });
    /* 设置二级页：账号与安全 / 隐私 / 通用设置 / 清理数据 / 互联网设置 */
    $on('#accountSecRow', 'click', function () { updateSettingsSubs(); openSubSheet('accountSecSheet'); });
    $on('#accountSecClose', 'click', function () { closeSheetById('accountSecSheet'); });
    $on('#privacyRow', 'click', function () { renderBlockList(); updateBlockSub(); openSubSheet('privacySheet'); });
    $on('#privacyClose', 'click', function () { closeSheetById('privacySheet'); });
    $on('#generalRow', 'click', function () { paintThemeSeg(); openSubSheet('generalSheet'); });
    $on('#generalClose', 'click', function () { closeSheetById('generalSheet'); });
        $on('#netRow', 'click', function () { paintAdminRows(); updateSrvStatus(); updateLanStatus(); openSubSheet('netSheet'); });
    $on('#netClose', 'click', function () { closeSheetById('netSheet'); });
    $on('#versionsClose', 'click', function () { closeSheetById('versionsSheet'); });
  $on('#versionsDl', 'click', openApkSheet);
  $on('#apkClose', 'click', function () { closeSheetById('apkSheet'); });
  $on('#feedbackClose', 'click', function () { closeSheetById('feedbackSheet'); });
  $on('#fbPick', 'click', function () { var p = $('#fbFile'); if (p) p.click(); });
  $on('#fbFile', 'change', function (e) { fbAddFiles(e.target.files); e.target.value = ''; });
  $on('#fbPreview', 'click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-fbrm]') : null;
    if (!b) return;
    var i = Number(b.getAttribute('data-fbrm'));
    var f = fbPending[i];
    if (!f) return;
    try { URL.revokeObjectURL(f.url); } catch (e2) {}
    fbPending.splice(i, 1);
    renderFbPreview();
  });
  $on('#fbSend', 'click', sendFeedback);

  $on('#apkBody', 'click', function (e) {
    var ins = e.target.closest ? e.target.closest('[data-apkinst]') : null;
    if (ins) { installLocalApk(ins.getAttribute('data-apkinst')); return; }
    var del = e.target.closest ? e.target.closest('[data-apkdel]') : null;
    if (del) {
      var dname = del.getAttribute('data-apkdel') || '';
      var host = window.UHost;
      var inApp = !!(host && (typeof host.deleteApkEx === 'function' || typeof host.deleteApk === 'function' || typeof host.listApks === 'function'));
      var canFs = !inApp && fhCanPick();
      var desc;
      if (inApp) {
        desc = '会从这台手机的「下载」目录里真正删掉「' + dname + '」，历史版本里的记录还在，需要时再下载一次即可。';
      } else if (canFs) {
        desc = '会把浏览器保存的「' + dname + '」从磁盘上删掉，历史版本里的记录还在，需要时再下载一次即可。';
      } else {
        desc = '「' + dname + '」是浏览器下载的，网页没有权限删手机或电脑里的文件。点删除只会把这一行从列表移掉，文件请到浏览器的「下载内容」里删。用 App 下载的包，这里的删除会真的删掉文件。';
      }
      confirmDialog({ title: '删除安装包？', desc: desc, okText: '删除' }).then(function (yes) {
        if (!yes) return;
        apkDeleteFile(dname, inApp).then(function (r) {
          apkForget(dname);
          try { openApkSheet(); } catch (e3) { /* 忽略 */ }
          var msg = (r && r.msg) ? r.msg : ('已从列表移除 ' + dname + (inApp || canFs ? '' : '，文件请在浏览器「下载内容」里删'));
          toast(msg);
        });
      });
      return;
    }
    var ag = e.target.closest ? e.target.closest('[data-apkagain]') : null;
    if (!ag) return;
    var id = ag.getAttribute('data-apkagain');
    if (!id) { toast('请到「历史版本」里重新下载'); return; }
    var row = ag.closest('.ver-row');
    var it = versionsCache.filter(function (x) { return String(x.id) === String(id); })[0] || {};
    downloadVersion(id, it.file || ('U-' + (it.version || id) + '.apk'), row, ag);
  });
    bindVersions();
    /* 黑名单 */
    $on('#blockListRow', 'click', function () {
      renderBlockList();
      $('#blockSheet').classList.add('open');
    });
    $on('#blockClose', 'click', function () { $('#blockSheet').classList.remove('open'); });
    $on('#blockList', 'click', function (e) {
      var b = e.target.closest('[data-unblock]');
      if (!b) return;
      toggleBlockKey(b.dataset.unblock);
      renderBlockList();
      updateBlockSub();
      renderFeed();
      renderTalk();
      if (state.tab === 'search') runSearch($('#searchInput').value);
      toast('已解除拉黑');
    });
    /* 外观 */
    $$('#themeSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        LS.setItem('u-theme', b.dataset.theme);
        applyTheme();
      });
    });
    $on('#srvSave', 'click', function () {
      var url = $('#srvUrl').value.trim();
      if (!url) { toast('请填写服务器地址'); return; }
      if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
      /* 只保留协议+主机+端口，去掉误加的 /admin 等路径 */
      var m = url.match(/^(https?):\/\/([^\/]+)/i);
      if (m) url = m[1].toLowerCase() + '://' + m[2];
      var hm = url.match(/^(https?:\/\/)([^:\/]+)(:(\d+))?$/i);
      if (hm) {
        if (!hm[4]) url = hm[1] + hm[2] + ':8787';
        if (/^(127\.0\.0\.1|localhost|0\.0\.0\.0)$/i.test(hm[2])) {
          $('#authErr').textContent = '';
          updateSrvStatus('地址不能填 127.0.0.1，手机要填电脑的局域网 IP');
          toast('请填电脑的局域网 IP，例如 http://192.168.1.10:8787');
          return;
        }
      }
      var old = srvBase();
      LS.setItem(SRV_KEY, url);
      clearSrvOff();
      updateSrvStatus('正在连接…');
      Srv.ping().then(function () {
        if (old && old !== url) {
          LS.removeItem(SRV_TOKEN_KEY);
          LS.removeItem(SRV_USER_KEY);
        }
        updateSrvStatus('已连接 ' + url);
        savePort(url, /^https:/i.test(url) ? 'public' : 'lan');
        toast('服务器已连接');
        loadSrvConfig();
        if (srvToken()) {
          return Srv.sync().then(function (n) {
            renderAll();
            toast('已同步 ' + ((n && n.count) || 0) + ' 条帖子');
          });
        }
      }).catch(function (err) {
        /* 连不上就回滚，避免登录被错误地指向不可用的服务器 */
        if (old) LS.setItem(SRV_KEY, old);
        else LS.removeItem(SRV_KEY);
        var reason = navigator.onLine === false
          ? '手机当前没有联网'
          : (err && err.message ? err.message : '连接失败');
        updateSrvStatus('连接失败：' + reason + '（确认电脑服务器窗口开着、手机与电脑连同一 Wi-Fi）');
        toast('连接失败，请看设置里的提示');
      });
    });
    $on('#srvScan', 'click', function () {
      var btn = this;
      if (btn.disabled) return;
      btn.disabled = true;
      var recorded = srvPortCandidates();
      updateSrvStatus('正在扫描库里记录的 ' + recorded.length + ' 个地址…');
      scanAllServers().then(function (found) {
        btn.disabled = false;
        if (!found) {
          updateSrvStatus('这 ' + recorded.length + ' 个记录地址都连不上：\n1. 确认电脑已运行 U 服务器并保持窗口开启\n2. 电脑防火墙已放行 8787 / 8765 / 17880 端口\n3. 在管理台「网络 / 穿透」里把当前服务器地址补进对应端');
          toast('未发现可用服务器');
          return;
        }
        applySrvFound(found, '已连接 ' + found);
        toast('已找到服务器 ' + found + '（已填入输入框）');
        loadSrvConfig();
        Srv.ensure().then(function () {
          return Srv.sync();
        }).then(function (n) {
          renderAll();
          refreshConversations();
          refreshNotifications();
          toast('已同步 ' + ((n && n.count) || 0) + ' 条帖子');
        }).catch(function (e) {
          toast(e && e.message ? e.message : '连接失败');
        });
      });
    });
    $on('#srvClear', 'click', function () {
      setSrvOff();
      LS.removeItem(SRV_KEY);
      LS.removeItem(SRV_TOKEN_KEY);
      LS.removeItem(SRV_USER_KEY);
      $('#srvUrl').value = '';
      updateSrvStatus();
      toast('已断开服务器，数据仅保存在本机');
    });
    $on('#lanToggle', 'change', function () {
      LS.setItem('u-lan', this.checked ? '1' : '0');
      if (this.checked) lanStart(); else lanStop();
      updateLanStatus();
      renderLanDevices();
    });
    $on('#lanRow', 'click', function () {
      /* 设置页保持打开，二级页直接盖在上面 */
      $('#lanSheet').classList.add('open');
      $('#lanToggle').checked = LS.getItem('u-lan') === '1';
      $('#lanToggle').disabled = !LAN_SUPPORTED;
      lanLoadInfo();
      updateLanStatus();
      renderLanDevices();
      setRemoteBox();
      if (remoteEnabled()) refreshRemote();
    });
    $on('#lanClose', 'click', function () {
      $('#lanSheet').classList.remove('open');
      $('#settingsSheet').classList.add('open');
    });
    $on('#remoteToggle', 'change', function () {
      LS.setItem('u-remote', this.checked ? '1' : '0');
      setRemoteBox();
      if (this.checked) refreshRemote();
    });
    $on('#remoteRefresh', 'click', refreshRemote);
    $on('#remoteCopy', 'click', function () {
      var url = $('#remoteUrl');
      var text = (url && url.dataset.url) ? url.dataset.url : (url ? url.textContent : '');
      if (!text || text === '—') { toast('暂无地址，请先检测'); return; }
      try {
        navigator.clipboard.writeText(text).then(function () { toast('已复制远程地址'); });
      } catch (e) {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('已复制远程地址'); } catch (e2) { toast('复制失败'); }
        document.body.removeChild(ta);
      }
    });
    $on('#lanDirRow', 'click', openFilesSheet);
    $on('#cacheRow', 'click', clearCache);
  $on('#dataRow', 'click', function () { updateCacheSub(); loadLocalStorage(); openSubSheet('dataSheet'); });
  $on('#dataClose', 'click', function () { closeSheetById('dataSheet'); });
    $on('#filesClose', 'click', function () {
      $('#filesSheet').classList.remove('open');
      $('#lanSheet').classList.add('open');
    });
    $on('#adminApiRow', 'click', openApiSheet);
    $on('#apiClose', 'click', function () {
      $('#apiSheet').classList.remove('open');
      $('#settingsSheet').classList.add('open');
    });
    $on('#restoreRow', 'click', restoreOfficialData);
    $on('#aboutRow2', 'click', openAbout);
    /* 设置 → 其他 也放一个入口：抽屉里的点不开时还有这里 */
    $on('#feedbackRow', 'click', function () {
      $('#settingsSheet').classList.remove('open');
      openFeedbackSheet();
    });
    $on('#logoutRow2', 'click', function () {
      $('#settingsSheet').classList.remove('open');
      logout();
    });
  
    /* 通知（管理员） */
    $on('#notifyAddBtn', 'click', function () { openNotifyEditor(null); });
    $on('#notifyClose', 'click', closeNotifyEditor);
    $on('#notifySave', 'click', saveNotifyEditor);
    $on('#notifyList', 'click', function (e) {
      var dprof = e.target.closest('[data-prof]');
      if (dprof) {
        if (dprof.dataset.prof) openUser(dprof.dataset.prof);
        return;
      }
      var dm = e.target.closest('[data-dm-user]');
      if (dm) {
        var peer = state.userDirectory[dm.dataset.dmUser];
        if (peer) openDM(null, peer);
        else toast('无法识别该服务器用户');
        return;
      }
      var remoteMsg = e.target.closest('[data-rnid]');
      if (remoteMsg) { openRemoteNotification(remoteMsg.dataset.rnid); return; }
      var msg = e.target.closest('[data-mid]');
      if (msg) { openMessage(msg.dataset.mid); return; }
      var b = e.target.closest('[data-nact]');
      if (!b) return;
      var act = b.dataset.nact;
      var id = b.dataset.nid;
      if (act === 'edit') openNotifyEditor(id);
      else if (act === 'del') deleteNotify(id);
      else if (act === 'pub') publishNotify(id);
    });

    /* 私信列表：左滑显示删除（类似微信） */
    bindDMSwipe();
    $on('#dmList', 'click', function (e) {
      var dprof = e.target.closest('[data-prof]');
      if (dprof) {
        if (dprof.dataset.prof) openUser(dprof.dataset.prof);
        return;
      }
      var dm = e.target.closest('[data-dm-user]');
      if (dm) {
        var peer = state.userDirectory[dm.dataset.dmUser];
        if (peer) openDM(null, peer);
        else toast('无法识别该服务器用户');
        return;
      }
      var msg = e.target.closest('[data-mid]');
      if (msg) openMessage(msg.dataset.mid);
    });

    /* 官方通知 / 互动消息切换 */
    $on('#notifyTabs', 'click', function (e) {
      var b = e.target.closest('[data-ntab]');
      if (!b) return;
      state.notifyTab = b.dataset.ntab;
      jellySwitch(b);
      if (state.notifyTab === 'official') markOfficialSeen();
      renderNotify();
    });
    $on('#dmClose', 'click', function () { $('#dmSheet').classList.remove('open'); });
    $on('#dmSend', 'click', sendDM);
    $on('#dmText', 'input', function () {
      $('#dmSend').disabled = !$('#dmText').value.trim();
    });
    $on('#dmText', 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      sendDM();
    });

    /* 删除回复 */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cdel]');
      if (!b) return;
      e.stopPropagation();
      deleteComment(b.dataset.cdel);
    });

    /* 帖子操作按钮：点击果冻回弹效果 */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.pactions button[data-act]');
      if (!b) return;
      b.classList.remove('jelly');
      void b.offsetWidth;
      b.classList.add('jelly');
      setTimeout(function () { b.classList.remove('jelly'); }, 460);
    }, true);

    /* 分段控件按钮果冻效果 */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.seg button');
      if (!b) return;
      b.style.animation = 'none';
      void b.offsetWidth;
      b.style.animation = 'jelly .4s cubic-bezier(.22,1.35,.36,1)';
      setTimeout(function () { b.style.animation = ''; }, 410);
    }, true);

    /* 底部按钮：长按 1 秒单独显示名称，松手淡出 */
    $$('.tab, .tab-mid').forEach(function (b) {
      var pressTimer = null;
      var hide = function () {
        clearTimeout(pressTimer);
        b.classList.remove('holding');
      };
      b.addEventListener('pointerdown', function () {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(function () { b.classList.add('holding'); }, 1000);
      });
      b.addEventListener('pointerup', hide);
      b.addEventListener('pointercancel', hide);
      b.addEventListener('pointerleave', hide);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () { switchTab(t.dataset.tab); });
    });
    /* 顶部 U：停留在当前场景，只把正在浏览的页面拉回顶部 */
    $on('#logoBtn', 'click', function () {
      var v = document.querySelector('.view.on');
      if (!v) v = $('#viewFeed');
      if (!v) return;
      smoothScrollTop(v);
    });
    /* 记录用户是否已经开始滑动，延迟回顶时不再打断操作 */
    (function () {
      function touched() { bootUserTouched = true; }
      document.addEventListener('pointerdown', touched, { passive: true });
      document.addEventListener('touchstart', touched, { passive: true });
    })();

    /* 下拉刷新：首页 / 说说 / 通知 / 我的 */
    (function () {
      var ind = $('#ptrInd'), txt = $('#ptrText');
      if (!ind) return;
      var TH = 56;

      function bind(viewSel, listSel, refresh) {
        var view = $(viewSel), list = $(listSel);
        if (!view) return;
        var startY = 0, dist = 0, pulling = false, busy = false;

        function reset() {
          ind.classList.remove('show', 'ready', 'busy');
          txt.textContent = '下拉刷新';
          if (list) list.style.transform = '';
        }
        view.addEventListener('touchstart', function (e) {
          if (busy || e.touches.length !== 1 || view.scrollTop > 0) return;
          startY = e.touches[0].clientY;
          dist = 0;
          pulling = true;
        }, { passive: true });

        view.addEventListener('touchmove', function (e) {
          if (!pulling || busy) return;
          var d = e.touches[0].clientY - startY;
          if (view.scrollTop > 0 || d <= 0) {
            pulling = false;
            reset();
            return;
          }
          e.preventDefault();
          dist = Math.min(88, d * 0.7);
          if (list) list.style.transform = 'translateY(' + dist + 'px)';
          if (dist > 8) ind.classList.add('show');
          ind.classList.toggle('ready', dist >= TH);
          txt.textContent = dist >= TH ? '松开刷新' : '下拉刷新';
        }, { passive: false });

        function finish() {
          if (!pulling) return;
          pulling = false;
          if (dist < TH) { reset(); return; }
          busy = true;
          ind.classList.add('show', 'busy');
          ind.classList.remove('ready');
          txt.textContent = '正在刷新';
          if (list) list.style.transform = 'translateY(' + TH + 'px)';
          refresh();
          lanTick();
          setTimeout(function () {
            reset();
            busy = false;
            toast('已刷新');
          }, 700);
        }
        view.addEventListener('touchend', finish);
        view.addEventListener('touchcancel', function () { pulling = false; reset(); });
      }

      bind('#viewFeed', '#feedList', function () {
        if (Srv.canSync()) Srv.sync().then(renderAll).catch(function (e) { console.warn('同步失败', e); });
        renderFeed();
        renderTalk();
        renderNotify();
        if (state.tab === 'profile') renderProfile();
      });
      bind('#viewTalk', '#talkList', function () {
        if (Srv.canSync()) Srv.sync().then(renderAll).catch(function (e) { console.warn('同步失败', e); });
        renderTalk();
      });
      bind('#viewNotify', '#notifyList', renderNotify);
      bind('#viewDM', '#dmList', function () {
        renderDMList($('#dmList'));
        refreshConversations();
      });
      bind('#viewProfile', '#profileContent', function () {
        if (Srv.canSync()) Srv.sync().then(renderAll).catch(function (e) { console.warn('同步失败', e); });
        renderProfile();
      });
    })();

    window.addEventListener('resize', fitHeight);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fitHeight);

    /* 滚动时按需补抓进入视口的视频封面（防抖，避免滚动过程中频繁抓帧） */
    var coverScrollTimer = 0;
    document.addEventListener('scroll', function () {
      if (coverScrollTimer) return;
      coverScrollTimer = setTimeout(function () {
        coverScrollTimer = 0;
        hydrateVideoCovers();
      }, 280);
    }, true);

    /* App 退到后台/锁屏时立即停止播放，避免继续出声和耗流量 */
    var hiddenAt = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        hiddenAt = Date.now();
        pauseAllVideos();
        return;
      }
      if (hiddenAt) {
        var v = document.querySelector('.view.on');
        if (v) v.scrollTop = 0;
      }
      hiddenAt = 0;
    });
    /* Android 壳 onPause 时调用 */
    window.__uPause = function () { pauseAllVideos(); };
    /* Android 壳 onResume 时调用：回到 App 时首页回到顶部（只回顶一次，不锁定滑动） */
    window.__uResetScroll = function () {
      var v = document.querySelector('.view.on');
      if (v) v.scrollTop = 0;
      window.scrollTo(0, 0);
    };
    window.addEventListener('pageshow', function () {
      var v = document.querySelector('.view.on');
      if (v) v.scrollTop = 0;
    });

    /* Blob 地址被回收/失效时，用本地数据重建，避免图片视频 ERR_ABORTED */
    function findMediaBlob(mid) {
      var found = null;
      (state.composeMedia || []).some(function (m) {
        if (m.id === mid && m.blob) { found = m.blob; return true; }
        return false;
      });
      if (!found) {
        (state.posts || []).some(function (p) {
          (p.media || []).some(function (m) {
            if (m.id === mid && m.blob) { found = m.blob; return true; }
            return false;
          });
          return !!found;
        });
      }
      return found;
    }
    document.addEventListener('error', function (e) {
      var el = e.target;
      if (!el || !el.getAttribute || (el.tagName !== 'IMG' && el.tagName !== 'VIDEO')) return;
      var mid = el.getAttribute('data-mid');
      if (!mid || el.dataset.recovered === '1') return;
      /* 已主动卸载的视频不要再补地址，否则一离开页面就又被重新下载 */
      if (el.tagName === 'VIDEO' && el.dataset.released === '1') return;
      if (!el.getAttribute('src')) return;
      var blob = findMediaBlob(mid);
      if (!blob) return;
      /* 只重建一次，防止持续报错循环；旧地址不再 revoke，
         避免同一媒体在信息流和详情页里的其他元素被一起中断 */
      el.dataset.recovered = '1';
      try {
        var u = URL.createObjectURL(blob);
        urlCache.set(mid, u);
        urlBytes.set(mid, blob.size || 0);
        urlMeta.set(mid, { name: '', type: blob.type || '', size: blob.size || 0 });
        $$('[data-mid="' + mid + '"]').forEach(function (node) {
          if (node.tagName !== 'IMG' && node.tagName !== 'VIDEO') return;
          node.src = u;
          if (node.tagName === 'VIDEO') node.load();
        });
      } catch (err) {}
    }, true);

    // 安卓返回键：先用二级页面栈一层层退（黑名单、本地缓存、设置、帖子详情、游戏…）
    /* 原生壳（Android）在页面内弹提示，避免系统 Toast 带应用图标 */
window.__uHint = function (msg) {
  try { toast(String(msg || '')); return true; } catch (e) { return false; }
};

window.__uBack = function () {
      if (state.banned) return true;
      if ($('#authScreen').classList.contains('on')) return false;
      /* 本地缓存里正在预览某个视频/图片，返回键先关预览，列表还在 */
      if ($('#cachePrev') && $('#cachePrev').classList.contains('open')) { closeCachePreview(); return true; }
      if (layerStack.length) {
        var top = layerStack[layerStack.length - 1];
        layerBackPending = true;
        try { closeLayerEl(top); } catch (e) { /* 忽略 */ }
        if (layerStack.length) {
          try { history.pushState({ uLayer: layerStack.length }, ''); } catch (e2) { /* 忽略 */ }
        }
        return true;
      }
      if ($('#tearSheet') && $('#tearSheet').classList.contains('open')) { if (window.closeTearGame) window.closeTearGame(); return true; }
    if ($('#lobbySheet') && $('#lobbySheet').classList.contains('open')) { closeLobby(); return true; }
    if ($('#jumpSheet').classList.contains('open')) { if (window.closeJumpGame) window.closeJumpGame(); return true; }
      if ($('#gameSheet').classList.contains('open')) { shooterCloseGame(); return true; }
      if ($('#sideListSheet').classList.contains('open')) { $('#sideListSheet').classList.remove('open'); return true; }
      if ($('#sideDrawer').classList.contains('open')) { closeSide(); return true; }
      if ($('#mediaViewer').classList.contains('open')) { closeViewer(); return true; }
      if ($('#editProfileSheet').classList.contains('open')) { $('#editProfileSheet').classList.remove('open'); return true; }
      if ($('#followSheet').classList.contains('open')) { $('#followSheet').classList.remove('open'); return true; }
      if ($('#userSheet').classList.contains('open')) { $('#userSheet').classList.remove('open'); return true; }
      if ($('#postSheet').classList.contains('open')) { closePost(); return true; }
      if ($('#confirmWrap').classList.contains('open')) {
        $('#confirmWrap').classList.remove('open');
        if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
        return true;
      }
      if ($('#menuSheet').classList.contains('open')) { closeMenu(); return true; }
      if ($('#aboutSheet').classList.contains('open')) { $('#aboutSheet').classList.remove('open'); return true; }
      if ($('#filesSheet').classList.contains('open')) {
        $('#filesSheet').classList.remove('open');
        $('#lanSheet').classList.add('open');
        return true;
      }
      if ($('#lanSheet').classList.contains('open')) {
        $('#lanSheet').classList.remove('open');
        $('#settingsSheet').classList.add('open');
        return true;
      }
      if ($('#apiSheet').classList.contains('open')) {
        $('#apiSheet').classList.remove('open');
        $('#settingsSheet').classList.add('open');
        return true;
      }
      if ($('#notifySheet').classList.contains('open')) { closeNotifyEditor(); return true; }
      if ($('#dmSheet').classList.contains('open')) { $('#dmSheet').classList.remove('open'); return true; }
      if ($('#settingsSheet').classList.contains('open')) { closeSettings(); return true; }
      if ($('#noteSheet').classList.contains('open')) { closeNote(); return true; }
      if ($('#compose').classList.contains('open')) { closeCompose(); return true; }
      if (state.tab !== 'feed') { switchTab('feed'); return true; }
      return false;
    };
  }

  function fitHeight() {
    var h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    document.documentElement.style.setProperty('--vh', h + 'px');
  }

  /* ---------------- boot ---------------- */
  function resetHomeScroll() {
    var v = $('#viewFeed');
    if (v) v.scrollTop = 0;
    window.scrollTo(0, 0);
  }
  function resetHomeScrollSoon() {
    /* 只补一次回顶，且用户已经开始滑动时不再打断 */
    resetHomeScroll();
    [90, 320].forEach(function (ms) {
      setTimeout(function () {
        if (!bootUserTouched) resetHomeScroll();
      }, ms);
    });
  }
  function boot() {
    var bootAt = Date.now();
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    fitHeight();
    applyTheme();
    bind();
    loadAccounts();
    seedUpdateNotice();
    /* 未登录时先把登录页准备好（主界面此时仍隐藏），避免闪一下首页 */
    var firstSession = null;
    try { firstSession = loadSession(); } catch (e) { firstSession = null; }
    if (!firstSession) { try { showAuth(); } catch (e) { /* 忽略 */ } }

    /* 开屏至少展示 1 秒，就绪后与主界面同时切换 */
    function revealApp() {
      /* 开屏只做一次过渡，不再硬等 1.7 秒：本地和手机上都能立刻进首页 */
      var wait = Math.max(0, 900 - (Date.now() - bootAt));
      setTimeout(function () {
        document.body.classList.remove('booting');
        resetHomeScroll();
        if (window.requestAnimationFrame) {
          requestAnimationFrame(function () { if (!bootUserTouched) resetHomeScroll(); });
        }
        var sp = $('#splash');
        if (!sp) return;
        sp.classList.add('hide');
        setTimeout(function () { if (sp.parentNode) sp.remove(); }, 400);
      }, wait);
    }

    openDB().then(function (db) {
      DB = db;
      if (db && db.__memory) {
        /* 拿不到持久化存储时给一句提示：功能能用，但刷新就没了 */
        setTimeout(function () {
          try { toast('当前环境禁用了本地存储，本次为临时数据'); } catch (e) { /* 忽略 */ }
        }, 1600);
      }
      return seedIfEmpty();
    }).then(function () {
      return Promise.all([DataAPI.listPosts(), DataAPI.listNotes(), DataAPI.listAllComments(), DataAPI.listDrafts()]);
    }).then(function (res) {
      state.posts = res[0];
      state.drafts = res[3] || [];
      try { updateDraftEntry(); } catch (e) { /* 忽略 */ }
      dedupePosts();
      state.notes = res[1];
      state.allComments = res[2] || [];
      return ensureOfficialPosts().then(resetDemoStats).then(removeRetiredDemo);
    }).then(function () {
      return migrateDemoCovers();
    }).then(function () {
      return fixMediaTypes();
    }).then(function () {
      return fixStaleMediaSrc();
    }).then(function () {
      session = loadSession();
      if (session) enterApp(); else showAuth();
      updateLanStatus();
      resetHomeScroll();
      revealApp();
    }).catch(function (err) {
      console.error(err);
      var s = $('#splash');
      if (s) s.innerHTML = '<div style="color:#71767b;font-size:14px;padding:0 32px;line-height:1.6;text-align:center">初始化失败：' + esc(err && err.message || err) + '</div>';
    });
  }

  /* 把开屏收掉；任何路径都可以反复调用 */
  function revealSplash() {
    var sp = $('#splash');
    if (!sp) return;
    sp.classList.add('hide');
    setTimeout(function () { if (sp.parentNode) sp.remove(); }, 400);
  }

  /* 启动保护：初始化无论在哪一步崩或者卡住，界面都必须出来，不能停在开屏 */
  function startBoot() {
    try {
      boot();
    } catch (e) {
      console.error('初始化异常', e);
      try { document.body.classList.remove('booting'); } catch (_) {}
      try { showAuth(); } catch (_) {}
      revealSplash();
    }
    setTimeout(function () {
      var sp = $('#splash');
      if (sp && !sp.classList.contains('hide')) {
        console.warn('初始化超时，强制放行界面');
        try { document.body.classList.remove('booting'); } catch (_) {}
        try { if (!session) showAuth(); } catch (_) {}
        revealSplash();
      }
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startBoot);
  else startBoot();
})();
