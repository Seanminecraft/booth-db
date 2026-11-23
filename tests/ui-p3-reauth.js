// UI 測試（phase 3 站長後台）。先重新啟動 node tests/dev-server.js 8787（樣本資料才是乾淨的），再 PUPPETEER_PATH=/path/to/node_modules/puppeteer-core SHOT_DIR=/tmp/shots/ node tests/ui-p3-reauth.js
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const OUT = process.env.SHOT_DIR || '/tmp/', B = 'http://localhost:8787/'; const res = [];
const ok = (n, c, d) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(B + '?theme=dark&lang=zh&devlogin=dev-admin~stale#/admin/queue', { waitUntil: 'networkidle0' }); await p.waitForSelector('.qi'); await sleep(1500);
  const t0 = await p.$eval('#app', e => e.textContent); ok('佇列顯示一審與第二位確認', /一審：小編B/.test(t0) && /第二位確認/.test(t0));
  // 站長 A 對 C00968 的 IG（身分欄位）做一審 → 需要 10 分鐘內登入
  const clicked = await p.evaluate(() => { const b = [...document.querySelectorAll('#app button')].find(x => /^🔐 一審/.test(x.textContent.trim()) || /一審/.test(x.textContent) && !x.disabled); if (b) b.click(); return b ? b.textContent : ''; });
  ok('找到一審按鈕', !!clicked, clicked);
  await p.waitForSelector('#modal:not([hidden]) textarea'); await p.type('#modal textarea', '已用原 IG 帳號私訊確認');
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => x.textContent === '確定').click());
  await p.waitForFunction(() => /重新登入/.test((document.getElementById('modal') || {}).textContent || '') && !document.getElementById('modal').hidden, { timeout: 8000 }).catch(() => {});
  const mt = await p.$eval('#modal', e => e.textContent); ok('過期登入時跳出重新登入視窗', /重新登入/.test(mt) && /10 分鐘/.test(mt), mt);
  await p.screenshot({ path: OUT + 'admin_reauth_modal.png' });
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /重新登入）/.test(x.textContent)).click());
  await sleep(2500);
  const t1 = await p.$eval('#app', e => e.textContent);
  ok('重新登入後自動繼續並完成一審', /一審：小編A/.test(t1), '');
  await p.screenshot({ path: OUT + 'admin_after_reauth_first_approval.png', fullPage: true });
  // 站長直接取代既有的身分欄位值（過期登入；空白欄新增不算身分變更）→ 重新登入 → 結果顯示在原本的表單裡
  const p2 = await b.newPage(); await p2.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 }); p2.on('pageerror', e => errs.push(String(e)));
  await p2.goto(B + '?theme=light&lang=zh&devlogin=dev-admin~stale#/o/C00968', { waitUntil: 'networkidle0' }); await p2.waitForSelector('.btn.admx', { timeout: 10000 });
  await p2.evaluate(() => [...document.querySelectorAll('.btn.admx')].find(x => /直接編輯/.test(x.textContent)).click());
  await p2.waitForSelector('#modal:not([hidden]) .frow');
  await p2.evaluate(() => { const r = [...document.querySelectorAll('#mbody .frow')].find(x => x.querySelector('.k').textContent === 'TWITTER (1)'); r.querySelector('input,textarea').value = 'https://x.com/mion_kokomo_new'; });
  await p2.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /預覽/.test(x.textContent)).click());
  await p2.waitForFunction(() => [...document.querySelectorAll('#mbody button')].some(x => /確認直接寫入/.test(x.textContent)), { timeout: 8000 });
  await p2.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /確認直接寫入/.test(x.textContent)).click());
  await p2.waitForFunction(() => /10 分鐘/.test(document.getElementById('mbody').textContent), { timeout: 8000 }).catch(() => {});
  const mt2 = await p2.$eval('#mbody', e => e.textContent); ok('站長改身分欄位也要 10 分鐘內登入', /修改身分欄位/.test(mt2), mt2.slice(-150));
  await p2.screenshot({ path: OUT + 'owner_admin_identity_reauth_light.png' });
  await p2.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /重新登入）/.test(x.textContent)).click());
  await p2.waitForSelector('#mbody .note.good, #mbody .note.bad', { timeout: 8000 }).catch(() => {});
  const r2 = await p2.$eval('#mbody', e => { const n = e.querySelector('.note.good, .note.bad'); return n ? n.className + '|' + n.textContent : e.textContent.slice(0, 200); });
  ok('重新登入後回到原表單：身分欄位進入待第二位確認', /good/.test(r2) && /第二位/.test(r2), r2);
  await p2.evaluate(() => { const n = document.querySelector('#mbody .note.good, #mbody .note.bad'); if (n) n.scrollIntoView({ block: 'center' }); });
  await p2.screenshot({ path: OUT + 'owner_admin_identity_waiting_second.png' });
  await b.close(); console.log(res.join('\n')); if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
})().catch(e => { console.error(e); console.log(res.join('\n')); process.exit(1); });
