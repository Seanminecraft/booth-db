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
    return resp(200, JSON.stringify({ aud: CLIENT, iss: 'https://accounts.google.com', sub: m[1], exp: String(Math.floor(Date.now() / 1000) + 3600) })); }
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
}).listen(PORT, () => console.log('dev server http://localhost:' + PORT + '  (dev login: dev-owner-1 manages C00968)'));
