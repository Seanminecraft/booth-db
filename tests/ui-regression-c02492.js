// UI 回歸測試（C02492：只有出展紀錄的攤主）。先跑 node tests/dev-server.js 8787，再 PUPPETEER_PATH=/path/to/node_modules/puppeteer-core node tests/ui-regression-c02492.js
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const OUT = process.env.SHOT_DIR || '/tmp/'; const res = [];
const ok = (n, c, d) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1.5 });
  // 未登入：顯示認領
  await p.goto('http://localhost:8787/?lang=zh#/o/C02492', { waitUntil: 'networkidle0' });
  await p.waitForSelector('.acts .btn');
  let txt = await p.$eval('.acts .btn', e => e.textContent); ok('未登入顯示認領', /認領/.test(txt), txt);
  // 登入 dev-owner-2（管理 C02492）
  await p.goto('http://localhost:8787/?lang=zh&devlogin=dev-owner-2#/o/C02492', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => /編輯/.test((document.querySelector('.acts .btn') || {}).textContent || ''), { timeout: 8000 }).catch(() => {});
  txt = await p.$eval('.acts .btn', e => e.textContent); ok('管理者在攤主頁看到「編輯」而不是「認領」', /編輯/.test(txt) && !/認領/.test(txt), txt);
  await p.screenshot({ path: OUT + 'owner_page_edit_button.png' });
  await p.click('.acts .btn');
  await p.waitForSelector('#modal:not([hidden]) .frow', { timeout: 8000 }).catch(() => {});
  const nrows = await p.$$eval('#mbody .frow', x => x.length); const note = await p.$eval('#mbody', e => e.textContent);
  ok('編輯表單打開（新列模式）', nrows > 3 && /主資料庫還沒有資料列/.test(note), nrows + ' 欄');
  await p.screenshot({ path: OUT + 'edit_form_new_row.png' });
  await p.evaluate(() => { const r = [...document.querySelectorAll('#mbody .frow')].find(x => x.querySelector('.k').textContent === '筆名'); r.querySelector('input,textarea').value = '天藍怪'; });
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /預覽/.test(x.textContent)).click());
  await p.waitForFunction(() => [...document.querySelectorAll('#mbody button')].some(x => /確認/.test(x.textContent)), { timeout: 8000 });
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /確認/.test(x.textContent)).click());
  await p.waitForSelector('#mbody .note.good, #mbody .note.bad', { timeout: 8000 }).catch(() => {});
  const fin = await p.$eval('#mbody', e => { const n = e.querySelector('.note.good, .note.bad'); return n ? n.className + '|' + n.textContent : ''; }); ok('送出成功（進入審核佇列）', /good/.test(fin), fin);
  await p.screenshot({ path: OUT + 'edit_submitted.png' });
  await p.keyboard.press('Escape'); await p.evaluate(() => { const m = document.getElementById('modal'); if (m) m.hidden = true; });
  // 「我的攤位」頁的編輯按鈕也能開
  await p.goto('http://localhost:8787/?lang=zh&devlogin=dev-owner-2#/me', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => !/載入中/.test(document.getElementById('app').textContent), { timeout: 8000 }).catch(() => {});
  await p.screenshot({ path: OUT + 'me_page.png' });
  const mb = await p.evaluate(() => { const b = [...document.querySelectorAll('#app button')].find(x => /編輯|修改/.test(x.textContent)); if (b) b.click(); return b ? b.textContent : ''; });
  await p.waitForSelector('#modal:not([hidden]) .frow', { timeout: 8000 }).catch(() => {});
  ok('「我的攤位」頁的編輯也能打開表單', !!mb && (await p.$$eval('#mbody .frow', x => x.length)) > 3, mb);
  await p.evaluate(() => { document.getElementById('modal').hidden = true; });
  // 別的攤主（未管理）仍顯示認領
  await p.goto('http://localhost:8787/?lang=zh&devlogin=dev-owner-2#/o/C00968', { waitUntil: 'networkidle0' });
  await p.waitForSelector('.acts .btn'); txt = await p.$eval('.acts .btn', e => e.textContent); ok('非自己的攤主仍顯示認領', /認領/.test(txt), txt);
  await b.close(); console.log(res.join('\n'));
})().catch(e => { console.error(e); console.log(res.join('\n')); process.exit(1); });
