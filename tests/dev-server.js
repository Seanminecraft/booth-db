// 本機開發伺服器：靜態網站 site/ ＋ 以模擬環境執行 apps-script/code.gs 的 /api。不連真實試算表、不連網。
// 用法：node tests/dev-server.js [port] （fixtures 目錄同 run-tests.js：環境變數 FIXTURES 或 ../../test-fixtures）
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const { makeEnv } = require('./gas-mock');
const PORT = +process.argv[2] || 8787, ROOT = path.join(__dirname, '../site');
const FX = process.env.FIXTURES || path.join(__dirname, '../../test-fixtures');
const load = f => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf8'));
const CLIENT = 'dev-client.apps.googleusercontent.com';
const PUBLIC_RE = /^1[A-Za-z0-9_-]{24,}$/; // 開發模式：fixture 裡標為公開的縮圖都當作公開
function fetch(url, o) {
  const resp = (code, body, headers) => ({ getResponseCode: () => code, getContentText: () => body || '', getHeaders: () => headers || {} });
  if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) { const m = decodeURIComponent(url.split('id_token=')[1]).match(/^fake:(.+)$/); if (!m) return resp(400, '{}');
    const stale = /~stale$/.test(m[1]), now = Math.floor(Date.now() / 1000); // 「fake:sub~stale」＝20 分鐘前登入（測試重新登入視窗）
    return resp(200, JSON.stringify({ aud: CLIENT, iss: 'https://accounts.google.com', sub: m[1].replace(/~stale$/, ''), iat: String(stale ? now - 1200 : now), exp: String(now + 3600) })); }
  if (url.startsWith('https://lh3.googleusercontent.com/d/')) { const id = url.split('/d/')[1].split('=')[0]; return /A{10}/.test(id) ? resp(403, '') : resp(200, '', { 'Content-Type': 'image/jpeg' }); }
  if (url.startsWith('https://safebrowsing.googleapis.com/')) return resp(200, '{}');
  return resp(404, '');
}
const env = makeEnv({ props: { HMAC_SECRET: 'dev-only-secret-'.repeat(3), OAUTH_CLIENT_ID: CLIENT }, fetch });
const DB_ID = 'DEV_DB', FFK = 'DEV_FFK19_COPY';
const H_CLAIM = ['申請ID', '申請時間', '攤主ID', '攤位名稱', '申請者代號', '驗證方式', '驗證連結', '驗證碼', '說明', '狀態', '審核時間', '審核備註', '角色', '最後活動'];
const H_EDIT = ['申請ID', '申請時間', '類型', '攤主ID', '目標', '目標鍵', '欄位', '舊值', '新值', '申請者代號', '風險', '風險說明', '狀態', '審核時間', '審核備註', '套用位置', '套用前值', '套用時間', '批次ID'];
env.addFile(DB_ID, '攤位資料庫', [['新攤位資料庫', load('fixture_db.json')], ['場次出展紀錄', load('fixture_log.json')], ['認領申請', [H_CLAIM]], ['修改申請', [H_EDIT]]]);
const ffk = load('fixture_ffk19.json');
env.addFile(FFK, 'FFK19 完整攤位整理', [['FFK19 攤位整理表單操作手冊', [['', 'FFK19 攤位整理表單  使用說明']]], ['攤位整理表 請在此填寫資訊', ffk, {}]]);
env.setActive(DB_ID);
const G = vm.createContext(env); vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/code.gs'), 'utf8'), G, { filename: 'code.gs' });
G.setActiveEvents_([{ code: 'FFK19', name: 'Fancy Frontier 開拓動漫祭 高雄場 19', start: '2026-12-05', sheetId: FFK, tab: '攤位整理表 請在此填寫資訊', status: '整理中' }]);
// 第二個整理中場次：用匯入功能從模擬主辦名單建立 FF48
const lg = load('fixture_log.json'), ff47 = lg.filter(r => r[1] === 'FF47').slice(0, 40);
env.addFile('DEV_ORG_FF48', 'FF48 名單', [['工作表1', [['攤位編號', '社團名稱', '參加日期']].concat(ff47.map((r, i) => [String.fromCharCode(65 + (i % 6)) + String(i + 1).padStart(2, '0'), r[4], i % 3 ? '兩天' : '第一天']))]]);
G.importEvent_({ code: 'FF48', name: 'Fancy Frontier 開拓動漫祭 48', start: '2027-02-06', srcId: 'DEV_ORG_FF48', templateId: FFK, prefill: true });
// 開發用帳號 dev-owner-1：已核准管理 心桃魅夢（C00968）
const uid = G.uidOf_('dev-owner-1');
G.sheet_('認領申請').appendRow(['CLDEV', G.now_(), 'C00968', '心桃魅夢', uid, 'SNS 貼文', '', 'JP-DEV000', '開發資料', '核准', G.now_(), '', 'owner', G.now_()]);
// 開發用帳號 dev-owner-2：已核准管理 加帕利天藍怪預警中心（C02492，只有出展紀錄、主資料庫沒有列；回歸測試用）
G.sheet_('認領申請').appendRow(['CLDEV2', G.now_(), 'C02492', '加帕利天藍怪預警中心', G.uidOf_('dev-owner-2'), 'SNS 貼文', '', 'JP-DEV002', '開發資料', '核准', G.now_(), '', 'owner', G.now_()]);
// ===== 站長（開發）：用真實程式路徑初始化、配對兩位站長（dev-admin＝擁有者站長「小編A」、dev-admin-2＝站長「小編B」） =====
const P = b => JSON.parse(G.doPost({ postData: { contents: JSON.stringify(b) } }).getContent());
const S_ = sub => P({ action: 'login', idToken: 'fake:' + sub }).session;
const log = (r, l) => { if (!r.ok) console.log('seed fail', l, r.error); return r; };
G.menuInitAdmin();
[['dev-admin', '小編A'], ['dev-admin-2', '小編B']].forEach(([sub, label]) => { const c = P({ action: 'admin.pairStart', session: S_(sub), label }).data.code; env.ui.prompts.push(c); G.menuAddAdmin(); });
if (!process.env.NO_SEED) {
  // 樣本申請（真實 API 路徑）
  const approveClaim = (sub, id, name) => G.sheet_('認領申請').appendRow(['CL' + id, '2026-11-20 21:14:03', id, name, G.uidOf_(sub), 'SNS 貼文', '', 'JP-OK0000', '', '核准', '2026-11-20 22:00:00', '站長 小編A', 'owner', G.now_()]);
  approveClaim('owner-c00007', 'C00007', '青雨アメ'); approveClaim('owner-c00045', 'C00045', '貓頭鷹辦事處');
  const sa = S_('claimer-a'), sb = S_('claimer-b'), sc = S_('claimer-c'), s1 = S_('dev-owner-1'), s7 = S_('owner-c00007');
  log(P({ action: 'claim', session: sa, ownerId: 'C00113', proofUrl: 'https://twitter.com/e831118/status/1859990001112223334', note: '我是 Feshana 的作者，貼文已發在主帳號' }), 'claim a');
  log(P({ action: 'claim', session: sb, ownerId: 'C00113', proofUrl: 'https://x.com/feshana_official2/status/1859990001112229999', note: '本人' }), 'claim b');
  log(P({ action: 'claim', session: sc, ownerId: 'C00002', method: 'dm', note: '已私訊加帕利粉專，帳號 TOHOORIN' }), 'claim c');
  log(P({ action: 'edit', session: s1, ownerId: 'C00968', rowName: '心桃魅夢', changes: { 'IG': 'https://www.instagram.com/mion_kokomo_new/?igsh=abc', '官方網站': 'https://mionkokomo.carrd.co/', '筆名': 'Mion Kokomo 心桃' } }), 'edit 968');
  log(P({ action: 'eventfill', session: s1, ownerId: 'C00968', event: 'FFK19', booth: '心桃魅夢', boothNo: '子05', changes: { '販售資訊': '💠新刊【心桃畫冊 Vol.2 NT$300】\n💠周邊【壓克力立牌、明信片】', '預告': 'https://x.com/MionKokomo/status/1860001112223334445', '試閱': 'https://www.pixiv.net/artworks/124578963?utm_source=twitter' } }), 'fill 968');
  log(P({ action: 'edit', session: s7, ownerId: 'C00007', rowName: '', changes: { 'TWITTER (1)': 'https://x.com/duck_doodle_new', 'Linktree等連結整合網頁': 'https://xn--80ak6aa92e.com/duck' } }), 'edit 7');
  log(P({ action: 'eventfill', session: s7, ownerId: 'C00007', event: 'FFK19', booth: '青雨アメ', changes: { '販售資訊': '💠新刊【青雨新刊《梅雨のあとで》NT$250】\n💠周邊【壓克力鑰匙圈】', '品書': 'https://www.plurk.com/p/3h9xk2' } }), 'fill 7');
  log(P({ action: 'report', session: sa, a: 'C00002', b: 'C00158', kind: 'split', note: '這兩個不是同一位，只是都用買動漫賣場' }), 'report');
  // 站長操作（稽核頁有實際紀錄）
  const A1 = S_('dev-admin'), A2 = S_('dev-admin-2');
  const q = P({ action: 'admin.queue', session: A2 }).data;
  const c45 = q.claims.find(c => c.ownerId === 'C00002'); if (c45) log(P({ action: 'admin.decide', session: A2, ids: [c45.id], decision: 'approve', note: '粉專私訊已確認' }), 'decide claim');
  const b7 = q.batches.find(b => b.ownerId === 'C00007' && b.type === '主資料修改'); const tw7 = b7 && b7.items.find(i => i.field === 'TWITTER (1)');
  if (tw7) log(P({ action: 'admin.decide', session: A2, ids: [tw7.id], decision: 'approve2', note: '已用原 X 帳號私訊確認' }), 'first approval');
  log(P({ action: 'admin.ownerEdit', session: A2, ownerId: 'C00045', rowName: '', changes: { '筆名': '狐狸,タク道,小狐', '創作者類型': '繪師' } }), 'admin edit 45');
  log(P({ action: 'admin.relationDecide', session: A1, a: 'C00004', b: 'C00785', decision: 'unrelated', note: '筆名相同但作品風格不同' }), 'unrelated');
}
G.bumpVersion_();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      let out; try { out = req.method === 'POST' ? G.doPost({ postData: { contents: body } }) : G.doGet({ parameter: Object.fromEntries(u.searchParams) }); } catch (e) { out = { getContent: () => JSON.stringify({ ok: false, error: String(e) }) }; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(out.getContent());
    }); return;
  }
  if (u.pathname === '/assets/config.js') { res.writeHead(200, { 'Content-Type': MIME['.js'] });
    return res.end("window.BOOTH_CONFIG={API_URL:'/api',OAUTH_CLIENT_ID:'',SITE_NAME:'攤位資料庫',CONTACT:'（開發模式）',DEV_LOGIN:true};"); }
  const p = path.normalize(path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('dev server http://localhost:' + PORT + '  (dev login: dev-owner-1 manages C00968, dev-owner-2 manages C02492, dev-admin = 擁有者站長 小編A, dev-admin-2 = 站長 小編B)'));
