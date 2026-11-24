// 前端純函式回歸測試（不需要瀏覽器）：關聯資料覆蓋層去重、vis 關聯圖建立（重複 id／失敗不拖垮整頁）。
// 用法：node tests/run-frontend-tests.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../site/assets/app.js'), 'utf8');
const grab = name => { const m = src.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}\\n')); if (!m) throw new Error('找不到 ' + name); return m[0]; };
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  — ' + d : '')); };
const applyOverlay = new Function(grab('applyOverlay') + 'return applyOverlay;')();
const rel = JSON.parse(fs.readFileSync(path.join(__dirname, '../site/data/relations.json'), 'utf8'));
const dupOf = R => Object.keys(R.r).filter(k => new Set(R.r[k]).size !== R.r[k].length);
// 1. 覆蓋層（快照或即時）套上後，同一攤主的關聯攤主不能重複（舊版 has() 比對字串第一個字元 → 每組都加兩次）
let R = applyOverlay(rel, { built: 'x', merged: {}, unrelated: [], live: [] });
ok('空覆蓋層：沒有任何攤主的關聯攤主重複', dupOf(R).length === 0, dupOf(R).slice(0, 5).join(','));
ok('C00846 的關聯攤主不重複', !R.r.C00846 || new Set(R.r.C00846).size === R.r.C00846.length, JSON.stringify(R.r.C00846));
ok('C00096 的關聯攤主不重複', !R.r.C00096 || new Set(R.r.C00096).size === R.r.C00096.length, JSON.stringify(R.r.C00096));
ok('關聯是雙向的（a 在 b 裡、b 在 a 裡）', Object.keys(R.r).every(a => R.r[a].every(b => (R.r[b] || []).indexOf(a) >= 0)));
const pairs = new Set(); Object.keys(rel.r).forEach(a => rel.r[a].forEach(b => { if (a !== b) pairs.add([a, b].sort().join('|')); }));
const nNew = Object.keys(R.r).reduce((s, a) => s + R.r[a].length, 0);
ok('每組關聯剛好出現兩次（a→b、b→a），沒有多出', nNew === pairs.size * 2, pairs.size + ' 組 → ' + nNew + ' 筆');
const ownerA = Object.keys(rel.r)[0], ownerB = rel.r[ownerA][0];
R = applyOverlay(rel, { merged: { [ownerB]: ownerA }, unrelated: [], live: [[ownerA, ownerB, 'x'], [ownerA, 'C99998', '同 SNS'], ['C99998', ownerA, '同 SNS']] });
ok('合併後不會出現自己連自己', Object.keys(R.r).every(a => R.r[a].indexOf(a) < 0) && Object.keys(R.w).every(a => R.w[a].every(w => w[0] !== a)));
ok('合併＋即時關聯後仍無重複', dupOf(R).length === 0 && Object.keys(R.w).every(a => new Set(R.w[a].map(w => w[0])).size === R.w[a].length));
R = applyOverlay(rel, { merged: {}, unrelated: [[ownerA, ownerB]], live: [] });
ok('「確認無關」會移除該關聯', (R.r[ownerA] || []).indexOf(ownerB) < 0);
// 2. mountNet：假的 vis（DataSet 遇到重複 id 會丟出跟 vis 一樣的錯誤）
class DataSet { constructor(a) { const s = {}; a.forEach(x => { if (x.id !== undefined) { if (s[x.id]) throw new Error('Cannot add item: item with id ' + x.id + ' already exists'); s[x.id] = 1; } }); this.items = a; } }
let created = [], destroyed = 0, boom = false;
class Network { constructor(el, d) { if (boom) throw new Error('boom'); this.d = d; created.push(this); } destroy() { destroyed++; } on() { } once() { } }
const el = () => ({ kids: [], textContent: '' });
const stubs = 'var window = {}, vis = VIS, LIVE_NETS = []; function t(k) { return k; } function clear(e) { e.kids = []; } function add(e, c) { e.kids.push(c); } function h(tag, a) { return { tag: tag, text: a && a.text }; }\n';
const mk = new Function('VIS', stubs + grab('mountNet') + grab('destroyNets') + 'return { mountNet: mountNet, destroyNets: destroyNets, live: function () { return LIVE_NETS.length; } };');
const M = mk({ DataSet, Network });
const nodes = [{ id: 'o:C00096' }, { id: 'g:C00846' }, { id: 'g:C00846' }, { id: 'g:C04400' }, { id: 'w:C00846' }];
const edges = [{ from: 'o:C00096', to: 'g:C00846' }, { from: 'o:C00096', to: 'g:C00846' }, { from: 'g:C00846', to: 'o:C00096' }, { from: 'o:C00096', to: 'g:C04400', id: 'x' }, { from: 'o:C00096', to: 'g:NOPE' }, { from: 'o:C00096', to: 'o:C00096' }];
const e1 = el(); let m = M.mountNet(e1, nodes, edges, {});
ok('重複節點 id 不會丟錯（C00846 情境）', !!m && m.nodes.length === 4, m && m.nodes.map(n => n.id).join(','));
ok('重複／反向／自連／端點不存在的邊都移除', !!m && m.net.d.edges.items.length === 2, m && JSON.stringify(m.net.d.edges.items));
ok('邊的 id 不帶入（避免邊 id 重複）', !!m && m.net.d.edges.items.every(e => e.id === undefined));
M.mountNet(e1, nodes, edges, {});
ok('同一容器重畫會先銷毀舊圖', destroyed === 1 && created.length === 2);
M.destroyNets(); ok('換頁時銷毀所有圖', destroyed === 2 && M.live() === 0);
boom = true; const e2 = el(); m = M.mountNet(e2, nodes, edges, {});
ok('vis 建圖失敗時不丟錯，只在圖的位置顯示訊息', m === null && e2.kids.length === 1 && e2.kids[0].text === 'graph_fail');
// 3. 販售資訊（p6 套組）：解析／組回不丟字，組回的文字一定通過後端 salesFormat_
const gs = fs.readFileSync(path.join(__dirname, '../apps-script/code.gs'), 'utf8');
const salesVars = src.match(/  var SALES_RE = [^\n]*\n/)[0];
const S6 = new Function(salesVars + grab('parseSales') + grab('serSales') + 'return { parseSales: parseSales, serSales: serSales };')();
const gsVars = gs.match(/var SALES_LINE[^\n]*\n[^\n]*\n/)[0], gsFn = gs.match(/function salesFormat_\(v\) \{[\s\S]*?\n\}\n/)[0];
const backend = new Function('function str_(v) { return v == null ? "" : String(v); }\n' + gsVars + gsFn + 'return salesFormat_;')();
const EX = '💠套組1\n1. 商品名1-1\n2. 商品名1-2\n💠套組2\n1. 商品名2-1\n2. 商品名2-2\n💠單品1【A】\n💠單品2【B】';
let B = S6.parseSales(EX, '商品');
ok('[p6] 使用者範例：解析成 2 個套組＋2 個單品', B.map(x => x.k).join(',') === 'bundle,bundle,item,item' && B[0].name === '套組1' && B[0].items.join('|') === '商品名1-1|商品名1-2');
ok('[p6] 使用者範例：組回與原文完全相同', S6.serSales(B) === EX, JSON.stringify(S6.serSales(B)));
ok('[p6] 使用者範例：後端格式檢查通過且不改字', backend(EX).ok && backend(EX).value === EX);
const editorOut = S6.serSales([{ k: 'item', cat: '新刊', con: '畫冊 NT$300' }, { k: 'bundle', name: '新刊套組', items: ['畫冊', '', '壓克力立牌'] }, { k: 'bundle', name: '', items: [''] }, { k: 'item', cat: '', con: '' }]);
ok('[p6] 編輯器輸出：空的商品／空套組／空單品略過，編號自動重排', editorOut === '💠新刊【畫冊 NT$300】\n💠新刊套組\n1. 畫冊\n2. 壓克力立牌', JSON.stringify(editorOut));
ok('[p6] 編輯器輸出通過後端', backend(editorOut).ok);
B = S6.parseSales('💠舊寫法 NT$100\n隨便的備註\n※ 售完為止\n💠套組A\n1. a\n1. b', '商品');
ok('[p6] 舊資料：沒有【】的 💠 行轉成單品（類別預設）並標示', B.legacy && B[0].k === 'item' && B[0].cat === '商品' && B[0].con === '舊寫法 NT$100');
ok('[p6] 看不懂的行原樣保留成「其他文字」（不丟字）', B[1].k === 'text' && B[1].text === '隨便的備註\n※ 售完為止');
ok('[p6] 編號重新從 1 開始：第二個 1. 不併進套組，原樣保留', B[2].k === 'bundle' && B[2].items.join() === 'a' && B[3].k === 'text' && B[3].text === '1. b');
ok('[p6] 有「其他文字」時後端會擋下（不會默默寫入）', !backend(S6.serSales(B)).ok);
B = S6.parseSales('  💠　套組X \n 1)  甲 \n2． 乙\n3、丙', '商品');
ok('[p6] 各種編號寫法與全形空白都能讀成套組', B.length === 1 && B[0].k === 'bundle' && B[0].name === '套組X' && B[0].items.join('|') === '甲|乙|丙', JSON.stringify(B));
ok('[p6] 組回後為標準格式', S6.serSales(B) === '💠套組X\n1. 甲\n2. 乙\n3. 丙');
// 真實資料：不丟任何字（每個非空字元都還在）
const fx = path.join(__dirname, '../../test-fixtures/fixture_ffk19.json');
if (fs.existsSync(fx)) {
  const F = JSON.parse(fs.readFileSync(fx, 'utf8')), cells = [];
  (function walk(o) { if (Array.isArray(o)) { const i = o.indexOf('販售資訊'); if (i >= 0 && typeof o[i] === 'string' && o.length > 3) walk.col = i; o.forEach(walk); } else if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (k === '販售資訊' && typeof o[k] === 'string') cells.push(o[k]); walk(o[k]); }); })(F);
  const rowsArr = []; (function walk2(o) { if (Array.isArray(o) && o.length && Array.isArray(o[0]) && o[0].indexOf('販售資訊') >= 0) { const c = o[0].indexOf('販售資訊'); o.slice(1).forEach(r => { if (r[c]) rowsArr.push(String(r[c])); }); } else if (o && typeof o === 'object') Object.values(o).forEach(walk2); })(F);
  const all = cells.concat(rowsArr).filter(Boolean);
  const norm = x => x.replace(/[\s【】💠]|^\d+[.．、)）]/gm, '').replace(/\d+[.．、)）]/g, '');
  const lost = all.filter(c => { const out = S6.serSales(S6.parseSales(c, '')); return norm(out) !== norm(c); });
  ok('[p6] 真實 FFK19 販售資訊 ' + all.length + ' 格：解析＋組回都不丟字', all.length > 0 && lost.length === 0, lost.slice(0, 2).map(x => JSON.stringify(x)).join(' / '));
  const passAgain = all.map(c => S6.serSales(S6.parseSales(c, '商品'))).filter(o => !/^(?!💠|\d)/m.test(o));
  ok('[p6] 沒有其他文字的格子，組回後都通過後端', passAgain.every(o => backend(o).ok), passAgain.filter(o => !backend(o).ok).slice(0, 2).join(' / '));
}
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
