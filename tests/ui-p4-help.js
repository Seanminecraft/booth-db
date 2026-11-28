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
    await p.evaluate(() => { const r = document.querySelector('#modal label.cm[data-m=discord] input'); r.click(); });
    await sleep(300); ok(L + ' 認領視窗有三種驗證方式與複製鈕', await p.evaluate(() => document.querySelectorAll('#modal label.cm').length === 3 && !!document.querySelector('#modal .copyb')));
    await snap(p, L + '-claim');
    await p.evaluate(() => { const b = [...document.querySelectorAll('#mbody button.btn')].find(x => !/ghost/.test(x.className)); b.click(); });
    await p.waitForSelector('#modal .claimremind', { timeout: 8000 }).catch(() => {});
    ok(L + ' 送出後顯示特別提醒', await p.evaluate(() => !!document.querySelector('#modal .claimremind')));
    await p.evaluate(() => document.querySelector('#modal .claimdone').scrollIntoView({ block: 'center' })); await sleep(300);
    await snap(p, L + '-claim-done'); await p.close();
    p = await pg(`?theme=light&lang=${L}&devlogin=dev-owner-1#/me`, { wait: 1800 });
    await p.evaluate(() => { const b = [...document.querySelectorAll('#app button.btn')].find(x => !/ghost|warn/.test(x.className)); b && b.click(); });
    await p.waitForSelector('#modal:not([hidden]) .frow', { timeout: 10000 }).catch(() => {}); await sleep(500);
    await snap(p, L + '-edit'); await p.close();
    p = await pg(`?theme=light&lang=${L}&devlogin=dev-owner-1#/o/C00968`, { wait: 1800 });
    await p.waitForSelector('.nvbox', { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => { const x = document.querySelector('.nvbox') || [...document.querySelectorAll('h3')].find(h => /攤名|booth name|ブース名/.test(h.textContent)); x && x.scrollIntoView({ block: 'center' }); });
    await sleep(400); await snap(p, L + '-names');
    ok(L + ' 攤主頁有隱藏舊攤名開關', await p.evaluate(() => !!document.querySelector('.nvbox'))); await p.close();
    p = await pg(`?theme=light&lang=${L}&devlogin=dev-owner-1#/events/FFK19`, { wait: 2500 });
    await p.evaluate(() => { const b = [...document.querySelectorAll('#app button, #app a')].find(x => x.dataset && x.dataset.mine) || [...document.querySelectorAll('#app .btn')].find(x => /✏️|填寫我的|Fill in my|自分のブース/.test(x.textContent)); b && b.click(); });
    await p.waitForSelector('#modal:not([hidden]) .frow', { timeout: 10000 }).catch(() => {}); await sleep(500);
    const hasThumb = await p.evaluate(() => { const k = [...document.querySelectorAll('#mbody .k')].find(x => x.querySelector('.helpq') && /Google/.test(x.textContent)); if (k) k.parentNode.scrollIntoView({ block: 'center' }); return !!k; });
    ok(L + ' 場次填寫有縮圖說明「?」', hasThumb); await sleep(300); await snap(p, L + '-thumb');
    const hasSales = await p.evaluate(() => { const x = [...document.querySelectorAll('#mbody .helpq')].find(a => /sales$/.test(a.getAttribute('href'))); if (x) x.parentNode.parentNode.scrollIntoView({ block: 'center' }); return !!x; });
    ok(L + ' 販售資訊有說明「?」', hasSales);
    ok(L + ' 場次填寫有作品類型／年齡分級選項鈕', await p.evaluate(() => document.querySelectorAll('#modal .msel .chip').length >= 5));
    // 截圖示範一個套組（不送出）
    const BN = { zh: ['新刊套組', '畫冊 Vol.2', '壓克力立牌'], en: ['New book set', 'Art book Vol.2', 'Acrylic stand'], ja: ['新刊セット', '画集 Vol.2', 'アクリルスタンド'] }[L];
    await p.evaluate(BN => { const ed = document.querySelector('#modal .sales-ed').parentNode; const bt = ed.querySelectorAll('.acts button')[1]; bt.click();
      const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); };
      set(ed.querySelector('.sbundle .srow input'), BN[0]); const its = ed.querySelectorAll('.sbundle .bitem input'); set(its[0], BN[1]); set(its[1], BN[2]);
      ed.querySelector('.sbundle').scrollIntoView({ block: 'center' }); }, BN);
    ok(L + ' 販售資訊可加套組（自動編號）', await p.evaluate(() => /\n?1\. .+\n2\. /.test(document.querySelector('#modal .sales-pv').textContent)));
    await sleep(300); await snap(p, L + '-sales'); await p.close();
    p = await pg(`?theme=light&lang=${L}&devlogin=claimer-a#/me`, { wait: 1800 }); await snap(p, L + '-status'); await p.close();
    p = await pg(`?theme=dark&lang=${L}#/help/claim`, { w: 1100, h: 900, wait: 1200 });
    const ht = await p.evaluate(() => ({ n: document.querySelectorAll('.htask').length, img: document.querySelectorAll('.hshot').length, faq: document.querySelectorAll('details.faq').length, nav: !!document.querySelector('#nav a[href="#/help"]') }));
    const body = await p.$eval('#app', e => e.textContent);
    ok(L + ' 使用說明頁：8 個任務、8 張截圖、常見問題、導覽列連結', ht.n === 8 && ht.img === 8 && ht.faq >= 6 && ht.nav, JSON.stringify(ht));
    ok(L + ' 說明有複選與隱藏舊攤名', (L === 'zh' && /隱藏舊攤名/.test(body) && /原創/.test(body) && /二創參考作品/.test(body) && /自動更新/.test(body) === false) || (L === 'en' && /Hide past names/.test(body) && /Fan work/.test(body) && /二創參考作品/.test(body)) || (L === 'ja' && /過去のブース名を隠す/.test(body) && /二次創作/.test(body) && /二創參考作品/.test(body)), body.slice(0, 80));
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
  const atxt = await p.$eval('#app', e => e.textContent);
  ok('站長使用說明：9 個任務、9 張截圖、常見問題', ah.n === 9 && ah.img === 9 && ah.faq >= 5, JSON.stringify(ah));
  ok('站長說明有待審核數字、重新整理、自動更新與橫幅', /待審核數量/.test(atxt) && /重新整理/.test(atxt) && /自動更新（每分鐘）/.test(atxt) && /有新的待審核項目/.test(atxt) && /隱藏舊攤名/.test(atxt), atxt.replace(/\s+/g,' ').slice(0,120));
  await p.screenshot({ path: '/tmp/p4shots/admin_help.png', fullPage: true }); await p.close();
  p = await pg('?theme=light&lang=zh&devlogin=dev-admin#/admin/queue', { wait: 2500 });
  const cl = await p.$eval('#app', e => e.textContent); ok('認領卡標示「帳號相符，仍需確認貼文含驗證碼」', /帳號相符，仍需確認貼文含驗證碼/.test(cl)); await p.close();
  // 圖片都在
  const imgs = await (await pg('?lang=zh#/help')).evaluate(async () => { const out = []; for (const i of document.querySelectorAll('.hshot')) { const r = await fetch(i.src); out.push(r.status); } return out; });
  ok('攤主說明截圖都存在（8 張）', imgs.length === 8 && imgs.every(s => s === 200), imgs.join(','));
  await b.close(); console.log(res.join('\n')); if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
})().catch(e => { console.error(e); console.log(res.join('\n')); process.exit(1); });
