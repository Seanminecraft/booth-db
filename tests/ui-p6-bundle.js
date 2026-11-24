// UI 測試（p6 販售資訊「套組」）。先重新啟動 node tests/dev-server.js 8787，再 PUPPETEER_PATH=… SHOT_DIR=… node tests/ui-p6-bundle.js
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const B = 'http://localhost:8787/', OUT = process.env.SHOT_DIR || '/tmp/'; const res = [];
const ok = (n, c, d) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const errs = [];
  async function pg(url, o = {}) {
    const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: o.w || 1100, height: o.h || 900, deviceScaleFactor: 1.5 }); p.on('pageerror', e => errs.push(String(e)));
    if (o.ver) { await p.setRequestInterception(true); p.on('request', async r => {
      if (/\/api\?action=meta/.test(r.url())) { const j = await (await fetch(r.url())).json(); j.version = o.ver; if (j.data) j.data.version = o.ver; return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); }
      r.continue(); }); }
    await p.goto(B + url, { waitUntil: 'networkidle0' }); await sleep(o.wait || 2500); p.ctx = ctx; return p;
  }
  // 在販售資訊編輯器裡操作（ed＝.sales-ed 外層 box）
  const ED = "document.querySelector('#modal .sales-ed').parentNode";
  const setVal = (p, sel, idx, v) => p.evaluate((ED, sel, idx, v) => { const e = eval(ED).querySelectorAll(sel)[idx]; e.value = v; e.dispatchEvent(new Event('input')); }, ED, sel, idx, v);
  const clickTxt = (p, re, scope) => p.evaluate((ED, re, scope) => { const root = scope === 'ed' ? eval(ED) : document.getElementById('mbody'); const x = [...root.querySelectorAll('button')].find(b => new RegExp(re).test(b.textContent)); if (!x) return false; x.click(); return true; }, ED, re, scope);
  const pvText = p => p.evaluate(() => document.querySelector('#modal .sales-pv').textContent);
  async function buildBundle(p, L) {
    // 先清掉原本的列（每列的 × 都按掉），剩一個空單品
    await p.evaluate(ED => { let ed = eval(ED); for (let k = 0; k < 40; k++) { const x = ed.querySelector('.sales-ed > div > .srow button[title="×"], .sales-ed > .srow button[title="×"], .sales-ed .stext .srow button[title="×"]'); if (!x || ed.querySelectorAll('.sales-ed > *').length === 1 && ed.querySelector('.sales-ed > .srow input') && !ed.querySelector('.sales-ed > .srow input').value) break; x.click(); } }, ED);
    await setVal(p, '.sales-ed > .srow input', 0, L.cat); await setVal(p, '.sales-ed > .srow input', 1, L.con);
    ok(L.tag + ' 有「＋單品」「＋套組」兩個按鈕', await clickTxt(p, L.addBundle, 'ed'));
    await setVal(p, '.sbundle .srow input', 0, L.bname);
    await setVal(p, '.sbundle .bitem input', 0, L.i1); await setVal(p, '.sbundle .bitem input', 1, L.i3);
    // 加第 3 個商品（按「加商品」），再把它往上移到第 2
    await clickTxt(p, L.addItem, 'ed'); await setVal(p, '.sbundle .bitem input', 2, L.i2);
    await p.evaluate(ED => eval(ED).querySelectorAll('.sbundle .bitem')[2].querySelector('button[title="↑"]').click(), ED);
    // 整個套組往上移到單品前面
    await p.evaluate(ED => eval(ED).querySelector('.sbundle > .srow button[title="↑"]').click(), ED);
  }
  // 1. 攤主自己填（中文）：建立套組、排序、自動編號
  let p = await pg('?theme=light&lang=zh&devlogin=dev-owner-1#/events/FFK19');
  await p.evaluate(() => { const b = [...document.querySelectorAll('#app .btn')].find(x => /✏️|填寫我的/.test(x.textContent)); b && b.click(); });
  await p.waitForSelector('#modal:not([hidden]) .sales-ed', { timeout: 10000 });
  const Z = { tag: '攤主', cat: '單品', con: '明信片 NT$30', addBundle: '套組', bname: '新刊套組', i1: '畫冊 Vol.2', i2: '壓克力立牌', i3: '貼紙', addItem: '加商品' };
  await buildBundle(p, Z);
  const want = '💠新刊套組\n1. 畫冊 Vol.2\n2. 壓克力立牌\n3. 貼紙\n💠單品【明信片 NT$30】';
  let pv = await pvText(p); ok('攤主：預覽文字＝套組（自動編號、排序後）＋單品', pv === want, JSON.stringify(pv));
  ok('攤主：套組商品前面顯示 1. 2. 3.', await p.evaluate(() => [...document.querySelectorAll('#modal .sbundle .num')].map(x => x.textContent).join('') === '1.2.3.'));
  await p.evaluate(() => document.querySelector('#modal .sbundle').scrollIntoView({ block: 'center' })); await sleep(300);
  await p.screenshot({ path: OUT + 'p6_bundle_editor_owner_zh.png' });
  // 刪掉一個商品 → 編號重排
  await p.evaluate(() => document.querySelectorAll('#modal .sbundle .bitem')[0].querySelector('button[title="×"]').click());
  pv = await pvText(p); ok('刪掉第 1 個商品後自動重新編號', /^💠新刊套組\n1\. 壓克力立牌\n2\. 貼紙\n/.test(pv), JSON.stringify(pv));
  await p.evaluate(() => document.querySelectorAll('#modal .sbundle .bitem')[0].querySelector('button[title="↑"]').disabled || 0);
  await clickTxt(p, '預覽'); await p.waitForFunction(() => [...document.querySelectorAll('#mbody button')].some(x => /確認送出|送出/.test(x.textContent) && !/預覽/.test(x.textContent)) || document.querySelector('#mbody .note.bad'), { timeout: 8000 }).catch(() => {});
  ok('攤主：伺服器預覽接受套組格式（沒有被擋）', await p.evaluate(() => !/格式不符|被擋|Blocked/.test(document.querySelector('#mbody table.diff') ? document.querySelector('#mbody table.diff').textContent : 'x')));
  await clickTxt(p, '確認送出');
  await p.waitForSelector('#mbody .note.good, #mbody .note.bad', { timeout: 8000 }).catch(() => {});
  ok('攤主：送出成功（進入審核）', await p.evaluate(() => [...document.querySelectorAll('#mbody .note.good')].some(n => /已送出 1 項|已套用/.test(n.textContent))), await p.$eval('#mbody', e => e.textContent.slice(-200)));
  await p.ctx.close();
  // 2. 站長直接編輯（英文介面也用中文標籤）
  p = await pg('?theme=light&lang=en&devlogin=dev-admin#/events/FFK19');
  await p.evaluate(() => document.querySelector('.bk .btn.admx').click());
  await p.waitForSelector('#modal:not([hidden]) .sales-ed', { timeout: 8000 });
  ok('站長編輯器在英文介面也顯示中文（＋ 套組）', await p.evaluate(ED => [...eval(ED).querySelectorAll('button')].some(b => /＋ 套組/.test(b.textContent)), ED));
  const A = { tag: '站長', cat: '新刊', con: '本子 NT$200', addBundle: '套組', bname: '場販套組', i1: '本子', i2: '色紙', i3: '徽章', addItem: '加商品' };
  await buildBundle(p, A);
  const wantA = '💠場販套組\n1. 本子\n2. 色紙\n3. 徽章\n💠新刊【本子 NT$200】';
  pv = await pvText(p); ok('站長：預覽文字正確', pv === wantA, JSON.stringify(pv));
  await clickTxt(p, '預覽|Preview');
  await p.waitForFunction(() => [...document.querySelectorAll('#mbody button')].some(x => /確認直接寫入/.test(x.textContent)), { timeout: 8000 }).catch(() => {});
  await clickTxt(p, '確認直接寫入'); await p.waitForSelector('#mbody .note.good, #mbody .note.bad', { timeout: 8000 }).catch(() => {});
  ok('站長：直接寫入成功', await p.evaluate(() => !!document.querySelector('#mbody .note.good')), await p.$eval('#mbody', e => e.textContent.slice(-200)));
  await p.ctx.close();
  // 3. 攤位卡顯示：套組＝標題＋編號清單
  p = await pg('?theme=light&lang=zh#/events/FFK19', { wait: 3000 });
  const card = await p.evaluate(() => { const c = [...document.querySelectorAll('.bk')].find(x => /場販套組/.test(x.textContent)); if (!c) return null; c.scrollIntoView({ block: 'center' }); const sb = c.querySelector('.salesv .sb'); return sb && { head: sb.querySelector('.sbh').textContent, li: [...sb.querySelectorAll('ol li')].map(x => x.textContent), single: c.querySelector('.salesv .si') && c.querySelector('.salesv .si').textContent }; });
  ok('攤位卡：套組顯示成標題＋<ol> 編號清單', card && /場販套組/.test(card.head) && card.li.join('|') === '本子|色紙|徽章', JSON.stringify(card));
  ok('攤位卡：單品照樣顯示', card && card.single === '💠新刊【本子 NT$200】', card && card.single);
  await sleep(300); await p.evaluate(() => { const c = [...document.querySelectorAll('.bk')].find(x => /場販套組/.test(x.textContent)); c.style.outline = '3px solid #e53'; });
  const el = await p.evaluateHandle(() => [...document.querySelectorAll('.bk')].find(x => /場販套組/.test(x.textContent)));
  await el.screenshot({ path: OUT + 'p6_bundle_card_rendered_zh.png' });
  ok('原本資料裡的套組（💠名稱＋1. 2.）也顯示成編號清單', await p.evaluate(() => document.querySelectorAll('.salesv .sb ol li').length > 3));
  // 4. 舊資料有看不懂的文字：保留成「其他文字」，可一鍵轉成單品
  await p.ctx.close(); p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/events/FFK19', { wait: 3000 });
  const opened = await p.evaluate(() => { const c = [...document.querySelectorAll('.bk')].find(x => x.querySelector('.salesv .st') && x.querySelector('.btn.admx')); if (!c) return null; const raw = c.querySelector('.salesv .st').textContent; c.querySelector('.btn.admx').click(); return raw; });
  await p.waitForSelector('#modal:not([hidden]) .sales-ed', { timeout: 8000 }).catch(() => {});
  ok('看不懂的文字原樣出現在「其他文字」框（不丟字）', opened && await p.evaluate(raw => [...document.querySelectorAll('#modal .stext textarea')].some(t => t.value.indexOf(raw) >= 0), opened), opened);
  ok('有其他文字時顯示提醒', await p.evaluate(() => /不是 💠 格式/.test(document.getElementById('mbody').textContent)));
  await clickTxt(p, '把每一行轉成單品', 'ed');
  ok('「轉成單品」後其他文字框消失、變成單品列', await p.evaluate(() => !document.querySelector('#modal .stext') && document.querySelectorAll('#modal .sales-ed > .srow').length > 0));
  await p.ctx.close();
  // 5. 後端還是 p5：套組按鈕停用並說明
  p = await pg('?theme=light&lang=ja&devlogin=dev-owner-1#/events/FFK19', { ver: '2026-11-24-p5' });
  await p.evaluate(() => { const b = [...document.querySelectorAll('#app .btn')].find(x => /✏️|自分のブース/.test(x.textContent)); b && b.click(); });
  await p.waitForSelector('#modal:not([hidden]) .sales-ed', { timeout: 10000 }).catch(() => {});
  ok('p5 後端相容：「＋セット」停用、顯示說明（日文）', await p.evaluate(ED => { const ed = eval(ED); const bt = [...ed.querySelectorAll('button')].find(b => /セット/.test(b.textContent)); return !!bt && bt.disabled && /バックエンドがまだ更新/.test(ed.textContent); }, ED));
  await p.ctx.close();
  ok('沒有 JS 錯誤', errs.length === 0, errs.join(' | '));
  await b.close(); console.log(res.join('\n')); const f = res.filter(x => /^FAIL/.test(x)).length; console.log(`\n${res.length - f} passed, ${f} failed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); console.log(res.join('\n')); process.exit(1); });
