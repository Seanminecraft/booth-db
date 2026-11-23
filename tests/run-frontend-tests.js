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
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
