/**
 * 攤位資料庫網站 — Apps Script 後端（整份貼上取代 code.gs）
 * ------------------------------------------------------------------
 * 綁定在「攤位資料庫」試算表（1nwZIqcrSz-vVJidCFJLmvDPNZvg7n-NVwnsdRmDFRao）。
 * 只使用：簡易觸發 onOpen / onEdit、Web App doGet / doPost。不建立任何可安裝觸發或時間觸發。
 *
 * 密鑰與設定一律放在「專案設定 › 指令碼屬性 (Script Properties)」，不要寫在程式碼裡：
 *   HMAC_SECRET            必填。選單「🔑 初始化設定」會自動產生（隨機 64 字元）。
 *   OAUTH_CLIENT_ID        必填。Google Identity Services 的 OAuth 用戶端 ID（網頁應用程式）。
 *   EVENT_FILL_MODE        選填。queue（預設，攤主填寫需站長核准）或 live（已核准攤主的低風險填寫即時寫入，可一鍵復原）。
 *   ACTIVE_EVENTS          選填。整理中場次 JSON 陣列，由選單「⚙️ 整理中場次設定」維護。
 *   SAFE_BROWSING_API_KEY  選填。Google Safe Browsing v4 API 金鑰；未設定時略過該檢查並在審核畫面標示「未檢查」。
 *   ALERT_EMAIL            選填。可疑修改通知信箱；未設定時寄給本指令碼擁有者。
 *   SITE_ORIGIN            選填。網站網址（例：https://xxx.github.io/booth-db），只用於通知信內的連結。
 *   NEXT_OWNER_SEQ         自動維護。新攤主ID流水號。
 *
 * 部署：部署 › 新增部署 › 類型「網頁應用程式」；執行身分「我」；存取權「所有人」。
 * 版本：2026-11-23 phase2
 */

/* ============================== 常數 ============================== */
var VERSION = '2026-11-23-p2';
var SH = {
  DB: '新攤位資料庫',
  LOG: '場次出展紀錄',
  CLAIM: '認領申請',
  EDIT: '修改申請'
};
var DB_ID_HEADER = '攤主ID';
var DB_NAME_HEADER = '攤位名稱';
/** 新攤位資料庫中，攤主可申請修改的欄位（攤位名稱屬敏感欄位，需二次驗證）。 */
var DB_EDITABLE = ['攤位名稱', '筆名', '創作者類型', 'FB (1)', 'FB (2)', 'Bluesky (1)', 'Bluesky (2)', 'TWITTER (1)', 'TWITTER (2)',
  'PLURK', 'Pixiv', 'Fanbox', 'Fantia', '可洛斯', '其他贊助平台', 'IG', 'YOUTUBE', 'TWITCH', 'LINE', 'DISCORD', '巴哈姆特',
  '官方網站', 'Linktree等連結整合網頁', '其他連結'];
var TEXT_FIELDS = ['攤位名稱', '筆名', '創作者類型', '商品年齡分類', '作品類型 (原創、二創)', '二創參考作品 (原創免填)', '販售資訊', '特殊標籤或備註'];
/** 場次攤位整理表中，攤主可填寫的欄位（以第 1 列標題比對）。攤位名稱、攤位編號、公式欄、Bot用、資料信心度不可由攤主修改。 */
var EVENT_EDITABLE = ['筆名', '創作者類型', '商品年齡分類', '作品類型 (原創、二創)', '二創參考作品 (原創免填)', '販售資訊', '特殊標籤或備註',
  'FB (1)', 'FB (2)', 'Bluesky (1)', 'Bluesky (2)', 'TWITTER (1)', 'TWITTER (2)', 'PLURK', 'Pixiv', 'Fanbox', 'Fantia', '可洛斯',
  '其他贊助平台', 'IG', 'YOUTUBE', 'TWITCH', 'LINE', 'DISCORD', '巴哈姆特', '官方網站', 'Linktree等連結整合網頁', '其他連結',
  '預告', '品書', '預購/通販', '賣場', '縮圖[請備註]', '試閱'];
var EVENT_LOCKED_HINTS = ['攤位名稱', '第一天', '第二天', '第三天', '有無', '資料信心度', '是否有縮圖', 'Bot用', '印量調查'];
/** 首要身分欄位：取代（非新增）這些欄位的既有值，屬敏感修改，需二次驗證。 */
var IDENTITY_FIELDS = ['攤位名稱', 'FB (1)', 'TWITTER (1)', 'IG', 'Pixiv', 'PLURK', 'Bluesky (1)'];

/** 各欄位允許的網域（含子網域）。null = 任何網域都可，但非常見網域會加風險分數。 */
var FIELD_DOMAINS = {
  'FB (1)': ['facebook.com', 'fb.com', 'fb.me'], 'FB (2)': ['facebook.com', 'fb.com', 'fb.me'],
  'Bluesky (1)': ['bsky.app'], 'Bluesky (2)': ['bsky.app'],
  'TWITTER (1)': ['x.com', 'twitter.com'], 'TWITTER (2)': ['x.com', 'twitter.com'],
  'PLURK': ['plurk.com'], 'Pixiv': ['pixiv.net', 'pixiv.me'], 'Fanbox': ['fanbox.cc', 'pixiv.net'], 'Fantia': ['fantia.jp'],
  '可洛斯': ['clusters.tw'], 'IG': ['instagram.com'], 'YOUTUBE': ['youtube.com', 'youtu.be'], 'TWITCH': ['twitch.tv'],
  'LINE': ['line.me', 'lin.ee'], 'DISCORD': ['discord.gg', 'discord.com'], '巴哈姆特': ['gamer.com.tw'],
  '縮圖[請備註]': ['drive.google.com', 'docs.google.com'],
  '其他贊助平台': null, '官方網站': null, 'Linktree等連結整合網頁': null, '其他連結': null, '預告': null, '品書': null,
  '預購/通販': null, '賣場': null, '試閱': null
};
/** 常見、可信的網域（用於 null 欄位的風險評估；取自既有資料庫出現頻率較高者）。 */
var KNOWN_DOMAINS = ['facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'plurk.com', 'pixiv.net', 'pixiv.me', 'fanbox.cc',
  'fantia.jp', 'bsky.app', 'youtube.com', 'youtu.be', 'twitch.tv', 'discord.gg', 'discord.com', 'gamer.com.tw', 'line.me', 'lin.ee',
  'threads.net', 'threads.com', 'tiktok.com', 'lit.link', 'linktr.ee', 'portaly.cc', 'potofu.me', 'fanme.link', 'linkgoods.com',
  'instabio.cc', 'pont.co', 'taplink.cc', 'linkbio.co', 'linkr.bio', 'linkby.tw', 'joy.link', 'carrd.co', 'bento.me',
  'patreon.com', 'clibo.tw', 'ecpay.com.tw', 'opay.tw', 'furuke.com', 'skeb.jp', 'ko-fi.com', 'streamlabs.com', 'ganknow.com',
  'clusters.tw', 'doujin.com.tw', 'myacg.com.tw', 'shopee.tw', 'ruten.com.tw', 'pinkoi.com', 'booth.pm', 'dlsite.com', 'melonbooks.co.jp',
  'toranoana.jp', 'bilibili.com', 'weibo.com', 'pawoo.net', 'misskey.io', 'sites.google.com', 'docs.google.com', 'forms.gle',
  'drive.google.com', 'weebly.com', 'wixsite.com', 'pixnet.net', 'blogspot.com', 'medium.com', 'notion.site', 'myship.7-11.com.tw',
  'kadokado.com.tw', 'waterring.tw', 'cxc.today', 'nicovideo.jp', 'store.line.me', 'shop.line.me'];
var SHORTENERS = ['bit.ly', 'tinyurl.com', 'reurl.cc', 't.co', 'goo.gl', 'is.gd', 'shorturl.at', 'lihi.cc', 'lihi1.com', 'lihi2.com',
  'pse.is', 'ppt.cc', 'rb.gy', 'cutt.ly', 'ow.ly', 'buff.ly', 'rebrand.ly', 'tiny.cc', 'shorturl.asia', 'l.facebook.com', 'l.instagram.com'];
var LIMITS = { login: [20, 3600], claim: [3, 86400], edit: [20, 86400], eventfill: [30, 86400], thumb: [30, 3600], report: [10, 86400] };
var CACHE_TTL = 21600; // 6 小時；任何經由 onEdit 的修改會換新版本號，網站立即讀到新資料
var EVENT_CACHE_TTL = 300; // 場次整理表（在其他檔案）5 分鐘快取

/* ============================== 設定 ============================== */
function prop_(k, dflt) { var v = PropertiesService.getScriptProperties().getProperty(k); return (v === null || v === '') ? dflt : v; }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }
function fillMode_() { return prop_('EVENT_FILL_MODE', 'queue') === 'live' ? 'live' : 'queue'; }
function activeEvents_() { try { return JSON.parse(prop_('ACTIVE_EVENTS', '[]')) || []; } catch (e) { return []; } }
function setActiveEvents_(list) { setProp_('ACTIVE_EVENTS', JSON.stringify(list)); bumpVersion_(); }
function findEvent_(code) { var l = activeEvents_(); for (var i = 0; i < l.length; i++) if (l[i].code === code) return l[i]; return null; }

/* ============================== 工具 ============================== */
function now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function b64u_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function hmac_(msg, key) { return Utilities.computeHmacSha256Signature(msg, key, Utilities.Charset.UTF_8); }
function secret_() { var s = prop_('HMAC_SECRET', ''); if (!s || s.length < 32) throw new Error('HMAC_SECRET 未設定，請先執行選單「🔑 初始化設定」'); return s; }
function newId_(prefix) { return prefix + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 4); }
function normName_(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s\u3000·・\.\-_~～！!？?「」『』【】()（）\[\]]/g, ''); }
function normHeader_(s) { return String(s || '').normalize('NFKC').replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')').toLowerCase(); }
function str_(v) { return v === null || v === undefined ? '' : String(v); }
/** 防止公式注入：以 = + - @ 開頭的文字前面加 '，讓 Sheets 視為純文字。 */
function safeCell_(v) { v = str_(v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function ss_() { return SpreadsheetApp.getActive(); }
function sheet_(name) { var s = ss_().getSheetByName(name); if (!s) throw new Error('找不到工作表：' + name); return s; }
function headerMap_(hdr) { var m = {}; hdr.forEach(function (h, i) { var k = normHeader_(h); if (k && !(k in m)) m[k] = i; }); return m; }
function colLetter_(n) { var s = ''; n = n + 1; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function esc_(s) { return str_(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

/* ============================== 快取（分段存放） ============================== */
function version_() { var c = CacheService.getScriptCache(); var v = c.get('ver'); if (!v) { v = String(Date.now()); c.put('ver', v, CACHE_TTL); } return v; }
function bumpVersion_() { try { CacheService.getScriptCache().put('ver', String(Date.now()), CACHE_TTL); } catch (e) { } }
function cachePutBig_(key, str, ttl) {
  var c = CacheService.getScriptCache(), size = 90000, n = Math.ceil(str.length / size), o = {};
  if (n > 90) return; // 超過 CacheService 上限就不快取
  for (var i = 0; i < n; i++) o[key + ':' + i] = str.substr(i * size, size);
  o[key + ':n'] = String(n); c.putAll(o, ttl);
}
function cacheGetBig_(key) {
  var c = CacheService.getScriptCache(), n = c.get(key + ':n'); if (!n) return null; n = +n; var ks = [];
  for (var i = 0; i < n; i++) ks.push(key + ':' + i); var got = c.getAll(ks), out = '';
  for (var j = 0; j < n; j++) { if (got[ks[j]] === undefined || got[ks[j]] === null) return null; out += got[ks[j]]; }
  return out;
}
function cached_(key, ttl, fn) { var k = key + '@' + version_(); var s = cacheGetBig_(k); if (s) return JSON.parse(s); var v = fn(); cachePutBig_(k, JSON.stringify(v), ttl); return v; }

/* ============================== 讀取主資料 ============================== */
function readDb_() {
  var sh = sheet_(SH.DB), vals = sh.getDataRange().getDisplayValues(), hdr = vals[0], hm = headerMap_(hdr);
  var idc = hm[normHeader_(DB_ID_HEADER)], nc = hm[normHeader_(DB_NAME_HEADER)];
  if (idc === undefined) throw new Error('新攤位資料庫缺少「攤主ID」欄');
  return { hdr: hdr, hm: hm, idc: idc, nc: nc, rows: vals.slice(1), sheet: sh };
}
function readLog_() {
  var sh = sheet_(SH.LOG), vals = sh.getDataRange().getDisplayValues(), hdr = vals[0], hm = headerMap_(hdr);
  var col = function (h) { return hm[normHeader_(h)]; };
  var C = { rid: col('紀錄ID'), ev: col('場次'), evn: col('場次名稱'), date: col('日期'), name: col('當屆攤名'), booth: col('攤位號'),
    id: col('攤主ID'), how: col('對應方式'), conf: col('信心'), src: col('來源'), fid: col('縮圖檔案ID'), ts: col('縮圖狀態') };
  return { C: C, rows: vals.slice(1), sheet: sh, hdr: hdr };
}
var SNS_COLS = ['FB (1)', 'FB (2)', 'Bluesky (1)', 'Bluesky (2)', 'TWITTER (1)', 'TWITTER (2)', 'PLURK', 'Pixiv', 'Fanbox', 'Fantia', '可洛斯',
  '其他贊助平台', 'IG', 'YOUTUBE', 'TWITCH', 'LINE', 'DISCORD', '巴哈姆特', '官方網站', 'Linktree等連結整合網頁', '其他連結'];
function splitUrls_(v) { return str_(v).split(/[\s\n]+/).filter(function (x) { return /^https?:\/\//i.test(x); }); }
function thumbPublic_(status) { return status === '公開' || status === 'PUBLIC'; }

/** 網站首頁／搜尋用的精簡索引（所有攤主）。 */
function buildIndex_() {
  var db = readDb_(), lg = readLog_(), C = lg.C, owners = {}, evs = {};
  function o(id) { return owners[id] || (owners[id] = { id: id, n: '', v: [], t: '', ev: [], th: '', p: [], db: 0, last: '', h: [] }); }
  db.rows.forEach(function (r) {
    var id = r[db.idc]; if (!id) return; var x = o(id), nm = r[db.nc];
    x.db++; if (nm && x.v.indexOf(nm) < 0) x.v.push(nm); if (!x.n) x.n = nm;
    var t = r[db.hm[normHeader_('創作者類型')]]; if (t && !x.t) x.t = t;
    SNS_COLS.forEach(function (h) { var i = db.hm[normHeader_(h)]; if (i === undefined || !r[i]) return; if (x.p.indexOf(h) < 0) x.p.push(h);
      splitUrls_(r[i]).forEach(function (u) { var k = hostOf_(u) + pathHead_(u); if (k && x.h.length < 12 && x.h.indexOf(k) < 0) x.h.push(k); }); });
  });
  lg.rows.forEach(function (r) {
    var id = r[C.id]; if (!id) return; var x = o(id), ev = r[C.ev], d = r[C.date];
    if (!evs[ev]) evs[ev] = [r[C.evn], d];
    if (x.ev.indexOf(ev) < 0) x.ev.push(ev);
    if (r[C.name] && x.v.indexOf(r[C.name]) < 0) x.v.push(r[C.name]);
    if (d >= x.last) { x.last = d; x.n = r[C.name] || x.n; if (thumbPublic_(r[C.ts]) && r[C.fid]) x.th = r[C.fid]; }
    else if (!x.th && thumbPublic_(r[C.ts]) && r[C.fid]) x.th = r[C.fid];
  });
  var list = Object.keys(owners).map(function (k) { var x = owners[k]; return [x.id, x.n, x.v, x.t, x.ev, x.th, x.p, x.db, x.h]; });
  return { v: version_(), built: now_(), events: evs, active: activeEvents_().map(publicEvent_), owners: list,
    fields: ['id', 'name', 'variants', 'type', 'events', 'thumb', 'platforms', 'dbRows', 'handles'] };
}
function publicEvent_(e) { return { code: e.code, name: e.name, start: e.start || '', status: e.status || '整理中' }; }

/** 單一攤主的完整資料。 */
function ownerDetail_(id) {
  if (!/^C\d{5,}$/.test(id)) throw new Error('bad id');
  var db = readDb_(), lg = readLog_(), C = lg.C, rows = [], hist = [];
  db.rows.forEach(function (r, i) {
    if (r[db.idc] !== id) return; var rec = { row: i + 2, fields: {} };
    db.hdr.forEach(function (h, j) { if (h && j !== db.idc && r[j]) rec.fields[h] = r[j]; }); rows.push(rec);
  });
  lg.rows.forEach(function (r) {
    if (r[C.id] !== id) return;
    hist.push({ ev: r[C.ev], evName: r[C.evn], date: r[C.date], name: r[C.name], booth: r[C.booth], how: r[C.how], conf: r[C.conf],
      thumb: thumbPublic_(r[C.ts]) ? r[C.fid] : '', thumbHidden: (!thumbPublic_(r[C.ts]) && (r[C.fid] || r[C.ts])) ? 1 : 0 });
  });
  hist.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var recent = recentApplied_(id, 10);
  return { id: id, dbRows: rows, history: hist, recentEdits: recent, v: version_() };
}
function recentApplied_(id, n) {
  var sh = ss_().getSheetByName(SH.EDIT); if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 19).getDisplayValues(), out = [];
  for (var i = v.length - 1; i >= 0 && out.length < n; i--) if (v[i][3] === id && v[i][12] === '已套用') out.push({ at: v[i][17], field: v[i][6], target: v[i][4] });
  return out;
}

/* ============================== 場次整理表 ============================== */
function eventSheet_(ev) {
  var f = SpreadsheetApp.openById(ev.sheetId), sh = ev.tab ? f.getSheetByName(ev.tab) : null;
  if (!sh) { var all = f.getSheets(); for (var i = 0; i < all.length; i++) if (str_(all[i].getRange(1, 1).getDisplayValue()).trim() === '攤位名稱') { sh = all[i]; break; } }
  if (!sh) throw new Error('找不到場次整理表分頁：' + ev.code);
  return sh;
}
function readEvent_(ev) {
  var sh = eventSheet_(ev), vals = sh.getDataRange().getDisplayValues(), hdr = vals[0];
  return { sheet: sh, hdr: hdr, hm: headerMap_(hdr), rows: vals.slice(1) };
}
/** 網站「整理中場次」頁的資料。縮圖只回傳已確認公開的 Drive 檔案。 */
function eventData_(code) {
  var ev = findEvent_(code); if (!ev) throw new Error('非整理中場次：' + code);
  return cached_('ev:' + code, EVENT_CACHE_TTL, function () {
    var E = readEvent_(ev), lg = readLog_(), C = lg.C, idOf = {};
    lg.rows.forEach(function (r) { if (r[C.ev] === code) idOf[normName_(r[C.name])] = r[C.id]; });
    var thumbCol = E.hm[normHeader_('縮圖[請備註]')], budget = 25, booths = [];
    E.rows.forEach(function (r, i) {
      var name = str_(r[0]).trim(); if (!name) return; var f = {};
      E.hdr.forEach(function (h, j) { if (h && j > 0 && r[j] && !isLockedHeader_(h, true)) f[h] = r[j]; });
      var th = ''; if (thumbCol !== undefined && r[thumbCol]) { var fid = driveId_(r[thumbCol]); if (fid) { var st = thumbStatusCached_(fid, false); if (st === null && budget > 0) { st = thumbStatusCached_(fid, true); budget--; } if (st === 'PUBLIC') th = fid; } }
      delete f['縮圖[請備註]'];
      booths.push({ row: i + 2, name: name, day1: r[2] || '', day2: r[3] || '', id: idOf[normName_(name)] || '', fields: f, thumb: th });
    });
    return { code: code, name: ev.name, start: ev.start || '', mode: fillMode_(), booths: booths, built: now_() };
  });
}
function isLockedHeader_(h, forDisplay) {
  var n = normHeader_(h);
  if (forDisplay) return /^有無/.test(n) || n === normHeader_('Bot用') || n === normHeader_('資料信心度') || n === normHeader_('是否有縮圖');
  for (var i = 0; i < EVENT_LOCKED_HINTS.length; i++) if (n.indexOf(normHeader_(EVENT_LOCKED_HINTS[i])) === 0) return true;
  return EVENT_EDITABLE.map(normHeader_).indexOf(n) < 0;
}

/* ============================== Drive 縮圖 ============================== */
/** 從任何 Drive 網址格式取出檔案 ID：/file/d/ID、open?id=ID、uc?id=ID、thumbnail?id=ID、lh3/d/ID、或直接貼 ID。 */
function driveId_(s) {
  s = str_(s).trim(); var m;
  if ((m = s.match(/\/file\/d\/([A-Za-z0-9_-]{20,})/))) return m[1];
  if ((m = s.match(/[?&]id=([A-Za-z0-9_-]{20,})/))) return m[1];
  if ((m = s.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]{20,})/))) return m[1];
  if ((m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/)) && /google\.com/.test(s)) return m[1];
  if (/^[A-Za-z0-9_-]{25,}$/.test(s)) return s;
  return '';
}
/** 以「未登入」身分檢查檔案是否「知道連結的任何人」可檢視。回傳 PUBLIC / NOT_PUBLIC / NOT_FOUND / NOT_IMAGE / ERROR。 */
function thumbStatus_(fid) {
  try {
    var r = UrlFetchApp.fetch('https://lh3.googleusercontent.com/d/' + encodeURIComponent(fid) + '=w400', { muteHttpExceptions: true, followRedirects: false });
    var code = r.getResponseCode(), h = r.getHeaders(), ct = str_(h['Content-Type'] || h['content-type']), loc = str_(h['Location'] || h['location']);
    if (code === 200 && /^image\//.test(ct)) return 'PUBLIC';
    if (code >= 300 && code < 400) { if (/accounts\.google\.com|ServiceLogin/.test(loc)) return 'NOT_PUBLIC';
      var r2 = UrlFetchApp.fetch(loc, { muteHttpExceptions: true, followRedirects: true }), ct2 = str_(r2.getHeaders()['Content-Type']);
      return r2.getResponseCode() === 200 && /^image\//.test(ct2) ? 'PUBLIC' : 'NOT_PUBLIC'; }
    if (code === 404) return 'NOT_FOUND';
    if (code === 200) return 'NOT_IMAGE';
    return code === 403 ? 'NOT_PUBLIC' : 'ERROR';
  } catch (e) { return 'ERROR'; }
}
function thumbStatusCached_(fid, allowFetch) {
  var c = CacheService.getScriptCache(), k = 'th:' + fid, v = c.get(k); if (v) return v; if (!allowFetch) return null;
  v = thumbStatus_(fid); c.put(k, v, v === 'PUBLIC' ? 86400 : 3600); return v;
}

/* ============================== 連結驗證與風險 ============================== */
function hostOf_(u) { var m = String(u).match(/^https?:\/\/([^\/?#:]+)(?::\d+)?([\/?#]|$)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/^m\./, '').replace(/^mobile\./, '') : ''; }
function domainIn_(host, list) { for (var i = 0; i < list.length; i++) { var d = list[i]; if (host === d || host.slice(-(d.length + 1)) === '.' + d) return true; } return false; }
/** 驗證單一欄位的新值。回傳 {ok, value, risk, notes[], block}。 */
function validateField_(field, value, oldValue) {
  var out = { ok: true, value: '', risk: 0, notes: [], block: '' }, v = str_(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '').trim();
  if (v.length > 1000) { out.ok = false; out.block = '內容過長（上限 1000 字）'; return out; }
  if (/<\s*\/?\s*(script|iframe|img|a|svg|style|object|embed|on\w+)/i.test(v)) { out.ok = false; out.block = '不可包含 HTML 標籤'; return out; }
  var isLink = field in FIELD_DOMAINS && TEXT_FIELDS.indexOf(field) < 0;
  if (isLink && v) {
    var parts = v.split(/[\s\n]+/).filter(Boolean); if (parts.length > 5) { out.ok = false; out.block = '一欄最多 5 個網址'; return out; }
    var clean = [];
    for (var i = 0; i < parts.length; i++) {
      var u = parts[i];
      if (!/^https?:\/\//i.test(u)) { out.ok = false; out.block = '只接受 http(s):// 開頭的網址：' + u.slice(0, 60); return out; }
      if (/^https?:\/\/[^\/]*@/i.test(u)) { out.ok = false; out.block = '網址不可含帳號密碼'; return out; }
      var host = hostOf_(u); if (!host) { out.ok = false; out.block = '無法辨識網域'; return out; }
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.indexOf(':') >= 0) { out.ok = false; out.block = '不接受 IP 位址網址'; return out; }
      if (domainIn_(host, SHORTENERS)) { out.ok = false; out.block = '不接受縮網址（' + host + '），請貼原始網址'; return out; }
      if (/(^|\.)xn--/.test(host)) { out.risk += 40; out.notes.push('國際化網域（可能為仿冒）：' + host); }
      var allow = FIELD_DOMAINS[field];
      if (allow && !domainIn_(host, allow)) { out.ok = false; out.block = field + ' 只接受 ' + allow.join(' / ') + ' 的網址'; return out; }
      if (!allow && !domainIn_(host, KNOWN_DOMAINS)) { out.risk += 30; out.notes.push('非常見網域：' + host); }
      u = u.replace(/([?&])(fbclid|igsh|igshid|si|utm_[a-z]+|__cft__\[0\]|__tn__|mibextid|srsltid|ref|s|t)=[^&#]*/gi, '$1').replace(/[?&]+(#|$)/, '$1').replace(/[?&]{2,}/g, '&').replace(/\?&/, '?');
      clean.push(u);
    }
    v = clean.join('\n');
  }
  if (str_(oldValue).trim() && v !== str_(oldValue).trim()) {
    out.risk += v ? 15 : 25; out.notes.push(v ? '取代既有值' : '清空既有值');
    if (IDENTITY_FIELDS.indexOf(field) >= 0) { out.risk += 25; out.notes.push('身分欄位：需二次驗證'); out.sensitive = true; }
  }
  if (field === '攤位名稱' && v !== str_(oldValue).trim()) { out.sensitive = true; if (out.notes.indexOf('身分欄位：需二次驗證') < 0) out.notes.push('身分欄位：需二次驗證'); }
  out.value = v; return out;
}
/** Google Safe Browsing v4（若有設定金鑰）。回傳 {checked, bad[]}。 */
function safeBrowsing_(urls) {
  var key = prop_('SAFE_BROWSING_API_KEY', ''); if (!key || !urls.length) return { checked: false, bad: [] };
  try {
    var body = { client: { clientId: 'booth-db', clientVersion: VERSION }, threatInfo: { threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
      platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'], threatEntries: urls.map(function (u) { return { url: u }; }) } };
    var r = UrlFetchApp.fetch('https://safebrowsing.googleapis.com/v4/threatMatches:find?key=' + encodeURIComponent(key), { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
    var j = JSON.parse(r.getContentText() || '{}'); return { checked: r.getResponseCode() === 200, bad: (j.matches || []).map(function (m) { return m.threat.url + '（' + m.threatType + '）'; }) };
  } catch (e) { return { checked: false, bad: [] }; }
}

/* ============================== 驗證身分（不保存 email / 姓名） ============================== */
function verifyIdToken_(tok) {
  var cid = prop_('OAUTH_CLIENT_ID', ''); if (!cid) throw new Error('OAUTH_CLIENT_ID 未設定');
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('登入驗證失敗');
  var j = JSON.parse(r.getContentText());
  if (j.aud !== cid) throw new Error('登入驗證失敗（aud）');
  if (j.iss !== 'accounts.google.com' && j.iss !== 'https://accounts.google.com') throw new Error('登入驗證失敗（iss）');
  if (+j.exp * 1000 < Date.now()) throw new Error('登入已過期');
  return uidOf_(j.sub); // 只取 sub，立即雜湊；email、姓名、頭像都不讀取也不保存
}
function uidOf_(sub) { return 'u_' + b64u_(hmac_('sub:' + sub, secret_())).slice(0, 22); }
function makeSession_(uid) { var p = b64u_(Utilities.newBlob(JSON.stringify({ u: uid, e: Date.now() + 12 * 3600 * 1000 })).getBytes()); return p + '.' + b64u_(hmac_('sess:' + p, secret_())); }
function readSession_(tok) {
  var parts = str_(tok).split('.'); if (parts.length !== 2) throw new Error('請重新登入');
  if (b64u_(hmac_('sess:' + parts[0], secret_())) !== parts[1]) throw new Error('請重新登入');
  var j = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0] + '==='.slice((parts[0].length + 3) % 4))).getDataAsString());
  if (j.e < Date.now()) throw new Error('登入已過期，請重新登入'); return j.u;
}
function claimCode_(uid, ownerId) { return 'JP-' + b64u_(hmac_('claim:' + uid + ':' + ownerId, secret_())).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase(); }

/** 讀取認領狀態：回傳 {owned:[攤主ID], pending:[...], suspended:bool} */
function claimsOf_(uid) {
  var sh = sheet_(SH.CLAIM), n = sh.getLastRow(), out = { owned: [], pending: [], suspended: false, rejected: [] }; if (n < 2) return out;
  var v = sh.getRange(2, 1, n - 1, 14).getDisplayValues();
  v.forEach(function (r) { if (r[4] !== uid) return; var st = r[9];
    if (st === '核准') out.owned.push(r[2]); else if (st === '待審核') out.pending.push(r[2]); else if (st === '停權') out.suspended = true; else if (st === '拒絕') out.rejected.push(r[2]); });
  return out;
}
function ownerSuspended_(ownerId) {
  var sh = sheet_(SH.CLAIM), n = sh.getLastRow(); if (n < 2) return false;
  return sh.getRange(2, 1, n - 1, 14).getDisplayValues().some(function (r) { return r[2] === ownerId && r[9] === '停權' && r[4] === '*'; });
}
function rate_(uid, kind) {
  var lim = LIMITS[kind]; if (!lim) return; var c = CacheService.getScriptCache(), win = Math.floor(Date.now() / 1000 / lim[1]), k = 'rl:' + kind + ':' + uid + ':' + win;
  var n = +(c.get(k) || 0) + 1; c.put(k, String(n), lim[1]);
  if (n > lim[0]) { if (n === lim[0] + 1) alert_('頻率限制觸發', '使用者 ' + uid + ' 在 ' + kind + ' 超過上限（' + lim[0] + '/' + lim[1] + ' 秒）'); throw new Error('操作太頻繁，請稍後再試'); }
}
function alert_(subject, body) {
  try {
    var c = CacheService.getScriptCache(), k = 'alert:' + subject; if (c.get(k)) return; c.put(k, '1', 600);
    var to = prop_('ALERT_EMAIL', '') || Session.getEffectiveUser().getEmail(); if (!to) return;
    MailApp.sendEmail(to, '[攤位資料庫] ' + subject, body + '\n\n試算表：' + ss_().getUrl() + '\n網站：' + prop_('SITE_ORIGIN', '(未設定)'));
  } catch (e) { }
}

/* ============================== Web API ============================== */
function doGet(e) {
  var p = (e && e.parameter) || {}, a = p.action || 'meta';
  try {
    if (a === 'meta') return json_({ ok: true, version: VERSION, v: version_(), active: activeEvents_().map(publicEvent_), fillMode: fillMode_(), clientId: prop_('OAUTH_CLIENT_ID', '') });
    if (a === 'index') return json_({ ok: true, data: cached_('index', CACHE_TTL, buildIndex_) });
    if (a === 'owner') return json_({ ok: true, data: cached_('owner:' + p.id, CACHE_TTL, function () { return ownerDetail_(p.id); }) });
    if (a === 'event') return json_({ ok: true, data: eventData_(p.code) });
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}
function doPost(e) {
  var body = {}; try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, error: 'bad json' }); }
  var lock = LockService.getScriptLock();
  try {
    var a = body.action;
    if (a === 'login') { var uid0 = verifyIdToken_(body.idToken); rate_(uid0, 'login'); return json_({ ok: true, session: makeSession_(uid0), me: meInfo_(uid0) }); }
    var uid = readSession_(body.session);
    if (a === 'me') return json_({ ok: true, me: meInfo_(uid) });
    if (a === 'preview') { rate_(uid, 'thumb'); var pv = {}, ch = body.changes || {}, old = body.old || {};
      Object.keys(ch).slice(0, 40).forEach(function (f) { var r = validateField_(String(f), ch[f], str_(old[f])); pv[f] = { ok: r.ok, value: r.value, risk: r.risk, notes: r.notes, block: r.block, sensitive: !!r.sensitive }; });
      return json_({ ok: true, data: pv }); }
    if (a === 'checkThumb') { rate_(uid, 'thumb'); var fid = driveId_(body.url); return json_({ ok: true, fileId: fid, status: fid ? thumbStatus_(fid) : 'BAD_LINK' }); }
    if (a === 'withdraw') { lock.waitLock(20000); return json_({ ok: true, done: withdraw_(uid) }); }
    var me = claimsOf_(uid); if (me.suspended) throw new Error('此帳號已被停權，如有疑問請聯絡站長');
    lock.waitLock(20000);
    if (a === 'claim') { rate_(uid, 'claim'); return json_({ ok: true, data: submitClaim_(uid, body) }); }
    if (a === 'edit') { rate_(uid, 'edit'); return json_({ ok: true, data: submitEdit_(uid, me, body) }); }
    if (a === 'eventfill') { rate_(uid, 'eventfill'); return json_({ ok: true, data: submitEventFill_(uid, me, body) }); }
    if (a === 'report') { rate_(uid, 'report'); return json_({ ok: true, data: submitReport_(uid, body) }); }
    if (a === 'thumb') { rate_(uid, 'thumb'); return json_({ ok: true, data: submitThumb_(uid, me, body) }); }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
  finally { try { lock.releaseLock(); } catch (x) { } }
}
function meInfo_(uid) { var c = claimsOf_(uid); return { uid: uid.slice(0, 8) + '…', owned: c.owned, pending: c.pending, suspended: c.suspended, fillMode: fillMode_(), active: activeEvents_().map(publicEvent_) }; }

function submitClaim_(uid, b) {
  var id = str_(b.ownerId); if (!/^C\d{5,}$/.test(id)) throw new Error('攤主ID 格式錯誤');
  var c = claimsOf_(uid); if (c.owned.indexOf(id) >= 0) return { status: '已核准' }; if (c.pending.indexOf(id) >= 0) return { status: '待審核', code: claimCode_(uid, id) };
  if (ownerSuspended_(id)) throw new Error('此攤主目前鎖定中，請聯絡站長');
  var proof = str_(b.proofUrl).trim(); if (proof) { var vf = validateField_('其他連結', proof, ''); if (!vf.ok) throw new Error('驗證連結：' + vf.block); proof = vf.value; }
  var detail = ownerDetail_(id), known = []; detail.dbRows.forEach(function (r) { Object.keys(r.fields).forEach(function (h) { splitUrls_(r.fields[h]).forEach(function (u) { known.push(hostOf_(u) + pathHead_(u)); }); }); });
  var match = proof && known.some(function (k) { return k && (hostOf_(proof) + pathHead_(proof)) === k; });
  var name = detail.dbRows.length ? detail.dbRows[0].fields[DB_NAME_HEADER] : (detail.history.length ? detail.history[detail.history.length - 1].name : '');
  var code = claimCode_(uid, id), method = b.method === 'dm' ? '私訊官方粉專' : 'SNS 貼文';
  sheet_(SH.CLAIM).appendRow([newId_('CL'), now_(), id, safeCell_(name), uid, method, safeCell_(proof), code, safeCell_(str_(b.note).slice(0, 300)) + (match ? '｜貼文帳號與資料庫相符' : (proof ? '｜⚠ 貼文帳號不在資料庫內' : '')), '待審核', '', '', 'owner', now_()]);
  return { status: '待審核', code: code };
}
function pathHead_(u) { var m = String(u).match(/^https?:\/\/[^\/]+\/(@?[A-Za-z0-9_.\-]+)/); return m ? '/' + m[1].toLowerCase() : ''; }

/** 主資料修改：每欄一列寫入「修改申請」，一律待審核。 */
function submitEdit_(uid, me, b) {
  var id = str_(b.ownerId); if (me.owned.indexOf(id) < 0) throw new Error('尚未核准管理此攤主');
  if (ownerSuspended_(id)) throw new Error('此攤主目前鎖定中，請聯絡站長');
  var db = readDb_(), rowIdx = -1, key = str_(b.rowName);
  db.rows.forEach(function (r, i) { if (r[db.idc] === id && (rowIdx < 0 || r[db.nc] === key)) rowIdx = i; });
  if (rowIdx < 0) throw new Error('找不到此攤主在新攤位資料庫的資料列');
  var row = db.rows[rowIdx], changes = b.changes || {}, batch = newId_('B'), out = [], urls = [];
  var fields = Object.keys(changes); if (fields.length > 30) throw new Error('一次最多修改 30 欄');
  var prepared = fields.map(function (f) {
    if (DB_EDITABLE.indexOf(f) < 0) throw new Error('此欄不可修改：' + f);
    var ci = db.hm[normHeader_(f)], old = ci === undefined ? '' : row[ci], vf = validateField_(f, changes[f], old);
    if (!vf.ok) throw new Error(f + '：' + vf.block); if (vf.value === str_(old).trim()) return null;
    splitUrls_(vf.value).forEach(function (u) { urls.push(u); }); return { f: f, old: old, vf: vf };
  }).filter(Boolean);
  if (!prepared.length) return { queued: 0 };
  var sb = safeBrowsing_(urls), sbNote = sb.checked ? (sb.bad.length ? '⛔ Safe Browsing：' + sb.bad.join('、') : 'Safe Browsing OK') : 'Safe Browsing 未檢查';
  if (sb.bad.length) { alert_('Safe Browsing 攔截', uid + ' 對 ' + id + ' 提交危險連結：' + sb.bad.join('\n')); throw new Error('連結被判定為危險網站，已拒絕'); }
  var extra = prepared.length > 8 ? 10 : 0, sh = sheet_(SH.EDIT), maxRisk = 0;
  prepared.forEach(function (p) {
    var risk = Math.min(100, p.vf.risk + extra), notes = p.vf.notes.concat([sbNote]); maxRisk = Math.max(maxRisk, risk);
    sh.appendRow([newId_('ED'), now_(), '主資料修改', id, SH.DB, safeCell_(row[db.nc]), p.f, safeCell_(p.old), safeCell_(p.vf.value), uid, risk, notes.join('｜'), '待審核', '', '', '', '', '', batch]);
    out.push(p.f);
  });
  var sens = prepared.some(function (p) { return p.vf.sensitive; });
  if (maxRisk >= 50 || sens) alert_('可疑修改待審核', uid + ' 對 ' + id + '（' + row[db.nc] + '）提交 ' + out.length + ' 欄修改，最高風險 ' + maxRisk + (sens ? '，含身分欄位變更（需二次驗證）' : '') + '\n欄位：' + out.join('、'));
  return { queued: out.length, batch: batch };
}

/** 場次整理表填寫：依設定 queue（預設）或 live。 */
function submitEventFill_(uid, me, b) {
  var id = str_(b.ownerId), code = str_(b.event), ev = findEvent_(code);
  if (!ev) throw new Error('此場次未開放填寫'); if (me.owned.indexOf(id) < 0) throw new Error('尚未核准管理此攤主');
  if (ownerSuspended_(id)) throw new Error('此攤主目前鎖定中，請聯絡站長');
  var lg = readLog_(), C = lg.C, names = lg.rows.filter(function (r) { return r[C.ev] === code && r[C.id] === id; }).map(function (r) { return r[C.name]; });
  var booth = str_(b.booth); if (names.indexOf(booth) < 0) throw new Error('此攤位不屬於你管理的攤主');
  var E = readEvent_(ev), loc = locateEventRow_(E, booth, str_(b.boothNo)); if (loc.error) throw new Error(loc.error);
  var row = E.rows[loc.index], changes = b.changes || {}, fields = Object.keys(changes), urls = [], batch = newId_('B');
  if (fields.length > 40) throw new Error('一次最多 40 欄');
  var prepared = fields.map(function (f) {
    var ci = E.hm[normHeader_(f)]; if (ci === undefined || isLockedHeader_(E.hdr[ci], false)) throw new Error('此欄不可由攤主填寫：' + f);
    var old = row[ci], vf = validateField_(f, changes[f], old); if (!vf.ok) throw new Error(f + '：' + vf.block);
    if (f === '縮圖[請備註]' && vf.value) { var fid = driveId_(vf.value), st = fid ? thumbStatus_(fid) : 'BAD_LINK'; if (st !== 'PUBLIC') throw new Error('縮圖連結無法公開檢視（' + st + '），請將共用設定改為「知道連結的任何人」'); }
    if (vf.value === str_(old).trim()) return null; splitUrls_(vf.value).forEach(function (u) { urls.push(u); });
    return { f: f, ci: ci, old: old, vf: vf };
  }).filter(Boolean);
  if (!prepared.length) return { queued: 0, applied: 0 };
  var sb = safeBrowsing_(urls); if (sb.bad.length) { alert_('Safe Browsing 攔截', uid + ' 對 ' + code + '/' + booth + '：' + sb.bad.join('\n')); throw new Error('連結被判定為危險網站，已拒絕'); }
  var sbNote = sb.checked ? 'Safe Browsing OK' : 'Safe Browsing 未檢查', live = fillMode_() === 'live', sh = sheet_(SH.EDIT), applied = 0, queued = 0, maxRisk = 0;
  prepared.forEach(function (p) {
    var risk = p.vf.risk, notes = p.vf.notes.concat([sbNote]), canLive = live && risk < 30 && !p.vf.sensitive, status = '待審核', where = '', before = '', at = '';
    maxRisk = Math.max(maxRisk, risk);
    if (canLive) { var r = applyEventCell_(ev, booth, str_(b.boothNo), p.f, p.vf.value, p.old); if (r.ok) { status = '已套用'; where = r.where; before = r.before; at = now_(); applied++; } else { status = '需人工'; notes.push(r.error); } }
    else queued++;
    sh.appendRow([newId_('EF'), now_(), '場次填寫', id, code, safeCell_(booth + (b.boothNo ? '｜' + b.boothNo : '')), p.f, safeCell_(p.old), safeCell_(p.vf.value), uid, risk, notes.join('｜'), status, canLive ? now_() : '', canLive ? '即時制自動套用' : '', where, safeCell_(before), at, batch]);
  });
  if (applied) bumpVersion_();
  if (maxRisk >= 50) alert_('可疑場次填寫', uid + ' 對 ' + code + '/' + booth + ' 提交修改，最高風險 ' + maxRisk);
  return { queued: queued, applied: applied, mode: live ? 'live' : 'queue', batch: batch };
}
/** 在場次整理表中找到攤位所在列：攤位名稱完全相同（去頭尾空白），若有多列再以攤位編號（第一天/第二天）區分。 */
function locateEventRow_(E, booth, boothNo) {
  var target = str_(booth).trim(), hits = [];
  E.rows.forEach(function (r, i) { if (str_(r[0]).trim() === target) hits.push(i); });
  if (!hits.length) { var nn = normName_(target); E.rows.forEach(function (r, i) { if (normName_(r[0]) === nn) hits.push(i); }); }
  if (hits.length > 1 && boothNo) { var bn = str_(boothNo).replace(/\s/g, ''); hits = hits.filter(function (i) { var r = E.rows[i]; return (str_(r[2]) + ',' + str_(r[3])).replace(/\s/g, '').split(',').indexOf(bn) >= 0; }); }
  if (hits.length === 1) return { index: hits[0], row: hits[0] + 2 };
  return { error: hits.length ? '整理表中有多列同名攤位，需站長處理' : '整理表中找不到此攤位：' + target };
}
/** 寫入場次整理表的一格；寫入前確認目前值仍等於申請時的舊值（避免覆蓋站長同時間的修改）。 */
function applyEventCell_(ev, booth, boothNo, field, value, expectOld) {
  var E = readEvent_(ev), loc = locateEventRow_(E, booth, boothNo); if (loc.error) return { ok: false, error: loc.error };
  var ci = E.hm[normHeader_(field)]; if (ci === undefined || isLockedHeader_(E.hdr[ci], false)) return { ok: false, error: '欄位不可寫入：' + field };
  var cur = str_(E.rows[loc.index][ci]);
  if (expectOld !== null && expectOld !== undefined && cur.trim() !== str_(expectOld).trim()) return { ok: false, error: '整理表此格已被他人修改（目前值不同），請人工確認' };
  var rg = E.sheet.getRange(loc.row, ci + 1); rg.setValue(safeCell_(value));
  CacheService.getScriptCache().remove('ev:' + ev.code + '@' + version_());
  return { ok: true, where: ev.code + '!' + colLetter_(ci) + loc.row, before: cur };
}
function submitReport_(uid, b) {
  var a = str_(b.a), c = str_(b.b); if (!/^C\d{5,}$/.test(a) || !/^C\d{5,}$/.test(c)) throw new Error('攤主ID 格式錯誤');
  sheet_(SH.EDIT).appendRow([newId_('RP'), now_(), '關聯回報', a, '關聯', c, b.kind === 'split' ? '應拆開' : '應合併', '', safeCell_(str_(b.note).slice(0, 300)), uid, 0, '', '待審核', '', '', '', '', '', '']);
  return { queued: 1 };
}
/** 使用者自行刪除：撤銷其所有認領，並把所有列的申請者代號改為「（已刪除）」。只改動相關儲存格。 */
function withdraw_(uid) {
  var n = 0;
  [[SH.CLAIM, 5, 10], [SH.EDIT, 10, 13]].forEach(function (t) {
    var sh = sheet_(t[0]), last = sh.getLastRow(); if (last < 2) return;
    var who = sh.getRange(2, t[1], last - 1, 1).getValues(), st = sh.getRange(2, t[2], last - 1, 1).getValues();
    for (var i = 0; i < who.length; i++) {
      if (who[i][0] !== uid) continue; n++;
      sh.getRange(i + 2, t[1]).setValue('（已刪除）');
      if (t[0] === SH.CLAIM && st[i][0] !== '停權') sh.getRange(i + 2, t[2]).setValue('撤銷');
      if (t[0] === SH.EDIT && st[i][0] === '待審核') sh.getRange(i + 2, t[2]).setValue('拒絕');
    }
  });
  bumpVersion_(); return n;
}

/** 攤主主頁縮圖（非特定場次）：寫入「場次出展紀錄」中該攤主最新一筆的縮圖檔案ID。必須已公開。 */
function submitThumb_(uid, me, b) {
  var id = str_(b.ownerId); if (me.owned.indexOf(id) < 0) throw new Error('尚未核准管理此攤主');
  if (ownerSuspended_(id)) throw new Error('此攤主目前鎖定中，請聯絡站長');
  if (b.event && findEvent_(b.event)) { var ch = {}; ch['縮圖[請備註]'] = b.url; return submitEventFill_(uid, me, { ownerId: id, event: b.event, booth: b.booth, boothNo: b.boothNo, changes: ch }); }
  var fid = driveId_(b.url); if (!fid) throw new Error('看不懂這個連結，請貼上 Google 雲端硬碟的分享連結');
  var st = thumbStatus_(fid); if (st !== 'PUBLIC') throw new Error('縮圖無法公開檢視（' + st + '）');
  var lg = readLog_(), C = lg.C, best = -1;
  lg.rows.forEach(function (r, i) { if (r[C.id] === id && (best < 0 || r[C.date] >= lg.rows[best][C.date])) best = i; });
  if (best < 0) throw new Error('此攤主沒有出展紀錄，無法設定縮圖');
  var r = lg.rows[best];
  sheet_(SH.EDIT).appendRow([newId_('TH'), now_(), '縮圖', id, SH.LOG, r[C.rid], '縮圖檔案ID', r[C.fid], fid, uid, r[C.fid] ? 15 : 0, (r[C.fid] ? '取代既有縮圖｜' : '') + 'Drive 公開檢查 OK', '待審核', '', '', '', '', '', newId_('B')]);
  return { queued: 1, fileId: fid };
}

/* ============================== 站長：套用／復原 ============================== */
var E_COL = { id: 1, at: 2, type: 3, owner: 4, target: 5, key: 6, field: 7, old: 8, val: 9, who: 10, risk: 11, notes: 12, status: 13, revAt: 14, revNote: 15, where: 16, before: 17, appliedAt: 18, batch: 19 };
function editRow_(n) { var v = sheet_(SH.EDIT).getRange(n, 1, 1, 19).getValues()[0]; var o = { n: n }; Object.keys(E_COL).forEach(function (k) { o[k] = v[E_COL[k] - 1]; }); return o; }
function setEdit_(n, obj) { var sh = sheet_(SH.EDIT); Object.keys(obj).forEach(function (k) { sh.getRange(n, E_COL[k]).setValue(k === 'before' || k === 'old' || k === 'val' ? safeCell_(obj[k]) : obj[k]); }); }
/** 套用一列「核准」的申請。crossFile=false 時（onEdit 簡易觸發）只處理同一檔案內的目標。 */
function applyRow_(n, crossFile) {
  var r = editRow_(n); if (r.status !== '核准') return { ok: false, error: '狀態不是核准' };
  if (/需二次驗證/.test(str_(r.notes)) && !/二次驗證OK/i.test(str_(r.revNote))) { setEdit_(n, { status: '需人工', revNote: str_(r.revNote) + '｜敏感欄位：請以原認領管道確認後，在審核備註寫「二次驗證OK」再改回核准' }); return { ok: false, error: '需二次驗證' }; }
  var res;
  if (r.type === '主資料修改') res = applyDbCell_(r.owner, str_(r.key), str_(r.field), str_(r.val), str_(r.old));
  else if (r.type === '縮圖') res = applyLogThumb_(str_(r.key), str_(r.val), str_(r.old));
  else if (r.type === '場次填寫') { if (!crossFile) return { ok: false, error: '跨檔案，請用選單套用' };
    var ev = findEvent_(str_(r.target)); if (!ev) res = { ok: false, error: '場次已不在整理中清單' };
    else { var kb = str_(r.key).split('｜'); res = applyEventCell_(ev, kb[0], kb[1] || '', str_(r.field), str_(r.val), str_(r.old)); } }
  else if (r.type === '關聯回報') res = { ok: true, where: '（人工處理）', before: '' };
  else res = { ok: false, error: '未知類型' };
  if (res.ok) { setEdit_(n, { status: '已套用', where: res.where, before: res.before, appliedAt: now_(), revAt: r.revAt || now_() }); bumpVersion_(); }
  else setEdit_(n, { status: '需人工', revNote: str_(r.revNote) + '｜' + res.error });
  return res;
}
function applyDbCell_(ownerId, key, field, value, expectOld) {
  var db = readDb_(), ci = db.hm[normHeader_(field)]; if (ci === undefined || DB_EDITABLE.indexOf(field) < 0) return { ok: false, error: '欄位不可寫入' };
  var hits = []; db.rows.forEach(function (row, i) { if (row[db.idc] === ownerId && str_(row[db.nc]).trim() === key.trim()) hits.push(i); });
  if (hits.length !== 1) return { ok: false, error: hits.length ? '同名多列' : '找不到資料列（可能已改名或刪除）' };
  var cur = str_(db.rows[hits[0]][ci]); if (cur.trim() !== str_(expectOld).trim()) return { ok: false, error: '目前值與申請時不同，請人工確認' };
  db.sheet.getRange(hits[0] + 2, ci + 1).setValue(safeCell_(value));
  return { ok: true, where: SH.DB + '!' + colLetter_(ci) + (hits[0] + 2), before: cur };
}
function applyLogThumb_(rid, fid, expectOld) {
  var lg = readLog_(), C = lg.C, i = -1; lg.rows.forEach(function (r, k) { if (r[C.rid] === rid) i = k; }); if (i < 0) return { ok: false, error: '找不到出展紀錄' };
  var cur = str_(lg.rows[i][C.fid]); if (cur !== str_(expectOld)) return { ok: false, error: '縮圖已被修改，請人工確認' };
  lg.sheet.getRange(i + 2, C.fid + 1).setValue(fid); lg.sheet.getRange(i + 2, C.ts + 1).setValue('公開');
  return { ok: true, where: SH.LOG + '!' + colLetter_(C.fid) + (i + 2), before: cur };
}
/** 復原一列「已套用」：只有目前值仍等於當初寫入的新值時才會還原，否則標示需人工。 */
function revertRow_(n, crossFile) {
  var r = editRow_(n); if (r.status !== '已套用' && r.status !== '復原') return { ok: false, error: '此列不是已套用' };
  var where = str_(r.where), m = where.match(/^(.+)!([A-Z]+)(\d+)$/); if (!m) { setEdit_(n, { status: '需人工', revNote: str_(r.revNote) + '｜無套用位置' }); return { ok: false }; }
  var tab = m[1], target;
  if (tab === SH.DB || tab === SH.LOG) target = sheet_(tab).getRange(m[2] + m[3]);
  else { if (!crossFile) return { ok: false, error: '跨檔案，請用選單復原' }; var ev = findEvent_(tab); if (!ev) return { ok: false, error: '場次不在清單' }; target = eventSheet_(ev).getRange(m[2] + m[3]); }
  var cur = str_(target.getDisplayValue()), want = str_(r.val);
  if (tab === SH.LOG && r.type === '縮圖') { target.setValue(str_(r.before)); target.offset(0, 1).setValue(r.before ? '公開' : ''); }
  else { if (cur.trim() !== want.trim()) { setEdit_(n, { status: '需人工', revNote: str_(r.revNote) + '｜復原失敗：此格之後又被修改過' }); return { ok: false }; } target.setValue(safeCell_(r.before)); }
  setEdit_(n, { status: '已復原', revNote: str_(r.revNote) + '｜' + now_() + ' 已復原' }); bumpVersion_(); return { ok: true };
}

/* ============================== 簡易觸發 ============================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🗂 攤位資料庫網站')
    .addItem('🔍 審核待處理申請（連結預覽／差異）', 'menuReview')
    .addItem('✅ 套用所有「核准」的申請', 'menuApplyApproved')
    .addItem('↩️ 復原選取的修改申請列', 'menuRevertSelected')
    .addItem('⏪ 一鍵復原某攤主的近期修改…', 'menuRevertOwner')
    .addItem('⛔ 停權／恢復攤主或帳號…', 'menuSuspend')
    .addSeparator()
    .addItem('📥 匯入新場次攤位名單…', 'menuImport')
    .addItem('📤 場次整理表 → 併入新攤位資料庫…', 'menuMerge')
    .addItem('⚙️ 整理中場次設定…', 'menuEvents')
    .addItem('⚙️ 切換場次填寫模式（審核制／即時制）', 'menuToggleMode')
    .addSeparator()
    .addItem('🔄 清除網站快取', 'menuClearCache')
    .addItem('🧪 自我檢查（不寫入）', 'menuSelfTest')
    .addItem('🔑 初始化設定', 'menuSetup')
    .addToUi();
}
/** 簡易觸發 onEdit：①任何主資料修改→網站快取換版本（網站立即反映試算表變更）②在「修改申請」把狀態改成核准／復原時，同檔案內的目標立即套用。 */
function onEdit(e) {
  try {
    var sh = e.range.getSheet(), name = sh.getName();
    if (name === SH.DB || name === SH.LOG || name === SH.CLAIM) { bumpVersion_(); return; }
    if (name !== SH.EDIT || e.range.getColumn() > E_COL.status || e.range.getLastColumn() < E_COL.status) return;
    for (var row = e.range.getRow(); row <= e.range.getLastRow(); row++) {
      if (row < 2) continue; var st = str_(sh.getRange(row, E_COL.status).getValue()), target = str_(sh.getRange(row, E_COL.target).getValue());
      var sameFile = target === SH.DB || target === SH.LOG || target === '關聯';
      if (st === '核准') { if (sameFile) applyRow_(row, false); else sh.getRange(row, E_COL.revNote).setValue('跨檔案：請按選單「✅ 套用所有核准的申請」'); }
      if (st === '復原' && sameFile) revertRow_(row, false);
      if (st === '核准' || st === '拒絕') { if (!sh.getRange(row, E_COL.revAt).getValue()) sh.getRange(row, E_COL.revAt).setValue(now_()); }
    }
  } catch (err) { /* 簡易觸發不可中斷使用者編輯 */ }
}

/* ============================== 站長選單 ============================== */
function ui_() { return SpreadsheetApp.getUi(); }
function menuApplyApproved() {
  var sh = sheet_(SH.EDIT), last = sh.getLastRow(); if (last < 2) return ui_().alert('沒有申請');
  var st = sh.getRange(2, E_COL.status, last - 1, 1).getValues(), ok = 0, bad = 0;
  for (var i = 0; i < st.length; i++) if (st[i][0] === '核准') { var r = applyRow_(i + 2, true); r.ok ? ok++ : bad++; }
  ui_().alert('套用完成：成功 ' + ok + ' 筆，需人工 ' + bad + ' 筆（請看「修改申請」的審核備註）');
}
function menuRevertSelected() {
  var sh = ss_().getActiveSheet(); if (sh.getName() !== SH.EDIT) return ui_().alert('請先在「修改申請」選取要復原的列');
  var rg = sh.getActiveRange(), ok = 0, bad = 0;
  for (var row = rg.getLastRow(); row >= rg.getRow(); row--) { if (row < 2) continue; var r = revertRow_(row, true); r.ok ? ok++ : bad++; }
  ui_().alert('復原：成功 ' + ok + ' 筆，失敗／需人工 ' + bad + ' 筆');
}
function menuRevertOwner() {
  var a = ui_().prompt('一鍵復原', '輸入攤主ID（例 C00045），可加空格與小時數（預設 72）：', ui_().ButtonSet.OK_CANCEL); if (a.getSelectedButton() !== ui_().Button.OK) return;
  var parts = a.getResponseText().trim().split(/\s+/), id = parts[0], hours = +(parts[1] || 72);
  var cutoff = Utilities.formatDate(new Date(Date.now() - hours * 3600e3), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  var sh = sheet_(SH.EDIT), last = sh.getLastRow(), v = last > 1 ? sh.getRange(2, 1, last - 1, 19).getDisplayValues() : [], ok = 0, bad = 0, rej = 0;
  for (var i = v.length - 1; i >= 0; i--) {
    if (v[i][3] !== id) continue;
    if (v[i][12] === '已套用' && v[i][17] >= cutoff) { var r = revertRow_(i + 2, true); r.ok ? ok++ : bad++; }
    else if (v[i][12] === '待審核') { sh.getRange(i + 2, E_COL.status).setValue('拒絕'); sh.getRange(i + 2, E_COL.revNote).setValue('一鍵復原時一併拒絕'); rej++; }
  }
  ui_().alert(id + '：復原 ' + ok + ' 筆、失敗 ' + bad + ' 筆、拒絕待審核 ' + rej + ' 筆。建議同時使用「⛔ 停權」。');
}
function menuSuspend() {
  var a = ui_().prompt('停權／恢復', '輸入「攤主ID」或「申請者代號 u_…」。要恢復請在前面加「+」，例：+C00045', ui_().ButtonSet.OK_CANCEL); if (a.getSelectedButton() !== ui_().Button.OK) return;
  var t = a.getResponseText().trim(), restore = t.charAt(0) === '+'; if (restore) t = t.slice(1);
  var sh = sheet_(SH.CLAIM), last = sh.getLastRow(), v = last > 1 ? sh.getRange(2, 1, last - 1, 14).getValues() : [], n = 0;
  if (/^u_/.test(t)) {
    v.forEach(function (r, i) { if (r[4] !== t) return; if (!restore && (r[9] === '核准' || r[9] === '待審核')) { sh.getRange(i + 2, 10).setValue('停權'); sh.getRange(i + 2, 12).setValue(now_() + ' 站長停權'); n++; }
      if (restore && r[9] === '停權') { sh.getRange(i + 2, 10).setValue('核准'); sh.getRange(i + 2, 12).setValue(now_() + ' 站長恢復'); n++; } });
  } else if (/^C\d{5,}$/.test(t)) {
    if (!restore) { sh.appendRow([newId_('CL'), now_(), t, '（攤主鎖定）', '*', '站長', '', '', '鎖定此攤主：所有帳號暫停修改', '停權', now_(), '站長鎖定', 'lock', now_()]); n = 1; }
    else v.forEach(function (r, i) { if (r[2] === t && r[4] === '*' && r[9] === '停權') { sh.getRange(i + 2, 10).setValue('撤銷'); n++; } });
  } else return ui_().alert('格式不正確');
  if (!restore) rejectPending_(t);
  bumpVersion_(); ui_().alert((restore ? '已恢復 ' : '已停權／鎖定 ') + n + ' 筆');
}
function rejectPending_(t) {
  var sh = sheet_(SH.EDIT), last = sh.getLastRow(); if (last < 2) return; var v = sh.getRange(2, 1, last - 1, 13).getValues();
  v.forEach(function (r, i) { if ((r[3] === t || r[9] === t) && r[12] === '待審核') { sh.getRange(i + 2, E_COL.status).setValue('拒絕'); sh.getRange(i + 2, E_COL.revNote).setValue('停權時一併拒絕'); } });
}
function menuToggleMode() {
  var m = fillMode_() === 'queue' ? 'live' : 'queue';
  var ok = ui_().alert('場次填寫模式', '目前：' + (fillMode_() === 'queue' ? '審核制（每筆需站長核准）' : '即時制（已核准攤主的低風險填寫立即寫入，可一鍵復原）') + '\n要切換成：' + (m === 'queue' ? '審核制' : '即時制') + '？', ui_().ButtonSet.YES_NO);
  if (ok === ui_().Button.YES) { setProp_('EVENT_FILL_MODE', m); bumpVersion_(); ui_().alert('已切換為 ' + m); }
}
function menuClearCache() { bumpVersion_(); ui_().alert('網站快取已更新，下一次載入就會讀到最新資料'); }
function menuSetup() {
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('HMAC_SECRET')) p.setProperty('HMAC_SECRET', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  var a = ui_().prompt('初始化設定', 'OAuth 用戶端 ID（Google Cloud Console › API 和服務 › 憑證 › 網頁應用程式）。目前：' + (p.getProperty('OAUTH_CLIENT_ID') || '未設定') + '\n留空不變：', ui_().ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() === ui_().Button.OK && a.getResponseText().trim()) p.setProperty('OAUTH_CLIENT_ID', a.getResponseText().trim());
  if (!p.getProperty('EVENT_FILL_MODE')) p.setProperty('EVENT_FILL_MODE', 'queue');
  if (!activeEvents_().length) {
    var b = ui_().prompt('整理中場次', '要先登記 FFK19 嗎？輸入 FFK19 整理表的網址（留空略過）：', ui_().ButtonSet.OK_CANCEL);
    var id = b.getSelectedButton() === ui_().Button.OK ? sheetIdFromUrl_(b.getResponseText()) : '';
    if (id) setActiveEvents_([{ code: 'FFK19', name: 'Fancy Frontier 開拓動漫祭 高雄場 19', start: '', sheetId: id, tab: '攤位整理表 請在此填寫資訊', status: '整理中' }]);
  }
  ensureOwnerSeq_(); bumpVersion_();
  ui_().alert('完成。HMAC_SECRET 已設定（不顯示）。接著請到「部署 › 新增部署 › 網頁應用程式」，執行身分：我；存取：所有人。');
}
function sheetIdFromUrl_(u) { var m = str_(u).match(/\/d\/([A-Za-z0-9_-]{25,})/); return m ? m[1] : (/^[A-Za-z0-9_-]{25,}$/.test(str_(u).trim()) ? str_(u).trim() : ''); }
function menuEvents() {
  var list = activeEvents_(), txt = list.map(function (e) { return e.code + '｜' + e.name + '｜' + e.start + '｜' + e.sheetId; }).join('\n') || '（無）';
  var a = ui_().prompt('整理中場次', '目前：\n' + txt + '\n\n新增：add 代碼｜名稱｜開始日 YYYY-MM-DD｜整理表網址\n移除：remove 代碼（只移出清單，不刪任何檔案）', ui_().ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui_().Button.OK) return; var t = a.getResponseText().trim();
  if (/^remove\s+/i.test(t)) { var c = t.replace(/^remove\s+/i, '').trim(); setActiveEvents_(list.filter(function (e) { return e.code !== c; })); return ui_().alert('已移除 ' + c); }
  if (/^add\s+/i.test(t)) { var p = t.replace(/^add\s+/i, '').split(/[｜|]/).map(function (x) { return x.trim(); }); var sid = sheetIdFromUrl_(p[3]); if (!p[0] || !sid) return ui_().alert('格式錯誤');
    list = list.filter(function (e) { return e.code !== p[0]; }); list.push({ code: p[0], name: p[1] || p[0], start: p[2] || '', sheetId: sid, tab: '', status: '整理中' }); setActiveEvents_(list); return ui_().alert('已新增 ' + p[0]); }
}

/* ============================== 審核畫面（連結預覽／差異） ============================== */
function menuReview() {
  var sh = sheet_(SH.EDIT), last = sh.getLastRow(), v = last > 1 ? sh.getRange(2, 1, last - 1, 19).getDisplayValues() : [], items = [];
  for (var i = 0; i < v.length && items.length < 40; i++) if (v[i][12] === '待審核' || v[i][12] === '需人工') items.push(reviewItem_(i + 2, v[i]));
  var t = HtmlService.createTemplate(REVIEW_HTML); t.items = items; t.mode = fillMode_();
  ui_().showModalDialog(t.evaluate().setWidth(1100).setHeight(720), '審核待處理申請（' + items.length + '）');
}
function reviewItem_(n, r) {
  var oldU = splitUrls_(r[7]), newU = splitUrls_(r[8]);
  return { n: n, id: r[0], at: r[1], type: r[2], owner: r[3], target: r[4], key: r[5], field: r[6], old: r[7], val: r[8], who: r[9], risk: +r[10] || 0, notes: r[11], status: r[12], revNote: r[14],
    links: newU.map(function (u) { return { url: u, host: hostOf_(u), isNew: oldU.indexOf(u) < 0, known: domainIn_(hostOf_(u), KNOWN_DOMAINS) }; }), removed: oldU.filter(function (u) { return newU.indexOf(u) < 0; }) };
}
/** 審核畫面按鈕呼叫：decision = approve / approve2 / reject */
function reviewDecide(n, decision, note) {
  var sh = sheet_(SH.EDIT), r = editRow_(n); if (r.status !== '待審核' && r.status !== '需人工') return '此列狀態已變更：' + r.status;
  var memo = str_(note).slice(0, 200);
  if (decision === 'reject') { setEdit_(n, { status: '拒絕', revAt: now_(), revNote: memo }); return '已拒絕'; }
  setEdit_(n, { status: '核准', revAt: now_(), revNote: (decision === 'approve2' ? '二次驗證OK｜' : '') + memo });
  var res = applyRow_(n, true); return res.ok ? '已套用 → ' + res.where : '需人工：' + res.error;
}
var REVIEW_HTML = '<!DOCTYPE html><html><head><base target="_blank"><style>body{font-family:sans-serif;font-size:13px;background:#0f1419;color:#e8eef7;margin:0;padding:10px}'
  + '.it{border:1px solid #2d3a4f;border-radius:10px;padding:10px;margin-bottom:10px;background:#1a2332}.h{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.risk{padding:2px 8px;border-radius:99px;font-weight:700}'
  + '.r0{background:#1dd1a133;color:#1dd1a1}.r1{background:#ff9f4333;color:#ff9f43}.r2{background:#ff6b6b33;color:#ff6b6b}.diff{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}'
  + '.old,.new{white-space:pre-wrap;word-break:break-all;padding:6px;border-radius:6px}.old{background:#ff6b6b1a;text-decoration:line-through;color:#ffb3b3}.new{background:#1dd1a11a;color:#b8f5e4}'
  + '.host{font-weight:700;padding:1px 6px;border-radius:4px;background:#5b9df933}.unk{background:#ff6b6b55}.btn{margin-right:6px;padding:6px 12px;border-radius:8px;border:0;cursor:pointer}.ok{background:#1dd1a1}.ok2{background:#48dbfb}.no{background:#ff6b6b;color:#fff}'
  + 'input{width:280px;background:#0f1419;color:#e8eef7;border:1px solid #2d3a4f;border-radius:6px;padding:4px}.m{color:#8b9cb3}</style></head><body>'
  + '<div class="m">場次填寫模式：<?= mode === "live" ? "即時制" : "審核制" ?>。連結只顯示為文字與網域；點「開啟」會在新分頁開啟（noopener）。敏感欄位請先以原認領管道確認，再按「二次驗證後核准」。</div>'
  + '<? for (var i = 0; i < items.length; i++) { var it = items[i]; ?><div class="it" id="it<?= it.n ?>"><div class="h"><b><?= it.type ?></b><span><?= it.owner ?> ／ <?= it.target ?> ／ <?= it.key ?></span><span>欄位：<b><?= it.field ?></b></span>'
  + '<span class="risk <?= it.risk >= 60 ? "r2" : (it.risk >= 30 ? "r1" : "r0") ?>">風險 <?= it.risk ?></span><span class="m"><?= it.at ?> ／ <?= it.who ?> ／ 列 <?= it.n ?></span></div>'
  + '<div class="m"><?= it.notes ?> <?= it.revNote ?></div><div class="diff"><div class="old"><?= it.old || "（空白）" ?></div><div class="new"><?= it.val || "（清空）" ?></div></div>'
  + '<? for (var j = 0; j < it.links.length; j++) { var l = it.links[j]; ?><div><span class="host <?= l.known ? "" : "unk" ?>"><?= l.host ?></span> <?= l.isNew ? "🆕" : "" ?> <code><?= l.url ?></code> <a href="<?= l.url ?>" rel="noopener noreferrer nofollow">開啟</a></div><? } ?>'
  + '<? for (var k = 0; k < it.removed.length; k++) { ?><div class="m">移除：<code><?= it.removed[k] ?></code></div><? } ?>'
  + '<div style="margin-top:8px"><input id="n<?= it.n ?>" placeholder="審核備註（選填）"> <button class="btn ok" onclick="go(<?= it.n ?>,\'approve\')">核准並套用</button>'
  + '<button class="btn ok2" onclick="go(<?= it.n ?>,\'approve2\')">二次驗證後核准</button><button class="btn no" onclick="go(<?= it.n ?>,\'reject\')">拒絕</button> <span id="s<?= it.n ?>"></span></div></div><? } ?>'
  + '<script>function go(n,d){var s=document.getElementById("s"+n);s.textContent="處理中…";google.script.run.withSuccessHandler(function(m){s.textContent=m;}).withFailureHandler(function(e){s.textContent="錯誤："+e.message;}).reviewDecide(n,d,document.getElementById("n"+n).value);}</script></body></html>';

/* ============================== 新攤主ID ============================== */
function ensureOwnerSeq_() {
  var p = PropertiesService.getScriptProperties(); if (p.getProperty('NEXT_OWNER_SEQ')) return;
  var max = 0, scan = function (vals) { vals.forEach(function (r) { var m = str_(r[0]).match(/^C(\d+)$/); if (m) max = Math.max(max, +m[1]); }); };
  var db = readDb_(); scan(db.rows.map(function (r) { return [r[db.idc]]; }));
  var lg = readLog_(); scan(lg.rows.map(function (r) { return [r[lg.C.id]]; }));
  p.setProperty('NEXT_OWNER_SEQ', String(max + 1));
}
function nextOwnerId_() { ensureOwnerSeq_(); var p = PropertiesService.getScriptProperties(), n = +p.getProperty('NEXT_OWNER_SEQ'); p.setProperty('NEXT_OWNER_SEQ', String(n + 1)); return 'C' + ('0000' + n).slice(-5); }
function nextLogSeq_(lg) { var max = 0; lg.rows.forEach(function (r) { var m = str_(r[lg.C.rid]).match(/^E(\d+)$/); if (m) max = Math.max(max, +m[1]); }); return max + 1; }

/* ============================== 匯入新場次攤位名單 ============================== */
/** 解析主辦方攤位名單（任何試算表；可由 xlsx/csv 上傳後以 Google 試算表開啟）。回傳依攤位編號排序、同名合併的列表。 */
function parseBoothList_(values) {
  var NAME = ['攤位名稱', '社團名稱', '攤名', '社團', '名稱', 'circle', 'circlename', 'boothname', '攤商名稱'], PEN = ['筆名', '作者', '攤主', 'pen', 'penname', '作者名'];
  var D1 = ['第一天', 'day1', 'd1', '第1天', '週六', '星期六', '六'], D2 = ['第二天', 'day2', 'd2', '第2天', '週日', '星期日', '日'], D3 = ['第三天', 'day3', 'd3', '第3天'];
  var BOOTH = ['攤位編號', '攤位', '攤號', '攤位號', '位置', 'booth', 'boothno', 'space'], DAY = ['日期', '參加日期', '天數', '參展日', 'day', '場次日'];
  var hr = -1, cols = {};
  function find(h, keys) { for (var i = 0; i < h.length; i++) { var x = normHeader_(h[i]); for (var k = 0; k < keys.length; k++) if (x === normHeader_(keys[k])) return i; } return -1; }
  for (var r = 0; r < Math.min(10, values.length); r++) { var c = find(values[r], NAME); if (c >= 0) { hr = r; break; } }
  if (hr < 0) throw new Error('找不到「攤位名稱／社團名稱」標題列（請確認名單前 10 列內有標題）');
  var h = values[hr]; cols = { name: find(h, NAME), pen: find(h, PEN), d1: find(h, D1), d2: find(h, D2), d3: find(h, D3), booth: find(h, BOOTH), day: find(h, DAY) };
  var map = {}, order = [];
  function add(arr, v) { str_(v).split(/[,，、\/\s]+/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (x) { if (arr.indexOf(x) < 0) arr.push(x); }); }
  values.slice(hr + 1).forEach(function (row) {
    var name = str_(row[cols.name]).trim(); if (!name) return; var k = name;
    var o = map[k] || (map[k] = { name: name, pen: '', d1: [], d2: [], d3: [] }); if (order.indexOf(k) < 0) order.push(k);
    if (cols.pen >= 0 && row[cols.pen] && !o.pen) o.pen = str_(row[cols.pen]).trim();
    if (cols.d1 >= 0 || cols.d2 >= 0) { if (cols.d1 >= 0) add(o.d1, row[cols.d1]); if (cols.d2 >= 0) add(o.d2, row[cols.d2]); if (cols.d3 >= 0) add(o.d3, row[cols.d3]); }
    else if (cols.booth >= 0) {
      var d = normHeader_(cols.day >= 0 ? row[cols.day] : ''), b = row[cols.booth];
      if (!d || /兩|全|both|1.?2|六日/.test(d)) { add(o.d1, b); add(o.d2, b); }
      else if (/2|二|日|sun/.test(d)) add(o.d2, b); else if (/3|三/.test(d)) add(o.d3, b); else add(o.d1, b);
    }
  });
  var list = order.map(function (k) { return map[k]; });
  var nat = function (s) { return str_(s).replace(/\d+/g, function (n) { return ('000000' + n).slice(-6); }); };
  list.sort(function (a, b) { var x = nat(a.d1[0] || a.d2[0] || '~'), y = nat(b.d1[0] || b.d2[0] || '~'); return x < y ? -1 : x > y ? 1 : 0; });
  return { cols: cols, headerRow: hr + 1, booths: list };
}
/** 依既定格式建立新場次整理表。opts: {code, name, start, srcId, srcTab, templateId, prefill, thumbSheetUrl, dryRun} */
function importEvent_(opts) {
  var src = SpreadsheetApp.openById(opts.srcId), srcSh = opts.srcTab ? src.getSheetByName(opts.srcTab) : src.getSheets()[0];
  var parsed = parseBoothList_(srcSh.getDataRange().getDisplayValues()), booths = parsed.booths; if (!booths.length) throw new Error('名單沒有任何攤位');
  var db = readDb_(), byName = {};
  db.rows.forEach(function (r, i) { var k = normName_(r[db.nc]); if (k) (byName[k] = byName[k] || []).push(i); });
  var lg0 = readLog_(), logName = {};
  lg0.rows.forEach(function (r) { var k = normName_(r[lg0.C.name]); if (k) (logName[k] = logName[k] || {})[r[lg0.C.id]] = 1; });
  var tplFile = DriveApp.getFileById(opts.templateId), tplCode = (tplFile.getName().match(/^[A-Za-z]+\d+/) || [''])[0];
  if (opts.dryRun) return { booths: booths.length, cols: parsed.cols, sample: booths.slice(0, 5), matched: booths.filter(function (b) { return byName[normName_(b.name)]; }).length };
  var parents = tplFile.getParents(), folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var copy = tplFile.makeCopy(opts.code + ' 完整攤位整理', folder), f = SpreadsheetApp.openById(copy.getId());
  var sh = null; f.getSheets().forEach(function (s) { if (!sh && str_(s.getRange(1, 1).getDisplayValue()).trim() === '攤位名稱') sh = s; });
  if (!sh) throw new Error('範本中找不到「攤位名稱」分頁');
  var lastCol = sh.getLastColumn(), hdr = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0], hm = headerMap_(hdr), n = booths.length;
  var f2 = sh.getRange(2, 1, 1, lastCol).getFormulasR1C1()[0], perRow = [];
  for (var c = 0; c < lastCol; c++) if (f2[c]) perRow.push(c);
  var arrayCols = []; var f1 = sh.getRange(1, 1, 1, lastCol).getFormulas()[0]; for (var c1 = 0; c1 < lastCol; c1++) if (f1[c1]) arrayCols.push(c1);
  if (sh.getMaxRows() < n + 1) sh.insertRowsAfter(sh.getMaxRows(), n + 1 - sh.getMaxRows());
  for (var cc = 0; cc < lastCol; cc++) { if (arrayCols.indexOf(cc) >= 0) continue; sh.getRange(2, cc + 1, sh.getMaxRows() - 1, 1).clearContent(); }
  if (sh.getMaxRows() > n + 1) sh.deleteRows(n + 2, sh.getMaxRows() - n - 1);
  var W = function (h) { return hm[normHeader_(h)]; }, grid = [];
  var prefilled = 0, logRows = [], lg = readLog_(), seq = nextLogSeq_(lg);
  booths.forEach(function (b) {
    var row = new Array(lastCol).fill(null);
    row[0] = safeCell_(b.name); row[1] = safeCell_(b.pen); row[2] = b.d1.join(','); row[3] = b.d2.join(',');
    if (W('第三天') !== undefined) row[W('第三天')] = b.d3.join(',');
    var hits = byName[normName_(b.name)] || [], ids = {}; hits.forEach(function (i) { ids[db.rows[i][db.idc]] = 1; });
    var id = Object.keys(ids).length === 1 ? Object.keys(ids)[0] : '';
    if (opts.prefill && id) {
      var src = db.rows[hits[hits.length - 1]];
      if (!b.pen && src[db.hm[normHeader_('筆名')]]) row[1] = safeCell_(src[db.hm[normHeader_('筆名')]]);
      ['創作者類型'].concat(SNS_COLS).forEach(function (h) { var ec = W(h), dc = db.hm[normHeader_(h)]; if (ec !== undefined && dc !== undefined && src[dc] && arrayCols.indexOf(ec) < 0 && perRow.indexOf(ec) < 0) row[ec] = safeCell_(src[dc]); });
      prefilled++;
    }
    grid.push(row);
    var how = id ? '匯入：同名（主資料庫）' : (hits.length ? '匯入：同名多攤主，需確認' : '');
    if (!id && !hits.length) { var li = Object.keys(logName[normName_(b.name)] || {}); if (li.length === 1) { id = li[0]; how = '匯入：同名（出展紀錄）'; } else how = li.length ? '匯入：同名多攤主，需確認' : '匯入：新攤主'; }
    if (!id) id = nextOwnerId_();
    logRows.push(['E' + ('0000' + (seq++)).slice(-5), opts.code, opts.name, opts.start || '', b.name, b.d1.join(',') + (b.d2.length ? ' / ' + b.d2.join(',') : ''), id, how, id && hits.length ? 'single' : 'new', '', '主辦攤位名單匯入', '', '', '']);
  });
  // 只寫非公式欄：以連續區塊寫入，避免覆蓋 BYROW/MAP 等陣列公式
  var blocks = [], start = -1;
  for (var k = 0; k <= lastCol; k++) { var writable = k < lastCol && arrayCols.indexOf(k) < 0 && perRow.indexOf(k) < 0; if (writable && start < 0) start = k; if (!writable && start >= 0) { blocks.push([start, k - 1]); start = -1; } }
  blocks.forEach(function (bk) { var vals = grid.map(function (r) { return r.slice(bk[0], bk[1] + 1).map(function (x) { return x === null ? '' : x; }); }); sh.getRange(2, bk[0] + 1, n, bk[1] - bk[0] + 1).setValues(vals); });
  perRow.forEach(function (c) { var fr = f2[c]; if (opts.thumbSheetUrl && /IMPORTRANGE\("https:\/\/docs\.google\.com\/spreadsheets\/d\/[^"]+"/.test(fr)) fr = fr.replace(/IMPORTRANGE\("https:\/\/docs\.google\.com\/spreadsheets\/d\/[^"]+"/, 'IMPORTRANGE("' + opts.thumbSheetUrl + '"'); sh.getRange(2, c + 1, n, 1).setFormulaR1C1(fr); });
  // 其他分頁：場次代碼、倒數時間、清空互動區
  if (tplCode) f.getSheets().forEach(function (s) { var t = s.getName(); if (t.indexOf(tplCode) >= 0) s.setName(t.split(tplCode).join(opts.code));
    if (s.getName().indexOf('操作手冊') >= 0) { s.createTextFinder(tplCode).matchEntireCell(false).replaceAllWith(opts.code);
      var cd = s.createTextFinder('距離開場').findNext(); if (cd && opts.start) cd.offset(0, 1).setValue(new Date(opts.start + 'T10:00:00+08:00')); } });
  ['印量調查區', '交流區', '攤位消失攤'].forEach(function (t) { var s = f.getSheetByName(t); if (s && s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).clearContent(); });
  if (logRows.length) lg.sheet.getRange(lg.sheet.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
  var list = activeEvents_().filter(function (e) { return e.code !== opts.code; });
  list.push({ code: opts.code, name: opts.name, start: opts.start || '', sheetId: f.getId(), tab: sh.getName(), status: '整理中', created: now_() }); setActiveEvents_(list);
  return { url: f.getUrl(), booths: n, prefilled: prefilled, newOwners: logRows.filter(function (r) { return r[7] === '匯入：新攤主'; }).length, cols: parsed.cols };
}
function menuImport() {
  var q = function (t, d) { var a = ui_().prompt('匯入新場次（1/5）'.replace('1', t[0]), t[1] + (d ? '\n預設：' + d : ''), ui_().ButtonSet.OK_CANCEL); if (a.getSelectedButton() !== ui_().Button.OK) throw new Error('已取消'); return a.getResponseText().trim() || d || ''; };
  try {
    var code = q(['1', '場次代碼（例 FF48）'], ''), name = q(['2', '場次全名'], code), start = q(['3', '開場日期 YYYY-MM-DD'], '');
    var src = sheetIdFromUrl_(q(['4', '主辦方攤位名單的試算表網址（xlsx/csv 請先上傳到雲端硬碟並用 Google 試算表開啟）'], ''));
    var last = activeEvents_().slice(-1)[0], tpl = sheetIdFromUrl_(q(['5', '範本整理表網址（沿用其格式）'], last ? 'https://docs.google.com/spreadsheets/d/' + last.sheetId : ''));
    if (!code || !src || !tpl) throw new Error('資料不完整');
    var dry = importEvent_({ code: code, name: name, start: start, srcId: src, templateId: tpl, prefill: true, dryRun: true });
    var ok = ui_().alert('確認匯入', '讀到 ' + dry.booths + ' 個攤位，其中 ' + dry.matched + ' 個在主資料庫有同名資料（會預先帶入 SNS）。\n前 5 筆：' + dry.sample.map(function (b) { return b.name + '(' + b.d1.join(',') + '/' + b.d2.join(',') + ')'; }).join('、') + '\n\n將複製範本建立「' + code + ' 完整攤位整理」，並登記為整理中場次。繼續？', ui_().ButtonSet.YES_NO);
    if (ok !== ui_().Button.YES) return;
    var r = importEvent_({ code: code, name: name, start: start, srcId: src, templateId: tpl, prefill: true });
    ui_().alert('完成：' + r.booths + ' 攤（預先帶入 ' + r.prefilled + '，新攤主 ' + r.newOwners + '）\n' + r.url + '\n\n請檢查：①操作手冊文字 ②整理進度分頁的 IMPORTRANGE 來源 ③是否有縮圖欄的縮圖試算表網址。');
  } catch (e) { if (String(e.message) !== '已取消') ui_().alert('匯入失敗：' + e.message); }
}

/* ============================== 場次整理表併入主資料庫 ============================== */
/** policy: event_wins（預設，與 PF45 決策一致）或 db_wins（衝突只記錄待審核）。所有變更記在「修改申請」（類型：場次併入，可復原）。 */
function mergeEventToDb_(code, policy) {
  var ev = findEvent_(code); if (!ev) throw new Error('非整理中場次');
  var E = readEvent_(ev), db = readDb_(), lg = readLog_(), C = lg.C, idOf = {}, stats = { filled: 0, conflicts: 0, appended: 0 };
  lg.rows.forEach(function (r) { if (r[C.ev] === code) idOf[normName_(r[C.name])] = r[C.id]; });
  var fields = ['筆名', '創作者類型'].concat(SNS_COLS), edits = sheet_(SH.EDIT), batch = newId_('MG'), logs = [];
  E.rows.forEach(function (r) {
    var name = str_(r[0]).trim(); if (!name) return; var id = idOf[normName_(name)] || '', target = -1;
    db.rows.forEach(function (d, i) { if (normName_(d[db.nc]) === normName_(name) && (!id || d[db.idc] === id)) target = i; });
    if (target < 0) {
      var row = db.hdr.map(function (h) { var ec = E.hm[normHeader_(h)]; return h === DB_NAME_HEADER ? name : (h === DB_ID_HEADER ? (id || nextOwnerId_()) : (ec !== undefined && fields.indexOf(h) >= 0 ? str_(r[ec]) : '')); });
      db.sheet.appendRow(row.map(safeCell_)); stats.appended++;
      logs.push([newId_('MG'), now_(), '場次併入', row[db.idc], SH.DB, safeCell_(name), '（新增整列）', '', '', '站長', 0, code + ' 新攤位', '已套用', now_(), '', SH.DB + '!A' + db.sheet.getLastRow(), '', now_(), batch]);
      return;
    }
    fields.forEach(function (h) {
      var ec = E.hm[normHeader_(h)], dc = db.hm[normHeader_(h)]; if (ec === undefined || dc === undefined) return;
      var nv = str_(r[ec]).trim(), ov = str_(db.rows[target][dc]).trim(); if (!nv || nv === ov) return;
      var where = SH.DB + '!' + colLetter_(dc) + (target + 2);
      if (!ov || policy !== 'db_wins') { db.sheet.getRange(target + 2, dc + 1).setValue(safeCell_(nv)); ov ? stats.conflicts++ : stats.filled++;
        logs.push([newId_('MG'), now_(), '場次併入', db.rows[target][db.idc], SH.DB, safeCell_(db.rows[target][db.nc]), h, safeCell_(ov), safeCell_(nv), '站長', ov ? 15 : 0, code + (ov ? ' 衝突：場次值覆寫' : ' 補空白'), '已套用', now_(), '', where, safeCell_(ov), now_(), batch]); }
      else { stats.conflicts++; logs.push([newId_('MG'), now_(), '主資料修改', db.rows[target][db.idc], SH.DB, safeCell_(db.rows[target][db.nc]), h, safeCell_(ov), safeCell_(nv), '站長', 15, code + ' 衝突：保留主資料，待審核', '待審核', '', '', '', '', '', batch]); }
    });
  });
  if (logs.length) edits.getRange(edits.getLastRow() + 1, 1, logs.length, 19).setValues(logs);
  bumpVersion_(); return stats;
}
function menuMerge() {
  var a = ui_().prompt('場次整理表 → 新攤位資料庫', '輸入場次代碼（例 FFK19）。衝突預設「場次值為準」（與 PF45 相同）；若要保留主資料請輸入「FFK19 db」。', ui_().ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui_().Button.OK) return; var p = a.getResponseText().trim().split(/\s+/);
  var ok = ui_().alert('確認', '將把 ' + p[0] + ' 整理表資料併入「新攤位資料庫」，所有變更會記錄在「修改申請」（批次可復原）。建議先備份。繼續？', ui_().ButtonSet.YES_NO); if (ok !== ui_().Button.YES) return;
  var s = mergeEventToDb_(p[0], p[1] === 'db' ? 'db_wins' : 'event_wins'); ui_().alert('完成：補空白 ' + s.filled + '、衝突 ' + s.conflicts + '、新增列 ' + s.appended);
}

/* ============================== 自我檢查（不寫入） ============================== */
function selfTest_() {
  var out = [], t = function (name, cond) { out.push((cond ? '✅ ' : '❌ ') + name); };
  t('HMAC_SECRET 已設定', !!prop_('HMAC_SECRET', '')); t('OAUTH_CLIENT_ID 已設定', !!prop_('OAUTH_CLIENT_ID', ''));
  try { var db = readDb_(); t('新攤位資料庫有攤主ID欄（' + db.rows.length + ' 列）', db.idc !== undefined); } catch (e) { t('新攤位資料庫：' + e.message, false); }
  [SH.LOG, SH.CLAIM, SH.EDIT].forEach(function (n) { t('工作表存在：' + n, !!ss_().getSheetByName(n)); });
  t('縮網址被拒', !validateField_('IG', 'https://bit.ly/abc', '').ok); t('javascript: 被拒', !validateField_('官方網站', 'javascript:alert(1)', '').ok);
  t('IG 欄位只收 instagram', !validateField_('IG', 'https://evil.example/x', '').ok); t('追蹤參數移除', validateField_('IG', 'https://www.instagram.com/abc/?igsh=xyz', '').value === 'https://www.instagram.com/abc/');
  t('取代身分欄位＝敏感', !!validateField_('TWITTER (1)', 'https://x.com/b', 'https://x.com/a').sensitive); t('公式注入防護', safeCell_('=IMPORTXML("x")').charAt(0) === "'");
  t('Drive ID 擷取', driveId_('https://drive.google.com/file/d/1CIfg3f9rdhtmuVLoYaPfCk2gkbBRLy2f/view?usp=drive_link') === '1CIfg3f9rdhtmuVLoYaPfCk2gkbBRLy2f');
  activeEvents_().forEach(function (ev) { try { var E = readEvent_(ev); t('整理中場次 ' + ev.code + '：' + E.rows.length + ' 列，可填欄位 ' + E.hdr.filter(function (h) { return h && !isLockedHeader_(h, false); }).length, true); } catch (e) { t('整理中場次 ' + ev.code + '：' + e.message, false); } });
  return out;
}
function menuSelfTest() { ui_().alert(selfTest_().join('\n')); }
