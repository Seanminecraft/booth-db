// 以 Node 執行 apps-script/code.gs 的端到端測試（模擬試算表，不連網）。
// 用法：node tests/run-tests.js [fixtures 目錄]；fixtures 由維護者自備（不放進 repo，見 docs/ENGINEERING.md §測試）。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeEnv } = require('./gas-mock');
const FX = process.argv[2] || process.env.FIXTURES || path.join(__dirname, '../../test-fixtures');
const load = f => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf8'));
const CLIENT = 'test-client.apps.googleusercontent.com';
const PUBLIC = new Set(['1CIfg3f9rdhtmuVLoYaPfCk2gkbBRLy2f', '1mEL2wHUA6DYY1GQrpaQ9iJucnOwfSf2J']);
const fetchLog = [];
function fetch(url, o) {
  fetchLog.push(url);
  const resp = (code, body, headers) => ({ getResponseCode: () => code, getContentText: () => body || '', getHeaders: () => headers || {} });
  if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
    const tok = decodeURIComponent(url.split('id_token=')[1]); const m = tok.match(/^fake:(.+)$/); if (!m) return resp(400, '{}');
    return resp(200, JSON.stringify({ aud: CLIENT, iss: 'https://accounts.google.com', sub: m[1], exp: String(Math.floor(Date.now() / 1000) + 3600), email: 'someone@example.com', name: 'Real Name' }));
  }
  if (url.startsWith('https://lh3.googleusercontent.com/d/')) { const id = decodeURIComponent(url.split('/d/')[1].split('=')[0]); return PUBLIC.has(id) ? resp(200, '', { 'Content-Type': 'image/jpeg' }) : resp(302, '', { Location: 'https://accounts.google.com/ServiceLogin?continue=x' }); }
  if (url.startsWith('https://safebrowsing.googleapis.com/')) { const body = JSON.parse(o.payload); const bad = body.threatInfo.threatEntries.filter(e => /malware-test/.test(e.url));
    return resp(200, JSON.stringify(bad.length ? { matches: bad.map(e => ({ threat: { url: e.url }, threatType: 'MALWARE' })) } : {})); }
  return resp(404, '');
}
const env = makeEnv({ props: { HMAC_SECRET: 'x'.repeat(16) + 'test-secret-not-real-0123456789abcdef', OAUTH_CLIENT_ID: CLIENT, SAFE_BROWSING_API_KEY: 'test' }, fetch });
// ---- fixtures ----
const DB_ID = '1nwZIqcrSz-vVJidCFJLmvDPNZvg7n-NVwnsdRmDFRao', FFK = 'FFK19_TEST_COPY';
const ffk = load('fixture_ffk19.json');
const ffkF = {}; ['={ "有無資料"; BYROW(S2:AM, LAMBDA(currRow, COUNTA(currRow)>0)) }', '={ "有無販售資訊"; BYROW(H2:L, LAMBDA(currRow,COUNTA(currRow)>0)) }', '={"有無預告";MAP(AN2:AN, LAMBDA(cell, ISTEXT(cell)))}', '={"有無品書";MAP(AO2:AO, LAMBDA(cell, ISTEXT(cell)))}'].forEach((f, i) => { ffkF['1:' + (13 + i)] = f; });
for (let r = 2; r <= ffk.length; r++) ffkF[r + ':44'] = '=IF(IFERROR(VLOOKUP(R[0]C[-43], IMPORTRANGE("https://docs.google.com/spreadsheets/d/1fJHhonBqzvdwiW4x82KaBaK_wvGbXgp7Oh7JOlgQV7Y", "工作表1!A:B"), 2, FALSE), "") <> "", "有縮圖", "無縮圖")';
env.addFile(DB_ID, '攤位資料庫', [['新攤位資料庫', load('fixture_db.json')], ['場次出展紀錄', load('fixture_log.json')],
  ['認領申請', [['申請ID', '申請時間', '攤主ID', '攤位名稱', '申請者代號', '驗證方式', '驗證連結', '驗證碼', '說明', '狀態', '審核時間', '審核備註', '角色', '最後活動']]],
  ['修改申請', [['申請ID', '申請時間', '類型', '攤主ID', '目標', '目標鍵', '欄位', '舊值', '新值', '申請者代號', '風險', '風險說明', '狀態', '審核時間', '審核備註', '套用位置', '套用前值', '套用時間', '批次ID']]]]);
env.addFile(FFK, 'FFK19 完整攤位整理', [['FFK19 攤位整理表單操作手冊', [['', 'FFK19 攤位整理表單  使用說明'], [], ['', '', '', '', '', '', '', '', '距離開場', '46361.4375']]], ['攤位整理表 請在此填寫資訊', ffk, ffkF], ['印量調查區', [['a'], ['x']]], ['交流區', [['b'], ['y']]], ['攤位消失攤', [['c'], ['z']]]]);
env.setActive(DB_ID);
const ctx = vm.createContext(env); vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/code.gs'), 'utf8'), ctx, { filename: 'code.gs' });
const G = ctx;
// ---- helpers ----
let pass = 0, fail = 0; const results = [];
function ok(name, cond, extra) { (cond ? pass++ : fail++); results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); }
const post = b => JSON.parse(G.doPost({ postData: { contents: JSON.stringify(b) } }).getContent());
const get = p => JSON.parse(G.doGet({ parameter: p }).getContent());
const sheet = (f, n) => env.files[f].getSheetByName(n);
const edits = () => sheet(DB_ID, '修改申請').data.slice(1).filter(r => r[0]);
const claims = () => sheet(DB_ID, '認領申請').data.slice(1).filter(r => r[0]);
function approveClaimRow(i) { const sh = sheet(DB_ID, '認領申請'); sh.data[i + 1][9] = '核准'; }
function setStatus(row, st, note) { const sh = sheet(DB_ID, '修改申請'); sh.data[row - 1][12] = st; if (note) sh.data[row - 1][14] = note; G.onEdit({ range: sh.getRange(row, 13) }); }
function rowOf(id) { return edits().findIndex(r => r[0] === id) + 2; }

// ===== 1. 公開讀取 API =====
G.setActiveEvents_([{ code: 'FFK19', name: 'FFK19', start: '2026-12-19', sheetId: FFK, tab: '攤位整理表 請在此填寫資訊', status: '整理中' }]);
const idx = get({ action: 'index' });
ok('index 回傳成功', idx.ok, idx.error);
const owners = idx.data.owners; const idxSize = JSON.stringify(idx).length;
ok('index 含所有攤主（DB+場次紀錄）', owners.length > 6000, owners.length + ' 位，' + (idxSize / 1024).toFixed(0) + ' KB');
const nonPublicIds = new Set(load('fixture_log.json').slice(1).filter(r => r[12] && r[12] !== '公開').map(r => r[11]).filter(Boolean));
ok('index 不含未公開／僅檔名縮圖', owners.every(o => !o[5] || !nonPublicIds.has(o[5])), nonPublicIds.size + ' 個隱藏的縮圖 ID');
const t0 = Date.now(); get({ action: 'index' }); ok('第二次讀取走快取', Date.now() - t0 < 400, (Date.now() - t0) + ' ms');
const rabbit = owners.find(o => o[2].includes('Rabbit Candy'));
const det = get({ action: 'owner', id: rabbit[0] });
ok('owner 詳細資料', det.ok && det.data.dbRows.length >= 1 && det.data.history.length >= 1, rabbit[0] + '：DB ' + det.data.dbRows.length + ' 列、出展 ' + det.data.history.length + ' 筆');
ok('owner id 格式檢查', get({ action: 'owner', id: '../x' }).ok === false);

// ===== 2. 登入（只存雜湊） =====
const L = post({ action: 'login', idToken: 'fake:1234567890-sub-A' });
ok('Google 登入換取 session', L.ok && !!L.session, L.error);
const uid = G.readSession_(L.session);
ok('uid 為 HMAC 雜湊（不含 sub）', /^u_[A-Za-z0-9_-]{22}$/.test(uid) && !uid.includes('1234567890'));
ok('偽造 token 被拒', post({ action: 'login', idToken: 'bogus' }).ok === false);
ok('竄改 session 被拒', post({ action: 'me', session: L.session.slice(0, -2) + 'xx' }).ok === false);

// ===== 3. 認領 → 核准 =====
const ownerId = '' + rabbit[0];
let c = post({ action: 'claim', session: L.session, ownerId, method: 'sns', proofUrl: 'https://www.facebook.com/usagicandy2019/posts/123', note: '本人' });
ok('提出認領（待審核＋驗證碼）', c.ok && c.data.status === '待審核' && /^JP-[A-Z0-9]{6}$/.test(c.data.code), JSON.stringify(c.data || c.error));
ok('未核准前不能修改', post({ action: 'edit', session: L.session, ownerId, rowName: 'Rabbit Candy', changes: { IG: 'https://www.instagram.com/rabbitcandy/' } }).ok === false);
approveClaimRow(0);
const me = post({ action: 'me', session: L.session });
ok('站長核准後成為管理者', me.ok && me.me.owned.includes(ownerId));

// ===== 4. 主資料修改 → 審核 → 套用 → 復原 =====
const dbRowName = det.data.dbRows[0].fields['攤位名稱'];
let e1 = post({ action: 'edit', session: L.session, ownerId, rowName: dbRowName, changes: { Fanbox: 'https://rabbitcandy.fanbox.cc/?utm_source=x', '其他連結': 'https://www.threads.net/@rabbitcandy' } });
ok('提出修改（逐欄進入修改申請）', e1.ok && e1.data.queued === 2, JSON.stringify(e1.data || e1.error));
const fanboxRow = edits().findIndex(r => r[6] === 'Fanbox') + 2;
ok('追蹤參數已移除', sheet(DB_ID, '修改申請').data[fanboxRow - 1][8] === 'https://rabbitcandy.fanbox.cc/');
const dbSh = sheet(DB_ID, '新攤位資料庫'), hdr = dbSh.data[0], fbCol = hdr.indexOf('Fanbox');
const dbr = dbSh.data.findIndex(r => r[25] === ownerId && r[0] === dbRowName);
const beforeVal = dbSh.data[dbr][fbCol] || '';
ok('審核前主資料未變', (dbSh.data[dbr][fbCol] || '') === beforeVal);
setStatus(fanboxRow, '核准');
ok('改成「核准」→ onEdit 立即寫入新攤位資料庫', dbSh.data[dbr][fbCol] === 'https://rabbitcandy.fanbox.cc/', 'row ' + (dbr + 1));
const er = sheet(DB_ID, '修改申請').data[fanboxRow - 1];
ok('記錄套用位置與套用前值', er[12] === '已套用' && er[15] === '新攤位資料庫!' + G.colLetter_(fbCol) + (dbr + 1), er[15]);
const v1 = get({ action: 'index' }).data.v; ok('套用後網站資料版本更新', v1 !== idx.data.v);
setStatus(fanboxRow, '復原');
ok('一鍵復原（狀態改「復原」）', (dbSh.data[dbr][fbCol] || '') === beforeVal && sheet(DB_ID, '修改申請').data[fanboxRow - 1][12] === '已復原');

// ===== 5. 防惡作劇 =====
const bad = (ch, why) => { const r = post({ action: 'edit', session: L.session, ownerId, rowName: dbRowName, changes: ch }); ok('拒絕：' + why, r.ok === false, r.error); };
bad({ IG: 'https://bit.ly/3abc' }, '縮網址');
bad({ IG: 'https://evil.example.com/rabbit' }, 'IG 欄位非 instagram 網域');
bad({ '官方網站': 'javascript:alert(1)' }, 'javascript: 連結');
bad({ '官方網站': 'https://user:pw@example.com/' }, '網址含帳密');
bad({ '官方網站': 'http://192.168.0.1/login' }, 'IP 網址');
bad({ '其他連結': 'https://malware-test.example.com/x' }, 'Safe Browsing 判定危險');
bad({ '筆名': '<script>alert(1)</script>' }, 'HTML 標籤');
bad({ '攤主ID': 'C99999' }, '不可修改的欄位');
const mailsBefore = env.mails.length;
const e2 = post({ action: 'edit', session: L.session, ownerId, rowName: dbRowName, changes: { 'TWITTER (1)': 'https://x.com/someone_else', '官方網站': 'https://totally-unknown-shop.example/' } });
ok('取代身分欄位＋陌生網域 → 高風險待審核', e2.ok && e2.data.queued === 2);
const twRow = edits().findIndex(r => r[6] === 'TWITTER (1)' && r[12] === '待審核') + 2;
ok('可疑修改寄通知信給站長', env.mails.slice(mailsBefore).some(m => /可疑修改/.test(m.subj)), env.mails.slice(-1)[0] && env.mails.slice(-1)[0].subj);
const twCol = hdr.indexOf('TWITTER (1)'), twBefore = dbSh.data[dbr][twCol];
setStatus(twRow, '核准');
ok('敏感欄位未二次驗證 → 不套用（需人工）', dbSh.data[dbr][twCol] === twBefore && sheet(DB_ID, '修改申請').data[twRow - 1][12] === '需人工');
const msg = G.reviewDecide(twRow, 'approve2', '已用原 FB 帳號私訊確認');
ok('二次驗證後核准 → 套用', /^已套用/.test(msg) && dbSh.data[dbr][twCol] === 'https://x.com/someone_else', msg);
// 公式注入
post({ action: 'edit', session: L.session, ownerId, rowName: dbRowName, changes: { '筆名': '=IMPORTXML("https://evil.example","//a")' } });
const pnRow = edits().findIndex(r => r[6] === '筆名') + 2; setStatus(pnRow, '核准');
ok('公式注入被轉為純文字', String(dbSh.data[dbr][hdr.indexOf('筆名')]).startsWith("'="));
// 審核畫面（HTML 逸出）
G.menuReview(); ok('審核畫面可渲染', true);
const item = G.reviewItem_(2, ['id', 't', '主資料修改', ownerId, '新攤位資料庫', 'k', 'IG', '', 'https://www.instagram.com/<img src=x onerror=alert(1)>', 'u', 0, '', '待審核', '', '', '', '', '', '']);
const tpl = env.HtmlService.createTemplate(G.REVIEW_HTML); tpl.items = [item]; tpl.mode = 'queue'; tpl.evaluate();
ok('審核畫面把惡意字串逸出', !tpl.html.includes('<img src=x') && tpl.html.includes('&lt;img'));

// ===== 6. 一鍵復原某攤主＋停權 =====
env.ui.prompts.push(ownerId + ' 72'); G.menuRevertOwner();
ok('一鍵復原某攤主近期所有修改', dbSh.data[dbr][twCol] === twBefore, env.ui.alerts.slice(-1)[0]);
env.ui.prompts.push(uid); G.menuSuspend();
ok('停權後無法再修改', post({ action: 'edit', session: L.session, ownerId, rowName: dbRowName, changes: { IG: 'https://www.instagram.com/x/' } }).ok === false);
env.ui.prompts.push('+' + uid); G.menuSuspend();
ok('恢復後可再修改', post({ action: 'edit', session: L.session, ownerId, rowName: dbRowName, changes: { IG: 'https://www.instagram.com/rabbitcandy/' } }).ok);
env.ui.prompts.push(ownerId); G.menuSuspend();
const L2 = post({ action: 'login', idToken: 'fake:other-person-B' }); post({ action: 'claim', session: L2.session, ownerId });
ok('攤主鎖定後他人也無法認領', claims().filter(r => r[4] === G.readSession_(L2.session)).length === 0);
env.ui.prompts.push('+' + ownerId); G.menuSuspend();

// ===== 7. 頻率限制 =====
let limited = false; for (let i = 0; i < 25; i++) { const r = post({ action: 'edit', session: L.session, ownerId, rowName: dbRowName, changes: { '其他連結': 'https://www.threads.net/@r' + i } }); if (!r.ok && /頻繁/.test(r.error)) { limited = true; break; } }
ok('頻率限制（每日修改上限）', limited);
ok('頻率限制觸發通知', env.mails.some(m => /頻率限制/.test(m.subj)));

// ===== 8. 場次整理表填寫（FFK19 測試副本）=====
const evSh = sheet(FFK, '攤位整理表 請在此填寫資訊');
const log = sheet(DB_ID, '場次出展紀錄').data;
const pick = ['魷魚祁聯盟', '心桃魅夢', '電玩狂熱份子'].map(n => { const lr = log.find(r => r[1] === 'FFK19' && r[4] === n); const er = evSh.data.findIndex(r => r[0] === n); return { name: n, id: lr && lr[6], row: er + 1, booth: evSh.data[er][2] }; });
ok('測試攤位都在 FFK19 出展紀錄', pick.every(p => p.id && p.row > 1), pick.map(p => p.name + '=' + p.id + '@列' + p.row).join('、'));
const L3 = post({ action: 'login', idToken: 'fake:ffk-owner-C' }), uid3 = G.readSession_(L3.session);
pick.forEach(p => post({ action: 'claim', session: L3.session, ownerId: p.id, method: 'dm' }));
claims().forEach((r, i) => { if (r[4] === uid3) approveClaimRow(i); });
const evData = get({ action: 'event', code: 'FFK19' });
ok('event API 回傳整理表', evData.ok && evData.data.booths.length >= 630, evData.ok ? evData.data.booths.length + ' 攤' : evData.error);
ok('event API 不回傳非公開縮圖', evData.data.booths.filter(b => b.thumb).every(b => PUBLIC.has(b.thumb)));
const fills = [
  { p: pick[0], changes: { '販售資訊': '【FFK19 測試】緣結：吊飾、飯友；秋月祁：立牌', '預告': 'https://x.com/test_account/status/1111111111111111111' } },
  { p: pick[1], changes: { '商品年齡分類': '一般', '試閱': 'https://www.pixiv.net/artworks/123456789' } },
  { p: pick[2], changes: { '創作者類型': '繪師', '販售資訊': '=HYPERLINK("https://evil.example","點我")' } }];
const evWritesStart = env.writes.length;
fills.forEach(f => { const r = post({ action: 'eventfill', session: L3.session, ownerId: f.p.id, event: 'FFK19', booth: f.p.name, changes: f.changes }); ok('審核制：' + f.p.name + ' 填寫進入待審核', r.ok && r.data.queued === Object.keys(f.changes).length && r.data.applied === 0, JSON.stringify(r.data || r.error)); });
ok('審核前整理表未被寫入', env.writes.slice(evWritesStart).every(w => w.file !== FFK));
ok('不可填寫鎖定欄位（攤位編號）', post({ action: 'eventfill', session: L3.session, ownerId: pick[0].id, event: 'FFK19', booth: pick[0].name, changes: { '第一天': 'A01' } }).ok === false);
ok('不可填寫別人的攤位', post({ action: 'eventfill', session: L3.session, ownerId: pick[0].id, event: 'FFK19', booth: 'ZLing讀做Z0的魔法研究室', changes: { '販售資訊': 'x' } }).ok === false);
edits().forEach((r, i) => { if (r[2] === '場次填寫' && r[12] === '待審核') sheet(DB_ID, '修改申請').data[i + 1][12] = '核准'; });
G.menuApplyApproved();
const evWrites = env.writes.slice(evWritesStart).filter(w => w.file === FFK);
const H = evSh.data[0];
const expect = []; fills.forEach(f => Object.keys(f.changes).forEach(k => { const col = H.indexOf(k); expect.push({ a1: G.colLetter_(col) + f.p.row, booth: f.p.name, field: k, value: k === '販售資訊' && /^=/.test(f.changes[k]) ? "'" + f.changes[k] : f.changes[k] }); }));
ok('套用後寫入正確的格子（列＝攤位、欄＝欄位標題）', expect.every(x => evWrites.some(w => w.a1 === x.a1 && w.value === x.value)), expect.map(x => x.a1).join(' '));
ok('只寫入預期的格子', evWrites.length === expect.length, evWrites.length + ' 次寫入');
fs.writeFileSync(path.join(__dirname, 'ffk19_expected_writes.json'), JSON.stringify(expect, null, 1));
// 即時制
G.setProp_('EVENT_FILL_MODE', 'live');
const lv = post({ action: 'eventfill', session: L3.session, ownerId: pick[1].id, event: 'FFK19', booth: pick[1].name, changes: { '品書': 'https://x.com/MionKokomo/status/2222222222222222222', '官方網站': 'https://unknown-new-site.example/' } });
ok('即時制：低風險立即寫入、高風險仍待審核', lv.ok && lv.data.applied === 1 && lv.data.queued === 1, JSON.stringify(lv.data || lv.error));
const pinRow = edits().findIndex(r => r[6] === '品書' && r[12] === '已套用') + 2;
G.revertRow_(pinRow, true); ok('即時制寫入可復原', (evSh.data[pick[1].row - 1][H.indexOf('品書')] || '') === '');
G.setProp_('EVENT_FILL_MODE', 'queue');
// 同名多列
const dupId = (log.find(r => r[1] === 'FFK19' && r[4] === '神之熾火') || [])[6];
if (dupId) { const L4 = post({ action: 'login', idToken: 'fake:dup-owner-D' }), uid4 = G.readSession_(L4.session); post({ action: 'claim', session: L4.session, ownerId: dupId }); claims().forEach((r, i) => { if (r[4] === uid4) approveClaimRow(i); });
  const d = post({ action: 'eventfill', session: L4.session, ownerId: dupId, event: 'FFK19', booth: '神之熾火', changes: { '販售資訊': 'x' } });
  ok('整理表同名多列 → 拒絕自動寫入', d.ok === false && /多列/.test(d.error), d.error); }
// 縮圖
const th1 = post({ action: 'checkThumb', session: L3.session, url: 'https://drive.google.com/open?id=1CIfg3f9rdhtmuVLoYaPfCk2gkbBRLy2f' });
const th2 = post({ action: 'checkThumb', session: L3.session, url: 'https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/view' });
ok('縮圖檢查：公開／未公開', th1.status === 'PUBLIC' && th2.status === 'NOT_PUBLIC');
ok('場次縮圖：未公開連結被拒', post({ action: 'eventfill', session: L3.session, ownerId: pick[0].id, event: 'FFK19', booth: pick[0].name, changes: { '縮圖[請備註]': 'https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/view' } }).ok === false);

// ===== 9. 匯入新場次（以 FFK19 測試副本為範本，模擬 FF48 主辦名單）=====
const org = [['FF48 攤位名單（主辦公告）'], ['攤位編號', '社團名稱', '參加日期', '作者'], ['A01', '魷魚祁聯盟', '兩天', ''], ['A02', '心桃魅夢', '第一天', 'Mion'], ['B10', '全新的測試社團', '第二天', '新人'], ['A03', '魷魚祁聯盟', '兩天', ''], ['C05', '=惡意公式社團', '兩天', '']];
env.addFile('ORG_FF48', 'FF48 名單', [['工作表1', org]]);
const dry = G.importEvent_({ code: 'FF48', name: 'Fancy Frontier 48', start: '2027-02-06', srcId: 'ORG_FF48', templateId: FFK, prefill: true, dryRun: true });
ok('名單解析（合併同名、依編號排序、日別）', dry.booths === 4 && dry.sample[0].name === '魷魚祁聯盟' && dry.sample[0].d1.join(',') === 'A01,A03' && dry.sample[0].d2.join(',') === 'A01,A03', JSON.stringify(dry.sample.map(b => [b.name, b.d1.join(','), b.d2.join(',')])));
const imp = G.importEvent_({ code: 'FF48', name: 'Fancy Frontier 48', start: '2027-02-06', srcId: 'ORG_FF48', templateId: FFK, prefill: true });
const nf = Object.values(env.files).find(f => f.name === 'FF48 完整攤位整理');
const ns = nf.getSheetByName('攤位整理表 請在此填寫資訊');
ok('建立 FF48 整理表（沿用範本格式）', !!ns && JSON.stringify(ns.data[0]) === JSON.stringify(ffk[0]), imp.booths + ' 攤，預先帶入 ' + imp.prefilled + '，新攤主 ' + imp.newOwners);
ok('陣列公式欄保留、每列公式重建', ns.formulas['1:13'] && ns.formulas['2:44'] && ns.formulas['5:44'] && !ns.formulas['6:44']);
ok('資料列＝名單攤位數（舊資料已清除）', ns.getLastRow() === 5 && ns.data[1][0] === '魷魚祁聯盟' && ns.data[1][2] === 'A01,A03');
ok('預先帶入主資料庫 SNS', imp.prefilled >= 1 && ns.data.slice(1).some(r => r.slice(18, 39).some(Boolean)));
ok('惡意名稱轉純文字', ns.data.slice(1).some(r => r[0] === "'=惡意公式社團"));
ok('分頁名稱／操作手冊代碼更新', !!nf.getSheetByName('FF48 攤位整理表單操作手冊') && nf.getSheetByName('FF48 攤位整理表單操作手冊').data[0][1].includes('FF48'));
ok('登記為整理中場次', G.activeEvents_().some(e => e.code === 'FF48' && e.sheetId === nf.id));
const ff48log = sheet(DB_ID, '場次出展紀錄').data.filter(r => r[1] === 'FF48');
ok('寫入場次出展紀錄（沿用既有攤主ID）', ff48log.length === 4 && ff48log.find(r => r[4] === '魷魚祁聯盟')[6] === pick[0].id && ff48log.find(r => r[4] === '心桃魅夢')[6] === 'C00968', ff48log.map(r => r[4] + '→' + r[6] + '（' + r[7] + '）').join('、'));
ok('網站可讀到 FF48', get({ action: 'event', code: 'FF48' }).data.booths.length === 4);

// ===== 10. 場次併入主資料庫 =====
const before = sheet(DB_ID, '新攤位資料庫').getLastRow();
const mg = G.mergeEventToDb_('FF48', 'event_wins');
ok('場次 → 主資料庫併入（新攤主新增列、全部記錄可復原）', mg.appended >= 1 && sheet(DB_ID, '新攤位資料庫').getLastRow() === before + mg.appended, JSON.stringify(mg));

// ===== 11. 隱私：撤回 =====
const n = post({ action: 'withdraw', session: L3.session });
ok('使用者撤回 → 申請者代號清除', n.ok && n.done > 0 && !JSON.stringify(sheet(DB_ID, '認領申請').data).includes(uid3) && !JSON.stringify(sheet(DB_ID, '修改申請').data).includes(uid3), n.done + ' 格');
const all = JSON.stringify(Object.values(env.files).map(f => f.sheets.map(s => s.data)));
ok('任何工作表都沒有 email／姓名／sub', !all.includes('someone@example.com') && !all.includes('Real Name') && !all.includes('1234567890-sub-A'));
ok('自我檢查全部通過', G.selfTest_().every(l => l.startsWith('✅')), G.selfTest_().filter(l => !l.startsWith('✅')).join(' '));

console.log(results.join('\n')); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
