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
  function safeUrl(u) { try { var x = new URL(String(u).trim()); if ((x.protocol === 'https:' || x.protocol === 'http:') && !x.username && !x.password) return x.href; } catch (e) { } return null; }
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
  function closeModal() { document.getElementById('modal').hidden = true; }
  function confLabel(c) { return t('conf_' + (c || 'low')); }
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
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) { if (/session/i.test(j.error || '')) logout(true); throw new Error(j.error || 'error'); } return j; });
  }

  /* ---------- 狀態 ---------- */
  var S = { meta: null, index: null, byId: {}, search: [], rel: null, me: null, session: sessionStorage.getItem('bdb_session') || '', events: {} };
  function loadMeta() { return S.meta ? Promise.resolve(S.meta) : apiGet({ action: 'meta' }).then(function (m) { S.meta = m; return m; }); }
  function loadIndex() {
    if (S.index) return Promise.resolve(S.index);
    return loadMeta().then(function (m) {
      try { var c = JSON.parse(sessionStorage.getItem('bdb_index') || 'null'); if (c && c.v === m.v) return c; } catch (e) { }
      return apiGet({ action: 'index' }).then(function (d) { try { sessionStorage.setItem('bdb_index', JSON.stringify(d)); } catch (e) { } return d; });
    }).then(function (d) {
      S.index = d; S.byId = {}; S.search = d.owners.map(function (o) { S.byId[o[0]] = o; return [o, nk([o[0], o[1]].concat(o[2], o[8] || []).join('|'))]; }); return d;
    });
  }
  function loadRel() { return S.rel ? Promise.resolve(S.rel) : fetch('data/relations.json').then(function (r) { return r.json(); }).then(function (j) { S.rel = j; return j; }).catch(function () { S.rel = { w: {}, r: {}, events: {} }; return S.rel; }); }
  function evDate(code) { var e = S.index && S.index.events[code]; return e ? e[1] : ''; }
  function lastEvent(o) { var best = '', bd = ''; (o[4] || []).forEach(function (c) { var d = evDate(c); if (d >= bd) { bd = d; best = c; } }); return best; }
  function activeCodes() { return ((S.meta && S.meta.active) || []).map(function (e) { return e.code; }); }

  /* ---------- 版面 ---------- */
  var app = document.getElementById('app');
  function applyI18n() {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;
    document.querySelectorAll('[data-t]').forEach(function (e) { e.textContent = t(e.getAttribute('data-t')); });
    var L = clear(document.getElementById('langs'));
    LANGS.forEach(function (l) { add(L, h('button', { class: 'pill sm' + (l === lang ? ' on' : ''), onclick: function () { lang = l; localStorage.setItem('lang', l); applyI18n(); route(); }, text: I[l].langName })); });
  }
  function setNav(r) { document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-route') === r); }); }
  function loading() { clear(app); add(app, h('div', { class: 'spin', text: t('loading') })); }
  function fail(err) { clear(app); add(app, h('div', { class: 'card note bad' }, h('b', { text: t('load_fail') }), h('div', { class: 'muted', text: String(err && err.message || err) }), h('p', null, h('button', { class: 'btn', onclick: route, text: t('retry') })))); }

  /* ---------- 首頁 ---------- */
  function ownerCard(o) {
    var last = lastEvent(o), act = activeCodes();
    return h('div', { class: 'card oc', onclick: function () { location.hash = '#/o/' + o[0]; } },
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
      add(app, h('section', { class: 'card' }, h('div', { class: 'search' }, h('span', { text: '🔍' }), input)));
      var renamed = owners.filter(function (o) { return uniqNames(o[2]).length > 1; });
      add(app, h('section', { class: 'stats' },
        [[owners.length, t('stat_owners')], [Object.keys(d.events).length, t('stat_events')], [renamed.length, t('stat_renamed')], [act.length, t('stat_active')]].map(function (x) { return h('div', { class: 'card st' }, h('b', { text: x[0].toLocaleString() }), h('span', { text: x[1] })); })));
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
    Promise.all([loadIndex(), apiGet({ action: 'owner', id: id }), loadRel()]).then(function (r) {
      var o = S.byId[id] || [id, id, [], '', [], '', [], 0, []], d = r[1], rel = r[2]; clear(app);
      var sns = [], seen = {}, fields = {};
      d.dbRows.forEach(function (row) { Object.keys(row.fields).forEach(function (k) { var v = row.fields[k]; if (TEXT_FIELDS.indexOf(k) >= 0) { if (!fields[k]) fields[k] = []; if (fields[k].indexOf(v) < 0) fields[k].push(v); } urls(v).forEach(function (u) { var s = safeUrl(u); if (s && !seen[s]) { seen[s] = 1; sns.push(s); } }); }); });
      var hidden = d.history.some(function (x) { return x.thumbHidden; });
      var head = h('section', { class: 'card' }, h('a', { href: '#/', text: t('back') }),
        h('div', { class: 'dhead' }, o[5] ? thumb(o[5]) : null,
          h('div', null, h('div', { class: 'big', text: o[1] || id }), h('div', { class: 'meta' }, id, o[3] ? ' ・ ' + o[3] : '', ' ・ ', t('events_n', { n: (o[4] || []).length })),
            hidden && !o[5] ? h('div', { class: 'muted', text: '🖼 ' + t('thumb_hidden') }) : null),
          h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: function () { claimFlow(id, o[1]); }, text: t('is_me') }), h('button', { class: 'btn ghost', onclick: function () { reportFlow(id); }, text: t('report_wrong') }))));
      add(app, head);
      var left = h('div'), right = h('div');
      add(left, h('section', { class: 'card' }, h('h3', { text: t('detail_names') }), h('div', { class: 'tags' }, uniqNames(o[2]).map(function (v) { return h('span', { class: 'tag', text: v }); })),
        fields['筆名'] ? h('div', { class: 'meta' }, t('pen') + '：' + fields['筆名'].join('、')) : null));
      add(left, h('section', { class: 'card' }, h('h3', { text: t('detail_sns') }), sns.length ? h('div', { class: 'sns' }, sns.map(snsLink)) : h('div', { class: 'muted', text: t('no_sns') })));
      var hist = d.history.slice().reverse();
      add(left, h('section', { class: 'card' }, h('h3', null, t('detail_history'), h('small', { text: ' ' + hist.length })),
        h('table', { class: 't' }, h('thead', null, h('tr', null, ['h_event', 'h_date', 'h_name', 'h_booth', 'h_how', 'h_conf'].map(function (k) { return h('th', { text: t(k) }); }))),
          h('tbody', null, hist.map(function (x) { return h('tr', null, h('td', null, h('span', { class: 'tag ev', text: x.ev })), h('td', { text: x.date }), h('td', { text: x.name }), h('td', { text: x.booth }), h('td', { class: 'muted', text: howLabel(x.how) }), h('td', null, h('span', { class: 'conf ' + (x.conf || 'low'), text: confLabel(x.conf) }))); })))));
      var gdiv = h('div', { id: 'graph' });
      add(right, h('section', { class: 'card' }, h('h3', { text: t('detail_graph') }),
        h('div', { class: 'legend' }, [['owner', 'legend_owner'], ['name', 'legend_name'], ['sns', 'legend_sns'], ['group', 'legend_group']].map(function (x) { return h('span', { class: 'lg' }, h('span', { class: 'sw', style: 'background:' + COLORS[x[0]] }), t(x[1])); }), h('span', { class: 'lg' }, h('span', { class: 'ln d' }), t('legend_weak'))), gdiv));
      var weak = (rel.w[id] || []), grp = (rel.r[id] || []);
      if (grp.length) add(right, h('section', { class: 'card' }, h('h3', { text: t('related_title') }), h('div', { class: 'tags' }, grp.map(function (g) { var x = S.byId[g]; return h('a', { class: 'tag', href: '#/o/' + g, text: (x ? x[1] : g) + ' (' + g + ')' }); }))));
      if (weak.length) add(right, h('section', { class: 'card' }, h('h3', null, t('weak_title'), h('small', { text: ' ' + t('weak_hint') })), h('table', { class: 't' }, h('tbody', null, weak.map(function (w) { var x = S.byId[w[0]]; return h('tr', null, h('td', null, h('a', { href: '#/o/' + w[0], text: (x ? x[1] : w[0]) })), h('td', { class: 'muted', text: w[1] })); })))));
      if (d.recentEdits && d.recentEdits.length) add(right, h('section', { class: 'card' }, h('h3', { text: t('recent_edits') }), h('table', { class: 't' }, h('tbody', null, d.recentEdits.map(function (e) { return h('tr', null, h('td', { text: e.at }), h('td', { text: e.field })); })))));
      add(app, h('div', { class: 'two' }, left, right));
      drawGraph(gdiv, id, o, sns, grp, weak);
    }).catch(fail);
  }
  function drawGraph(el, id, o, sns, grp, weak) {
    if (!window.vis) { el.textContent = '—'; return; }
    var nodes = [{ id: 'o:' + id, label: o[1] || id, color: COLORS.owner, shape: 'dot', size: 26, font: { color: '#e8eef7', size: 15 } }], edges = [];
    uniqNames(o[2]).forEach(function (v, i) { nodes.push({ id: 'n:' + i, label: v, color: COLORS.name, shape: 'dot', size: 12, font: { color: '#e8eef7' } }); edges.push({ from: 'o:' + id, to: 'n:' + i, color: '#4a5a75' }); });
    sns.slice(0, 20).forEach(function (u, i) { nodes.push({ id: 's:' + i, label: platOf(u) + ' ' + handleOf(u), color: COLORS.sns, shape: 'dot', size: 10, font: { color: '#bfeee0', size: 12 }, url: u }); edges.push({ from: 'o:' + id, to: 's:' + i, color: '#2f6f5f' }); });
    grp.slice(0, 15).forEach(function (g) { var x = S.byId[g]; nodes.push({ id: 'g:' + g, label: x ? x[1] : g, color: COLORS.group, shape: 'dot', size: 14, font: { color: '#e0d4ff' }, owner: g }); edges.push({ from: 'o:' + id, to: 'g:' + g, color: COLORS.group, width: 2 }); });
    weak.slice(0, 15).forEach(function (w) { if (grp.indexOf(w[0]) >= 0) return; var x = S.byId[w[0]]; nodes.push({ id: 'w:' + w[0], label: x ? x[1] : w[0], color: '#55627a', shape: 'dot', size: 11, font: { color: '#b8c3d6' }, owner: w[0], title: w[1] }); edges.push({ from: 'o:' + id, to: 'w:' + w[0], dashes: true, color: COLORS.weak }); });
    var net = new vis.Network(el, { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, { physics: { stabilization: { iterations: 150 }, barnesHut: { springLength: 110 } }, interaction: { hover: true }, nodes: { borderWidth: 0 } });
    net.on('doubleClick', function (p) { var n = p.nodes[0] && nodes.filter(function (x) { return x.id === p.nodes[0]; })[0]; if (n && n.owner) location.hash = '#/o/' + n.owner; });
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
        var d = r[0], owned = (S.me && S.me.owned) || []; clear(box);
        var input = h('input', { placeholder: t('ev_search'), autocomplete: 'off' }), list = h('div', { class: 'bt' });
        add(box, h('section', { class: 'card' }, h('h3', null, d.name || code, h('small', { text: ' ' + (d.start || '') + ' ・ ' + t('ev_booths', { n: d.booths.length }) })),
          h('div', { class: 'note ' + (d.mode === 'live' ? 'good' : 'warn'), text: d.mode === 'live' ? t('ev_mode_live') : t('ev_mode_queue') }),
          h('div', { class: 'search' }, h('span', { text: '🔍' }), input)));
        add(box, list);
        function render() {
          var q = nk(input.value), mine = d.booths.filter(function (b) { return b.id && owned.indexOf(b.id) >= 0; });
          var rows = q ? d.booths.filter(function (b) { return nk(b.name + '|' + b.day1 + '|' + b.day2 + '|' + (b.fields['筆名'] || '')).indexOf(q) >= 0; }) : mine.concat(d.booths.filter(function (b) { return mine.indexOf(b) < 0; }));
          clear(list); add(list, rows.slice(0, 80).map(function (b) { return boothCard(d, b, owned.indexOf(b.id) >= 0); }));
          if (rows.length > 80) add(list, h('div', { class: 'muted', text: t('showing', { n: 80 }) }));
        }
        input.addEventListener('input', render); render();
      }).catch(function (e) { clear(box); add(box, h('div', { class: 'card note bad', text: String(e.message || e) })); });
    }).catch(fail);
  }
  function boothCard(d, b, mine) {
    var f = b.fields, links = [];
    Object.keys(f).forEach(function (k) { if (TEXT_FIELDS.indexOf(k) < 0) urls(f[k]).forEach(function (u) { if (links.indexOf(u) < 0) links.push(u); }); });
    return h('div', { class: 'card bk' + (mine ? ' mine' : '') },
      h('div', { class: 'oc', style: 'cursor:default;padding:0;background:none' }, b.thumb ? thumb(b.thumb) : null,
        h('div', { class: 'bd' }, h('div', { class: 'nm', text: b.name }), h('div', { class: 'meta' }, t('day1') + ' ' + (b.day1 || '—') + ' ・ ' + t('day2') + ' ' + (b.day2 || '—')))),
      ['筆名', '創作者類型', '商品年齡分類', '作品類型 (原創、二創)', '二創參考作品 (原創免填)', '販售資訊', '特殊標籤或備註'].filter(function (k) { return f[k]; }).map(function (k) { return h('div', { class: 'f' }, h('i', { text: k.replace(/ \(.*\)$/, '') }), f[k]); }),
      links.length ? h('div', { class: 'sns', style: 'margin-top:6px' }, links.slice(0, 10).map(snsLink)) : null,
      h('div', { class: 'acts', style: 'margin-top:8px' }, b.id ? h('a', { class: 'btn ghost', href: '#/o/' + b.id, text: t('ev_open_owner') }) : null,
        mine ? h('button', { class: 'btn', onclick: function () { fillFlow(d, b); }, text: t('ev_fill_mine') }) : null));
  }

  /* ---------- 登入 ---------- */
  function refreshMe() { return apiPost({ action: 'me' }).then(function (j) { S.me = j.me; return j.me; }); }
  function doLogin(idToken) { return apiPost({ action: 'login', idToken: idToken }).then(function (j) { S.session = j.session; sessionStorage.setItem('bdb_session', j.session); S.me = j.me; route(); }); }
  function logout(silent) { S.session = ''; S.me = null; sessionStorage.removeItem('bdb_session'); if (window.google && google.accounts) try { google.accounts.id.disableAutoSelect(); } catch (e) { } if (!silent) route(); }
  function loginBox() {
    var box = h('div', { class: 'card' }, h('h3', { text: t('login') }), h('p', { class: 'muted', text: t('login_why') }));
    var btn = h('div', { id: 'gbtn' }); add(box, btn);
    if (CFG.DEV_LOGIN) add(box, h('p', null, h('button', { class: 'btn ghost', onclick: function () { doLogin('fake:' + (prompt('dev user', 'dev-owner-1') || 'dev-owner-1')).catch(function (e) { toast(e.message); }); }, text: t('dev_login') })));
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
          h('div', { class: 'acts' }, h('button', { class: 'btn ghost', onclick: function () { logout(); }, text: t('logout') }), h('button', { class: 'btn warn', onclick: withdrawFlow, text: t('withdraw') })))));
        if (me.suspended) add(app, h('div', { class: 'card note bad', text: t('me_suspended') }));
        add(app, h('section', { class: 'card' }, h('h3', { text: t('me_owned') }),
          me.owned.length ? h('div', { class: 'grid' }, me.owned.map(function (id) { var o = S.byId[id] || [id, id, [], '', [], '', [], 0]; return h('div', { class: 'card', style: 'margin:0' }, h('div', { class: 'nm', text: o[1] }), h('div', { class: 'meta', text: id }),
            h('div', { class: 'acts', style: 'justify-content:flex-start;margin-top:8px' }, h('button', { class: 'btn', onclick: function () { editFlow(id); }, text: t('edit_title') }), h('a', { class: 'btn ghost', href: '#/o/' + id, text: t('ev_open_owner') }),
              (o[4] || []).filter(function (c) { return activeCodes().indexOf(c) >= 0; }).map(function (c) { return h('a', { class: 'btn ghost', href: '#/events/' + encodeURIComponent(c), text: c + ' ' + t('go_fill') }); }))); })) : h('div', { class: 'muted', text: t('me_none') })));
        if (me.pending.length) add(app, h('section', { class: 'card' }, h('h3', { text: t('me_pending') }), h('div', { class: 'tags' }, me.pending.map(function (id) { var o = S.byId[id]; return h('a', { class: 'tag', href: '#', onclick: function (e) { e.preventDefault(); claimFlow(id, o ? o[1] : id); }, text: (o ? o[1] : id) + ' (' + id + ')' }); }))));
        add(app, h('div', { class: 'note', text: t('admin_note') }));
      });
    }).catch(fail);
  }
  function needLogin() { if (S.session) return false; location.hash = '#/me'; toast(t('login')); return true; }

  function claimFlow(id, name) {
    if (needLogin()) return;
    var proof = h('input', { class: 'in', placeholder: 'https://x.com/…/status/…' }), note = h('textarea', { class: 'in', maxlength: 300 }), method = h('select', { class: 'in' }, h('option', { value: 'post', text: t('claim_method_post') }), h('option', { value: 'dm', text: t('claim_method_dm') }));
    var out = h('div');
    var body = modal(t('claim_title') + '：' + name + '（' + id + '）', [h('p', { class: 'muted', text: t('claim_steps') }), out,
      h('label', { class: 'fl', text: t('claim_proof') }), proof, h('label', { class: 'fl' }, ''), method, h('label', { class: 'fl', text: t('claim_note') }), note,
      h('p', { class: 'acts' }, h('button', { class: 'btn ghost', onclick: closeModal, text: t('cancel') }), h('button', { class: 'btn', onclick: send, text: t('submit') }))]);
    // 先送出一次空的認領取得驗證碼（重複送出不會產生新申請）
    apiPost({ action: 'claim', ownerId: id }).then(function (j) { showCode(j.data); }).catch(function (e) { clear(out); add(out, h('div', { class: 'note bad', text: e.message })); });
    function showCode(d) { clear(out); add(out, h('div', { class: 'note ' + (d.status === '已核准' ? 'good' : 'warn') }, d.code ? [t('claim_code') + '：', h('span', { class: 'code', text: d.code })] : d.status)); }
    function send() { apiPost({ action: 'claim', ownerId: id, proofUrl: proof.value, note: note.value, method: method.value }).then(function (j) { showCode(j.data); toast(t('ok')); }).catch(function (e) { toast(e.message); }); }
    return body;
  }
  function reportFlow(id) {
    if (needLogin()) return;
    var other = h('input', { class: 'in', placeholder: 'C01234' }), kind = h('select', { class: 'in' }, h('option', { value: 'merge', text: t('report_merge') }), h('option', { value: 'split', text: t('report_split') })), note = h('textarea', { class: 'in', maxlength: 300 });
    modal(t('report_title') + '（' + id + '）', [h('label', { class: 'fl', text: t('report_other') }), other, h('label', { class: 'fl' }, ''), kind, h('label', { class: 'fl', text: t('claim_note') }), note,
      h('p', { class: 'acts' }, h('button', { class: 'btn ghost', onclick: closeModal, text: t('cancel') }), h('button', { class: 'btn', onclick: function () { apiPost({ action: 'report', a: id, b: other.value.trim(), kind: kind.value, note: note.value }).then(function () { closeModal(); toast(t('ok')); }).catch(function (e) { toast(e.message); }); }, text: t('submit') }))]);
  }
  function withdrawFlow() { if (!confirm(t('withdraw_confirm'))) return; apiPost({ action: 'withdraw' }).then(function (j) { toast(t('withdraw_done', { n: j.done })); logout(); }).catch(function (e) { toast(e.message); }); }

  /* 共用：欄位表單 → 預覽差異 → 確認送出 */
  function fieldForm(fields, current, onSubmit, extra) {
    var inputs = {}, wrap = h('div'), pv = h('div');
    fields.forEach(function (f) {
      var long = LONG_FIELDS.indexOf(f) >= 0, el = long ? h('textarea', { class: 'in' }) : h('input', { class: 'in', placeholder: TEXT_FIELDS.indexOf(f) < 0 ? 'https://' : '' });
      el.value = current[f] || ''; inputs[f] = el; add(wrap, h('div', { class: 'frow' }, h('div', { class: 'k', text: f }), el));
    });
    var btnPv = h('button', { class: 'btn', text: t('preview') });
    btnPv.addEventListener('click', function () {
      var ch = {}, old = {}; fields.forEach(function (f) { var v = inputs[f].value.trim(); if (v !== String(current[f] || '').trim()) { ch[f] = v; old[f] = current[f] || ''; } });
      clear(pv); if (!Object.keys(ch).length) { add(pv, h('div', { class: 'note', text: t('diff_none') })); return; }
      apiPost({ action: 'preview', changes: ch, old: old }).then(function (j) {
        var res = j.data, blocked = false;
        var rows = Object.keys(ch).map(function (f) { var r = res[f] || {}; if (!r.ok) blocked = true;
          return h('tr', null, h('td', { text: f }), h('td', { class: 'o', text: old[f] || '—' }), h('td', { class: 'n' }, r.ok ? (urls(r.value).length ? urls(r.value).map(function (u) { return h('div', null, h('b', { text: platOf(u) + ' ' }), hostOf(u), ' ', h('span', { class: 'muted', text: u })); }) : (r.value || '（清空）')) : h('span', { text: t('blocked') + '：' + r.block })),
            h('td', null, r.ok ? h('span', { class: 'conf ' + (r.risk >= 50 ? 'single' : r.risk >= 30 ? 'medium' : 'high'), text: t('risk') + ' ' + r.risk }) : null, r.sensitive ? h('div', { class: 'muted', text: t('sensitive') }) : null, (r.notes || []).length ? h('div', { class: 'muted', text: r.notes.join('；') }) : null)); });
        add(pv, h('table', { class: 't diff' }, h('thead', null, h('tr', null, h('th', { text: t('field') }), h('th', { text: t('old_v') }), h('th', { text: t('new_v') }), h('th', { text: t('risk') }))), h('tbody', null, rows)));
        if (!blocked) add(pv, h('p', { class: 'acts' }, h('button', { class: 'btn', onclick: function (e) { e.target.disabled = true; onSubmit(ch).then(function (d) { clear(pv); add(pv, h('div', { class: 'note good', text: d.applied ? t('sent_live', { a: d.applied, q: d.queued }) : t('sent_queue', { n: d.queued || 0 }) })); }).catch(function (er) { e.target.disabled = false; add(pv, h('div', { class: 'note bad', text: er.message })); }); }, text: t('confirm_submit') })));
      }).catch(function (e) { add(pv, h('div', { class: 'note bad', text: e.message })); });
    });
    return [extra || null, wrap, h('p', { class: 'acts' }, btnPv), pv];
  }
  function editFlow(id) {
    apiGet({ action: 'owner', id: id }).then(function (d) {
      if (!d.dbRows.length) { toast('—'); return; }
      var sel = h('select', { class: 'in' }, d.dbRows.map(function (r, i) { return h('option', { value: i, text: r.fields['攤位名稱'] || ('#' + r.row) }); })), holder = h('div');
      function build() { clear(holder); var r = d.dbRows[+sel.value]; add(holder, fieldForm(DB_EDITABLE, r.fields, function (ch) { return apiPost({ action: 'edit', ownerId: id, rowName: r.fields['攤位名稱'] || '', changes: ch }).then(function (j) { S.index = null; sessionStorage.removeItem('bdb_index'); return j.data; }); })); }
      sel.addEventListener('change', build);
      modal(t('edit_title') + '（' + id + '）', [h('label', { class: 'fl', text: t('edit_row') }), sel, holder]); build();
    }).catch(function (e) { toast(e.message); });
  }
  function fillFlow(d, b) {
    var thumbIn = h('input', { class: 'in', placeholder: 'https://drive.google.com/file/d/…/view' }), tres = h('span', { class: 'muted' });
    var thumbBox = h('div', { class: 'card', style: 'margin:12px 0 0;padding:12px' }, h('div', { class: 'k', text: t('thumb_title') }), thumbIn,
      h('p', { class: 'acts' }, tres, h('button', { class: 'btn ghost', onclick: function () { apiPost({ action: 'checkThumb', url: thumbIn.value }).then(function (j) { tres.textContent = j.status === 'PUBLIC' ? t('thumb_public') : j.status === 'BAD_LINK' ? t('thumb_bad') : t('thumb_not_public') + '（' + j.status + '）'; }).catch(function (e) { tres.textContent = e.message; }); }, text: t('thumb_check') }),
        h('button', { class: 'btn', onclick: function () { apiPost({ action: 'thumb', ownerId: b.id, event: d.code, booth: b.name, boothNo: b.day1 || b.day2, url: thumbIn.value }).then(function (j) { tres.textContent = j.data.applied ? t('sent_live', { a: j.data.applied, q: j.data.queued }) : t('sent_queue', { n: j.data.queued }); }).catch(function (e) { tres.textContent = e.message; }); }, text: t('submit') })));
    modal(t('fill_title') + '：' + d.code + ' ／ ' + b.name, fieldForm(EVENT_EDITABLE, b.fields, function (ch) {
      return apiPost({ action: 'eventfill', ownerId: b.id, event: d.code, booth: b.name, boothNo: b.day1 || b.day2, changes: ch }).then(function (j) { delete S.events[d.code]; return j.data; });
    }, h('div', { class: 'note ' + (d.mode === 'live' ? 'good' : 'warn'), text: d.mode === 'live' ? t('ev_mode_live') : t('ev_mode_queue') }))).appendChild(thumbBox);
  }

  /* ---------- 隱私權政策 ---------- */
  function viewPrivacy() {
    setNav(''); clear(app); var p = P[lang] || P.zh, contact = CFG.CONTACT || '';
    add(app, h('section', { class: 'card pp' }, h('h2', { style: 'font-size:22px', text: p.title }), h('div', { class: 'muted', text: (lang === 'en' ? 'Last updated: ' : lang === 'ja' ? '最終更新日：' : '最後更新：') + P.updated }),
      h('div', { class: 'note warn', text: p.draft }),
      p.sections.map(function (s) { return [h('h2', { text: s[0] }), s[1].map(function (x) { return h('p', { text: x.split('{CONTACT}').join(contact) }); })]; }),
      h('div', { class: 'tabs', style: 'margin-top:16px' }, LANGS.map(function (l) { return h('a', { class: 'pill sm' + (l === lang ? ' on' : ''), href: '?lang=' + l + '#/privacy', text: P[l].title }); }))));
  }

  /* ---------- 路由 ---------- */
  function route() {
    closeModal(); var hs = location.hash.replace(/^#\/?/, ''), parts = hs.split('/').map(decodeURIComponent);
    if (parts[0] === 'o' && /^C\d{5,}$/.test(parts[1] || '')) return viewOwner(parts[1]);
    if (parts[0] === 'events') return viewEvents(parts[1]);
    if (parts[0] === 'me') return viewMe();
    if (parts[0] === 'privacy') return viewPrivacy();
    return viewHome();
  }
  document.getElementById('mclose').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
  window.addEventListener('hashchange', route);
  if (!API_OK) { var bn = document.getElementById('banner'); bn.hidden = false; bn.textContent = 'API_URL 尚未設定（assets/config.js）'; }
  applyI18n();
  var devU = CFG.DEV_LOGIN && new URLSearchParams(location.search).get('devlogin');
  if (devU && !S.session) doLogin('fake:' + devU).catch(function (e) { toast(e.message); }); else route();
})();
