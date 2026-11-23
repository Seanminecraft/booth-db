// UI 回歸：有關聯攤主的頁面不可出現「Cannot add item … already exists」、連續換頁正常、關聯圖失敗不拖垮整頁。
// 先重新啟動 node tests/dev-server.js 8787，再 PUPPETEER_PATH=… [BASE=…] node tests/ui-regression-graph-dup.js
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const B = process.env.BASE || 'http://localhost:8787/'; const res = [];
const ok = (n, c, d) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const IDS = ['C00096', 'C00846', 'C00003', 'C00004', 'C02293', 'C00826', 'C00005', 'C00968'];
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(B + '?lang=zh#/', { waitUntil: 'networkidle2' });
  const state = () => p.evaluate(() => { const bad = document.querySelector('#app .note.bad'); return { bad: bad ? bad.textContent : '', canvas: !!document.querySelector('#graph canvas'), name: (document.querySelector('#app .dhead .big') || {}).textContent || '', rel: [...document.querySelectorAll('#app .tags a.tag')].map(a => a.getAttribute('href')) }; });
  const go = async id => { await p.evaluate(i => { location.hash = '#/o/' + i; }, id); await p.waitForFunction(() => document.querySelector('#app .note.bad') || document.querySelector('#graph canvas') || /graph_fail|關聯圖暫時無法顯示/.test(document.getElementById('app').textContent), { timeout: 30000 }).catch(() => {}); await sleep(400); return state(); };
  for (const round of [1, 2]) for (const id of IDS) {
    const s = await go(id);
    ok(`第 ${round} 輪 ${id}：沒有錯誤卡、關聯圖畫出`, !s.bad && s.canvas, s.bad || s.name);
    if (round === 1) ok(`${id}：「相關攤主」沒有重複`, new Set(s.rel).size === s.rel.length, s.rel.join(','));
  }
  // 從關聯攤主的連結點過去（使用者實際操作）
  await go('C00096'); await p.evaluate(() => { const a = [...document.querySelectorAll('#app .tags a.tag')].find(a => /C00846/.test(a.getAttribute('href'))); a && a.click(); }); await sleep(2500);
  let s = await state(); ok('從 C00096 點「相關攤主」到 C00846 正常', !s.bad && s.canvas && /C00846/.test(await p.evaluate(() => location.hash)), s.bad);
  // vis 建圖失敗：只有圖的位置顯示訊息，其餘資料照常顯示
  await p.evaluate(() => { window.__RealNet = vis.Network; vis.Network = function () { throw new Error('forced'); }; });
  s = await go('C00004'); const txt = await p.$eval('#app', e => e.textContent);
  ok('關聯圖失敗時整頁不會變成「資料載入失敗」', !s.bad && !!s.name && /關聯圖暫時無法顯示/.test(txt) && /出展紀錄|出展/.test(txt), s.bad || txt.slice(0, 120));
  await p.evaluate(() => { vis.Network = window.__RealNet; });
  s = await go('C00846'); ok('恢復後再換頁仍正常', !s.bad && s.canvas);
  // 首頁總覽圖切換「兩兩相連」兩次（同一容器重畫）
  await p.evaluate(() => { location.hash = '#/'; }); await sleep(1500); await p.evaluate(() => document.querySelector('.ovcard').scrollIntoView()); await sleep(5000);
  for (let i = 0; i < 2; i++) { await p.evaluate(() => document.querySelector('.ovcard input[type=checkbox]').click()); await sleep(4000); }
  ok('首頁總覽圖重畫兩次沒有錯誤', !(await p.evaluate(() => !!document.querySelector('#app .note.bad'))) && await p.evaluate(() => document.querySelectorAll('#overview canvas').length === 1));
  ok('沒有未捕捉的頁面錯誤', errs.length === 0, errs.join(' | '));
  await b.close(); console.log(res.join('\n'));
})().catch(e => { console.error(e); console.log(res.join('\n')); process.exit(1); });
