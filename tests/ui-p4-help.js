// 產生使用說明截圖（site/help/*.jpg）並檢查說明頁、懶載入關聯圖、骨架畫面。
// 先重新啟動 node tests/dev-server.js 8787，再 PUPPETEER_PATH=… node tests/ui-p4-help.js [--shots]
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const path = require('path'), B = 'http://localhost:8787/', SHOTS = process.argv.includes('--shots');
const HELPDIR = path.join(__dirname, '../site/help/'); const res = [];
const ok = (n, c, d) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const errs = [];
  async function pg(url, o = {}) { const p = await b.newPage(); await p.setViewport({ width: o.w || 1100, height: o.h || 760, deviceScaleFactor: 1 }); p.on('pageerror', e => errs.push(String(e)));
    if (o.reqs) p.on('request', r => o.reqs.push(r.url())); await p.goto(B + url, { waitUntil: 'networkidle0' }); await sleep(o.wait || 800); return p; }
  async function snap(p, name, sel) {
    if (!SHOTS) return; const el = sel ? await p.$(sel) : null;
    if (el) await el.screenshot({ path: HELPDIR + name + '.jpg', type: 'jpeg', quality: 72 }); else await p.screenshot({ path: HELPDIR + name + '.jpg', type: 'jpeg', quality: 72 });
    console.log(name);
  }
  const click = (p, re) => p.evaluate(src => { const r = new RegExp(src); const x = [...document.querySelectorAll('button, a')].find(e => r.test(e.textContent.trim())); if (x) x.click(); return !!x; }, re.source);
  // 0. 速度：首頁一開始不載入 vis-network；骨架畫面
  const r0 = []; let p = await pg('?theme=dark&lang=zh#/all', { reqs: r0 });
  ok('沒有關聯圖的頁面（全部攤位）完全不下載 vis-network（689KB）', !r0.some(u => /vis-network/.test(u)), r0.filter(u => /vis/.test(u)).join(','));
  ok('index.html 不再直接載入 vis-network', !/vis-network/.test(await p.evaluate(() => document.documentElement.outerHTML.split('<main')[0]))); await p.close();
  const reqs = []; p = await pg('?theme=dark&lang=zh#/', { reqs, w: 1280, h: 800 });
  await p.evaluate(() => document.querySelector('.ovcard').scrollIntoView()); await sleep(4000);
  ok('捲到關聯圖卡才載入 vis-network 並畫出', reqs.some(u => /vis-network/.test(u)) && await p.evaluate(() => !!document.querySelector('#overview canvas')));
  await p.close();
  p = await b.newPage(); await p.setRequestInterception(true);
  p.on('request', r => { if (/\/api\?action=owner/.test(r.url())) setTimeout(() => r.continue(), 2500); else r.continue(); });
  await p.goto(B + '?lang=zh#/o/C00968', { waitUntil: 'domcontentloaded' }); await sleep(1200);
  ok('攤主頁等待時顯示骨架', await p.evaluate(() => !!document.querySelector('.sk')));
  await sleep(3000); ok('攤主頁載入完成後骨架消失', await p.evaluate(() => !document.querySelector('.sk') && /心桃魅夢/.test(document.getElementById('app').textContent)));
  await p.close();
  // 1. 攤主說明（三語）
  for (const L of ['zh', 'en', 'ja']) {
    p = await pg(`?theme=light&lang=${L}#/`); await p.type('#q', '心桃'); await sleep(900); await snap(p, L + '-search'); await p.close();
    p = await pg(`?theme=light&lang=${L}&devlogin=guide-${L}#/o/C00007`, { wait: 1500 });
    await p.waitForFunction(() => document.querySelector('.dhead'), { timeout: 15000 }).catch(() => {});
    ok(L + ' 攤主頁有「認領」按鈕', await click(p, /→/)); await p.waitForSelector('#modal:not([hidden]) .code', { timeout: 8000 }).catch(() => {});
    ok(L + ' 認領視窗顯示驗證碼與說明「?」', await p.evaluate(() => !!document.querySelector('#modal .code') && !!document.querySelector('#modal .helpq')));
    await p.type('#modal input.in', 'https://x.com/ame_aoi/status/1860000000000000001'); await snap(p, L + '-claim', '#modal .mbox, #modal > div'); await p.close();
    p = await pg(`?theme=light&lang=${L}&devlogin=dev-owner-1#/me`, { wait: 1800 });
    await p.evaluate(() => { const b = [...document.querySelectorAll('#app button.btn')].find(x => !/ghost|warn/.test(x.className)); b && b.click(); });
    await p.waitForSelector('#modal:not([hidden]) .frow', { timeout: 10000 }).catch(() => {}); await sleep(500); await snap(p, L + '-edit'); await p.close();
    p = await pg(`?theme=light&lang=${L}&devlogin=dev-owner-1#/events/FFK19`, { wait: 2500 });
    await p.evaluate(() => { const b = [...document.querySelectorAll('#app button, #app a')].find(x => x.dataset && x.dataset.mine) || [...document.querySelectorAll('#app .btn')].find(x => /✏️|填寫我的|Fill in my|自分のブース/.test(x.textContent)); b && b.click(); });
    await p.waitForSelector('#modal:not([hidden]) .frow', { timeout: 10000 }).catch(() => {}); await sleep(500);
    const hasThumb = await p.evaluate(() => { const k = [...document.querySelectorAll('#mbody .k')].find(x => x.querySelector('.helpq') && /Google/.test(x.textContent)); if (k) k.parentNode.scrollIntoView({ block: 'center' }); return !!k; });
    ok(L + ' 場次填寫有縮圖說明「?」', hasThumb); await sleep(300); await snap(p, L + '-thumb');
    const hasSales = await p.evaluate(() => { const x = [...document.querySelectorAll('#mbody .helpq')].find(a => /sales$/.test(a.getAttribute('href'))); if (x) x.parentNode.parentNode.scrollIntoView({ block: 'center' }); return !!x; });
    ok(L + ' 販售資訊有說明「?」', hasSales); await sleep(300); await snap(p, L + '-sales'); await p.close();
    p = await pg(`?theme=light&lang=${L}&devlogin=claimer-a#/me`, { wait: 1800 }); await snap(p, L + '-status'); await p.close();
    p = await pg(`?theme=dark&lang=${L}#/help/claim`, { w: 1100, h: 900, wait: 1200 });
    const ht = await p.evaluate(() => ({ n: document.querySelectorAll('.htask').length, img: document.querySelectorAll('.hshot').length, faq: document.querySelectorAll('details.faq').length, nav: !!document.querySelector('#nav a[href="#/help"]') }));
    ok(L + ' 使用說明頁：6 個任務、6 張截圖、常見問題、導覽列連結', ht.n === 6 && ht.img === 6 && ht.faq >= 4 && ht.nav, JSON.stringify(ht));
    if (L === 'zh') await p.screenshot({ path: '/tmp/p4shots/help_zh_dark.png', fullPage: true }); await p.close();
  }
  // 2. 站長說明（中文）
  p = await pg('?theme=light&lang=zh&devlogin=guide-pair#/me', { wait: 1500 }); await click(p, /取得站長配對碼/); await sleep(600); await click(p, /^取得配對碼$/); await sleep(1200); await snap(p, 'admin-pair', '#modal .mbox, #modal > div'); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/queue', { wait: 2500, h: 900 }); await snap(p, 'admin-queue');
  await p.evaluate(() => { const x = [...document.querySelectorAll('.qi')].find(q => /待第二位確認|一審：/.test(q.textContent)); x && x.scrollIntoView({ block: 'center' }); }); await sleep(300); await snap(p, 'admin-second'); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin~stale#/admin/queue', { wait: 2500 });
  await click(p, /^🔐 二次驗證（一審）/); await p.waitForSelector('#modal:not([hidden]) textarea', { timeout: 8000 }).catch(() => {}); await p.type('#modal textarea', '已用原帳號私訊確認');
  await p.evaluate(() => { const x = [...document.querySelectorAll('#mbody button')].find(x => x.textContent === '確定'); x && x.click(); });
  await p.waitForFunction(() => /重新登入/.test(document.getElementById('modal').textContent) && !document.getElementById('modal').hidden, { timeout: 8000 }).catch(() => {});
  ok('過期登入時跳出重新登入視窗', await p.evaluate(() => /10 分鐘/.test(document.getElementById('modal').textContent))); await snap(p, 'admin-relogin'); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/audit', { wait: 2500 }); await snap(p, 'admin-revert'); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/owners', { wait: 2500 }); await snap(p, 'admin-suspend'); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/events', { wait: 2500, h: 900 }); await p.evaluate(() => { const x = [...document.querySelectorAll('#app h3')].find(h => /新增整理中場次/.test(h.textContent)); x && x.scrollIntoView({ block: 'start' }); }); await sleep(300); await snap(p, 'admin-event'); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/relations', { wait: 3000 }); await snap(p, 'admin-merge'); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/settings', { wait: 2500 });
  const st = await p.$eval('#app', e => e.textContent); ok('站長與安全頁顯示試算表編輯權警告與編輯者人數', /試算表編輯權＝全部權限/.test(st) && /目前試算表編輯者：/.test(st));
  await p.evaluate(() => { const x = [...document.querySelectorAll('#app .note')].find(n => /全部權限/.test(n.textContent)); x && x.scrollIntoView({ block: 'center' }); }); await sleep(300); await snap(p, 'admin-editors'); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/help/editors', { wait: 2500, h: 900 });
  const ah = await p.evaluate(() => ({ n: document.querySelectorAll('.htask').length, img: document.querySelectorAll('.hshot').length, faq: document.querySelectorAll('details.faq').length }));
  ok('站長使用說明：9 個任務、9 張截圖、常見問題', ah.n === 9 && ah.img === 9 && ah.faq >= 3, JSON.stringify(ah));
  await p.screenshot({ path: '/tmp/p4shots/admin_help.png', fullPage: true }); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/queue', { wait: 2500 });
  const cl = await p.$eval('#app', e => e.textContent); ok('認領卡標示「帳號相符，仍需確認貼文含驗證碼」', /帳號相符，仍需確認貼文含驗證碼/.test(cl)); await p.close();
  // 圖片都在
  const imgs = await (await pg('?lang=zh#/help')).evaluate(async () => { const out = []; for (const i of document.querySelectorAll('.hshot')) { const r = await fetch(i.src); out.push(r.status); } return out; });
  ok('攤主說明截圖都存在', imgs.every(s => s === 200), imgs.join(','));
  await b.close(); console.log(res.join('\n')); if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
})().catch(e => { console.error(e); console.log(res.join('\n')); process.exit(1); });
