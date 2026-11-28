/* 攤位資料庫 — 前端（純靜態，GitHub Pages）。
 * 安全原則：所有資料一律用 textContent 放進 DOM（不使用 innerHTML）；外部連結只接受 http(s)，
 * 並加 rel="noopener noreferrer nofollow ugc"；縮圖只顯示伺服器確認為公開的 Drive 檔案（lh3）。 */
(function () {
  'use strict';
  var CFG = window.BOOTH_CONFIG || {}, I = window.I18N, P = window.PRIVACY;
  var API = CFG.API_URL || '', API_OK = API && API.indexOf('__') !== 0;
  var LANGS = ['zh', 'en', 'ja'];
  var lang = localStorage.getItem('lang');
  if (LANGS.indexOf(lang) < 0) { var nl = (navigator.language || 'zh').toLowerCase(); lang = nl.indexOf('ja') === 0 ? 'ja' : nl.indexOf('zh') === 0 ? 'zh' : 'en'; }
  var qlang = new URLSearchParams(location.search).get('lang'); if (LANGS.indexOf(qlang) >= 0) lang = qlang;

  var DB_EDITABLE = ['攤位名稱', '筆名', '創作者類型', 'FB (1)', 'FB (2)', 'Bluesky (1)', 'Bluesky (2)', 'TWITTER (1)', 'TWITTER (2)', 'PLURK', 'Pixiv', 'Fanbox', 'Fantia', '可洛斯', '其他贊助平台', 'IG', 'YOUTUBE', 'TWITCH', 'LINE', 'DISCORD', '巴哈姆特', '官方網站', 'Linktree等連結整合網頁', '其他連結'];
  var EVENT_EDITABLE = ['筆名', '創作者類型', '商品年齡分類', '作品類型 (原創、二創)', '二創參考作品 (原創免填)', '販售資訊', '特殊標籤或備註', 'FB (1)', 'FB (2)', 'Bluesky (1)', 'Bluesky (2)', 'TWITTER (1)', 'TWITTER (2)', 'PLURK', 'Pixiv', 'Fanbox', 'Fantia', '可洛斯', '其他贊助平台', 'IG', 'YOUTUBE', 'TWITCH', 'LINE', 'DISCORD', '巴哈姆特', '官方網站', 'Linktree等連結整合網頁', '其他連結', '預告', '品書', '預購/通販', '賣場', '試閱'];
  var TEXT_FIELDS = ['攤位名稱', '筆名', '創作者類型', '商品年齡分類', '作品類型 (原創、二創)', '二創參考作品 (原創免填)', '販售資訊', '特殊標籤或備註'];
  var LONG_FIELDS = ['販售資訊', '特殊標籤或備註'];
  var PLAT = [['x.com', 'X'], ['twitter.com', 'X'], ['facebook.com', 'FB'], ['fb.com', 'FB'], ['instagram.com', 'IG'], ['plurk.com', '噗浪'], ['pixiv.net', 'pixiv'], ['fanbox.cc', 'FANBOX'], ['fantia.jp', 'Fantia'], ['bsky.app', 'Bluesky'], ['youtube.com', 'YouTube'], ['youtu.be', 'YouTube'], ['twitch.tv', 'Twitch'], ['patreon.com', 'Patreon'], ['gamer.com.tw', '巴哈'], ['discord.com', 'Discord'], ['discord.gg', 'Discord'], ['lit.link', 'lit.link'], ['linktr.ee', 'Linktree'], ['line.me', 'LINE'], ['booth.pm', 'BOOTH'], ['myacg.com.tw', '買動漫'], ['shopee.tw', '蝦皮'], ['portaly.cc', 'Portaly'], ['ko-fi.com', 'Ko-fi']];
  var COLORS = { owner: '#5b9df9', name: '#ff9f43', sns: '#1dd1a1', group: '#b48cff', weak: '#8b9cb3' };

  /* ---------- 小工具 ---------- */
  function tz(k, v) { var s = I.zh[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  function t(k, v) { var s = (I[lang] && I[lang][k]) || I.zh[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k]; if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(e, x); }); return; } e.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function nk(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s\u3000【】\[\]（）()・·.♡♥✤|｜_\-~～!！?？「」『』]/g, ''); }
  // 反斜線、空白、< > " { } | ^ ` 的網址一律不顯示成連結（瀏覽器會把 \ 當成 /，網域判斷會被騙）
  function safeUrl(u) { var raw = String(u).trim(); if (/[\\\s<>"{}|^`]/.test(raw)) return null; try { var x = new URL(raw); if ((x.protocol === 'https:' || x.protocol === 'http:') && !x.username && !x.password) return x.href; } catch (e) { } return null; }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^(www|m|mobile)\./, ''); } catch (e) { return ''; } }
  function platOf(u) { var host = hostOf(u); for (var i = 0; i < PLAT.length; i++) { var d = PLAT[i][0]; if (host === d || host.slice(-(d.length + 1)) === '.' + d) return PLAT[i][1]; } return host || '🔗'; }
  function handleOf(u) { try { var x = new URL(u), p = x.pathname.replace(/\/+$/, ''); var id = x.searchParams.get('id'); if (id) return 'id…' + id.slice(-5); var seg = p.split('/').filter(Boolean); return seg.length ? decodeURIComponent(seg[seg.length > 1 && /^(profile|people|user|users|channel|c|en|ja|zh-tw)$/.test(seg[0]) ? 1 : 0]) : x.hostname; } catch (e) { return u; } }
  function urls(v) { return String(v || '').split(/[\s\n]+/).filter(function (x) { return /^https?:\/\//i.test(x); }); }
  function ext(u, label) { var s = safeUrl(u); if (!s) return h('span', { class: 'muted', text: label || u }); return h('a', { href: s, target: '_blank', rel: 'noopener noreferrer nofollow ugc', referrerpolicy: 'no-referrer', title: s }, label || s); }
  function snsLink(u) { var s = safeUrl(u); if (!s) return null; return h('a', { class: 'sl', href: s, target: '_blank', rel: 'noopener noreferrer nofollow ugc', referrerpolicy: 'no-referrer', title: s }, h('b', { text: platOf(s) }), h('span', { text: handleOf(s) })); }
  var FID = /^[A-Za-z0-9_-]{20,}$/;
  function thumb(fid, cls) { if (!fid || !FID.test(fid)) return h('div', { class: (cls || 'th') + ' ph', text: '🏷️' }); return h('img', { class: cls || 'th', src: 'https://lh3.googleusercontent.com/d/' + fid + '=w480', alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }); }
  function toast(msg) { var e = document.getElementById('toast'); e.textContent = msg; e.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { e.hidden = true; }, 3500); }
  function modal(title, body) { var m = document.getElementById('modal'), b = clear(document.getElementById('mbody')); add(b, h('h3', { text: title })); add(b, body); m.hidden = false; return b; }
  function closeModal() { document.getElementById('modal').hidden = true; clear(document.getElementById('mbody')); }
  function confLabel(c) { return t('conf_' + (c || 'low')); }
  function gfg(muted) { var L = window.BOOTH_THEME && window.BOOTH_THEME.isLight(); return muted ? (L ? '#5d6b80' : '#b8c3d6') : (L ? '#1a2332' : '#e8eef7'); }
  function howLabel(s) { s = String(s || ''); return s.indexOf('同名') === 0 ? t('how_same') : s.indexOf('僅場次') === 0 ? t('how_log') : s.indexOf('關聯分析') === 0 ? t('how_link') : s; }
  function uniqNames(list) { var seen = {}, out = []; (list || []).forEach(function (v) { var k = nk(v); if (k && !seen[k]) { seen[k] = 1; out.push(String(v).trim()); } }); return out; }

  /* ---------- API ---------- */
  function apiGet(params) {
    if (!API_OK) return Promise.reject(new Error('API_URL 尚未設定'));
    var u = new URL(API, location.href); Object.keys(params).forEach(function (k) { u.searchParams.set(k, params[k]); });
    return fetch(u.href, { method: 'GET', credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw new Error(j.error || 'error'); return j.data !== undefined ? j.data : j; });
  }
  function apiPost(body) {
    if (!API_OK) return Promise.reject(new Error('API_URL 尚未設定'));
    if (S.session) body.session = S.session;
    // text/plain 避免 CORS 預檢（Apps Script 不支援 OPTIONS）
    return fetch(API, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) { if (/session/i.test(j.error || '')) logout(true); throw new Error(j.error || 'error'); }
        if (!/^(me|preview|login|checkThumb|admin\.(summary|home|counts|hiddenNames|queue|audit|events|relations|suspensions|pairStart)|ownerFull)$/.test(body.action)) OWNER_P = {}; // 寫入後清掉攤主頁快取
        return j; });
  }

  /* ---------- 狀態 ---------- */
  var S = { meta: null, index: null, byId: {}, search: [], rel: null, me: null, session: sessionStorage.getItem('bdb_session') || '', events: {} };
  /* 速度：公開資料先讀 GitHub Pages 上的靜態快照（data/*.json，部署時由 GitHub Actions 產生，CDN＋gzip），
   * 同時向 Apps Script 要最新版本號；版本不同才在背景更新，不讓使用者等 Apps Script。 */
  var SNAP = {};
  function snap(name) { return SNAP[name] || (SNAP[name] = fetch('data/' + name + '.json', { cache: 'no-cache', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })); }
  var META_LIVE = null;
  function liveMeta() { return META_LIVE || (META_LIVE = (API_OK ? apiGet({ action: 'meta' }) : Promise.reject(new Error('no api'))).then(function (m) {
    var was = S.meta; S.meta = m; S.metaLive = true;
    if (was && JSON.stringify(was.active) !== JSON.stringify(m.active) && !document.querySelector('#modal:not([hidden])') && !/^#\/admin/.test(location.hash)) route();
    return m; }).catch(function (e) { META_LIVE = null; throw e; })); }
  function loadMeta() {
    if (S.meta) return Promise.resolve(S.meta);
    var lv = liveMeta();
    return snap('meta').then(function (m) { if (m && m.version) { if (!S.meta) S.meta = m; lv.catch(function () { }); return S.meta; } return lv; });
  }
  function setIndex(d) { S.index = d; S.byId = {}; S.search = d.owners.map(function (o0) { var o = o0, ex = S.admHidden && S.admHidden[o0[0]]; if (ex) { o = o0.slice(); o[2] = o0[2].concat(ex); } /* 站長登入後，把被隱藏的舊攤名只放在記憶體（不寫入 sessionStorage），讓站長搜尋得到 */ S.byId[o[0]] = o; return [o, nk([o[0], o[1]].concat(o[2], o[8] || []).join('|'))]; }); return d; }
  function storeIndex(d) { try { sessionStorage.setItem('bdb_index', JSON.stringify(d)); } catch (e) { } }
  var INDEX_BG = null;
  /** 背景確認版本：伺服器版本號和手上的資料不同時，背景下載最新 index（下次換頁就用新的）。 */
  function refreshIndexBg() {
    if (INDEX_BG || !API_OK) return; INDEX_BG = liveMeta().then(function (m) {
      if (S.index && S.index.v === m.v) return;
      return apiGet({ action: 'index' }).then(function (d) { setIndex(d); storeIndex(d); });
    }).catch(function () { INDEX_BG = null; });
  }
  function loadIndex() {
    if (S.index) return Promise.resolve(S.index);
    var c = null; try { c = JSON.parse(sessionStorage.getItem('bdb_index') || 'null'); } catch (e) { }
    if (c && c.owners) { setIndex(c); refreshIndexBg(); return Promise.resolve(S.index); }
    return snap('index').then(function (d) {
      if (d && d.owners) { setIndex(d); refreshIndexBg(); return d; }
      // 沒有快照（本機開發或快照失敗）：照舊直接向 Apps Script 讀
      return liveMeta().then(function () { return apiGet({ action: 'index' }); }).then(function (x) { storeIndex(x); return setIndex(x); });
    });
  }
  /** 關聯資料＝靜態 relations.json（關聯分析結果）＋伺服器即時覆蓋層（站長「確認無關」、攤主合併、主資料庫裡共用 SNS 帳號的即時關聯）。
   * 覆蓋層先用快照（立即顯示），背景再向伺服器要最新的。 */
  function loadRel() {
    if (S.rel) return Promise.resolve(S.rel);
    var base = fetch('data/relations.json').then(function (r) { return r.json(); }).catch(function () { return { w: {}, r: {}, g: [], events: {} }; });
    var live = API_OK ? apiGet({ action: 'relations' }).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([base, snap('reloverlay')]).then(function (x) {
      if (!x[1]) return live.then(function (ov) { S.rel = applyOverlay(x[0], ov); return S.rel; });
      S.rel = applyOverlay(x[0], x[1]); live.then(function (ov) { if (ov) S.rel = applyOverlay(x[0], ov); }); return S.rel;
    });
  }
  /** 攤主詳細資料：同一頁面內 2 分鐘快取；滑過卡片時預先載入。 */
  var OWNER_P = {};
  function loadOwner(id) { var c = OWNER_P[id]; if (c && Date.now() - c.at < 120000) return c.p; var p = apiGet({ action: 'owner', id: id }); p.catch(function () { delete OWNER_P[id]; }); OWNER_P[id] = { at: Date.now(), p: p }; return p; }
  function prefetchOwner(id) { if (API_OK && /^C\d{5,}$/.test(id)) loadOwner(id).catch(function () { }); }
  /** vis-network（約 160 KB）只在要畫關聯圖時才載入。 */
  var VIS_P = null;
  function loadVis() { if (window.vis) return Promise.resolve(); return VIS_P || (VIS_P = new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = 'vendor/vis-network.min.js'; sc.onload = function () { ok(); }; sc.onerror = function () { VIS_P = null; no(new Error('vis-network')); }; document.head.appendChild(sc); })); }
  function applyOverlay(rel, ov) {
    if (!ov) return rel;
    var mm = ov.merged || {}, res = function (id) { var n = 0; while (mm[id] && n++ < 10) id = mm[id]; return id; }, bad = {};
    (ov.unrelated || []).forEach(function (p) { bad[[res(p[0]), res(p[1])].sort().join('|')] = 1; });
    var w = {}, r = {}, has = function (o, a, b) { return (o[a] || []).some(function (x) { return (typeof x === 'string' ? x : x[0]) === b; }); };
    function addW(a, b, why) { a = res(a); b = res(b); if (a === b || bad[[a, b].sort().join('|')] || has(r, a, b) || has(w, a, b)) return; (w[a] = w[a] || []).push([b, why]); (w[b] = w[b] || []).push([a, why]); }
    Object.keys(rel.r || {}).forEach(function (a) { rel.r[a].forEach(function (b) { var x = res(a), y = res(b); if (x === y || bad[[x, y].sort().join('|')] || has(r, x, y)) return; (r[x] = r[x] || []).push(y); (r[y] = r[y] || []).push(x); }); });
    Object.keys(rel.w || {}).forEach(function (a) { rel.w[a].forEach(function (p) { addW(a, p[0], p[1]); }); });
    (ov.live || []).forEach(function (p) { addW(p[0], p[1], p[2]); });
    return { note: rel.note, built: rel.built, events: rel.events, g: (rel.g || []).map(res), w: w, r: r, overlay: { at: ov.built, merged: Object.keys(mm).length, unrelated: (ov.unrelated || []).length, live: (ov.live || []).length } };
  }
  function evDate(code) { var e = S.index && S.index.events[code]; return e ? e[1] : ''; }
  function lastEvent(o) { var best = '', bd = ''; (o[4] || []).forEach(function (c) { var d = evDate(c); if (d >= bd) { bd = d; best = c; } }); return best; }
  function activeCodes() { return ((S.meta && S.meta.active) || []).map(function (e) { return e.code; }); }

  /* ---------- 版面 ---------- */
  var app = document.getElementById('app');
  function applyI18n() {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;
    document.querySelectorAll('[data-t]').forEach(function (e) { e.textContent = t(e.getAttribute('data-t')); });
    var L = clear(document.getElementById('langs'));
    if (document.getElementById('themeBtn')) themeBtn();
    LANGS.forEach(function (l) { add(L, h('button', { class: 'pill sm' + (l === lang ? ' on' : ''), onclick: function () { lang = l; localStorage.setItem('lang', l); applyI18n(); route(); }, text: I[l].langName })); });
  }
  function setNav(r) { document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-route') === r); }); }
  function loading(kind) { clear(app); add(app, h('div', { class: 'skel', 'aria-busy': 'true' }, h('div', { class: 'spin', text: t('loading') }), h('div', { class: 'sk sk-bar' }), h('div', { class: 'sk-grid' }, [0, 1, 2, 3].map(function () { return h('div', { class: 'sk sk-card' }); })), h('div', { class: 'sk sk-block' }))); }
  function fail(err) { clear(app); add(app, h('div', { class: 'card note bad' }, h('b', { text: t('load_fail') }), h('div', { class: 'muted', text: String(err && err.message || err) }), h('p', null, h('button', { class: 'btn', onclick: route, text: t('retry') })))); }

  /* ---------- 首頁 ---------- */
  function ownerCard(o) {
    var last = lastEvent(o), act = activeCodes();
    return h('div', { class: 'card oc', onclick: function () { location.hash = '#/o/' + o[0]; }, onmouseenter: function () { prefetchOwner(o[0]); }, ontouchstart: function () { prefetchOwner(o[0]); } },
      thumb(o[5]),
      h('div', { class: 'bd' },
        h('div', { class: 'nm', text: o[1] || o[0] }),
        h('div', { class: 'meta' }, o[0], o[3] ? ' ・ ' + o[3] : '', ' ・ ', t('events_n', { n: (o[4] || []).length }), last ? ' ・ ' + t('last_seen') + ' ' + last : ''),
        uniqNames(o[2]).length > 1 ? h('div', { class: 'aka' }, t('aka') + '：', uniqNames(o[2]).filter(function (v) { return nk(v) !== nk(o[1]); }).slice(0, 6).join('、')) : null,
        h('div', { class: 'tags' }, (o[4] || []).filter(function (c) { return act.indexOf(c) >= 0; }).map(function (c) { return h('span', { class: 'tag act', text: c }); }),
          (o[6] || []).slice(0, 6).map(function (p) { return h('span', { class: 'tag', text: p.replace(/ \(\d\)$/, '') }); }))));
  }
  function viewHome() {
    setNav('home'); loading();
    Promise.all([loadIndex(), loadMeta()]).then(function () {
      clear(app); var d = S.index, owners = d.owners, act = (S.meta.active || []);
      var input = h('input', { id: 'q', placeholder: t('search_ph'), autocomplete: 'off', value: sessionStorage.getItem('bdb_q') || '' });
      var res = h('div');
      add(app, h('section', { class: 'card' }, h('div', { class: 'search' }, h('span', { text: '🔍' }), input, helpQ('search'))));
      var renamed = owners.filter(function (o) { return uniqNames(o[2]).length > 1; });
      add(app, h('section', { class: 'stats' },
        [[owners.length, t('stat_owners')], [Object.keys(d.events).length, t('stat_events')], [renamed.length, t('stat_renamed')], [act.length, t('stat_active')]].map(function (x) { return h('div', { class: 'card st' }, h('b', { text: x[0].toLocaleString() }), h('span', { text: x[1] })); })));
      // 大型關聯圖：放在數字統計下面；手機預設點一下才載入；可切換顯示兩兩相連的小關係
      var ovsub = h('small'), ovdiv = h('div', { id: 'overview' }), pairsCb = h('input', { type: 'checkbox' }), ovState = { drawn: false };
      pairsCb.checked = sessionStorage.getItem('bdb_pairs') === '1';
      var drawNow = function () { ovState.drawn = true; clear(ovdiv); add(ovdiv, h('div', { class: 'spin', text: t('loading') })); Promise.all([loadRel(), loadVis()]).then(function (x) { clear(ovdiv); drawOverview(ovdiv, ovsub, x[0], pairsCb.checked); }).catch(function () { clear(ovdiv); add(ovdiv, h('div', { class: 'muted', text: t('load_fail') })); }); };
      pairsCb.addEventListener('change', function () { sessionStorage.setItem('bdb_pairs', pairsCb.checked ? '1' : ''); if (ovState.drawn) drawNow(); });
      add(app, h('section', { class: 'card ovcard' }, h('div', { class: 'ghead' }, h('h3', { style: 'margin:0' }, t('ov_title'), ' ', ovsub),
        h('div', { class: 'legend' }, h('span', { class: 'lg' }, h('span', { class: 'sw', style: 'background:' + COLORS.owner }), t('legend_owner')), h('span', { class: 'lg' }, h('span', { class: 'sw', style: 'background:' + COLORS.group }), t('legend_group')), h('span', { class: 'lg' }, h('span', { class: 'ln', style: 'border-color:' + COLORS.group }), t('related_title')), h('span', { class: 'lg' }, h('span', { class: 'ln d', style: 'border-color:#ff9f43' }), t('legend_weak')),
          h('label', { class: 'lg', style: 'cursor:pointer' }, pairsCb, ' ', t('ov_pairs')))), ovdiv));
      if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) add(ovdiv, h('div', { class: 'ovtap' }, h('p', { class: 'muted', text: t('ov_tap_hint') }), h('button', { class: 'btn', onclick: drawNow, text: t('ov_tap') })));
      else if (window.IntersectionObserver) { add(ovdiv, h('div', { class: 'sk sk-graph' })); var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); if (!ovState.drawn) drawNow(); } }, { rootMargin: '200px' }); setTimeout(function () { io.observe(ovdiv); }, 0); }
      else drawNow();
      add(app, res);
      function render() {
        var q = nk(input.value); sessionStorage.setItem('bdb_q', input.value); clear(res);
        if (q) {
          var hits = S.search.filter(function (s) { return s[1].indexOf(q) >= 0; }).map(function (s) { var o = s[0], sc = nk(o[1]) === q ? 0 : o[2].some(function (v) { return nk(v) === q; }) ? 1 : nk(o[1]).indexOf(q) === 0 ? 2 : 3; return [sc, -(o[4] || []).length, o]; })
            .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).slice(0, 60).map(function (x) { return x[2]; });
          add(res, h('div', { class: 'sect' }, h('h3', null, t('results'), h('small', { text: hits.length >= 60 ? ' ' + t('showing', { n: 60 }) : ' ' + hits.length }))));
          add(res, hits.length ? h('section', { class: 'grid' }, hits.map(ownerCard)) : h('div', { class: 'card muted', text: t('no_results') }));
          return;
        }
        if (act.length) add(res, h('section', { class: 'card' }, h('h3', { text: t('active_title') }), h('div', { class: 'tabs' }, act.map(function (e) { return h('a', { class: 'pill', href: '#/events/' + encodeURIComponent(e.code) }, e.name || e.code, e.start ? ' ・ ' + e.start : '', ' → ', t('go_fill')); }))));
        var score = function (o) { return ((o[4] || []).some(function (c) { return activeCodes().indexOf(c) >= 0; }) ? 1000 : 0) + (o[5] ? 200 : 0) + uniqNames(o[2]).length * 10 + (o[4] || []).length; };
        var featured = renamed.slice().sort(function (a, b) { return score(b) - score(a); });
        add(res, h('div', { class: 'sect' }, h('h3', { text: t('renamed_title') })));
        add(res, h('section', { class: 'grid' }, featured.slice(0, 12).map(ownerCard)));
      }
      var tm; input.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(render, 120); });
      render(); input.focus();
    }).catch(fail);
  }

  /* ---------- 攤主頁 ---------- */
  function viewOwner(id) {
    setNav('home'); loading();
    var stamp = {}; app.__view = stamp;
    // 先用 index 顯示名稱（快），詳細資料（Apps Script）回來前顯示骨架
    loadIndex().then(function () { var o0 = S.byId[id]; if (app.__view !== stamp || !o0 || !app.querySelector('.skel')) return; clear(app);
      add(app, h('section', { class: 'card' }, h('a', { href: '#/', text: t('back') }), h('div', { class: 'dhead' }, o0[5] ? thumb(o0[5]) : null, h('div', null, h('div', { class: 'big', text: o0[1] || id }), h('div', { class: 'meta' }, id, o0[3] ? ' ・ ' + o0[3] : '', ' ・ ', t('events_n', { n: (o0[4] || []).length }))))));
      add(app, h('div', { class: 'skel two' }, h('div', null, h('div', { class: 'sk sk-block' }), h('div', { class: 'sk sk-block' })), h('div', null, h('div', { class: 'sk sk-graph' }), h('div', { class: 'spin', text: t('loading') })))); }).catch(function () { });
    loadVis().catch(function () { });
    Promise.all([loadIndex(), loadOwner(id), loadRel(), S.session ? refreshMe().catch(function () { return null; }) : null]).then(function (r) {
      // p7：舊攤名被隱藏時，公開 API 不含舊名；攤主本人與站長改用需登入的 ownerFull 取得完整資料
      var oo = S.byId[id], mm = S.me || { owned: [] };
      if (S.session && (mm.admin || (mm.owned || []).indexOf(id) >= 0) && ((oo && oo[9]) || (r[1] && r[1].namesHidden))) return apiPost({ action: 'ownerFull', ownerId: id }).then(function (j) { r[4] = j.data; return r; }, function () { return r; });
      return r;
    }).then(function (r) {
      if (app.__view !== stamp) return;
      var d = r[1], rel = r[2], full = r[4];
      if (full) d = Object.assign({}, d, { dbRows: full.dbRows, history: full.history });
      if (d.redirect) { toast(t('redirected', { a: id, b: d.redirect })); location.replace('#/o/' + d.redirect); return; }
      var o = S.byId[id] || [id, id, [], '', [], '', [], 0, []]; clear(app);
      if (full && full.names) { o = o.slice(); o[2] = full.names; }
      var me = S.me || { owned: [], pending: [] }, mine = me.owned.indexOf(id) >= 0, pend = !mine && me.pending.indexOf(id) >= 0;
      var namesHid = !!(o[9] || d.namesHidden || (full && full.namesHidden));
      var sns = [], seen = {}, fields = {};
      d.dbRows.forEach(function (row) { Object.keys(row.fields).forEach(function (k) { var v = row.fields[k]; if (TEXT_FIELDS.indexOf(k) >= 0) { if (!fields[k]) fields[k] = []; if (fields[k].indexOf(v) < 0) fields[k].push(v); } urls(v).forEach(function (u) { var s = safeUrl(u); if (s && !seen[s]) { seen[s] = 1; sns.push(s); } }); }); });
      var hidden = d.history.some(function (x) { return x.thumbHidden; });
      var head = h('section', { class: 'card' }, h('a', { href: '#/', text: t('back') }),
        h('div', { class: 'dhead' }, o[5] ? thumb(o[5]) : null,
          h('div', null, h('div', { class: 'big', text: o[1] || id }), h('div', { class: 'meta' }, id, o[3] ? ' ・ ' + o[3] : '', ' ・ ', t('events_n', { n: (o[4] || []).length })),
            hidden && !o[5] ? h('div', { class: 'muted', text: '🖼 ' + t('thumb_hidden') }) : null),
          h('div', { class: 'acts' }, mine ? h('button', { class: 'btn', onclick: function () { editFlow(id); }, text: t('edit_mine') }) : pend ? h('button', { class: 'btn ghost', onclick: function () { claimFlow(id, o[1]); }, text: t('claim_pending') }) : h('button', { class: 'btn', onclick: function () { claimFlow(id, o[1]); }, text: t('is_me') }),
            h('button', { class: 'btn ghost', onclick: function () { reportFlow(id); }, text: t('report_wrong') }),
            me.admin ? h('button', { class: 'btn admx', onclick: function () { adminEditFlow(id); }, text: '🛠 站長直接編輯' }) : null)));
      add(app, head);
      var left = h('div'), right = h('div');
      add(left, h('section', { class: 'card' }, h('h3', { text: t('detail_names') }), h('div', { class: 'tags' }, uniqNames(o[2]).map(function (v) { return h('span', { class: 'tag', text: v }); })),
        fields['筆名'] ? h('div', { class: 'meta' }, t('pen') + '：' + fields['筆名'].join('、')) : null,
        mine || me.admin ? nameVisBox(id, namesHid, mine) : namesHid ? h('div', { class: 'muted', style: 'font-size:12px;margin-top:8px', text: '🙈 ' + t('names_hidden_pub') }) : null));
      add(left, h('section', { class: 'card' }, h('h3', { text: t('detail_sns') }), sns.length ? h('div', { class: 'sns' }, sns.map(snsLink)) : h('div', { class: 'muted', text: t('no_sns') })));
      var hist = d.history.slice().reverse();
      add(left, h('section', { class: 'card' }, h('h3', null, t('detail_history'), h('small', { text: ' ' + hist.length })),
        h('table', { class: 't' }, h('thead', null, h('tr', null, ['h_event', 'h_date', 'h_name', 'h_booth', 'h_how', 'h_conf'].map(function (k) { return h('th', { text: t(k) }); }))),
          h('tbody', null, hist.map(function (x) { return h('tr', null, h('td', null, h('span', { class: 'tag ev', text: x.ev })), h('td', { text: x.date }), h('td', { text: x.name || (namesHid ? '—' : '') }), h('td', { text: x.booth }), h('td', { class: 'muted', text: howLabel(x.how) }), h('td', null, h('span', { class: 'conf ' + (x.conf || 'low'), text: confLabel(x.conf) }))); })))));
      var gdiv = h('div', { id: 'graph' });
      add(right, h('section', { class: 'card' }, h('h3', { text: t('detail_graph') }),
        h('div', { class: 'legend' }, [['owner', 'legend_owner'], ['name', 'legend_name'], ['sns', 'legend_sns'], ['group', 'legend_group']].map(function (x) { return h('span', { class: 'lg' }, h('span', { class: 'sw', style: 'background:' + COLORS[x[0]] }), t(x[1])); }), h('span', { class: 'lg' }, h('span', { class: 'ln d' }), t('legend_weak'))), gdiv));
      var gs = {}, grp = (rel.r[id] || []).filter(function (g) { if (g === id || gs[g]) return false; gs[g] = 1; return true; });
      var ws = {}, weak = (rel.w[id] || []).filter(function (w) { if (!w || w[0] === id || gs[w[0]] || ws[w[0]]) return false; ws[w[0]] = 1; return true; });
      if (grp.length) add(right, h('section', { class: 'card' }, h('h3', { text: t('related_title') }), h('div', { class: 'tags' }, grp.map(function (g) { var x = S.byId[g]; return h('a', { class: 'tag', href: '#/o/' + g, text: (x ? x[1] : g) + ' (' + g + ')' }); }))));
      if (weak.length) add(right, h('section', { class: 'card' }, h('h3', null, t('weak_title'), h('small', { text: ' ' + t('weak_hint') })), h('table', { class: 't' }, h('tbody', null, weak.map(function (w) { var x = S.byId[w[0]]; return h('tr', null, h('td', null, h('a', { href: '#/o/' + w[0], text: (x ? x[1] : w[0]) })), h('td', { class: 'muted', text: w[1] })); })))));
      if (d.recentEdits && d.recentEdits.length) add(right, h('section', { class: 'card' }, h('h3', { text: t('recent_edits') }), h('table', { class: 't' }, h('tbody', null, d.recentEdits.map(function (e) { return h('tr', null, h('td', { text: e.at }), h('td', { text: e.field })); })))));
      add(app, h('div', { class: 'two' }, left, right));
      try { drawGraph(gdiv, id, o, sns, grp, weak); } catch (e) { clear(gdiv); add(gdiv, h('div', { class: 'muted', style: 'padding:16px', text: t('graph_fail') })); }
    }).catch(fail);
  }
  /** 建立 vis 關聯圖（唯一入口）：節點 id 去重（先出現的保留）、去掉端點不存在或重複的邊、
   * 同一容器先銷毀舊圖；建立失敗只在圖的位置顯示訊息，不會讓整頁變成「資料載入失敗」。 */
  var LIVE_NETS = [];
  function destroyNets() { LIVE_NETS.forEach(function (n) { try { n.destroy(); } catch (e) { } }); LIVE_NETS = []; }
  function mountNet(el, nodes, edges, opts) {
    if (el.__net) { try { el.__net.destroy(); } catch (e) { } LIVE_NETS = LIVE_NETS.filter(function (n) { return n !== el.__net; }); el.__net = null; }
    var N = [], ids = {}, E = [], ek = {};
    (nodes || []).forEach(function (n) { if (!n || n.id === undefined || n.id === null || ids[n.id]) return; ids[n.id] = 1; N.push(n); });
    (edges || []).forEach(function (e) { if (!e || !ids[e.from] || !ids[e.to] || e.from === e.to) return; var k = e.from < e.to ? e.from + '\u0000' + e.to : e.to + '\u0000' + e.from; if (ek[k]) return; ek[k] = 1; var c = {}; Object.keys(e).forEach(function (x) { if (x !== 'id') c[x] = e[x]; }); E.push(c); });
    try { var net = new vis.Network(el, { nodes: new vis.DataSet(N), edges: new vis.DataSet(E) }, opts); el.__net = net; LIVE_NETS.push(net); return { net: net, nodes: N }; }
    catch (err) { if (window.console) console.warn('graph failed', err); clear(el); add(el, h('div', { class: 'muted', style: 'padding:16px', text: t('graph_fail') })); return null; }
  }
  function drawGraph(el, id, o, sns, grp, weak) {
    if (!window.vis) { loadVis().then(function () { drawGraph(el, id, o, sns, grp, weak); }).catch(function () { el.textContent = '—'; }); return; }
    var nodes = [{ id: 'o:' + id, label: o[1] || id, color: COLORS.owner, shape: 'dot', size: 26, font: { color: gfg(), size: 15 } }], edges = [];
    uniqNames(o[2]).forEach(function (v, i) { nodes.push({ id: 'n:' + i, label: v, color: COLORS.name, shape: 'dot', size: 12, font: { color: gfg() } }); edges.push({ from: 'o:' + id, to: 'n:' + i, color: window.BOOTH_THEME.isLight() ? '#b9c4d6' : '#4a5a75' }); });
    sns.slice(0, 20).forEach(function (u, i) { nodes.push({ id: 's:' + i, label: platOf(u) + ' ' + handleOf(u), color: COLORS.sns, shape: 'dot', size: 10, font: { color: gfg(1), size: 12 }, url: u }); edges.push({ from: 'o:' + id, to: 's:' + i, color: '#2f6f5f' }); });
    grp.slice(0, 15).forEach(function (g) { var x = S.byId[g]; nodes.push({ id: 'g:' + g, label: x ? x[1] : g, color: COLORS.group, shape: 'dot', size: 14, font: { color: gfg() }, owner: g }); edges.push({ from: 'o:' + id, to: 'g:' + g, color: COLORS.group, width: 2 }); });
    weak.slice(0, 15).forEach(function (w) { if (grp.indexOf(w[0]) >= 0) return; var x = S.byId[w[0]]; nodes.push({ id: 'w:' + w[0], label: x ? x[1] : w[0], color: '#55627a', shape: 'dot', size: 11, font: { color: gfg(1) }, owner: w[0], title: w[1] }); edges.push({ from: 'o:' + id, to: 'w:' + w[0], dashes: true, color: COLORS.weak }); });
    var m = mountNet(el, nodes, edges, { physics: { stabilization: { iterations: 150 }, barnesHut: { springLength: 110 } }, interaction: { hover: true }, nodes: { borderWidth: 0 } }); if (!m) return;
    m.net.on('doubleClick', function (p) { var n = p.nodes[0] && m.nodes.filter(function (x) { return x.id === p.nodes[0]; })[0]; if (n && n.owner) location.hash = '#/o/' + n.owner; });
  }

  /* ---------- 整理中場次 ---------- */
  function viewEvents(code) {
    setNav('events'); loading();
    loadMeta().then(function (m) {
      var act = m.active || []; clear(app);
      if (!act.length) { add(app, h('div', { class: 'card muted', text: t('ev_none') })); return; }
      if (!code || !act.some(function (e) { return e.code === code; })) code = act[0].code;
      add(app, h('div', { class: 'tabs' }, act.map(function (e) { return h('a', { class: 'pill' + (e.code === code ? ' on' : ''), href: '#/events/' + encodeURIComponent(e.code) }, e.name || e.code, ' ', h('span', { class: 'muted', text: e.status || '' })); })));
      var box = h('div', null, h('div', { class: 'spin', text: t('loading') })); add(app, box);
      var p = S.events[code] ? Promise.resolve(S.events[code]) : apiGet({ action: 'event', code: code }).then(function (d) { S.events[code] = d; return d; });
      Promise.all([p, S.session ? refreshMe().catch(function () { return null; }) : null]).then(function (r) {
        var d = r[0], owned = (S.me && S.me.owned) || [], isAdm = !!(S.me && S.me.admin); clear(box);
        var input = h('input', { placeholder: t('ev_search'), autocomplete: 'off' }), list = h('div', { class: 'bt' });
        add(box, h('section', { class: 'card' }, h('h3', null, d.name || code, h('small', { text: ' ' + (d.start || '') + ' ・ ' + t('ev_booths', { n: d.booths.length }) })),
          h('div', { class: 'note ' + (d.mode === 'live' ? 'good' : 'warn'), text: d.mode === 'live' ? t('ev_mode_live') : t('ev_mode_queue') }),
          h('div', { class: 'search' }, h('span', { text: '🔍' }), input)));
        add(box, list);
        function render() {
          var q = nk(input.value), mine = d.booths.filter(function (b) { return b.id && owned.indexOf(b.id) >= 0; });
          var rows = q ? d.booths.filter(function (b) { return nk(b.name + '|' + b.day1 + '|' + b.day2 + '|' + (b.fields['筆名'] || '')).indexOf(q) >= 0; }) : mine.concat(d.booths.filter(function (b) { return mine.indexOf(b) < 0; }));
          clear(list); add(list, rows.slice(0, 80).map(function (b) { return boothCard(d, b, owned.indexOf(b.id) >= 0, isAdm); }));
          if (rows.length > 80) add(list, h('div', { class: 'muted', text: t('showing', { n: 80 }) }));
        }
        input.addEventListener('input', render); render();
      }).catch(function (e) { clear(box); add(box, h('div', { class: 'card note bad', text: String(e.message || e) })); });
    }).catch(fail);
  }
  function boothCard(d, b, mine, isAdm) {
    var f = b.fields, links = [];
    Object.keys(f).forEach(function (k) { if (TEXT_FIELDS.indexOf(k) < 0) urls(f[k]).forEach(function (u) { if (links.indexOf(u) < 0) links.push(u); }); });
    return h('div', { class: 'card bk' + (mine ? ' mine' : '') },
      h('div', { class: 'oc', style: 'cursor:default;padding:0;background:none' }, b.thumb ? thumb(b.thumb) : null,
        h('div', { class: 'bd' }, h('div', { class: 'nm', text: b.name }), h('div', { class: 'meta' }, t('day1') + ' ' + (b.day1 || '—') + ' ・ ' + t('day2') + ' ' + (b.day2 || '—')))),
      ['筆名', '創作者類型', '商品年齡分類', '作品類型 (原創、二創)', '二創參考作品 (原創免填)', '販售資訊', '特殊標籤或備註'].filter(function (k) { if (!f[k]) return false; return !(k === REF_F && f[TYPE_F] && multiParse(TYPE_F, f[TYPE_F]).sel.indexOf('二創') < 0); /* 只選原創時不顯示二創參考作品 */ }).map(function (k) { return h('div', { class: 'f' + (k === '販售資訊' ? ' sales' : '') }, h('i', { text: k.replace(/ \(.*\)$/, '') }), k === '販售資訊' ? renderSales(f[k]) : MULTI[k] ? showMulti(k, f[k]) : f[k]); }),
      links.length ? h('div', { class: 'sns', style: 'margin-top:6px' }, links.slice(0, 10).map(snsLink)) : null,
      h('div', { class: 'acts', style: 'margin-top:8px' }, b.id ? h('a', { class: 'btn ghost', href: '#/o/' + b.id, text: t('ev_open_owner') }) : null,
        mine ? h('button', { class: 'btn', onclick: function () { fillFlow(d, b); }, text: t('ev_fill_mine') }) : null,
        isAdm ? h('button', { class: 'btn admx', onclick: function () { adminFillFlow(d, b); }, text: '🛠 站長編輯' }) : null));
  }

  /* ---------- 登入 ---------- */
  /* ---------- 站長：後台按鈕數字（p7）：每 60 秒輪詢 admin.counts（頁面隱藏時暫停），只讀幾個狀態欄，很輕量 ---------- */
  var ADM_T = null;
  function admPaint() {
    var s = S.adm, n = (s && s.total) || 0, b = document.getElementById('admBadge'), err = s && s.error;
    if (b) { b.hidden = !(n > 0 || err); b.textContent = err ? '!' : (n > 99 ? '99+' : String(n)); b.title = err === 'reauth' ? '站長登入已逾時：進入後台時會要求重新登入' : err ? '暫時讀不到待審核數量' : n ? '待審核／待核准 ' + n + (s.needsMySecond ? '（其中 ' + s.needsMySecond + ' 筆等你二審）' : '') : ''; b.className = 'nbadge' + (err ? ' err' : ''); }
    document.title = (n > 0 ? '(' + n + ') ' : '') + document.title.replace(/^\(\d+\) /, '');
  }
  function admPush(sum) { if (!sum || !sum.counts) return; S.adm = { counts: sum.counts, total: sum.total, needsMySecond: sum.needsMySecond, at: sum.at, fetchedAt: Date.now() }; admPaint(); }
  function admPoll() {
    if (!S.session || !S.me || !S.me.admin) return Promise.resolve();
    return apiPost({ action: 'admin.counts' }).then(function (j) { admPush(j.data); window.dispatchEvent(new Event('bdb-adm')); }).catch(function (e) {
      S.adm = Object.assign({ counts: {}, total: 0 }, S.adm || {}, { error: /^REAUTH/.test(e.message) ? 'reauth' : 'net' }); admPaint(); window.dispatchEvent(new Event('bdb-adm')); });
  }
  function admStart() { if (ADM_T) return; admPoll(); ADM_T = setInterval(function () { if (!document.hidden) admPoll(); }, 60000);
    if (!S.admHidden && !S.admHiddenP) S.admHiddenP = apiPost({ action: 'admin.hiddenNames' }).then(function (j) { S.admHidden = j.data || {}; if (S.index) setIndex(S.index); }).catch(function () { S.admHiddenP = null; }); }
  function admStop() { if (ADM_T) clearInterval(ADM_T); ADM_T = null; S.adm = null; S.admHidden = null; S.admHiddenP = null; admPaint(); if (S.index) setIndex(S.index); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && ADM_T && (!S.adm || Date.now() - (S.adm.fetchedAt || 0) > 20000)) admPoll(); });
  function applyAdmin(me) { document.querySelectorAll('.admin-only').forEach(function (e) { e.hidden = !me.admin; }); if (me.admin) admStart(); else if (ADM_T) admStop(); }
  function refreshMe() { return apiPost({ action: 'me' }).then(function (j) { S.me = j.me; applyAdmin(j.me); return j.me; }); }
  function doLogin(idToken) { return apiPost({ action: 'login', idToken: idToken }).then(function (j) { S.session = j.session; sessionStorage.setItem('bdb_session', j.session); S.me = j.me; applyAdmin(j.me); route(); }); }
  function logout(silent) { S.session = ''; S.me = null; admStop(); document.querySelectorAll('.admin-only').forEach(function (e) { e.hidden = true; }); sessionStorage.removeItem('bdb_session'); if (window.google && google.accounts) try { google.accounts.id.disableAutoSelect(); } catch (e) { } if (!silent) route(); }
  function loginBox() {
    var box = h('div', { class: 'card' }, h('h3', { text: t('login') }), h('p', { class: 'muted', text: t('login_why') }));
    var btn = h('div', { id: 'gbtn' }); add(box, btn);
    if (CFG.DEV_LOGIN) add(box, h('p', null, h('button', { class: 'btn ghost', onclick: function () { var du = prompt('dev user', 'dev-owner-1') || 'dev-owner-1'; sessionStorage.setItem('bdb_devsub', du); doLogin('fake:' + du).catch(function (e) { toast(e.message); }); }, text: t('dev_login') })));
    var cid = CFG.OAUTH_CLIENT_ID && CFG.OAUTH_CLIENT_ID.indexOf('__') !== 0 ? CFG.OAUTH_CLIENT_ID : (S.meta && S.meta.clientId);
    if (cid && !CFG.DEV_LOGIN) loadGis().then(function () {
      google.accounts.id.initialize({ client_id: cid, callback: function (r) { doLogin(r.credential).catch(function (e) { toast(e.message); }); }, auto_select: false, itp_support: true });
      google.accounts.id.renderButton(btn, { theme: 'filled_black', size: 'large', locale: lang === 'zh' ? 'zh_TW' : lang });
    }).catch(function () { btn.textContent = 'Google Sign-In unavailable'; });
    else if (!CFG.DEV_LOGIN) add(btn, h('div', { class: 'note warn', text: 'OAUTH_CLIENT_ID 尚未設定' }));
    return box;
  }
  var gisP; function loadGis() { return gisP || (gisP = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); })); }

  /* ---------- 我的攤位 ---------- */
  function viewMe() {
    setNav('me'); loading();
    Promise.all([loadMeta(), loadIndex()]).then(function () {
      if (!S.session) { clear(app); add(app, loginBox()); return; }
      return refreshMe().then(function (me) {
        clear(app);
        add(app, h('section', { class: 'card' }, h('div', { class: 'dhead' }, h('div', null, h('h3', { text: t('nav_me') }), h('div', { class: 'muted' }, '代號 ', me.uid)),
          h('div', { class: 'acts' }, me.admin ? h('a', { class: 'btn admx', href: '#/admin', text: '🛠 站長後台' }) : h('button', { class: 'btn ghost', onclick: pairFlow, text: t('pair_btn') }), h('button', { class: 'btn ghost', onclick: function () { logout(); }, text: t('logout') }), h('button', { class: 'btn warn', onclick: withdrawFlow, text: t('withdraw') })))));
        if (me.suspended) add(app, h('div', { class: 'card note bad', text: t('me_suspended') }));
        add(app, h('section', { class: 'card' }, h('h3', null, t('me_owned'), ' ', helpQ('status')),
          me.owned.length ? h('div', { class: 'grid' }, me.owned.map(function (id) { var o = S.byId[id] || [id, id, [], '', [], '', [], 0]; return h('div', { class: 'card', style: 'margin:0' }, h('div', { class: 'nm', text: o[1] }), h('div', { class: 'meta', text: id }),
            h('div', { class: 'acts', style: 'justify-content:flex-start;margin-top:8px' }, h('button', { class: 'btn', onclick: function () { editFlow(id); }, text: t('edit_title') }), h('a', { class: 'btn ghost', href: '#/o/' + id, text: t('ev_open_owner') }),
              (o[4] || []).filter(function (c) { return activeCodes().indexOf(c) >= 0; }).map(function (c) { return h('a', { class: 'btn ghost', href: '#/events/' + encodeURIComponent(c), text: c + ' ' + t('go_fill') }); }))); })) : h('div', { class: 'muted', text: t('me_none') })));
        if (me.pending.length) add(app, h('section', { class: 'card' }, h('h3', { text: t('me_pending') }), h('div', { class: 'tags' }, me.pending.map(function (id) { var o = S.byId[id]; return h('a', { class: 'tag', href: '#', onclick: function (e) { e.preventDefault(); claimFlow(id, o ? o[1] : id); }, text: (o ? o[1] : id) + ' (' + id + ')' }); }))));
        add(app, h('div', { class: 'note', text: t('admin_note') }));
      });
    }).catch(fail);
  }
  function needLogin() { if (S.session) return false; location.hash = '#/me'; toast(t('login')); return true; }

  /* 認領驗證方式（p5）：① SNS 貼文 ② 私訊 FB 粉專／LINE 官方帳號 ③ 動漫同人展資訊組 Discord。三種都用同一個驗證碼，最後由站長人工核准。 */
  var CLAIM_LINKS = { fb: 'https://www.facebook.com/JapariWeatherBureau/', line: 'https://lin.ee/qo1OC8v', discord: 'https://discord.gg/nFTsSR9HAf' };
  var POST_RE = [/^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,20}\/status(es)?\/\d{5,}/i, /^https?:\/\/(www\.|m\.|web\.)?facebook\.com\/[^\/?#]+\/(posts|videos|photos)\/[^\/?#]+/i, /^https?:\/\/(www\.|m\.|web\.)?facebook\.com\/(permalink|story)\.php\?(?=.*story_fbid=)/i, /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]{5,}/i, /^https?:\/\/(www\.)?plurk\.com\/p\/[a-z0-9]{4,}/i, /^https?:\/\/bsky\.app\/profile\/[^\/]+\/post\/[a-z0-9]{5,}/i, /^https?:\/\/(www\.)?threads\.(net|com)\/@[^\/]+\/post\/[A-Za-z0-9_-]{5,}/i];
  function isPostUrl(u) { return POST_RE.some(function (re) { return re.test(u); }); }
  function backendAtLeast(v) { return !!(S.meta && S.meta.version && S.meta.version >= v); }
  function extA(href, text, cls) { return h('a', { class: cls || 'btn ghost sm', href: href, target: '_blank', rel: 'noopener noreferrer', referrerpolicy: 'no-referrer', text: text }); }
  function copyBtn(getText) { return h('button', { class: 'btn ghost sm copyb', type: 'button', onclick: function (e) { var b = e.currentTarget, v = getText(); var done = function () { b.textContent = t('copied'); setTimeout(function () { b.textContent = t('copy'); }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { prompt(t('copy'), v); }); else { prompt(t('copy'), v); } }, text: t('copy') }); }
  function claimFlow(id, name) {
    if (needLogin()) return;
    var code = '', cur = 'sns', sent = false;
    var proof = h('input', { class: 'in', placeholder: 'https://x.com/…/status/…', inputmode: 'url' }), note = h('textarea', { class: 'in', maxlength: 300 });
    var codeBox = h('div', { class: 'claimcode' }), status = h('div'), opts = h('div', { class: 'cmethods' }), detail = h('div', { class: 'cdetail' }), after = h('div');
    function codeView() { clear(codeBox); if (!code) return; add(codeBox, [h('div', { class: 'k', text: t('claim_code_send') }), h('div', { class: 'acts', style: 'justify-content:flex-start;gap:10px' }, h('span', { class: 'code', text: code }), copyBtn(function () { return code; }))]); }
    function pick(m) { cur = m; opts.querySelectorAll('label.cm').forEach(function (l) { l.classList.toggle('on', l.getAttribute('data-m') === m); l.querySelector('input').checked = l.getAttribute('data-m') === m; }); clear(detail);
      if (m === 'sns') add(detail, [h('p', { class: 'muted', text: t('cm_sns_d') }), h('label', { class: 'fl', text: t('claim_proof') }), proof]);
      if (m === 'dm') add(detail, [h('p', { class: 'muted', text: t('cm_dm_d') }), h('div', { class: 'acts', style: 'justify-content:flex-start' }, extA(CLAIM_LINKS.fb, '📘 ' + t('cm_fb')), extA(CLAIM_LINKS.line, '💬 ' + t('cm_line')))]);
      if (m === 'discord') add(detail, [h('ol', { class: 'steps' }, t('cm_dc_s').split('|').map(function (x) { return h('li', { text: x }); })), h('div', { class: 'acts', style: 'justify-content:flex-start' }, extA(CLAIM_LINKS.discord, '🎮 ' + t('cm_dc_join')))]);
    }
    [['sns', 'cm_sns'], ['dm', 'cm_dm'], ['discord', 'cm_dc']].forEach(function (x) { add(opts, h('label', { class: 'cm', 'data-m': x[0] }, h('input', { type: 'radio', name: 'cm', value: x[0], onchange: function () { pick(x[0]); } }), h('span', { text: t(x[1]) }))); });
    var sendBtn = h('button', { class: 'btn', onclick: send, text: t('claim_send') });
    var form = h('div', null, h('div', { class: 'k', style: 'margin-top:10px', text: t('cm_pick') }), opts, detail, h('label', { class: 'fl', text: t('claim_note') }), note,
      h('p', { class: 'acts' }, h('button', { class: 'btn ghost', onclick: closeModal, text: t('cancel') }), sendBtn));
    var body = modal(t('claim_title') + '：' + name + '（' + id + '）', [h('p', { class: 'muted' }, t('claim_steps'), ' ', helpQ('claim')), status, codeBox, form, after]);
    pick('sns');
    function done(d, m) { sent = true; clear(after); form.hidden = true; /* 送出後只留驗證碼、結果與提醒 */ var methodTxt = t({ sns: 'cm_sns', dm: 'cm_dm', discord: 'cm_dc' }[m] || 'cm_sns');
      add(after, [h('div', { class: 'note good claimdone' }, h('b', { text: '✅ ' + t('claim_done') }), h('div', { class: 'muted', text: t('claim_cur') + methodTxt })),
        h('div', { class: 'note warn claimremind', text: '⚠ ' + t('claim_remind') }),
        !backendAtLeast('2026-11-24-p5') ? h('div', { class: 'note', text: t('claim_old_backend') }) : null,
        h('div', { class: 'acts', style: 'justify-content:flex-start' }, m === 'discord' ? extA(CLAIM_LINKS.discord, '🎮 ' + t('cm_dc_join'), 'btn') : m === 'dm' ? [extA(CLAIM_LINKS.fb, '📘 ' + t('cm_fb'), 'btn'), extA(CLAIM_LINKS.line, '💬 ' + t('cm_line'), 'btn')] : null, h('button', { class: 'btn ghost', onclick: closeModal, text: t('ok') }))]);
      after.scrollIntoView && after.scrollIntoView({ block: 'nearest' }); }
    function show(d) { clear(status); if (d.status === '已核准') { add(status, h('div', { class: 'note good', text: d.status })); form.hidden = true; return; }
      code = d.code || code; codeView(); if (d.status === '待審核') { if (d.method) pick(d.method); add(status, h('div', { class: 'note warn', text: t('me_pending') + (d.method ? '・' + t('claim_cur') + t({ sns: 'cm_sns', dm: 'cm_dm', discord: 'cm_dc' }[d.method]) : '') })); } }
    // 先取得驗證碼（p5：preview 不寫入；p4 以前的後端會在這一步建立申請，之後的送出會被忽略，所以下方另有提示）
    apiPost({ action: 'claim', ownerId: id, preview: true }).then(function (j) { show(j.data); }).catch(function (e) { clear(status); add(status, h('div', { class: 'note bad', text: e.message })); });
    function send() {
      var m = cur, u = proof.value.trim();
      if (m === 'sns' && !isPostUrl(u)) { toast(t('claim_need_post')); proof.focus(); return; }
      sendBtn.disabled = true;
      (API_OK ? liveMeta().catch(function () { return null; }) : Promise.resolve(null)).then(function () {
      var p5 = backendAtLeast('2026-11-24-p5'), methodForApi = p5 ? m : (m === 'sns' ? 'post' : 'dm'); // p4 後端只認得 post／dm
      var nt = note.value; if (!p5 && m === 'discord') nt = '[Discord] ' + nt;
      return apiPost({ action: 'claim', ownerId: id, method: methodForApi, proofUrl: m === 'sns' ? u : '', note: nt }).then(function (j) { if (j.data.code) { code = j.data.code; codeView(); } done(j.data, m); toast(t('ok')); }); })
        .catch(function (e) { toast(e.message); }).then(function () { sendBtn.disabled = false; });
    }
    return body;
  }
  function reportFlow(id) {
    if (needLogin()) return;
    var other = h('input', { class: 'in', placeholder: 'C01234' }), kind = h('select', { class: 'in' }, h('option', { value: 'merge', text: t('report_merge') }), h('option', { value: 'split', text: t('report_split') })), note = h('textarea', { class: 'in', maxlength: 300 });
    modal(t('report_title') + '（' + id + '）', [h('label', { class: 'fl', text: t('report_other') }), other, h('label', { class: 'fl' }, ''), kind, h('label', { class: 'fl', text: t('claim_note') }), note,
      h('p', { class: 'acts' }, h('button', { class: 'btn ghost', onclick: closeModal, text: t('cancel') }), h('button', { class: 'btn', onclick: function () { apiPost({ action: 'report', a: id, b: other.value.trim(), kind: kind.value, note: note.value }).then(function () { closeModal(); toast(t('ok')); }).catch(function (e) { toast(e.message); }); }, text: t('submit') }))]);
  }
  function withdrawFlow() { if (!confirm(t('withdraw_confirm'))) return; apiPost({ action: 'withdraw' }).then(function (j) { toast(t('withdraw_done', { n: j.done })); logout(); }).catch(function (e) { toast(e.message); }); }

  /* 複選欄位（p7）：作品類型＝原創／二創；商品年齡分類＝一般／R15／R18。畫面用可點選的選項鈕（平板好按），送出的值一律是中文標準值「A, B」。
   * 「二創參考作品」只有在選了「二創」時才顯示；隱藏時不送出、不驗證，原本的值保留在整理表裡不動。 */
  var MULTI = { '作品類型 (原創、二創)': ['原創', '二創'], '商品年齡分類': ['一般', 'R15', 'R18'] }, TYPE_F = '作品類型 (原創、二創)', REF_F = '二創參考作品 (原創免填)';
  var MULTI_KEY = { '原創': 'opt_orig', '二創': 'opt_fan', '一般': 'opt_all', 'R15': 'opt_r15', 'R18': 'opt_r18' };
  var MALIAS = { '原創': '原創', 'オリジナル': '原創', 'original': '原創', '二創': '二創', '二次創作': '二創', 'fanwork': '二創', 'fanworks': '二創', 'fanart': '二創', 'derivative': '二創', '一般': '一般', '全年齡': '一般', '全年齢': '一般', '全年齡向': '一般', 'allages': '一般', 'general': '一般', 'r15': 'R15', 'r-15': 'R15', 'r18': 'R18', 'r-18': 'R18', '18禁': 'R18' };
  function multiParse(f, v) {
    var opts = MULTI[f], got = {}, extra = [];
    String(v || '').split(/[,，、;；\/\n|]+/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (tk) {
      var k = tk.toLowerCase().replace(/[\s_]/g, ''), m = MALIAS[k] || MALIAS[k.replace(/-/g, '')];
      if (m && opts.indexOf(m) >= 0) got[m] = 1; else if (extra.indexOf(tk) < 0) extra.push(tk); });
    return { sel: opts.filter(function (o) { return got[o]; }), extra: extra };
  }
  function multiCanon(f, v) { var p = multiParse(f, v); return p.sel.concat(p.extra).join(', '); }
  function optLabel(tok, adm) { var k = MULTI_KEY[tok]; return k ? (adm ? tz(k) : t(k)) : tok; }
  /** 公開頁顯示：依介面語言顯示選項名稱（原創／Original／オリジナル…）。 */
  function showMulti(f, v) { var p = multiParse(f, v); return p.sel.concat(p.extra).map(function (x) { return optLabel(x); }).join(lang === 'en' ? ' / ' : '、'); }
  function multiSel(f, cur, isAdmin, onChange) {
    var p = multiParse(f, cur), on = {}, order = MULTI[f].concat(p.extra), box = h('div', { class: 'msel', role: 'group', 'aria-label': f });
    order.forEach(function (o) { on[o] = p.sel.indexOf(o) >= 0 || p.extra.indexOf(o) >= 0; });
    function draw() { clear(box); order.forEach(function (o) { var b = h('button', { type: 'button', class: 'chip' + (on[o] ? ' on' : ''), 'aria-pressed': on[o] ? 'true' : 'false', text: (on[o] ? '✓ ' : '') + optLabel(o, isAdmin) });
      b.addEventListener('click', function () { on[o] = !on[o]; draw(); if (onChange) onChange(); }); add(box, b); }); }
    draw();
    Object.defineProperty(box, 'value', { get: function () { return order.filter(function (o) { return on[o]; }).join(', '); } });
    box.has = function (o) { return !!on[o]; }; box.norm = function (v) { return multiCanon(f, v); };
    return box;
  }
  /* 共用：欄位表單 → 預覽差異 → 確認送出 */
  function fieldForm(fields, current, onSubmit, extra, isAdmin) {
    var inputs = {}, rowEl = {}, wrap = h('div'), pv = h('div');
    function updRef() { var rf = inputs[REF_F], tp = inputs[TYPE_F]; if (!rf || !tp) return; var show = tp.has('二創'); rowEl[REF_F].style.display = show ? '' : 'none'; rf.hiddenState = !show; }
    fields.forEach(function (f) {
      var long = LONG_FIELDS.indexOf(f) >= 0, el = MULTI[f] ? multiSel(f, current[f] || '', isAdmin, updRef) : f === '販售資訊' ? salesEditor(current[f] || '', isAdmin) : long ? h('textarea', { class: 'in' }) : h('input', { class: 'in', placeholder: TEXT_FIELDS.indexOf(f) < 0 ? 'https://' : '' });
      if (f !== '販售資訊' && !MULTI[f]) el.value = current[f] || ''; inputs[f] = el;
      rowEl[f] = h('div', { class: 'frow' }, h('div', { class: 'k', text: f }), MULTI[f] ? h('div', null, el, h('div', { class: 'muted', style: 'font-size:12px;margin-top:4px', text: isAdmin ? tz('multi_hint') : t('multi_hint') })) : el); add(wrap, rowEl[f]);
    });
    updRef();
    var btnPv = h('button', { class: 'btn', text: t('preview') });
    btnPv.addEventListener('click', function () {
      var ch = {}, old = {}; fields.forEach(function (f) { if (inputs[f].dirty === false || inputs[f].hiddenState) return; var v = inputs[f].value.trim(), cv = inputs[f].norm ? inputs[f].norm(current[f]) : String(current[f] || '').trim(); if (v !== cv) { ch[f] = v; old[f] = current[f] || ''; } });
      clear(pv); if (!Object.keys(ch).length) { add(pv, h('div', { class: 'note', text: t('diff_none') })); return; }
      apiPost({ action: 'preview', changes: ch, old: old }).then(function (j) {
        var res = j.data, blocked = false;
        var rows = Object.keys(ch).map(function (f) { var r = res[f] || {}; if (!r.ok) blocked = true;
          return h('tr', null, h('td', { text: f }), h('td', { class: 'o', text: old[f] || '—' }), h('td', { class: 'n' }, r.ok ? (urls(r.value).length ? urls(r.value).map(function (u) { return h('div', null, h('b', { text: platOf(u) + ' ' }), hostOf(u), ' ', h('span', { class: 'muted', text: u })); }) : (r.value || '（清空）')) : h('span', { text: t('blocked') + '：' + r.block })),
            h('td', null, r.ok ? h('span', { class: 'conf ' + (r.risk >= 50 ? 'single' : r.risk >= 30 ? 'medium' : 'high'), text: t('risk') + ' ' + r.risk }) : null, r.sensitive ? h('div', { class: 'muted', text: t('sensitive') }) : null, (r.notes || []).length ? h('div', { class: 'muted', text: r.notes.join('；') }) : null)); });
        add(pv, h('table', { class: 't diff' }, h('thead', null, h('tr', null, h('th', { text: t('field') }), h('th', { text: t('old_v') }), h('th', { text: t('new_v') }), h('th', { text: t('risk') }))), h('tbody', null, rows)));
        if (!blocked) add(pv, h('p', { class: 'acts' }, h('button', { class: 'btn', onclick: function (e) { e.target.disabled = true; onSubmit(ch).then(function (d) { clear(pv); add(pv, h('div', { class: 'note good', text: isAdmin ? '已寫入 ' + (d.applied || 0) + ' 欄' + (d.queued ? '，' + d.queued + ' 欄身分欄位等待第二位站長確認' : '') : d.applied ? t('sent_live', { a: d.applied, q: d.queued }) : t('sent_queue', { n: d.queued || 0 }) })); if (d.failed && d.failed.length) add(pv, h('div', { class: 'note bad', text: d.failed.join('；') })); }).catch(function (er) { e.target.disabled = false; add(pv, h('div', { class: 'note bad', text: er.message })); }); }, text: isAdmin ? '🛠 確認直接寫入' : t('confirm_submit') })));
      }).catch(function (e) { add(pv, h('div', { class: 'note bad', text: e.message })); });
    });
    return [extra || null, wrap, h('p', { class: 'acts' }, btnPv), pv];
  }
  /* 販售資訊（p6）：單品「💠類別【內容】」一行一項；套組「💠套組名稱」＋「1. 商品名」「2. 商品名」…；兩種可以混用、排序。
   * 讀入時不丟任何文字：沒有【】的「💠文字」轉成單品（類別預設「商品」並提示）；其他看不懂的行保留成「其他文字」原樣顯示，送出前由伺服器檢查格式。 */
  var SALES_RE = /^💠\s*([^【】\n]*?)\s*【\s*([^【】\n]*?)\s*】$/, SALES_HEAD = /^💠\s*([^【】\n]+?)\s*$/, SALES_NUM = /^(\d{1,2})\s*[.．、)）]\s*(.+)$/;
  function parseSales(v, defCat) {
    var L = String(v || '').replace(/\r/g, '').split('\n').map(function (x) { return x.replace(/\u3000/g, ' ').trim(); }).filter(Boolean), out = [], b = null, legacy = false;
    function text(l) { var last = out[out.length - 1]; if (last && last.k === 'text') last.text += '\n' + l; else out.push({ k: 'text', text: l }); }
    L.forEach(function (l, i) {
      var m = l.match(SALES_RE), n;
      if (m && (m[1] || m[2])) { b = null; out.push({ k: 'item', cat: m[1], con: m[2] }); return; }
      if (b && (n = l.match(SALES_NUM)) && +n[1] === b.items.length + 1 && !/[【】]/.test(n[2])) { b.items.push(n[2].trim()); return; }
      var nx = L[i + 1] && L[i + 1].match(SALES_NUM);
      if ((m = l.match(SALES_HEAD)) && nx && +nx[1] === 1) { b = { k: 'bundle', name: m[1], items: [] }; out.push(b); return; }
      b = null;
      if (m) { legacy = true; out.push({ k: 'item', cat: defCat, con: m[1] }); return; }
      text(l);
    });
    out.legacy = legacy; return out;
  }
  function serSales(blocks) {
    return blocks.map(function (x) {
      if (x.k === 'item') { var c = (x.cat || '').trim(), v = (x.con || '').trim(); return c || v ? '💠' + c + '【' + v + '】' : ''; }
      if (x.k === 'bundle') { var it = x.items.map(function (s) { return s.trim(); }).filter(Boolean); if (!x.name.trim() && !it.length) return ''; return ['💠' + x.name.trim()].concat(it.map(function (s, i) { return (i + 1) + '. ' + s; })).join('\n'); }
      return (x.text || '').trim();
    }).filter(Boolean).join('\n');
  }
  /** 顯示用：單品一行、套組＝標題＋編號清單、其他文字原樣（全部 textContent）。 */
  function renderSales(v) {
    var blocks = parseSales(v, ''), box = h('div', { class: 'salesv' });
    blocks.forEach(function (x) {
      if (x.k === 'item') add(box, h('div', { class: 'si' }, '💠', x.cat ? [h('b', { text: x.cat }), '【' + x.con + '】'] : x.con));
      else if (x.k === 'bundle') add(box, h('div', { class: 'sb' }, h('div', { class: 'sbh' }, '💠', h('b', { text: x.name }), h('span', { class: 'tag sm', text: t('sales_bundle_tag') })), h('ol', null, x.items.map(function (s) { return h('li', { text: s }); }))));
      else add(box, h('div', { class: 'st', text: x.text }));
    });
    return box;
  }
  function salesEditor(initial, isAdmin) {
    var T = function (k, p) { return isAdmin ? tz(k, p) : t(k, p); };
    var rows = parseSales(initial, T('sales_default_cat')), list = h('div', { class: 'sales-ed' }), pv = h('pre', { class: 'sales-pv' });
    var p6 = !S.meta || !S.meta.version || S.meta.version >= '2026-11-24-p6';
    var addBundleBtn = h('button', { class: 'pill sm', type: 'button', disabled: !p6, onclick: function () { touch(); rows.push({ k: 'bundle', name: '', items: ['', ''] }); draw(); var ins = list.querySelectorAll('.sbundle:last-child input'); if (ins.length) ins[0].focus(); }, text: '＋ ' + T('sales_add_bundle') });
    var box = h('div', null, rows.legacy ? h('div', { class: 'note warn', text: T('sales_converted') }) : null,
      rows.some(function (x) { return x.k === 'text'; }) ? h('div', { class: 'note warn', text: T('sales_text_warn') }) : null,
      h('div', { class: 'muted', style: 'font-size:12px' }, T('sales_hint'), ' ', helpQ('sales', isAdmin)), list,
      h('div', { class: 'acts', style: 'justify-content:flex-start;gap:8px' },
        h('button', { class: 'pill sm', type: 'button', onclick: function () { touch(); rows.push({ k: 'item', cat: '', con: '' }); draw(); var ins = list.querySelectorAll('input'); if (ins.length) ins[ins.length - 2].focus(); }, text: '＋ ' + T('sales_add') }), addBundleBtn),
      !p6 ? h('div', { class: 'muted', style: 'font-size:12px', text: T('sales_bundle_old') }) : null,
      h('div', { class: 'muted', style: 'font-size:12px;margin-top:6px', text: T('sales_preview') }), pv);
    function touch() { box.dirty = true; }
    function upd() { pv.textContent = serSales(rows) || '—'; }
    function strip(v) { return v.replace(/[【】\n]/g, ''); }
    function moveBtns(i) { return [h('button', { class: 'pill sm', type: 'button', title: '↑', 'aria-label': '↑', disabled: i === 0, onclick: function () { touch(); rows.splice(i - 1, 0, rows.splice(i, 1)[0]); draw(); }, text: '↑' }),
      h('button', { class: 'pill sm', type: 'button', title: '↓', 'aria-label': '↓', disabled: i === rows.length - 1, onclick: function () { touch(); rows.splice(i + 1, 0, rows.splice(i, 1)[0]); draw(); }, text: '↓' }),
      h('button', { class: 'pill sm', type: 'button', title: '×', 'aria-label': '×', onclick: function () { touch(); rows.splice(i, 1); if (!rows.length) rows.push({ k: 'item', cat: '', con: '' }); draw(); }, text: '×' })]; }
    function draw() {
      clear(list);
      rows.forEach(function (r, i) {
        if (r.k === 'item') {
          var cat = h('input', { class: 'in', placeholder: T('sales_cat'), value: r.cat, maxlength: 30 }), con = h('input', { class: 'in', placeholder: T('sales_content'), value: r.con });
          cat.addEventListener('input', function () { touch(); r.cat = strip(cat.value); upd(); }); con.addEventListener('input', function () { touch(); r.con = strip(con.value); upd(); });
          add(list, h('div', { class: 'srow' }, h('span', { class: 'dia', text: '💠' }), cat, h('span', { class: 'br', text: '【' }), con, h('span', { class: 'br', text: '】' }), moveBtns(i)));
        } else if (r.k === 'bundle') {
          var nm = h('input', { class: 'in', placeholder: T('sales_bundle_name'), value: r.name, maxlength: 40 });
          nm.addEventListener('input', function () { touch(); r.name = strip(nm.value); upd(); });
          var ol = h('div', { class: 'bitems' });
          r.items.forEach(function (it, j) {
            var inp = h('input', { class: 'in', placeholder: T('sales_bundle_item'), value: it });
            inp.addEventListener('input', function () { touch(); r.items[j] = strip(inp.value); upd(); });
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); touch(); r.items.splice(j + 1, 0, ''); draw(); var q = list.children[i] && list.children[i].querySelectorAll('.bitem input')[j + 1]; if (q) q.focus(); } });
            add(ol, h('div', { class: 'bitem' }, h('span', { class: 'num', text: (j + 1) + '.' }), inp,
              h('button', { class: 'pill sm', type: 'button', title: '↑', 'aria-label': '↑', disabled: j === 0, onclick: function () { touch(); r.items.splice(j - 1, 0, r.items.splice(j, 1)[0]); draw(); }, text: '↑' }),
              h('button', { class: 'pill sm', type: 'button', title: '×', 'aria-label': '×', onclick: function () { touch(); r.items.splice(j, 1); if (!r.items.length) r.items.push(''); draw(); }, text: '×' })));
          });
          add(list, h('div', { class: 'sbundle' }, h('div', { class: 'srow' }, h('span', { class: 'dia', text: '💠' }), h('span', { class: 'tag sm', text: T('sales_bundle_tag') }), nm, moveBtns(i)), ol,
            h('button', { class: 'pill sm', type: 'button', style: 'margin-left:34px', onclick: function () { touch(); r.items.push(''); draw(); var q = list.children[i] ? list.children[i].querySelectorAll('.bitem input') : []; if (q.length) q[q.length - 1].focus(); }, text: '＋ ' + T('sales_bundle_add_item') })));
        } else {
          var ta = h('textarea', { class: 'in', rows: Math.min(6, r.text.split('\n').length + 1) }); ta.value = r.text;
          ta.addEventListener('input', function () { touch(); r.text = ta.value; upd(); });
          add(list, h('div', { class: 'stext' }, h('div', { class: 'muted', style: 'font-size:12px', text: T('sales_text_row') }), h('div', { class: 'srow' }, ta, moveBtns(i)),
            h('button', { class: 'pill sm', type: 'button', onclick: function () { touch(); var ls = r.text.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); rows.splice.apply(rows, [i, 1].concat(ls.map(function (x) { return { k: 'item', cat: T('sales_default_cat'), con: strip(x) }; }))); draw(); }, text: T('sales_text_conv') })));
        }
      });
      upd();
    }
    if (!rows.length) rows.push({ k: 'item', cat: '', con: '' }); draw(); box.dirty = false;
    Object.defineProperty(box, 'value', { get: function () { return serSales(rows); } });
    return box;
  }
  /** 「使用過的攤名」開關（p7）：攤主自己切換立即生效、不需審核（只是改變誰看得到，不改資料）；站長也可代為切換（會記在站長操作紀錄）。 */
  function nameVisBox(id, hiddenNow, byOwner) {
    var T = byOwner ? t : tz, msg = h('span', { class: 'muted' }), btn = h('button', { class: 'btn ghost', type: 'button', text: hiddenNow ? T('names_show_btn') : T('names_hide_btn') });
    btn.addEventListener('click', function () {
      btn.disabled = true; var want = !hiddenNow;
      (byOwner ? apiPost({ action: 'nameVis', ownerId: id, hidden: want }) : adminCall({ action: 'admin.setNameVis', ownerId: id, hidden: want })).then(function () {
        toast(want ? T('names_hide_done') : T('names_show_done')); S.index = null; sessionStorage.removeItem('bdb_index'); OWNER_P = {};
        return apiGet({ action: 'index' }).then(function (d) { setIndex(d); storeIndex(d); }).catch(function () { }).then(function () { route(); });
      }).catch(function (e) { btn.disabled = false; msg.textContent = e.message; });
    });
    return h('div', { class: 'nvbox' }, h('div', { class: 'muted', style: 'font-size:12.5px' }, hiddenNow ? '🙈 ' + (byOwner ? T('names_hidden_mine') : '此攤主已隱藏舊攤名（公開頁看不到；站長可見）。') : '👁 ' + (byOwner ? T('names_shown_mine') : '此攤主的舊攤名目前公開。')), h('div', { class: 'acts', style: 'justify-content:flex-start;margin-top:6px' }, btn, msg));
  }
  function editFlow(id) {
    apiPost({ action: 'ownerFull', ownerId: id }).then(function (j) { return j.data; }).then(function (d) {
      var rows = d.dbRows.slice(), isNew = !rows.length;
      // 只有出展紀錄、主資料庫還沒有列的攤主：以最近一屆攤名建立「新列」表單，核准後伺服器才新增資料列
      if (isNew) { var last = d.history.length ? d.history[d.history.length - 1].name : ''; rows = [{ row: 0, fields: { '攤位名稱': last } }]; }
      var sel = h('select', { class: 'in' }, rows.map(function (r, i) { return h('option', { value: i, text: (r.fields['攤位名稱'] || ('#' + r.row)) + (isNew ? '（' + t('edit_new_row') + '）' : '') }); })), holder = h('div');
      function build() { clear(holder); var r = rows[+sel.value]; add(holder, fieldForm(DB_EDITABLE, r.fields, function (ch) { return apiPost({ action: 'edit', ownerId: id, rowName: r.fields['攤位名稱'] || '', changes: ch }).then(function (j) { S.index = null; sessionStorage.removeItem('bdb_index'); return j.data; }); })); }
      sel.addEventListener('change', build);
      modal(t('edit_title') + '（' + id + '）', [h('div', { class: 'muted', style: 'text-align:right' }, helpQ('edit')), nameVisBox(id, !!d.namesHidden, true), isNew ? h('div', { class: 'note warn', text: t('edit_new_row_note') }) : null, h('label', { class: 'fl', text: t('edit_row') }), sel, holder]); build();
    }).catch(function (e) { toast(t('err') + '：' + e.message); });
  }
  function fillFlow(d, b) {
    var thumbIn = h('input', { class: 'in', placeholder: 'https://drive.google.com/file/d/…/view' }), tres = h('span', { class: 'muted' });
    var thumbBox = h('div', { class: 'card', style: 'margin:12px 0 0;padding:12px' }, h('div', { class: 'k' }, t('thumb_title'), ' ', helpQ('thumb')), thumbIn,
      h('p', { class: 'acts' }, tres, h('button', { class: 'btn ghost', onclick: function () { apiPost({ action: 'checkThumb', url: thumbIn.value }).then(function (j) { tres.textContent = j.status === 'PUBLIC' ? t('thumb_public') : j.status === 'BAD_LINK' ? t('thumb_bad') : t('thumb_not_public') + '（' + j.status + '）'; }).catch(function (e) { tres.textContent = e.message; }); }, text: t('thumb_check') }),
        h('button', { class: 'btn', onclick: function () { apiPost({ action: 'thumb', ownerId: b.id, event: d.code, booth: b.name, boothNo: b.day1 || b.day2, url: thumbIn.value }).then(function (j) { tres.textContent = j.data.applied ? t('sent_live', { a: j.data.applied, q: j.data.queued }) : t('sent_queue', { n: j.data.queued }); }).catch(function (e) { tres.textContent = e.message; }); }, text: t('submit') })));
    modal(t('fill_title') + '：' + d.code + ' ／ ' + b.name, fieldForm(EVENT_EDITABLE, b.fields, function (ch) {
      return apiPost({ action: 'eventfill', ownerId: b.id, event: d.code, booth: b.name, boothNo: b.day1 || b.day2, changes: ch }).then(function (j) { delete S.events[d.code]; return j.data; });
    }, h('div', { class: 'note ' + (d.mode === 'live' ? 'good' : 'warn'), text: d.mode === 'live' ? t('ev_mode_live') : t('ev_mode_queue') }))).appendChild(thumbBox);
  }

  /* ---------- 站長直接編輯（攤主頁／場次頁）：立即套用、同一套驗證、記錄在站長操作紀錄、可復原 ---------- */
  function adminResult(d) { return { applied: d.applied, queued: d.waiting, failed: d.failed }; }
  function adminCall(body) { return apiPost(body).catch(function (e) { if (/^REAUTH:/.test(e.message)) return reauth(e.message.replace(/^REAUTH:/, '')).then(function () { return apiPost(body); }); throw e; }); }
  function adminNote() { return h('div', { class: 'note admx', text: '🛠 站長直接修改：一般欄位按下確認後立即寫入（不進審核佇列），驗證規則與攤主相同；每一格都記錄在「站長操作紀錄」，可在後台稽核紀錄復原。身分欄位在有 2 位以上站長時會進入「待第二位確認」。' }); }
  function adminEditFlow(id) {
    adminCall({ action: 'ownerFull', ownerId: id }).then(function (j) { return j.data; }).then(function (d) {
      var rows = d.dbRows.slice(), isNew = !rows.length;
      if (isNew) { var last = d.history.length ? d.history[d.history.length - 1].name : ''; rows = [{ row: 0, fields: { '攤位名稱': last } }]; }
      var sel = h('select', { class: 'in' }, rows.map(function (r, i) { return h('option', { value: i, text: (r.fields['攤位名稱'] || ('#' + r.row)) + (r.row ? '（第 ' + r.row + ' 列）' : '（新列）') }); })), holder = h('div');
      function build() { clear(holder); var r = rows[+sel.value]; add(holder, fieldForm(DB_EDITABLE, r.fields, function (ch) { return adminCall({ action: 'admin.ownerEdit', ownerId: id, rowName: r.fields['攤位名稱'] || '', changes: ch }).then(function (j) { S.index = null; sessionStorage.removeItem('bdb_index'); return adminResult(j.data); }); }, null, true)); }
      sel.addEventListener('change', build);
      modal('🛠 站長編輯主資料（' + id + '）', [adminNote(), nameVisBox(id, !!d.namesHidden, false), isNew ? h('div', { class: 'note warn', text: '此攤主在主資料庫還沒有列：寫入時會新增一列。' }) : null, h('label', { class: 'fl', text: t('edit_row') }), sel, holder]); build();
    }).catch(function (e) { toast(t('err') + '：' + e.message); });
  }
  function adminFillFlow(d, b) {
    var expect = {}; Object.keys(b.fields).forEach(function (k) { expect[k] = b.fields[k]; });
    modal('🛠 站長編輯：' + d.code + ' ／ ' + b.name, fieldForm(EVENT_EDITABLE, b.fields, function (ch) {
      var ex = {}; Object.keys(ch).forEach(function (k) { ex[k] = expect[k] || ''; });
      return adminCall({ action: 'admin.eventEdit', event: d.code, booth: b.name, boothNo: b.day1 || b.day2, changes: ch, expect: ex }).then(function (j) { delete S.events[d.code]; return adminResult(j.data); });
    }, adminNote(), true));
  }
  /** 站長高風險操作：要求 10 分鐘內重新以 Google 登入（伺服器檢查登入時間）。 */
  function reauth(msg) {
    return new Promise(function (ok, no) {
      // 若重新登入前已有開著的表單（例如站長直接編輯），登入後把它放回去，讓結果顯示在原表單裡
      var mEl = document.getElementById('modal'), mb = document.getElementById('mbody'), prev = mEl.hidden ? null : Array.prototype.slice.call(mb.childNodes);
      var back = function () { if (prev) { clear(mb); prev.forEach(function (n) { mb.appendChild(n); }); mEl.hidden = false; } else closeModal(); };
      var btn = h('div'), body = [h('div', { class: 'note warn', text: msg || '此操作需要重新登入' }), h('p', { class: 'muted', text: '重新登入後會自動繼續剛才的操作。' }), btn,
        h('p', { class: 'acts' }, h('button', { class: 'btn ghost', onclick: function () { back(); no(new Error('已取消')); }, text: t('cancel') }))];
      var done = function (tok) { apiPost({ action: 'login', idToken: tok }).then(function (j) { S.session = j.session; sessionStorage.setItem('bdb_session', j.session); S.me = j.me; back(); ok(); }).catch(function (e) { toast(e.message); }); };
      modal('🔐 重新登入', body);
      if (CFG.DEV_LOGIN) { add(btn, h('button', { class: 'btn', onclick: function () { done('fake:' + (sessionStorage.getItem('bdb_devsub') || 'dev-admin').replace(/~stale$/, '')); }, text: t('dev_login') + '（重新登入）' })); return; }
      var cid = CFG.OAUTH_CLIENT_ID && CFG.OAUTH_CLIENT_ID.indexOf('__') !== 0 ? CFG.OAUTH_CLIENT_ID : (S.meta && S.meta.clientId);
      loadGis().then(function () { google.accounts.id.initialize({ client_id: cid, callback: function (r) { done(r.credential); }, auto_select: false, itp_support: true }); google.accounts.id.renderButton(btn, { theme: 'filled_black', size: 'large', locale: lang === 'zh' ? 'zh_TW' : lang }); }).catch(function () { btn.textContent = 'Google Sign-In unavailable'; });
    });
  }
  function pairFlow() {
    var label = h('input', { class: 'in', placeholder: t('pair_label_ph'), maxlength: 20 }), out = h('div');
    modal(t('pair_btn'), [h('p', { class: 'muted', text: t('pair_why') }), h('label', { class: 'fl', text: t('pair_label') }), label, out,
      h('p', { class: 'acts' }, h('button', { class: 'btn', onclick: function () { apiPost({ action: 'admin.pairStart', label: label.value }).then(function (j) { clear(out); add(out, j.data.already ? h('div', { class: 'note good', text: j.data.label }) : h('div', { class: 'note good' }, t('pair_code') + '：', h('span', { class: 'code', text: j.data.code }), h('div', { class: 'muted', text: t('pair_next') }))); }).catch(function (e) { toast(e.message); }); }, text: t('pair_get') }))]);
  }

  /* ---------- 使用說明 ---------- */
  /** 小「?」說明鈕：連到使用說明的某一節。 */
  function helpQ(id, admin) { return h('a', { class: 'helpq', href: admin ? '#/admin/help/' + id : '#/help/' + id, title: t('help_q'), 'aria-label': t('help_q'), text: '?' }); }
  /** 說明頁本體（攤主版與站長版共用）：目錄＋每個任務的編號步驟＋一張截圖＋常見問題。 */
  function helpBody(H, focus, base, faqT, tocT) {
    var wrap = h('div', { class: 'help' });
    add(wrap, h('section', { class: 'card' }, h('h2', { style: 'font-size:22px', text: H.title }), h('p', { class: 'muted', text: H.intro }),
      h('div', { class: 'tags' }, H.tasks.map(function (x, i) { return h('a', { class: 'tag', href: base + x.id, text: (i + 1) + '. ' + x.t }); }), h('a', { class: 'tag', href: base + 'faq', text: '❓ ' + faqT }))));
    H.tasks.forEach(function (x, i) {
      add(wrap, h('section', { class: 'card htask', id: 'help-' + x.id }, h('h3', { text: (i + 1) + '. ' + x.t }),
        h('div', { class: 'hgrid' }, h('ol', { class: 'steps' }, x.s.map(function (st) { return h('li', { text: st }); })),
          h('a', { href: 'help/' + x.img + '.jpg', target: '_blank', rel: 'noopener' }, h('img', { class: 'hshot', src: 'help/' + x.img + '.jpg', alt: x.t, loading: 'lazy' })))));
    });
    add(wrap, h('section', { class: 'card', id: 'help-faq' }, h('h3', { text: '❓ ' + faqT }), H.faq.map(function (q) { return h('details', { class: 'faq' }, h('summary', { text: q[0] }), h('p', { text: q[1] })); })));
    if (focus) setTimeout(function () { var el = document.getElementById('help-' + focus); if (el) el.scrollIntoView({ block: 'start' }); }, 50);
    return wrap;
  }
  function viewHelp(focus) {
    setNav('help'); clear(app); var H = (window.HELP || {})[lang] || window.HELP.zh;
    add(app, helpBody(H, focus, '#/help/', H.faq_t, H.toc));
  }
  window.BOOTH_HELP = { body: helpBody, q: helpQ };

  /* ---------- 隱私權政策 ---------- */
  function viewPrivacy() {
    setNav(''); clear(app); var p = P[lang] || P.zh, contact = CFG.CONTACT || '';
    add(app, h('section', { class: 'card pp' }, h('h2', { style: 'font-size:22px', text: p.title }), h('div', { class: 'muted', text: (lang === 'en' ? 'Last updated: ' : lang === 'ja' ? '最終更新日：' : '最後更新：') + P.updated }),
      p.sections.map(function (s) { return [h('h2', { text: s[0] }), s[1].map(function (x) { return h('p', { text: x.split('{CONTACT}').join(contact) }); })]; }),
      h('div', { class: 'tabs', style: 'margin-top:16px' }, LANGS.map(function (l) { return h('a', { class: 'pill sm' + (l === lang ? ' on' : ''), href: '?lang=' + l + '#/privacy', text: P[l].title }); }))));
  }


  /* ---------- 首頁總覽圖（全部攤主的關聯網絡） ---------- */
  function drawOverview(el, sub, rel, showPairs) {
    if (!window.vis) { loadVis().then(function () { drawOverview(el, sub, rel, showPairs); }); return; } var adj = {}, E = [], seen = {}, grp = {}; (rel.g || []).forEach(function (g) { grp[g] = 1; });
    function link(a, b, e) { var k = a < b ? a + b : b + a; if (seen[k]) return; seen[k] = 1; (adj[a] = adj[a] || {})[b] = 1; (adj[b] = adj[b] || {})[a] = 1; e.from = a; e.to = b; E.push(e); }
    var L = window.BOOTH_THEME.isLight();
    Object.keys(rel.r).forEach(function (a) { rel.r[a].forEach(function (b) { link(a, b, { color: L ? '#7b52d9' : '#b48cff', width: 1.6 }); }); });
    Object.keys(rel.w).forEach(function (a) { rel.w[a].forEach(function (w) { link(a, w[0], { dashes: [4, 4], color: L ? '#d9730d' : '#ff9f43', width: 1.3, title: w[1] }); }); });
    var comp = {}, ci = 0, size = {};
    Object.keys(adj).forEach(function (id) { if (comp[id] !== undefined) return; var st = [id]; comp[id] = ci; while (st.length) { var x = st.pop(); Object.keys(adj[x]).forEach(function (y) { if (comp[y] === undefined) { comp[y] = ci; st.push(y); } }); } ci++; });
    Object.keys(comp).forEach(function (k) { size[comp[k]] = (size[comp[k]] || 0) + 1; });
    var minSize = showPairs ? 2 : 3, keep = function (id) { return size[comp[id]] >= minSize; }, small = Object.keys(size).filter(function (k) { return size[k] === 2; }).length;
    var N = Object.keys(adj).filter(keep).map(function (id) { var o = S.byId[id], ne = o ? (o[4] || []).length : 0, deg = Object.keys(adj[id]).length, nm = o ? o[1] : id;
      return { id: id, label: (deg >= 3 || ne >= 12) ? nm : undefined, title: nm + '（' + ne + '）', shape: grp[id] ? 'diamond' : 'dot', size: 6 + Math.min(ne, 20) * 0.9, color: grp[id] ? (L ? '#7b52d9' : '#b48cff') : (o ? (L ? '#2f6fd6' : '#5b9df9') : '#8b9cb3'),
        font: { color: L ? '#1a2332' : '#dfe7f2', size: 30, strokeWidth: 6, strokeColor: L ? '#ffffff' : '#0f1419' }, scaling: { label: { drawThreshold: 2 } } }; });
    var E2 = E.filter(function (e) { return keep(e.from); });
    sub.textContent = t(showPairs ? 'ov_sub_pairs' : 'ov_sub', { n: N.length, e: E2.length, p: small });
    var m = mountNet(el, N, E2, { layout: { improvedLayout: false }, physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -45, springLength: 50, avoidOverlap: 0.4 }, stabilization: { iterations: 400 } }, interaction: { hover: true, tooltipDelay: 80, hideEdgesOnDrag: true } }); if (!m) return; var net = m.net;
    net.once('stabilizationIterationsDone', function () { net.setOptions({ physics: false }); net.fit(); });
    net.on('doubleClick', function (p) { if (p.nodes[0]) location.hash = '#/o/' + p.nodes[0]; });
  }

  /* ---------- 全部攤位列表 ---------- */
  var LS = { q: '', ev: '', type: '', sort: 'events', dir: -1, page: 1, per: 50, renamed: false, active: false };
  function typesOf(o) { return String(o[3] || '').split(/\s*[｜|,、／\/]\s*/).filter(Boolean); }
  function viewAll() {
    setNav('all'); loading();
    Promise.all([loadIndex(), loadMeta()]).then(function () {
      clear(app); var owners = S.index.owners, evs = Object.keys(S.index.events).sort(function (a, b) { return evDate(b) < evDate(a) ? -1 : 1; });
      var tc = {}; owners.forEach(function (o) { typesOf(o).forEach(function (x) { tc[x] = (tc[x] || 0) + 1; }); });
      var types = Object.keys(tc).filter(function (k) { return tc[k] >= 5; }).sort(function (a, b) { return tc[b] - tc[a]; });
      var q = h('input', { placeholder: t('all_ph'), value: LS.q, autocomplete: 'off' });
      var evSel = h('select', { class: 'in' }, h('option', { value: '', text: t('all_any_event') }), evs.map(function (c) { return h('option', { value: c, text: c + '（' + evDate(c) + '）', selected: LS.ev === c }); }));
      var tySel = h('select', { class: 'in' }, h('option', { value: '', text: t('all_any_type') }), types.map(function (c) { return h('option', { value: c, text: c + '（' + tc[c] + '）', selected: LS.type === c }); }));
      var perSel = h('select', { class: 'in' }, [25, 50, 100, 200].map(function (n) { return h('option', { value: n, text: t('per_page', { n: n }), selected: LS.per === n }); }));
      var cbR = h('input', { type: 'checkbox', checked: LS.renamed }), cbA = h('input', { type: 'checkbox', checked: LS.active });
      var cnt = h('small'), body = h('div'), SK = {}; S.search.forEach(function (x) { SK[x[0][0]] = x[1]; });
      add(app, h('section', { class: 'card' }, h('h3', null, t('all_title'), ' ', cnt), h('div', { class: 'search' }, h('span', { text: '🔍' }), q),
        h('div', { class: 'filters' }, evSel, tySel, perSel, h('div', { style: 'display:flex;gap:14px;align-items:center;font-size:13px' }, h('label', null, cbR, ' ', t('only_renamed')), h('label', null, cbA, ' ', t('only_active'))))));
      add(app, h('section', { class: 'card' }, body));
      var act = activeCodes();
      function sortVal(o, k) { return k === 'name' ? nk(o[1]) : k === 'type' ? String(o[3] || '') : k === 'events' ? (o[4] || []).length : k === 'last' ? evDate(lastEvent(o)) : k === 'aka' ? uniqNames(o[2]).length : (o[6] || []).length; }
      function render() {
        var nq = nk(LS.q), rows = owners.filter(function (o) {
          if (LS.ev && (o[4] || []).indexOf(LS.ev) < 0) return false; if (LS.type && typesOf(o).indexOf(LS.type) < 0) return false;
          if (LS.renamed && uniqNames(o[2]).length < 2) return false; if (LS.active && !(o[4] || []).some(function (c) { return act.indexOf(c) >= 0; })) return false;
          return !nq || SK[o[0]].indexOf(nq) >= 0; });
        rows.sort(function (a, b) { var x = sortVal(a, LS.sort), y = sortVal(b, LS.sort); return (x < y ? -1 : x > y ? 1 : 0) * LS.dir || (nk(a[1]) < nk(b[1]) ? -1 : 1); });
        var pages = Math.max(1, Math.ceil(rows.length / LS.per)); if (LS.page > pages) LS.page = pages;
        cnt.textContent = ' ' + t('all_count', { n: owners.length.toLocaleString(), m: rows.length.toLocaleString() });
        clear(body);
        var cols = [['name', 'col_owner'], ['aka', 'col_aka'], ['type', 'col_type'], ['events', 'col_events'], ['last', 'col_last'], ['plat', 'col_plat']];
        add(body, h('table', { class: 'list' }, h('thead', null, h('tr', null, h('th', null, ''), cols.map(function (c) { return h('th', { class: LS.sort === c[0] ? 'on' : '', onclick: function () { if (LS.sort === c[0]) LS.dir = -LS.dir; else { LS.sort = c[0]; LS.dir = c[0] === 'name' || c[0] === 'type' ? 1 : -1; } render(); } }, t(c[1]), LS.sort === c[0] ? (LS.dir > 0 ? ' ▲' : ' ▼') : ''); }))),
          h('tbody', null, rows.slice((LS.page - 1) * LS.per, LS.page * LS.per).map(function (o) { var last = lastEvent(o), aka = uniqNames(o[2]).filter(function (v) { return nk(v) !== nk(o[1]); });
            return h('tr', { onclick: function () { location.hash = '#/o/' + o[0]; } }, h('td', null, thumb(o[5], 'mini')), h('td', null, h('b', { text: o[1] }), h('div', { class: 'muted', text: o[0] })),
              h('td', { class: 'muted', text: aka.slice(0, 3).join('、') + (aka.length > 3 ? ' +' + (aka.length - 3) : '') }), h('td', { text: o[3] || '' }), h('td', { text: (o[4] || []).length }),
              h('td', null, last ? h('span', { class: 'tag ' + (act.indexOf(last) >= 0 ? 'act' : 'ev'), text: last }) : ''), h('td', null, h('div', { class: 'tags', style: 'margin:0' }, (o[6] || []).slice(0, 4).map(function (p) { return h('span', { class: 'tag', text: p.replace(/ \(\d\)$/, '') }); })))); }))));
        var pg = h('div', { class: 'pager' }), go = function (p) { LS.page = p; render(); window.scrollTo(0, 0); };
        add(pg, h('button', { class: 'pill', disabled: LS.page <= 1, onclick: function () { go(LS.page - 1); }, text: t('prev') }));
        [1, LS.page - 2, LS.page - 1, LS.page, LS.page + 1, LS.page + 2, pages].filter(function (p, i, a) { return p >= 1 && p <= pages && a.indexOf(p) === i; }).sort(function (a, b) { return a - b; }).forEach(function (p) { add(pg, h('button', { class: 'pill' + (p === LS.page ? ' on' : ''), onclick: function () { go(p); }, text: p })); });
        add(pg, h('button', { class: 'pill', disabled: LS.page >= pages, onclick: function () { go(LS.page + 1); }, text: t('next') }), h('span', { class: 'muted', text: t('page_of', { p: LS.page, n: pages }) }));
        add(body, pg);
      }
      var tm; q.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(function () { LS.q = q.value; LS.page = 1; render(); }, 150); });
      evSel.addEventListener('change', function () { LS.ev = evSel.value; LS.page = 1; render(); }); tySel.addEventListener('change', function () { LS.type = tySel.value; LS.page = 1; render(); });
      perSel.addEventListener('change', function () { LS.per = +perSel.value; LS.page = 1; render(); });
      cbR.addEventListener('change', function () { LS.renamed = cbR.checked; LS.page = 1; render(); }); cbA.addEventListener('change', function () { LS.active = cbA.checked; LS.page = 1; render(); });
      render();
    }).catch(fail);
  }

  /* ---------- 主題切換 ---------- */
  function themeBtn() { var b = document.getElementById('themeBtn'), p = window.BOOTH_THEME.pref(); b.textContent = t('theme_' + p); b.onclick = function () { window.BOOTH_THEME.set(p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system'); }; }
  window.addEventListener('themechange', function () { themeBtn(); if (/^#\/(o\/|$)|^$/.test(location.hash) || location.hash === '#/') route(); });

  /* ADMIN_PLACEHOLDER */
  /* ---------- 路由 ---------- */
  function route() {
    closeModal(); destroyNets(); var hs = location.hash.replace(/^#\/?/, ''), parts = hs.split('/').map(decodeURIComponent);
    if (parts[0] === 'o' && /^C\d{5,}$/.test(parts[1] || '')) return viewOwner(parts[1]);
    if (parts[0] === 'events') return viewEvents(parts[1]);
    if (parts[0] === 'me') return viewMe();
    if (parts[0] === 'all') return viewAll();
    if (parts[0] === 'admin') return window.viewAdmin ? window.viewAdmin({ h: h, add: add, clear: clear, t: t, app: app, apiPost: apiPost, setNav: setNav, loading: loading, fail: fail, S: S, thumb: thumb, safeUrl: safeUrl, platOf: platOf, hostOf: hostOf, toast: toast, loadMeta: loadMeta, loadIndex: loadIndex, loadRel: loadRel, needLogin: needLogin, urls: urls, route: route, modal: modal, closeModal: closeModal, reauth: reauth, admState: function () { return S.adm; }, admPush: admPush, admPoll: admPoll }, parts.slice(1)) : viewHome();
    if (parts[0] === 'privacy') return viewPrivacy();
    if (parts[0] === 'help') return viewHelp(parts[1]);
    return viewHome();
  }
  document.getElementById('mclose').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
  window.addEventListener('hashchange', route);
  if (!API_OK) { var bn = document.getElementById('banner'); bn.hidden = false; bn.textContent = 'API_URL 尚未設定（assets/config.js）'; }
  applyI18n(); if (S.session) refreshMe().catch(function () { });
  var devU = CFG.DEV_LOGIN && new URLSearchParams(location.search).get('devlogin');
  if (devU) sessionStorage.setItem('bdb_devsub', devU);
  if (devU && !S.session) doLogin('fake:' + devU).catch(function (e) { toast(e.message); }); else route();
})();
