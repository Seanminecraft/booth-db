// UI 測試（phase 3 站長後台）。先重新啟動 node tests/dev-server.js 8787（樣本資料才是乾淨的），再 PUPPETEER_PATH=/path/to/node_modules/puppeteer-core SHOT_DIR=/tmp/shots/ node tests/ui-p3-admin.js
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const OUT = process.env.SHOT_DIR || '/tmp/', B = 'http://localhost:8787/'; const res = [];
const ok = (n, c, d) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + String(d).slice(0, 160) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const errs = [];
  async function page(o = {}) { const p = await b.newPage(); await p.setViewport({ width: o.w || 1440, height: o.h || 1000, deviceScaleFactor: 1.5, isMobile: !!o.mobile, hasTouch: !!o.mobile }); p.on('pageerror', e => errs.push(String(e))); return p; }
  async function shot(url, file, o = {}) {
    const p = await page(o); await p.goto(B + url, { waitUntil: 'networkidle0' }); await sleep(o.wait || 1500);
    if (o.sel) await p.waitForSelector(o.sel, { timeout: 30000 });
    if (o.wait2) await sleep(o.wait2);
    if (o.scrollTo) await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), o.scrollTo);
    if (o.fn) await o.fn(p);
    await p.screenshot({ path: OUT + file, fullPage: !!o.full }); console.log(file); return p;
  }
  // 首頁：統計卡下面的大關聯圖
  let p = await shot('?theme=dark&lang=zh#/', 'home_graph_below_stats_dark.png', { full: true, wait2: 9000 });
  const order = await p.evaluate(() => { const st = document.querySelector('.stats'), ov = document.querySelector('.ovcard'); return st && ov ? !!(st.compareDocumentPosition(ov) & Node.DOCUMENT_POSITION_FOLLOWING) : null; });
  ok('首頁關聯圖卡在數字統計下面', order === true, order);
  ok('關聯圖有畫出來（canvas）', await p.evaluate(() => !!document.querySelector('#overview canvas')));
  await p.close();
  p = await shot('?theme=light&lang=zh#/', 'home_graph_below_stats_light.png', { full: true, wait2: 9000 }); await p.close();
  p = await shot('?theme=dark&lang=zh#/', 'home_graph_pairs_on_dark.png', { wait2: 6000, fn: async p => {
    await p.evaluate(() => { const c = document.querySelector('.ovcard input[type=checkbox]'); c.click(); }); await sleep(7000);
    await p.evaluate(() => document.querySelector('.ovcard').scrollIntoView({ block: 'start' })); } });
  ok('「顯示兩兩相連」切換後副標題包含組數', /兩兩相連/.test(await p.$eval('.ovcard', e => e.textContent)));
  await p.close();
  p = await shot('?theme=light&lang=en#/', 'home_phone_tap_to_load_en.png', { w: 390, h: 844, mobile: true, scrollTo: '.ovcard' });
  ok('手機：關聯圖要點一下才載入', await p.evaluate(() => !!document.querySelector('.ovtap') && !document.querySelector('#overview canvas')));
  await p.close();
  p = await shot('?theme=dark&lang=zh#/all', 'all_booths_dark_zh.png', { full: true }); await p.close();
  p = await shot('?theme=light&lang=ja#/all', 'all_booths_light_ja.png', { h: 1100 }); await p.close();
  // 後台
  p = await shot('?theme=dark&lang=zh&devlogin=dev-admin#/admin/queue', 'admin_queue_dark.png', { full: true, sel: '.qi', wait: 2500 });
  const qt = await p.$eval('#app', e => e.textContent);
  ok('佇列顯示「待第二位確認」與第二位確認按鈕', /一審：/.test(qt) && /第二位確認/.test(qt), '');
  await p.close();
  p = await shot('?theme=light&lang=zh&devlogin=dev-admin-2#/admin/queue', 'admin_queue_light_tablet_adminB.png', { full: true, sel: '.qi', wait: 2500, w: 820, h: 1180 });
  ok('一審的站長 B 不能自己做第二位確認（按鈕停用或提示）', /等待另一位站長|另一位站長/.test(await p.$eval('#app', e => e.textContent)));
  await p.close();
  p = await shot('?theme=dark&lang=zh&devlogin=dev-admin#/admin/events', 'admin_events_dark.png', { full: true, wait: 3000 }); await p.close();
  p = await shot('?theme=dark&lang=zh&devlogin=dev-admin#/admin/relations', 'admin_relations_dark.png', { full: true, wait: 3000 }); await p.close();
  p = await shot('?theme=light&lang=zh&devlogin=dev-admin#/admin/audit', 'admin_audit_light.png', { sel: 'table', wait: 2500, full: true });
  ok('稽核紀錄顯示站長暱稱', /小編B/.test(await p.$eval('#app', e => e.textContent)));
  await p.close();
  p = await shot('?theme=dark&lang=zh&devlogin=dev-admin#/admin/settings', 'admin_settings_dark.png', { full: true, wait: 3000 }); await p.close();
  p = await shot('?theme=dark&lang=zh&devlogin=dev-owner-1#/admin', 'admin_denied_nonadmin.png', { h: 600, wait: 2500 }); await p.close();
  // 攤主頁：站長直接編輯
  p = await page(); await p.goto(B + '?theme=dark&lang=zh&devlogin=dev-admin#/o/C00968', { waitUntil: 'networkidle0' });
  await p.waitForSelector('.btn.admx', { timeout: 10000 }).catch(() => {});
  ok('站長在攤主頁看到「🛠 站長直接編輯」', !!(await p.$('.btn.admx')));
  await p.screenshot({ path: OUT + 'owner_page_admin_button.png' });
  await p.evaluate(() => [...document.querySelectorAll('.btn.admx')].find(x => /直接編輯/.test(x.textContent)).click());
  await p.waitForSelector('#modal:not([hidden]) .frow', { timeout: 8000 });
  await p.evaluate(() => { const r = [...document.querySelectorAll('#mbody .frow')].find(x => x.querySelector('.k').textContent === '官方網站'); r.querySelector('input,textarea').value = 'https://mionkokomo.carrd.co/'; });
  await p.screenshot({ path: OUT + 'owner_admin_edit_modal.png' });
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /預覽/.test(x.textContent)).click());
  await p.waitForFunction(() => [...document.querySelectorAll('#mbody button')].some(x => /確認直接寫入/.test(x.textContent)), { timeout: 8000 }).catch(() => {});
  await p.screenshot({ path: OUT + 'owner_admin_edit_preview.png' });
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /確認直接寫入/.test(x.textContent)).click());
  await p.waitForSelector('#mbody .note.good, #mbody .note.bad', { timeout: 8000 }).catch(() => {});
  let fin = await p.$eval('#mbody', e => { const n = e.querySelector('.note.good, .note.bad'); return n ? n.className + '|' + n.textContent : e.textContent; });
  ok('站長直接寫入成功', /good/.test(fin), fin);
  await p.evaluate(() => { const n = document.querySelector('#mbody .note.good, #mbody .note.bad'); if (n) n.scrollIntoView({ block: 'center' }); });
  await p.screenshot({ path: OUT + 'owner_admin_edit_done.png' });
  // 惡意值被擋
  await p.evaluate(() => { document.getElementById('modal').hidden = true; [...document.querySelectorAll('.btn.admx')].find(x => /直接編輯/.test(x.textContent)).click(); });
  await p.waitForSelector('#modal:not([hidden]) .frow', { timeout: 8000 });
  await p.evaluate(() => { const r = [...document.querySelectorAll('#mbody .frow')].find(x => x.querySelector('.k').textContent === '官方網站'); r.querySelector('input,textarea').value = 'https://bit.ly/abc'; });
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /預覽/.test(x.textContent)).click()); await sleep(600);
  const blk = await p.evaluate(() => { const b = [...document.querySelectorAll('#mbody button')].find(x => /確認直接寫入/.test(x.textContent)); return b ? 'confirm-visible' : document.getElementById('mbody').textContent; });
  ok('短網址在站長編輯也會被擋', blk !== 'confirm-visible', blk);
  await p.evaluate(() => { const n = document.querySelector('#mbody .note.bad, #mbody .bad, #mbody .flag'); if (n) n.scrollIntoView({ block: 'center' }); });
  await p.screenshot({ path: OUT + 'owner_admin_edit_blocked.png' });
  await p.close();
  // 場次攤位列表：站長編輯 + 販售資訊編輯器
  p = await page(); await p.goto(B + '?theme=dark&lang=zh&devlogin=dev-admin#/events/FFK19', { waitUntil: 'networkidle0' }); await sleep(2500);
  ok('場次攤位列表每張卡有「🛠 站長編輯」', (await p.$$('.bk .btn.admx')).length > 3);
  await p.screenshot({ path: OUT + 'event_list_admin_buttons.png' });
  await p.evaluate(() => document.querySelector('.bk .btn.admx').click());
  await p.waitForSelector('#modal:not([hidden]) .sales-ed', { timeout: 8000 }).catch(() => {});
  ok('販售資訊用 💠類別【內容】編輯器', !!(await p.$('#modal .sales-ed .srow')));
  await p.evaluate(() => { const ed = document.querySelector('#modal .sales-ed'); const ins = ed.querySelectorAll('.srow input'); ins[0].value = '新刊'; ins[0].dispatchEvent(new Event('input')); ins[1].value = '測試畫冊 NT$200'; ins[1].dispatchEvent(new Event('input')); });
  await p.screenshot({ path: OUT + 'event_admin_sales_editor.png' });
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /預覽/.test(x.textContent)).click());
  await p.waitForFunction(() => [...document.querySelectorAll('#mbody button')].some(x => /確認直接寫入/.test(x.textContent)), { timeout: 8000 }).catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('#mbody button')].find(x => /確認直接寫入/.test(x.textContent)).click());
  await p.waitForSelector('#mbody .note.good, #mbody .note.bad', { timeout: 8000 }).catch(() => {});
  fin = await p.$eval('#mbody', e => { const n = e.querySelector('.note.good, .note.bad'); return n ? n.className + '|' + n.textContent : e.textContent; });
  ok('場次販售資訊直接寫入成功', /good/.test(fin), fin);
  await p.evaluate(() => { const n = document.querySelector('#mbody .note.good, #mbody .note.bad'); if (n) n.scrollIntoView({ block: 'center' }); });
  await p.screenshot({ path: OUT + 'event_admin_sales_done.png' });
  await p.close();
  // 稽核：剛才的修改出現、可復原
  p = await shot('?theme=dark&lang=zh&devlogin=dev-admin#/admin/audit', 'admin_audit_after_edits_dark.png', { sel: 'table', wait: 2500 });
  const at = await p.$eval('#app', e => e.textContent); ok('稽核紀錄出現剛才的直接修改與復原按鈕', /官方網站/.test(at) && /販售資訊/.test(at) && /復原/.test(at));
  await p.close();
  // 重新登入視窗見 p3reauth.js
  await b.close(); console.log(res.join('\n')); if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
})().catch(e => { console.error(e); console.log(res.join('\n')); process.exit(1); });
