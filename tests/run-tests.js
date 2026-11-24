// 以 Node 執行 apps-script/code.gs 的端到端測試（模擬試算表，不連網）。
// 用法：node tests/run-tests.js [fixtures 目錄]；fixtures 由維護者自備（不放進 repo，見 docs/ENGINEERING.md §測試）。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeEnv } = require('./gas-mock');
const { fakeJwt, readFake } = require('./fake-jwt');
const FX = process.argv[2] || process.env.FIXTURES || path.join(__dirname, '../../test-fixtures');
const load = f => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf8'));
const CLIENT = 'test-client.apps.googleusercontent.com';
const PUBLIC = new Set(['1CIfg3f9rdhtmuVLoYaPfCk2gkbBRLy2f', '1mEL2wHUA6DYY1GQrpaQ9iJucnOwfSf2J']);
const fetchLog = [];
function fetch(url, o) {
  fetchLog.push(url);
  const resp = (code, body, headers) => ({ getResponseCode: () => code, getContentText: () => body || '', getHeaders: () => headers || {} });
  if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
    const pl = readFake(decodeURIComponent(url.split('id_token=')[1])); if (!pl) return resp(400, '{}');
    return resp(200, JSON.stringify({ aud: pl.aud, iss: pl.iss, sub: pl.sub, iat: String(pl.iat), exp: String(pl.exp), email: 'someone@example.com', name: 'Real Name' }));
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
// 'fake:<sub>' → 形狀正確的假 JWT（code.gs 會先做 JWT 預檢才呼叫 tokeninfo）
const toJwt = b => (b && typeof b.idToken === 'string' && /^fake:/.test(b.idToken)) ? Object.assign({}, b, { idToken: fakeJwt(b.idToken.slice(5), CLIENT) }) : b;
const post = b => JSON.parse(G.doPost({ postData: { contents: JSON.stringify(toJwt(b)) } }).getContent());
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
  { p: pick[0], changes: { '販售資訊': '💠FFK19 測試【緣結：吊飾、飯友；秋月祁：立牌】', '預告': 'https://x.com/test_account/status/1111111111111111111' } },
  { p: pick[1], changes: { '商品年齡分類': '一般', '試閱': 'https://www.pixiv.net/artworks/123456789' } },
  { p: pick[2], changes: { '創作者類型': '繪師', '特殊標籤或備註': '=1+1' } }];
const evWritesStart = env.writes.length;
fills.forEach(f => { const r = post({ action: 'eventfill', session: L3.session, ownerId: f.p.id, event: 'FFK19', booth: f.p.name, changes: f.changes }); ok('審核制：' + f.p.name + ' 填寫進入待審核', r.ok && r.data.queued === Object.keys(f.changes).length && r.data.applied === 0, JSON.stringify(r.data || r.error)); });
ok('審核前整理表未被寫入', env.writes.slice(evWritesStart).every(w => w.file !== FFK));
ok('不可填寫鎖定欄位（攤位編號）', post({ action: 'eventfill', session: L3.session, ownerId: pick[0].id, event: 'FFK19', booth: pick[0].name, changes: { '第一天': 'A01' } }).ok === false);
ok('不可填寫別人的攤位', post({ action: 'eventfill', session: L3.session, ownerId: pick[0].id, event: 'FFK19', booth: 'ZLing讀做Z0的魔法研究室', changes: { '販售資訊': 'x' } }).ok === false);
edits().forEach((r, i) => { if (r[2] === '場次填寫' && r[12] === '待審核') sheet(DB_ID, '修改申請').data[i + 1][12] = '核准'; });
G.menuApplyApproved();
const evWrites = env.writes.slice(evWritesStart).filter(w => w.file === FFK);
const H = evSh.data[0];
const expect = []; fills.forEach(f => Object.keys(f.changes).forEach(k => { const col = H.indexOf(k); expect.push({ a1: G.colLetter_(col) + f.p.row, booth: f.p.name, field: k, value: /^=/.test(f.changes[k]) ? "'" + f.changes[k] : f.changes[k] }); }));
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


// ===== 12. 回歸：只有出展紀錄、主資料庫沒有列的攤主（例：C02492 加帕利天藍怪預警中心）=====
{
  const dbNow = sheet(DB_ID, '新攤位資料庫'), idCol = dbNow.data[0].indexOf('攤主ID');
  const inDb = new Set(dbNow.data.slice(1).map(r => r[idCol]));
  const LOGR = sheet(DB_ID, '場次出展紀錄').data.slice(1), logOnly = LOGR.find(r => r[6] === 'C02492' && !inDb.has('C02492')) || LOGR.find(r => r[6] && !inDb.has(r[6]) && r[4]);
  const LO = post({ action: 'login', idToken: 'fake:log-only-owner' }), uLO = G.readSession_(LO.session), oid = logOnly[6];
  ok('回歸：測試對象只在出展紀錄', get({ action: 'owner', id: oid }).data.dbRows.length === 0, oid);
  post({ action: 'claim', session: LO.session, ownerId: oid }); claims().forEach((r, i) => { if (r[4] === uLO) approveClaimRow(i); });
  ok('回歸：核准後「我的攤位」列出此攤主', post({ action: 'me', session: LO.session }).me.owned.includes(oid));
  const hist = get({ action: 'owner', id: oid }).data.history, lastName = hist[hist.length - 1].name;
  const e1 = post({ action: 'edit', session: LO.session, ownerId: oid, rowName: lastName, changes: { '筆名': '回歸測試筆名', 'FB (1)': 'https://www.facebook.com/regression.test.page' } });
  ok('回歸：無主資料列也能送出修改（新列模式）', e1.ok && e1.data.queued === 2 && e1.data.newRow === true, JSON.stringify(e1.data || e1.error));
  const e1b = post({ action: 'edit', session: LO.session, ownerId: oid, rowName: '', changes: { '創作者類型': '繪師' } });
  ok('回歸：rowName 留空也可以', e1b.ok && e1b.data.queued === 1, JSON.stringify(e1b.data || e1b.error));
  const before = dbNow.data.length;
  ok('回歸：核准前主資料庫沒有新增列', dbNow.data.length === before && !dbNow.data.some(r => r[idCol] === oid));
  const ids = edits().filter(r => r[3] === oid && r[2] === '主資料修改').map(r => r[0]);
  ids.forEach(x => setStatus(rowOf(x), x === ids[1] ? '核准' : '核准', ''));
  const rowsNow = dbNow.data.filter(r => r[idCol] === oid);
  const nc = dbNow.data[0].indexOf('攤位名稱'), pc = dbNow.data[0].indexOf('筆名'), fc = dbNow.data[0].indexOf('FB (1)'), tc = dbNow.data[0].indexOf('創作者類型');
  ok('回歸：核准後只新增一列、寫入攤名與攤主ID', rowsNow.length === 1 && rowsNow[0][nc] === lastName, rowsNow.length + ' 列，攤名 ' + (rowsNow[0] || [])[nc]);
  ok('回歸：三個欄位都寫進同一列', rowsNow[0] && rowsNow[0][pc] === '回歸測試筆名' && rowsNow[0][fc] === 'https://www.facebook.com/regression.test.page' && rowsNow[0][tc] === '繪師');
  ok('回歸：修改申請全部「已套用」並記錄位置', ids.every(x => { const r = edits().find(e => e[0] === x); return r[12] === '已套用' && /^新攤位資料庫!/.test(r[15]); }), ids.map(x => edits().find(e => e[0] === x)[15]).join(' '));
  ok('回歸：網站讀得到新列', get({ action: 'owner', id: oid }).data.dbRows.length === 1);
  setStatus(rowOf(ids[0]), '復原'); ok('回歸：可復原', dbNow.data.filter(r => r[idCol] === oid)[0][pc] === '' && edits().find(e => e[0] === ids[0])[12] === '已復原');
  const e2 = post({ action: 'edit', session: LO.session, ownerId: oid, rowName: lastName, changes: { '筆名': '第二次修改' } });
  ok('回歸：之後的修改走既有列', e2.ok && e2.data.newRow === false && e2.data.queued === 1, JSON.stringify(e2.data || e2.error));
  const NO = post({ action: 'login', idToken: 'fake:not-owner' });
  ok('回歸：非管理者不能用新列模式', post({ action: 'edit', session: NO.session, ownerId: oid, rowName: '', changes: { '筆名': 'x' } }).ok === false);
}

// ===== 13. 站長後台（多位站長、二審、併發、直接修改、關聯判定、合併、稽核） =====
{
  const A = b => post(b), dbS = sheet(DB_ID, '新攤位資料庫'), hdr = dbS.data[0], col = h => hdr.indexOf(h), idc = col('攤主ID');
  const login = sub => post({ action: 'login', idToken: 'fake:' + sub });
  const X1 = login('admin-one'), X2 = login('admin-two'), NO = login('plain-user-13');
  ok('站長：未加入前沒有權限', A({ action: 'admin.summary', session: X1.session }).ok === false && login('admin-one').me.admin === false);
  // 初始化（試算表擁有者）
  const nFiles = Object.keys(env.files).length;
  env.activeUser = 'intruder@example.invalid'; G.menuInitAdmin(); ok('站長：非擁有者不能初始化', !sheet(DB_ID, '關聯判定') && /只有試算表擁有者/.test(env.ui.alerts.pop()));
  env.activeUser = undefined; G.menuInitAdmin();
  ok('站長：初始化建立 3 個分頁', ['站長操作紀錄', '關聯判定', 'ID 合併對照'].every(n => !!sheet(DB_ID, n)));
  ok('站長：初始化先備份整份試算表（Drive 副本）', Object.keys(env.files).length === nFiles + 1 && /備份副本 ID：copy_/.test(env.ui.alerts[env.ui.alerts.length - 1]));
  const before13 = JSON.stringify(sheet(DB_ID, '新攤位資料庫').data.length); G.menuInitAdmin(); ok('站長：重複初始化不覆蓋既有分頁', /都已存在/.test(env.ui.alerts.pop()) && JSON.stringify(sheet(DB_ID, '新攤位資料庫').data.length) === before13);
  // 配對
  const p1 = A({ action: 'admin.pairStart', session: X1.session, label: '小編A' }); ok('站長：取得配對碼', p1.ok && /^[A-Z0-9]{8}$/.test(p1.data.code), p1.data && p1.data.code);
  env.ui.prompts.push('WRONG123'); G.menuAddAdmin(); ok('站長：錯誤配對碼被拒', /無效或已過期/.test(env.ui.alerts.pop()));
  env.activeUser = 'intruder@example.invalid'; env.ui.prompts.push(p1.data.code); G.menuAddAdmin(); ok('站長：非擁有者不能新增站長', /只有試算表擁有者/.test(env.ui.alerts.pop())); env.ui.prompts.length = 0; env.activeUser = undefined;
  env.ui.prompts.push(p1.data.code); G.menuAddAdmin();
  const p2 = A({ action: 'admin.pairStart', session: X2.session, label: '小編B' }); env.ui.prompts.push(p2.data.code); G.menuAddAdmin();
  const adm = JSON.parse(env.props.ADMIN_UIDS);
  ok('站長：配對成功 2 位（第一位為擁有者）', adm.length === 2 && adm[0].role === 'owner' && adm[1].role === 'admin' && adm[0].label === '小編A', adm.map(a => a.label + '/' + a.role).join(' '));
  ok('站長：ADMIN_UIDS 只存 HMAC 代號（無 email）', !/@|example/.test(env.props.ADMIN_UIDS));
  ok('站長：配對碼只能用一次', (env.ui.prompts.push(p1.data.code), G.menuAddAdmin(), /無效或已過期/.test(env.ui.alerts.pop())));
  const S1 = A({ action: 'admin.summary', session: X1.session });
  ok('站長：summary 可讀、標示兩人規則', S1.ok && S1.data.twoAdmin === true && S1.data.admins.length === 2 && S1.data.role === 'owner', JSON.stringify(S1.error || S1.data.counts));
  ok('站長：me 回傳 admin 旗標', A({ action: 'me', session: X1.session }).me.admin === true && A({ action: 'me', session: NO.session }).me.admin === false);
  ok('站長：一般帳號被拒（伺服器檢查）', /沒有站長權限/.test(A({ action: 'admin.queue', session: NO.session }).error));
  ok('站長：偽造 session 被拒', A({ action: 'admin.queue', session: X1.session.replace(/.$/, c => c === 'A' ? 'B' : 'A') }).ok === false);
  env.props.ADMIN_WEB_DISABLED = '1'; ok('站長：緊急停用開關', /已停用/.test(A({ action: 'admin.summary', session: X1.session }).error)); delete env.props.ADMIN_WEB_DISABLED;
  const u1 = G.readSession_(X1.session), u2 = G.readSession_(X2.session);
  const old1 = G.makeSession_(u1, Date.now() - 3 * 3600e3), stale1 = G.makeSession_(u1, Date.now() - 20 * 60e3);
  ok('站長：登入超過 2 小時需重新登入', /^REAUTH/.test(A({ action: 'admin.summary', session: old1 }).error));
  // 測試對象：有 TWITTER (1)、筆名空白、IG 有值的攤主
  const used = new Set(edits().map(r => r[3]).concat(claims().map(r => r[2])));
  const cands = dbS.data.slice(1).filter(r => r[idc] && !used.has(r[idc]) && /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]+\/?$/.test(r[col('TWITTER (1)')]) && !r[col('筆名')] && r[col('IG')] && dbS.data.filter(x => x[idc] === r[idc]).length === 1);
  const T = cands[0], T2 = cands[1], T3 = cands[2], tid = T[idc];
  const OW = login('owner-13');
  const tw = T[col('TWITTER (1)')], proof = tw.replace(/^https:\/\/(x|twitter)\.com/, m => m.includes('twitter') ? 'https://x.com' : 'https://twitter.com') + '/status/1234567890';
  A({ action: 'claim', session: OW.session, ownerId: tid, proofUrl: proof, note: '本人' });
  const crow = claims().find(r => r[2] === tid && r[4] === G.readSession_(OW.session));
  ok('認領：twitter.com 與 x.com 視為同一帳號', /相符/.test(crow[8]), tw + ' vs ' + proof);
  const q0 = A({ action: 'admin.queue', session: X1.session }); const qc = q0.data.claims.find(c => c.id === crow[0]);
  ok('站長：待審核列出認領（含 SNS 比對）', !!qc && qc.match === true && qc.known.length > 0);
  const dc = A({ action: 'admin.decide', session: X1.session, ids: [crow[0]], decision: 'approve' });
  ok('站長：核准認領', dc.ok && dc.data.done === 1 && claims().find(r => r[0] === crow[0])[9] === '核准' && /小編A/.test(claims().find(r => r[0] === crow[0])[11]));
  ok('站長：已處理的認領再按顯示由誰處理', (() => { const r = A({ action: 'admin.decide', session: X2.session, ids: [crow[0]], decision: 'reject' }); return r.ok && r.data.handled.length === 1 && /小編A/.test(r.data.handled[0].by); })());
  const newTw = 'https://x.com/new_handle_' + tid.toLowerCase();
  const e13 = A({ action: 'edit', session: OW.session, ownerId: tid, rowName: T[col('攤位名稱')], changes: { '筆名': '站長測試筆名', 'TWITTER (1)': newTw } });
  ok('站長：攤主送出修改（含身分欄位）', e13.ok && e13.data.queued === 2, JSON.stringify(e13.error || e13.data));
  const q1 = A({ action: 'admin.queue', session: X1.session }), bt = q1.data.batches.find(b => b.batch === e13.data.batch);
  const penId = bt.items.find(i => i.field === '筆名').id, twId = bt.items.find(i => i.field === 'TWITTER (1)').id;
  ok('站長：佇列分批、標示身分欄位與將寫入的格子', bt.items.length === 2 && bt.items.find(i => i.id === twId).sensitive && /新攤位資料庫!/.test(bt.items[0].cell), bt.items.map(i => i.field + ':' + i.cell).join(' '));
  const rowT = dbS.data.findIndex(r => r[idc] === tid) + 1, penA1 = G.colLetter_(col('筆名')) + rowT;
  const w0 = env.writes.length;
  const d1 = A({ action: 'admin.decide', session: X1.session, ids: [penId], decision: 'approve' }), d2 = A({ action: 'admin.decide', session: X2.session, ids: [penId], decision: 'approve' });
  const penWrites = env.writes.slice(w0).filter(w => w.sheet === '新攤位資料庫' && w.a1 === penA1);
  ok('併發：兩位站長同時核准同一筆，只套用一次', d1.data.done === 1 && d2.data.done === 0 && penWrites.length === 1, penWrites.length + ' 次寫入 ' + penA1);
  ok('併發：第二位看到「已由 小編A 處理」', d2.data.handled.length === 1 && /小編A/.test(d2.data.handled[0].by), JSON.stringify(d2.data.handled));
  ok('站長：批次核准略過身分欄位', A({ action: 'admin.decide', session: X1.session, ids: [twId], decision: 'approve' }).data.skipped === 1);
  ok('站長：身分欄位核准必填驗證方式', /必須填寫驗證方式/.test(A({ action: 'admin.decide', session: X1.session, ids: [twId], decision: 'approve2' }).error));
  ok('站長：高風險操作需 10 分鐘內重新登入', /^REAUTH/.test(A({ action: 'admin.decide', session: stale1, ids: [twId], decision: 'approve2', note: 'x' }).error));
  const a1 = A({ action: 'admin.decide', session: X1.session, ids: [twId], decision: 'approve2', note: '已在原 X 帳號私訊確認' });
  ok('二審：第一位站長核准後狀態「待第二位確認」，尚未寫入', a1.data.waiting === 1 && edits().find(r => r[0] === twId)[12] === '待第二位確認' && dbS.data[rowT - 1][col('TWITTER (1)')] === tw);
  ok('二審：同一位站長不能自己二審', A({ action: 'admin.decide', session: X1.session, ids: [twId], decision: 'approve2', note: '再按一次' }).data.skipped === 1);
  ok('二審：summary 提示另一位站長有待確認', A({ action: 'admin.summary', session: X2.session }).data.needsMySecond >= 1);
  const a2 = A({ action: 'admin.decide', session: X2.session, ids: [twId], decision: 'approve2', note: '我也用 X 私訊確認' });
  ok('二審：第二位站長確認後套用', a2.data.done === 1 && dbS.data[rowT - 1][col('TWITTER (1)')] === newTw && edits().find(r => r[0] === twId)[12] === '已套用', JSON.stringify(a2.data));
  // 擁有者覆核
  const e14 = A({ action: 'edit', session: OW.session, ownerId: tid, rowName: T[col('攤位名稱')], changes: { 'IG': 'https://www.instagram.com/override_test_13/' } }), igId = edits().find(r => r[18] === e14.data.batch)[0];
  ok('覆核：一般站長不能覆核', /只有擁有者站長/.test(A({ action: 'admin.decide', session: X2.session, ids: [igId], decision: 'override', note: '急件處理' }).error));
  ok('覆核：必填理由', /理由/.test(A({ action: 'admin.decide', session: X1.session, ids: [igId], decision: 'override', note: '' }).error));
  const ov = A({ action: 'admin.decide', session: X1.session, ids: [igId], decision: 'override', note: '小編B 請假，已電話確認' });
  ok('覆核：擁有者站長覆核後套用並記錄理由', ov.data.done === 1 && /擁有者覆核/.test(edits().find(r => r[0] === igId)[14]) && dbS.data[rowT - 1][col('IG')] === 'https://www.instagram.com/override_test_13/');
  // 站長直接修改任何攤主
  const t2 = T2[idc], row2 = dbS.data.findIndex(r => r[idc] === t2) + 1;
  ok('直接修改：一樣擋縮網址', /縮網址/.test(A({ action: 'admin.ownerEdit', session: X2.session, ownerId: t2, rowName: T2[col('攤位名稱')], changes: { '官方網站': 'https://bit.ly/abc' } }).error));
  ok('直接修改：一樣擋白名單外網域', /只接受/.test(A({ action: 'admin.ownerEdit', session: X2.session, ownerId: t2, rowName: T2[col('攤位名稱')], changes: { 'IG': 'https://evil.example/x' } }).error));
  const de = A({ action: 'admin.ownerEdit', session: X2.session, ownerId: t2, rowName: T2[col('攤位名稱')], changes: { '筆名': '=1+1', '創作者類型': '模型製作' } });
  ok('直接修改：一般欄位立即套用（不進佇列）', de.ok && de.data.applied === 2 && dbS.data[row2 - 1][col('筆名')] === "'=1+1", JSON.stringify(de.error || de.data));
  const de2 = A({ action: 'admin.ownerEdit', session: X2.session, ownerId: t2, rowName: T2[col('攤位名稱')], changes: { 'TWITTER (1)': 'https://x.com/admin_direct_' + t2.toLowerCase() } });
  ok('直接修改：身分欄位在 2 位站長時需第二位確認', de2.data.waiting === 1 && dbS.data[row2 - 1][col('TWITTER (1)')] === T2[col('TWITTER (1)')]);
  const de2b = A({ action: 'admin.decide', session: X1.session, ids: [de2.data.items[0].id], decision: 'approve2', note: '看過攤主公告' });
  ok('直接修改：第二位站長確認後套用', de2b.data.done === 1 && /admin_direct_/.test(dbS.data[row2 - 1][col('TWITTER (1)')]));
  const al = sheet(DB_ID, '站長操作紀錄').data.slice(1);
  ok('稽核：記錄站長、動作、舊值→新值', al.some(r => r[2] === '小編B' && r[3] === '直接修改' && r[5] === '筆名' && r[7] === "'=1+1") && al.some(r => r[2] === '小編A' && r[3] === '一審（待第二位確認）'), al.length + ' 列');
  const penAd = de.data.items.find(i => i.field === '筆名').id;
  const rv = A({ action: 'admin.revert', session: X1.session, ids: [penAd] });
  ok('直接修改：可復原', rv.data.ok === 1 && dbS.data[row2 - 1][col('筆名')] === '' && edits().find(r => r[0] === penAd)[12] === '已復原');
  ok('復原：再按一次不會重複', A({ action: 'admin.revert', session: X2.session, ids: [penAd] }).data.already === 1);
  const au = A({ action: 'admin.audit', session: X1.session, q: t2 });
  ok('稽核 API：可搜尋、標示可復原', au.ok && au.data.rows.length >= 3 && au.data.rows.some(r => r.revertable) && au.data.rows.every(r => r.admin), au.data.rows.length + ' 筆');
  // 站長直接修改場次整理表（任何攤位）
  const evSh2 = env.files[FFK].getSheetByName('攤位整理表 請在此填寫資訊'), EH = evSh2.data[0], sc = EH.indexOf('販售資訊');
  const target = evSh2.data.slice(1).findIndex(r => r[0] && evSh2.data.filter(x => x[0] === r[0]).length === 1 && !edits().some(e => String(e[5]).split('｜')[0] === r[0])) + 2, tb = evSh2.data[target - 1];
  ok('場次：販售資訊必須是「💠類別【內容】」', /💠類別【內容】/.test(A({ action: 'admin.eventEdit', session: X1.session, event: 'FFK19', booth: tb[0], changes: { '販售資訊': '新刊 畫冊' } }).error));
  ok('場次：讀取後被別人改過會被擋', /剛被別人修改過/.test(A({ action: 'admin.eventEdit', session: X1.session, event: 'FFK19', booth: tb[0], expect: { '販售資訊': 'stale' }, changes: { '販售資訊': '💠新刊【x】' } }).error));
  const sales = '💠 新刊【畫冊 Vol.2 NT$300】\n💠周邊【 壓克力立牌、明信片 】';
  const ee = A({ action: 'admin.eventEdit', session: X1.session, event: 'FFK19', booth: tb[0], expect: { '販售資訊': tb[sc] || '' }, changes: { '販售資訊': sales, '預告': 'https://x.com/someone/status/1999999999999999999' } });
  ok('場次：站長直接寫入任何攤位（格式自動整理）', ee.ok && ee.data.applied === 2 && evSh2.data[target - 1][sc] === '💠新刊【畫冊 Vol.2 NT$300】\n💠周邊【壓克力立牌、明信片】', JSON.stringify(ee.error || ee.data) + ' ' + JSON.stringify(evSh2.data[target - 1][sc]));
  const salesId = ee.data.items.find(i => i.field === '販售資訊').id;
  ok('場次：寫入的格子正確並記錄位置', ee.data.items.find(i => i.field === '販售資訊').where === 'FFK19!' + G.colLetter_(sc) + target);
  const er = A({ action: 'admin.revert', session: X2.session, ids: [salesId] });
  ok('場次：可復原（跨檔案）', er.data.ok === 1 && evSh2.data[target - 1][sc] === (tb[sc] || ''));
  // 關聯判定、合併、ID 對照
  const ownersNow = get({ action: 'index' }).data.owners, logS = sheet(DB_ID, '場次出展紀錄'), lid = logS.data[0].indexOf('攤主ID');
  const mB = ownersNow.find(o => o[7] === 0 && o[4].length === 1 && !used.has(o[0]) && logS.data.filter(r => r[lid] === o[0]).length === 1)[0], mA = T3[idc];
  ok('關聯：一般站長未重新登入不能合併', /^REAUTH/.test(A({ action: 'admin.relationDecide', session: stale1, a: mA, b: mB, decision: 'merge' }).error));
  const OB = login('owner-of-b'); A({ action: 'claim', session: OB.session, ownerId: mB, method: 'dm' }); A({ action: 'admin.decide', session: X1.session, ids: [claims().find(r => r[2] === mB && r[4] === G.readSession_(OB.session))[0]], decision: 'approve' });
  const mg = A({ action: 'admin.relationDecide', session: X1.session, a: mA, b: mB, decision: 'merge', note: '同一位作者（站長確認）' });
  ok('合併：B 的列改為 A 的攤主ID', mg.ok && mg.data.moved >= 1 && !logS.data.some(r => r[lid] === mB), JSON.stringify(mg.error || mg.data));
  ok('合併：舊ID 自動導向新ID', get({ action: 'owner', id: mB }).data.redirect === mA);
  ok('合併：ID 合併對照有記錄', sheet(DB_ID, 'ID 合併對照').data.some(r => r[0] === mB && r[1] === mA && r[5] === '有效'));
  ok('合併：原本管理 B 的人可管理 A', A({ action: 'me', session: OB.session }).me.owned.includes(mA));
  ok('合併：關聯覆蓋層含合併', get({ action: 'relations' }).data.merged[mB] === mA);
  const mr = A({ action: 'admin.revert', session: X1.session, batch: mg.data.batch });
  ok('合併：整批復原', mr.data.ok === mg.data.moved && logS.data.some(r => r[lid] === mB) && !get({ action: 'owner', id: mB }).data.redirect && !get({ action: 'relations' }).data.merged[mB], JSON.stringify(mr.data));
  const un = A({ action: 'admin.relationDecide', session: X2.session, a: 'C00002', b: 'C00158', decision: 'unrelated', note: '只是都用買動漫賣場' });
  ok('關聯：確認無關後，公開覆蓋層移除此配對', un.ok && get({ action: 'relations' }).data.unrelated.some(p => p[0] === 'C00002' && p[1] === 'C00158'));
  ok('關聯：即時共用帳號關聯是陣列', Array.isArray(get({ action: 'relations' }).data.live));
  const rel13 = A({ action: 'admin.relations', session: X1.session }); ok('關聯：後台可讀判定紀錄', rel13.ok && rel13.data.decisions.length >= 2);
  // 停權
  const su = A({ action: 'admin.suspend', session: X1.session, target: G.readSession_(OW.session), note: '測試停權' });
  ok('停權：網站後台停權帳號', su.ok && su.data.n >= 1 && A({ action: 'me', session: OW.session }).me.suspended === true);
  ok('停權：被停權後不能修改', A({ action: 'edit', session: OW.session, ownerId: tid, rowName: '', changes: { '筆名': 'x' } }).ok === false);
  A({ action: 'admin.suspend', session: X1.session, target: G.readSession_(OW.session), restore: true });
  ok('停權：恢復後回到原本的管理權', A({ action: 'me', session: OW.session }).me.owned.includes(tid) && !A({ action: 'me', session: OW.session }).me.suspended);
  ok('停權：列表', A({ action: 'admin.suspensions', session: X1.session }).ok);
  // 場次設定
  ok('場次：後台讀取整理中場次統計', (() => { const r = A({ action: 'admin.events', session: X1.session }); return r.ok && r.data.active[0].booths > 600; })());
  ok('模式：切換並記錄', A({ action: 'admin.mode', session: X2.session, mode: 'queue' }).data.mode === 'queue');
  // 站長管理
  ok('站長：一般站長不能移除擁有者', /不能移除|只有擁有者/.test(A({ action: 'admin.adminRemove', session: X2.session, u: u1 }).error));
  const rm = A({ action: 'admin.adminRemove', session: X1.session, u: u2 });
  ok('站長：擁有者移除站長後立即失效', rm.ok && /沒有站長權限/.test(A({ action: 'admin.summary', session: X2.session }).error));
  ok('站長：只剩 1 位時身分欄位由唯一站長核准', (() => { const e = A({ action: 'admin.ownerEdit', session: X1.session, ownerId: t2, rowName: T2[col('攤位名稱')], changes: { 'IG': 'https://www.instagram.com/single_admin_13/' } }); return e.ok && e.data.applied === 1; })());
  ok('稽核：所有網站後台動作都有站長暱稱', sheet(DB_ID, '站長操作紀錄').data.slice(1).every(r => r[2]));
}
// ===== 14. 安全性修正（2026-11-23 稽核報告，每一項一組回歸測試） =====
{
  const A = b => post(b), login = sub => post({ action: 'login', idToken: 'fake:' + sub });
  const evH = evSh.data[0], ecol = h => evH.indexOf(h), ffkWrites = () => env.writes.filter(w => w.file === FFK).length;
  // 準備：一位管理 pick[0]（魷魚祁聯盟）的攤主、兩位站長
  const P1 = login('p4-owner'), up1 = G.readSession_(P1.session);
  post({ action: 'claim', session: P1.session, ownerId: pick[0].id, method: 'dm' }); claims().forEach((r, i) => { if (r[4] === up1) approveClaimRow(i); });
  const AD1 = login('admin-one'); // 第 13 節的擁有者站長（仍在名單）
  const pB = A({ action: 'admin.pairStart', session: login('p4-admin-b').session, label: '小編P4' }); env.ui.prompts.push(pB.data.code); G.menuAddAdmin();
  const AD2 = login('p4-admin-b');
  ok('P4 準備：2 位站長', JSON.parse(env.props.ADMIN_UIDS).length === 2 && A({ action: 'admin.summary', session: AD2.session }).ok);

  // [高 1] 變形欄位名稱
  ok('[1] validateField_ 拒絕 twitter(1)', !G.validateField_('twitter(1)', 'javascript:alert(1) or https://evil.example/', 'https://x.com/real').ok);
  ok('[1] validateField_ 拒絕「販售資訊 」（多空白）', !G.validateField_('販售資訊 ', '隨便寫', '').ok);
  ok('[1] validateField_ 拒絕全形括號 TWITTER（1）', !G.validateField_('TWITTER（1）', 'https://evil.example/', '').ok);
  G.setProp_('EVENT_FILL_MODE', 'live');
  const w0 = ffkWrites();
  ['twitter(1)', 'TWITTER(1)', 'twitter (1)', '販售資訊 ', ' 販售資訊', 'ｉｇ'].forEach(f => {
    const r = A({ action: 'eventfill', session: P1.session, ownerId: pick[0].id, event: 'FFK19', booth: pick[0].name, changes: { [f]: f.includes('販售') ? '沒有格式' : 'https://evil.example/' } });
    ok('[1] 場次填寫拒絕變形欄名「' + f + '」（即時制）', r.ok === false && /不可/.test(r.error), r.error);
  });
  ok('[1] 變形欄名完全沒有寫入整理表', ffkWrites() === w0);
  const okFill = A({ action: 'eventfill', session: P1.session, ownerId: pick[0].id, event: 'FFK19', booth: pick[0].name, changes: { 'TWITTER (1)': 'https://evil.example/' } });
  ok('[1] 正式欄名仍套用白名單', okFill.ok === false && /只接受/.test(okFill.error), okFill.error);
  G.setProp_('EVENT_FILL_MODE', 'queue');
  ok('[1] 主資料修改拒絕變形欄名', A({ action: 'edit', session: P1.session, ownerId: pick[0].id, rowName: '', changes: { 'twitter(1)': 'https://evil.example/' } }).ok === false);
  ok('[1] 站長直接修改主資料拒絕變形欄名', /不可修改/.test(A({ action: 'admin.ownerEdit', session: AD1.session, ownerId: 'C00968', rowName: '', changes: { 'ig ': 'https://evil.example/' } }).error || ''));
  ok('[1] 站長修改場次拒絕變形欄名', /不可寫入/.test(A({ action: 'admin.eventEdit', session: AD1.session, event: 'FFK19', booth: pick[0].name, changes: { 'twitter(1)': 'https://evil.example/' } }).error || ''));
  const pv = A({ action: 'preview', session: P1.session, changes: { 'twitter(1)': 'https://evil.example/' }, old: {} });
  ok('[1] 預覽也標示變形欄名不可用', pv.ok && pv.data['twitter(1)'].ok === false);
  // 試算表手動加的（或舊版留下的）申請列：套用前再驗證
  const es = sheet(DB_ID, '修改申請'); es.appendRow(['EDP4X', G.now_(), '場次填寫', pick[0].id, 'FFK19', pick[0].name, 'twitter(1)', '', 'https://evil.example/', up1, 0, '', '核准', '', '', '', '', '', 'BP4']);
  const apX = G.applyRow_(es.getLastRow(), true); ok('[1] 套用前再驗證：舊格式申請列不會寫入', apX.ok === false && es.data[es.getLastRow() - 1][12] === '需人工', apX.error);
  es.appendRow(['EDP4Y', G.now_(), '主資料修改', 'C00968', '新攤位資料庫', '心桃魅夢', 'IG', '', 'https://evil.example/', up1, 0, '', '核准', '', '', '', '', '', 'BP4']);
  ok('[1] 套用前再驗證：白名單不符的核准列不會寫入', G.applyRow_(es.getLastRow(), true).ok === false);

  // [中 2] 反斜線與非 RFC 3986 字元
  ok('[2] 反斜線網址被拒（FB 白名單）', !G.validateField_('FB (1)', 'https://evil.example\\.facebook.com/login', '').ok);
  ok('[2] hostOf_ 對反斜線回傳空值', G.hostOf_('https://evil.example\\.facebook.com/login') === '');
  ok('[2] 其他不合法字元被拒（空白、<、"、`、{）', ['https://x.com/a b', 'https://x.com/<a>', 'https://x.com/"a', 'https://x.com/`a', 'https://x.com/{a}'].every(u => !G.validateField_('TWITTER (2)', u, '').ok));
  ok('[2] 非 ASCII 網域被拒、路徑中文自動編碼', !G.validateField_('官方網站', 'https://例子.tw/', '').ok && /%E5%BF%83/.test(G.validateField_('FB (1)', 'https://www.facebook.com/心桃', '').value));
  ok('[2] 主機名稱格式（.. 開頭結尾點、底線）被拒', ['https://a..facebook.com/', 'https://.facebook.com/', 'https://evil_.facebook.com/'].every(u => !G.validateField_('FB (1)', u, '').ok));
  ok('[2] 合法網址照常通過', G.validateField_('FB (1)', 'https://www.facebook.com/profile.php?id=100012345678', '').ok && G.validateField_('官方網站', 'https://shop.example.com:8443/a?b=c#d', '').ok);

  // [中 3] 併入主資料庫逐欄驗證
  const nsH = ns.data[0], nscol = h => nsH.indexOf(h), dbS = sheet(DB_ID, '新攤位資料庫'), dH = dbS.data[0], dcol = h => dH.indexOf(h);
  const mRow = ns.data.findIndex(r => r[0] === '心桃魅夢'), dRow = dbS.data.findIndex(r => r[dcol('攤主ID')] === 'C00968' && r[dcol('攤位名稱')] === '心桃魅夢');
  const oldTw = dbS.data[dRow][dcol('TWITTER (1)')], oldFb2 = dbS.data[dRow][dcol('FB (2)')];
  ns.data[mRow][nscol('FB (2)')] = 'https://evil.example\\.facebook.com/x';
  ns.data[mRow][nscol('TWITTER (1)')] = 'https://x.com/someone_else_p4';
  ns.data.push(['P4 併入測試社團', '', 'D01', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'https://www.facebook.com/p4merge', '', '', '', '', '', '', '', '', '', '', '', 'javascript:alert(1)']);
  const pend0 = edits().filter(r => r[12] === '待審核').length;
  const mg4 = G.mergeEventToDb_('FF48', 'event_wins');
  ok('[3] 驗證失敗的值不寫入主資料庫', dbS.data[dRow][dcol('FB (2)')] === oldFb2, dbS.data[dRow][dcol('FB (2)')]);
  ok('[3] 取代既有身分欄位（TWITTER）改為待審核，不直接覆蓋', dbS.data[dRow][dcol('TWITTER (1)')] === oldTw);
  const newR = dbS.data.find(r => r[dcol('攤位名稱')] === 'P4 併入測試社團');
  ok('[3] 新攤位：合法欄位寫入、非法欄位留空', newR && newR[dcol('FB (1)')] === 'https://www.facebook.com/p4merge' && newR[dcol('IG')] === '', newR && newR[dcol('IG')]);
  const pends = edits().filter(r => r[12] === '待審核').slice(pend0);
  ok('[3] 沒通過的都變成「待審核」申請', mg4.pending >= 3 && pends.some(r => r[6] === 'FB (2)' && /驗證失敗/.test(r[11])) && pends.some(r => r[6] === 'TWITTER (1)' && /需二次驗證/.test(r[11])) && pends.some(r => r[6] === 'IG' && /驗證失敗/.test(r[11])), JSON.stringify(mg4));
  const pfb = pends.find(r => r[6] === 'FB (2)'), pfbRow = rowOf(pfb[0]); setStatus(pfbRow, '核准');
  ok('[3] 即使站長按核准，驗證失敗的值仍不會寫入', dbS.data[dRow][dcol('FB (2)')] === oldFb2 && edits().find(r => r[0] === pfb[0])[12] === '需人工');

  // [中 4] 認領「帳號相符」
  const C4 = login('p4-claimer'), cid4 = dbS.data.find(r => r[dcol('攤主ID')] && /^https:\/\/x\.com\/[A-Za-z0-9_]+\/?$/.test(r[dcol('TWITTER (1)')]) && !claims().some(c => c[2] === r[dcol('攤主ID')]));
  const tw4 = cid4[dcol('TWITTER (1)')].replace(/\/$/, ''), id4 = cid4[dcol('攤主ID')];
  const cl1 = A({ action: 'claim', session: C4.session, ownerId: id4, proofUrl: tw4 });
  ok('[4] 個人頁網址不能當驗證貼文', cl1.ok === false && /貼文/.test(cl1.error), cl1.error);
  const cl2 = A({ action: 'claim', session: C4.session, ownerId: id4, proofUrl: tw4.replace('https://x.com', 'https://twitter.com') + '/status/1859990001112223334' });
  const c4row = claims().find(r => r[2] === id4 && r[4] === G.readSession_(C4.session));
  ok('[4] 貼文網址＋帳號相符 → 標示「帳號相符，仍需確認貼文含驗證碼」', cl2.ok && /帳號相符，仍需確認貼文含驗證碼/.test(c4row[8]), c4row && c4row[8]);
  ok('[4] 貼文網址格式（X/FB/IG/Plurk/Bluesky/Threads）', ['https://x.com/a/status/12345678', 'https://www.facebook.com/page/posts/pfbid0abc', 'https://www.facebook.com/permalink.php?story_fbid=123&id=456', 'https://www.instagram.com/p/Cabc123/', 'https://www.plurk.com/p/3h9xk2', 'https://bsky.app/profile/a.bsky.social/post/3kabc12', 'https://www.threads.net/@abc/post/Cxyz123'].every(G.isPostUrl_)
    && !['https://x.com/a', 'https://www.facebook.com/page', 'https://www.instagram.com/abc/', 'https://bsky.app/profile/a.bsky.social'].some(G.isPostUrl_));
  ok('[4] 帳號鍵：不同 Bluesky／FB profile.php 帳號不會被當成同一人', G.snsKey_('https://bsky.app/profile/a.bsky.social') !== G.snsKey_('https://bsky.app/profile/b.bsky.social') && G.snsKey_('https://www.facebook.com/profile.php?id=111111') !== G.snsKey_('https://www.facebook.com/profile.php?id=222222') && G.snsKey_('https://www.instagram.com/p/AAAAA/') === 'instagram.com');

  // [中 5] 匯入公式注入
  env.addFile('ORG_FF49', 'FF49 名單', [['工作表1', [['攤位編號', '社團名稱', '參加日期'], ['A01', '=IMPORTXML("https://evil.example","//a")', '兩天'], ['=1+1', '+正常社團', '第一天'], ['A03', '@提及社團', '兩天']]]]);
  ok('[5] 場次代碼格式檢查', (() => { try { G.importEvent_({ code: '=FF49', name: 'x', srcId: 'ORG_FF49', templateId: FFK }); return false; } catch (e) { return /場次代碼/.test(e.message); } })());
  G.importEvent_({ code: 'FF49', name: '=HYPERLINK("https://evil.example","FF49")', start: '2027-05-01', srcId: 'ORG_FF49', templateId: FFK, prefill: false });
  const l49 = sheet(DB_ID, '場次出展紀錄').data.filter(r => r[1] === 'FF49');
  ok('[5] 場次出展紀錄每個字串都不會變成公式', l49.length === 3 && l49.every(r => r.every(c => !/^[=+\-@]/.test(String(c)))), l49.map(r => r[4] + '|' + r[2]).join(' / '));
  const f49 = Object.values(env.files).find(f => f.name === 'FF49 完整攤位整理').getSheetByName('攤位整理表 請在此填寫資訊');
  ok('[5] 整理表的攤名、攤位編號也是純文字', f49.data.slice(1).every(r => [r[0], r[2], r[3]].every(c => !/^[=+\-@]/.test(String(c || '')))));
  G.setActiveEvents_(G.activeEvents_().filter(e => e.code !== 'FF49'));

  // [低 6] 登入預檢與失敗上限
  const tk = () => fetchLog.filter(u => u.startsWith('https://oauth2.googleapis.com/tokeninfo')).length;
  const t0 = tk();
  ['bogus', 'a.b.c', 'x'.repeat(5000), fakeJwt('s', 'other-client.apps.googleusercontent.com'), fakeJwt('s', CLIENT, { claims: { exp: Math.floor(Date.now() / 1000) - 10 } }), fakeJwt('s', CLIENT, { claims: { iss: 'https://evil.example' } })].forEach(tok => post({ action: 'login', idToken: tok }));
  ok('[6] 非 JWT、aud／exp／iss 不符：不呼叫 tokeninfo', tk() === t0, (tk() - t0) + ' 次');
  const forged = fakeJwt('forged', CLIENT).replace(/\.[^.]+$/, '.' + 'A'.repeat(43)); // 形狀正確、簽章錯
  const capWas = G.LOGIN_FAIL_CAP; G.LOGIN_FAIL_CAP = 3;
  for (let k = 0; k < 6; k++) post({ action: 'login', idToken: forged });
  ok('[6] 失敗達上限後不再呼叫 tokeninfo', tk() - t0 === 3, (tk() - t0) + ' 次');
  ok('[6] 上限期間登入回覆暫停訊息', /暫時無法使用/.test(post({ action: 'login', idToken: 'fake:p4-good' }).error || ''));
  G.CacheService.getScriptCache().remove(G.loginFailKey_()); G.LOGIN_FAIL_CAP = capWas;
  ok('[6] 時段過後正常登入', post({ action: 'login', idToken: 'fake:p4-good' }).ok);

  // [低 7] 所有網址／SNS 欄位都算身分欄位
  ok('[7] 官方網站、Linktree、FB (2)、其他連結 取代＝敏感', ['官方網站', 'Linktree等連結整合網頁', '其他連結'].every(f => G.validateField_(f, 'https://new.example.com/', 'https://old.example.com/').sensitive) && G.validateField_('FB (2)', 'https://www.facebook.com/b', 'https://www.facebook.com/a').sensitive);
  ok('[7] 填入原本空白的欄位不算敏感（站長決策）', !G.validateField_('官方網站', 'https://new.example.com/', '').sensitive);
  ok('[7] IDENTITY_FIELDS 涵蓋所有網址欄', Object.keys(G.FIELD_DOMAINS).every(f => G.IDENTITY_FIELDS.includes(f)) && G.SNS_COLS.every(f => G.IDENTITY_FIELDS.includes(f)));
  const offRow = dbS.data.find(r => r[dcol('攤主ID')] && r[dcol('官方網站')] && /^https:\/\//.test(r[dcol('官方網站')]) && dbS.data.filter(x => x[dcol('攤主ID')] === r[dcol('攤主ID')]).length === 1);
  const oe = A({ action: 'admin.ownerEdit', session: AD1.session, ownerId: offRow[dcol('攤主ID')], rowName: offRow[dcol('攤位名稱')], changes: { '官方網站': 'https://replaced.example.com/' } });
  ok('[7] 兩位站長時，單一站長取代官方網站要等第二位確認', oe.ok && oe.data.waiting === 1 && oe.data.applied === 0 && offRow[dcol('官方網站')] !== 'https://replaced.example.com/', JSON.stringify(oe.data || oe.error));

  // [低 8] 站長借用雲端硬碟
  env.addFile('OUTSIDE_SHEET', '別人的試算表', [['工作表1', [['攤位名稱', '密碼'], ['甲', 'secret-value']]]]); env.setParent('OUTSIDE_SHEET', 'FOLDER_OTHER');
  const e8a = A({ action: 'admin.importPreview', session: AD2.session, srcUrl: 'OUTSIDE_SHEET'.padEnd(30, 'X'), templateCode: 'FFK19', code: 'FF50' });
  ok('[8] 一般站長不能在網站匯入／預覽', /只有擁有者站長/.test(e8a.error || ''), e8a.error);
  env.addFile('OUTSIDE_SHEET_ID_0000000000001', '別人的試算表', [['工作表1', [['攤位名稱', '密碼'], ['甲', 'secret-value']]]]); env.setParent('OUTSIDE_SHEET_ID_0000000000001', 'FOLDER_OTHER');
  const e8b = A({ action: 'admin.importPreview', session: AD1.session, srcUrl: 'OUTSIDE_SHEET_ID_0000000000001', templateCode: 'FFK19', code: 'FF50' });
  ok('[8] 允許資料夾以外的試算表被拒，且不回傳內容', /不在允許的雲端硬碟資料夾/.test(e8b.error || '') && !JSON.stringify(e8b).includes('secret-value'), e8b.error);
  const e8c = A({ action: 'admin.eventAdd', session: AD1.session, code: 'FF50', sheetUrl: 'OUTSIDE_SHEET_ID_0000000000001' });
  ok('[8] 新增場次也檢查資料夾', /不在允許的雲端硬碟資料夾/.test(e8c.error || ''));
  ok('[8] 不存在／沒權限的檔案也被拒', /不在允許的雲端硬碟資料夾/.test(A({ action: 'admin.eventAdd', session: AD1.session, code: 'FF50', sheetUrl: 'NOPE_NOPE_NOPE_NOPE_NOPE_NOPE_1' }).error || ''));
  env.addFile('ORG_FF50_IN_FOLDER_000000000001', 'FF50 名單', [['工作表1', [['攤位編號', '社團名稱'], ['A01', '測試社團']]]]);
  const e8d = A({ action: 'admin.importPreview', session: AD1.session, srcUrl: 'ORG_FF50_IN_FOLDER_000000000001', templateCode: 'FFK19', code: 'FF50' });
  ok('[8] 允許資料夾內的檔案：擁有者站長可預覽', e8d.ok && e8d.data.booths === 1, JSON.stringify(e8d.error || e8d.data.booths));
  env.props.ALLOWED_FOLDER_IDS = 'FOLDER_OTHER';
  const e8e = A({ action: 'admin.importPreview', session: AD1.session, srcUrl: 'OUTSIDE_SHEET_ID_0000000000001', templateUrl: 'OUTSIDE_SHEET_ID_0000000000001', code: 'FF50' });
  ok('[8] ALLOWED_FOLDER_IDS 可指定其他資料夾', !/不在允許/.test(e8e.error || ''), e8e.error || 'ok');
  ok('[8] 指定後原資料夾就不再允許', /不在允許/.test(A({ action: 'admin.importPreview', session: AD1.session, srcUrl: 'ORG_FF50_IN_FOLDER_000000000001', templateCode: 'FFK19', code: 'FF50' }).error || ''));
  delete env.props.ALLOWED_FOLDER_IDS;

  // [低 9] 取不到擁有者時 fail closed
  const DBF = env.files[DB_ID]; DBF.noOwner = true;
  ok('[9] 取不到擁有者：不能初始化、不能新增站長', (G.menuInitAdmin(), /只有試算表擁有者/.test(env.ui.alerts.pop())) && (env.ui.prompts.push('ANYCODE1'), G.menuAddAdmin(), /只有試算表擁有者/.test(env.ui.alerts.pop())));
  DBF.noOwner = false; env.ui.prompts.length = 0;
  env.activeUser = ''; ok('[9] 取不到目前使用者：拒絕', (G.menuAdmins(), /只有試算表擁有者/.test(env.ui.alerts.pop()))); env.activeUser = undefined;

  // 其他
  ok('[其他] HTML 標籤寫法一律拒絕（含 <b onmouseover>）', ['<b onmouseover=alert(1)>x</b>', '<div>', '</p>', '<!-- x -->', '<?php'].every(v => !G.validateField_('特殊標籤或備註', v, '').ok));
  ok('[其他] 一般文字中的 < > 可以用（例如 <3、< 新刊 >）', G.validateField_('特殊標籤或備註', '謝謝大家 <3 ＞＜', '').ok && G.validateField_('筆名', '< 新刊 >', '').ok);
  dH.push('私人備註'); dbS.data[dRow].push('不應公開的內容'); G.bumpVersion_();
  const od = get({ action: 'owner', id: 'C00968' });
  ok('[其他] 攤主頁只回傳白名單欄位（新增的私人欄位不會外洩）', od.ok && !JSON.stringify(od).includes('不應公開的內容') && od.data.dbRows.every(r => Object.keys(r.fields).every(k => G.PUBLIC_DB_FIELDS.includes(k))));
  ok('[其他] index 也不含私人欄位', !JSON.stringify(get({ action: 'index' })).includes('不應公開的內容'));
  dH.pop(); dbS.data[dRow].pop(); G.bumpVersion_();
  const ev14 = get({ action: 'event', code: 'FFK19' });
  ok('[其他] 場次頁只回傳可填欄位（正式欄名）', ev14.ok && ev14.data.booths.every(b => Object.keys(b.fields).every(k => G.EVENT_EDITABLE.includes(k))));
  const s14 = A({ action: 'admin.summary', session: AD1.session });
  ok('[營運] 後台 summary 回傳試算表編輯者人數（設定頁警告用）', s14.ok && typeof s14.data.sheetEditors === 'number');
}
// ===== 15. 認領驗證方式（p5）：SNS 貼文／私訊粉專或 LINE／Discord =====
{
  const A = b => post(b), login = sub => post({ action: 'login', idToken: 'fake:' + sub });
  const dbS = sheet(DB_ID, '新攤位資料庫'), H = dbS.data[0], idc = H.indexOf('攤主ID'), twc = H.indexOf('TWITTER (1)');
  const taken = new Set(claims().map(r => r[2])), free = dbS.data.slice(1).filter(r => /^C\d{5,}$/.test(r[idc]) && !taken.has(r[idc]) && !G.ownerSuspended_(r[idc]));
  const pickFree = () => { const r = free.shift(); taken.add(r[idc]); return r; };
  const nRows = () => claims().length, rowOf = (id, u) => claims().find(r => r[2] === id && r[4] === u);
  // 預覽：只拿驗證碼，不寫入
  const U1 = login('p5-dm'), u1 = G.readSession_(U1.session), o1 = pickFree()[idc], n0 = nRows();
  const pv = A({ action: 'claim', session: U1.session, ownerId: o1, preview: true });
  ok('[p5] 預覽只回傳驗證碼與「未送出」，不新增認領列', pv.ok && /^JP-[A-Z0-9]{6}$/.test(pv.data.code) && pv.data.status === '未送出' && nRows() === n0, JSON.stringify(pv.data));
  for (let i = 0; i < 5; i++) A({ action: 'claim', session: U1.session, ownerId: o1, preview: true });
  ok('[p5] 預覽不吃認領次數上限（3 次／日）', A({ action: 'claim', session: U1.session, ownerId: o1, preview: true }).ok);
  // 私訊粉專／LINE：不需要網址，送了網址也不存
  const d1 = A({ action: 'claim', session: U1.session, ownerId: o1, method: 'dm', proofUrl: 'https://x.com/evil/status/1234567890', note: '已私訊 LINE' });
  const r1 = rowOf(o1, u1);
  ok('[p5] 私訊粉專／LINE：不需貼文網址即可送出，驗證方式欄＝「私訊粉專／LINE」', d1.ok && d1.data.status === '待審核' && r1 && r1[5] === '私訊粉專／LINE' && r1[6] === '' && r1[7] === pv.data.code && r1[9] === '待審核', r1 && r1.slice(5, 10).join('|'));
  ok('[p5] 驗證碼與預覽相同（同一人同一攤主固定）', d1.data.code === pv.data.code);
  // Discord
  const U2 = login('p5-discord'), u2 = G.readSession_(U2.session), o2 = pickFree()[idc];
  const d2 = A({ action: 'claim', session: U2.session, ownerId: o2, method: 'discord' });
  ok('[p5] Discord：不需網址，驗證方式欄＝「Discord」，狀態待審核', d2.ok && rowOf(o2, u2) && rowOf(o2, u2)[5] === 'Discord' && rowOf(o2, u2)[9] === '待審核');
  // SNS：明確選 sns 時必須有貼文網址；個人頁仍拒絕
  const U3 = login('p5-sns'), u3 = G.readSession_(U3.session), fr3 = free.find(r => /^https:\/\/x\.com\/[A-Za-z0-9_]+\/?$/.test(r[twc])); free.splice(free.indexOf(fr3), 1);
  const o3 = fr3[idc], tw3 = fr3[twc].replace(/\/$/, '');
  const s0 = A({ action: 'claim', session: U3.session, ownerId: o3, method: 'sns' });
  ok('[p5] SNS 驗證沒有貼文網址 → 拒絕且不寫入', s0.ok === false && /貼文/.test(s0.error) && !rowOf(o3, u3), s0.error);
  const s1 = A({ action: 'claim', session: U3.session, ownerId: o3, method: 'sns', proofUrl: tw3 });
  ok('[p5] SNS 驗證：個人頁網址仍拒絕（p4 規則不變）', s1.ok === false && /一則貼文/.test(s1.error));
  const s2 = A({ action: 'claim', session: U3.session, ownerId: o3, method: 'sns', proofUrl: tw3 + '/status/1860000000000000099' });
  ok('[p5] SNS 驗證：貼文網址＋帳號相符 → 驗證方式「SNS 貼文」、標示帳號相符', s2.ok && rowOf(o3, u3)[5] === 'SNS 貼文' && /帳號相符，仍需確認貼文含驗證碼/.test(rowOf(o3, u3)[8]));
  ok('[p5] 失敗的送出也算次數（防暴力嘗試）：第 4 次被擋', A({ action: 'claim', session: U3.session, ownerId: o3, method: 'discord' }).ok === false);
  // 已有待審核申請 → 改方式只更新同一列（換一位申請者，避免次數上限）
  const U3b = login('p5-switch'), fr3b = free.find(r => /^https:\/\/x\.com\/[A-Za-z0-9_]+\/?$/.test(r[twc])); free.splice(free.indexOf(fr3b), 1);
  const o3b = fr3b[idc]; A({ action: 'claim', session: U3b.session, ownerId: o3b, method: 'sns', proofUrl: fr3b[twc].replace(/\/$/, '') + '/status/1860000000000000777' });
  { const U3 = U3b, u3 = G.readSession_(U3b.session), o3 = o3b;
  const before = nRows(), d3 = A({ action: 'claim', session: U3.session, ownerId: o3, method: 'discord' });
  ok('[p5] 已在待審核時改用 Discord：更新同一列（不新增），貼文欄清空', d3.ok && d3.data.updated && nRows() === before && rowOf(o3, u3)[5] === 'Discord' && rowOf(o3, u3)[6] === '');
  const pv3 = A({ action: 'claim', session: U3.session, ownerId: o3, preview: true });
  ok('[p5] 預覽待審核申請時回傳目前方式', pv3.data.status === '待審核' && pv3.data.method === 'discord'); }
  ok('[p5] 不明的驗證方式被拒絕', A({ action: 'claim', session: login('p5-bad').session, ownerId: pickFree()[idc], method: 'email' }).ok === false);
  // 說明欄公式注入
  const U5 = login('p5-formula'), o5 = pickFree()[idc]; A({ action: 'claim', session: U5.session, ownerId: o5, method: 'dm', note: '=HYPERLINK("https://evil.example","x")' });
  ok('[p5] 說明欄經 safeCell_（公式變純文字）', /^'=/.test(rowOf(o5, G.readSession_(U5.session))[8]));
  // 舊前端相容：沒帶 method、沒帶 preview → 跟 p4 一樣建立 SNS 貼文申請（貼文選填）；之後帶 method:'post' 會補上貼文
  const U6 = login('p5-legacy'), u6 = G.readSession_(U6.session), fr6 = free.find(r => /^https:\/\/x\.com\/[A-Za-z0-9_]+\/?$/.test(r[twc])); free.splice(free.indexOf(fr6), 1);
  const l1 = A({ action: 'claim', session: U6.session, ownerId: fr6[idc] });
  ok('[p5] 舊前端：第一次（無 method）仍建立待審核申請並回傳驗證碼', l1.ok && l1.data.code && rowOf(fr6[idc], u6) && rowOf(fr6[idc], u6)[5] === 'SNS 貼文');
  const l2 = A({ action: 'claim', session: U6.session, ownerId: fr6[idc], method: 'post', proofUrl: fr6[twc].replace(/\/$/, '') + '/status/1860000000000000123' });
  ok('[p5] 舊前端：再送 method:post＋貼文網址會補進同一列（p4 以前會被忽略）', l2.ok && /status\/1860000000000000123/.test(rowOf(fr6[idc], u6)[6]) && claims().filter(r => r[4] === u6).length === 1);
  // 送出次數上限仍在
  const U7 = login('p5-rate'), o7 = pickFree()[idc]; let last;
  for (let i = 0; i < 4; i++) last = A({ action: 'claim', session: U7.session, ownerId: o7, method: i % 2 ? 'dm' : 'discord' });
  ok('[p5] 送出認領仍有 3 次／日上限', last.ok === false && /頻繁/.test(last.error), last.error);
  // 站長佇列顯示方式；核准仍需人工
  const AD = login('admin-one'), q = A({ action: 'admin.queue', session: AD.session });
  const qd = q.ok && q.data.claims.find(c => c.ownerId === o2), qm = q.ok && q.data.claims.find(c => c.ownerId === o1);
  ok('[p5] 站長佇列顯示驗證方式（Discord／私訊粉專／LINE）', qd && qd.method === 'Discord' && qm && qm.method === '私訊粉專／LINE', JSON.stringify(qd && { m: qd.method }));
  ok('[p5] 送出後仍未核准：攤主不能修改（需站長核准）', A({ action: 'me', session: U2.session }).me.owned.indexOf(o2) < 0);
  ok('[p5] 認領申請分頁欄位數不變（14 欄，沒有新增欄位）', claims().every(r => r.length <= 14) && sheet(DB_ID, '認領申請').data[0].length === 14);
}
ok('自我檢查全部通過', G.selfTest_().every(l => l.startsWith('✅')), G.selfTest_().filter(l => !l.startsWith('✅')).join(' '));
console.log(results.join('\n')); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
