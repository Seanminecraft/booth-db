// 站長後台讀取量比較（p7）：node tests/perf-admin.js <code.gs 路徑>
// 在模擬試算表（真實大小的 fixtures：約 6,000 位攤主）上，數「進入站長後台」一次要讀多少儲存格、幾次讀取、開幾次別的檔案。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeEnv, stats } = require('./gas-mock'); const { fakeJwt, readFake } = require('./fake-jwt');
const CODE = process.argv[2] || path.join(__dirname, '../apps-script/code.gs'), FX = path.join(__dirname, '../../test-fixtures');
const load = f => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf8')), CLIENT = 'test-client.apps.googleusercontent.com';
const env = makeEnv({ props: { HMAC_SECRET: 'x'.repeat(16) + 'test-secret-not-real-0123456789abcdef', OAUTH_CLIENT_ID: CLIENT }, fetch: url => { const resp = (c, b) => ({ getResponseCode: () => c, getContentText: () => b || '', getHeaders: () => ({}) });
  if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) { const pl = readFake(decodeURIComponent(url.split('id_token=')[1])); if (!pl) return resp(400, '{}'); return resp(200, JSON.stringify({ aud: pl.aud, iss: pl.iss, sub: pl.sub, iat: String(pl.iat), exp: String(pl.exp) })); }
  return resp(404); } });
const DB_ID = '1nwZIqcrSz-vVJidCFJLmvDPNZvg7n-NVwnsdRmDFRao', FFK = 'FFK19_TEST_COPY', ffk = load('fixture_ffk19.json');
env.addFile(DB_ID, '攤位資料庫', [['新攤位資料庫', load('fixture_db.json')], ['場次出展紀錄', load('fixture_log.json')],
  ['認領申請', [['申請ID', '申請時間', '攤主ID', '攤位名稱', '申請者代號', '驗證方式', '驗證連結', '驗證碼', '說明', '狀態', '審核時間', '審核備註', '角色', '最後活動']]],
  ['修改申請', [['申請ID', '申請時間', '類型', '攤主ID', '目標', '目標鍵', '欄位', '舊值', '新值', '申請者代號', '風險', '風險說明', '狀態', '審核時間', '審核備註', '套用位置', '套用前值', '套用時間', '批次ID']]]]);
env.addFile(FFK, 'FFK19', [['攤位整理表 請在此填寫資訊', ffk, {}]]); env.setActive(DB_ID);
const G = vm.createContext(env); vm.runInContext(fs.readFileSync(CODE, 'utf8'), G, { filename: 'code.gs' });
const post = b => JSON.parse(G.doPost({ postData: { contents: JSON.stringify(b && /^fake:/.test(b.idToken || '') ? Object.assign({}, b, { idToken: fakeJwt(b.idToken.slice(5), CLIENT) }) : b) } }).getContent());
G.setActiveEvents_([{ code: 'FFK19', name: 'FFK19', start: '2026-12-19', sheetId: FFK, tab: '攤位整理表 請在此填寫資訊', status: '整理中' }]);
G.menuInitAdmin(); const X = post({ action: 'login', idToken: 'fake:perf-admin' }); const pc = post({ action: 'admin.pairStart', session: X.session, label: 'A' }); if (!pc.ok) { console.log(X, pc); process.exit(1); } env.ui.prompts.push(pc.data.code); G.menuAddAdmin();
// 造 3 筆待審：1 筆認領＋2 筆場次填寫（一般攤主，審核制）
const U = post({ action: 'login', idToken: 'fake:perf-owner' }), uid = G.readSession_(U.session), ev = JSON.parse(G.doGet({ parameter: { action: 'event', code: 'FFK19' } }).getContent()).data;
const bk = ev.booths.filter(b => b.id && ev.booths.filter(x => x.name === b.name).length === 1).slice(0, 2);
bk.forEach(b => post({ action: 'claim', session: U.session, ownerId: b.id, method: 'discord' }));
const cs = env.files[DB_ID].getSheetByName('認領申請'); cs.data[1][9] = '核准';
post({ action: 'eventfill', session: U.session, ownerId: bk[0].id, event: 'FFK19', booth: bk[0].name, changes: { '筆名': 'perf-1' } });
post({ action: 'eventfill', session: U.session, ownerId: bk[0].id, event: 'FFK19', booth: bk[0].name, changes: { '特殊標籤或備註': 'perf-2' } });
function measure(label, fn) { stats.cells = 0; stats.reads = 0; stats.opens = 0; const t = Date.now(); const r = fn(); console.log(label.padEnd(34), String(stats.cells).padStart(9), '格', String(stats.reads).padStart(4), '次讀取', String(stats.opens).padStart(2), '次開別檔', String(Date.now() - t).padStart(5), 'ms(模擬)'); return r; }
const S = X.session, A = a => post(Object.assign({ session: S }, a));
G.bumpVersion_(); env.cache.clear();
console.log('版本：', vm.runInContext('VERSION', G));
measure('進後台（冷）summary', () => A({ action: 'admin.summary' }));
measure('進後台（冷）queue', () => A({ action: 'admin.queue' }));
measure('進後台（暖）summary', () => A({ action: 'admin.summary' }));
measure('進後台（暖）queue', () => A({ action: 'admin.queue' }));
const q = A({ action: 'admin.queue' }); console.log('待審：認領', q.data.claims.length, '批次', q.data.batches.length);
if (vm.runInContext("typeof adminCounts_", G) === 'function') {
  G.bumpVersion_(); env.cache.clear();
  measure('p7 admin.home（冷，一次往返）', () => A({ action: 'admin.home', tab: 'queue' }));
  measure('p7 admin.home（暖）', () => A({ action: 'admin.home', tab: 'queue' }));
  G.bumpVersion_(); measure('p7 admin.counts（輪詢，快取失效後）', () => A({ action: 'admin.counts' }));
  measure('p7 admin.counts（20 秒內重複）', () => A({ action: 'admin.counts' }));
}
