// UI 測試（p5 認領驗證方式）。先重新啟動 node tests/dev-server.js 8787，再 PUPPETEER_PATH=… node tests/ui-p5-claim.js
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const B = 'http://localhost:8787/', OUT = process.env.SHOT_DIR || '/tmp/'; const res = [];
const ok = (n, c, d) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const errs = [];
  async function open(sub, owner, o = {}) {
    const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1100, height: 900 }); p.on('pageerror', e => errs.push(String(e)));
    const posts = []; await p.setRequestInterception(true);
    p.on('request', r => { const u = r.url();
      if (r.method() === 'POST' && /\/api$/.test(u)) { try { const j = JSON.parse(r.postData()); if (j.action === 'claim') posts.push(j); } catch (e) { } }
      if (o.p4 && /\/api\?action=meta/.test(u)) return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: '2026-11-23-p4', v: 'x', active: [], fillMode: 'queue', clientId: '' }) });
      r.continue(); });
    await p.goto(B + `?lang=${o.lang || 'zh'}&devlogin=${sub}#/o/${owner}`, { waitUntil: 'networkidle0' }); await sleep(800);
    await p.evaluate(() => { const x = document.querySelector('#app .dhead .acts button'); x && x.click(); });
    await p.waitForSelector('#modal:not([hidden]) .code', { timeout: 10000 }).catch(() => {});
    return { p, ctx, posts };
  }
  const pick = (p, m) => p.evaluate(m => document.querySelector(`#modal label.cm[data-m=${m}] input`).click(), m);
  const submit = p => p.evaluate(() => [...document.querySelectorAll('#mbody button.btn')].find(x => !/ghost/.test(x.className)).click());
  const txt = p => p.$eval('#mbody', e => e.textContent);
  // 1. 預覽不建立申請：打開視窗再關掉，「我的攤位」不會出現待審核
  let s = await open('p5ui-viewer', 'C00005');
  ok('打開認領視窗就有驗證碼與複製鈕', await s.p.evaluate(() => /^JP-/.test(document.querySelector('#modal .code').textContent) && !!document.querySelector('#modal .copyb')));
  ok('預設是 SNS 驗證並顯示貼文網址欄', await s.p.evaluate(() => document.querySelector('#modal label.cm.on').dataset.m === 'sns' && !!document.querySelector('#modal .cdetail input.in')));
  await s.p.evaluate(() => { location.hash = '#/me'; }); await sleep(2000);
  ok('只打開視窗不會建立待審核認領（preview）', !/待審核的認領/.test(await s.p.$eval('#app', e => e.textContent)));
  await s.ctx.close();
  // 2. SNS：沒有貼文網址／個人頁 → 前端擋下，不送出
  s = await open('p5ui-sns', 'C00006'); await submit(s.p); await sleep(500);
  await s.p.type('#modal .cdetail input.in', 'https://x.com/someone'); await submit(s.p); await sleep(600);
  ok('SNS 驗證：沒有或不是貼文網址時不送出', s.posts.filter(x => !x.preview).length === 0, JSON.stringify(s.posts));
  await s.ctx.close();
  // 3. 私訊粉專／LINE
  s = await open('p5ui-dm', 'C00008'); await pick(s.p, 'dm'); await sleep(300);
  const links = await s.p.$$eval('#modal .cdetail a', as => as.map(a => a.href + '|' + a.rel));
  ok('私訊方式顯示 FB 粉專與 LINE 官方帳號連結（noopener）', links.some(l => /facebook\.com\/JapariWeatherBureau/.test(l)) && links.some(l => /lin\.ee\/qo1OC8v/.test(l)) && links.every(l => /noopener/.test(l)), links.join(' '));
  ok('私訊方式不顯示貼文網址欄', await s.p.evaluate(() => !document.querySelector('#modal .cdetail input.in')));
  await submit(s.p); await s.p.waitForSelector('#modal .claimremind', { timeout: 8000 }).catch(() => {});
  const t3 = await txt(s.p);
  ok('私訊：送出成功、顯示特別提醒全文', /已送出申請/.test(t3) && /特別提醒：按下申請後請盡速與加帕利主編聯繫，我們會盡快幫您進行查驗。/.test(t3));
  ok('私訊：送出的 method＝dm、沒有網址', s.posts.some(x => x.method === 'dm' && !x.proofUrl), JSON.stringify(s.posts.filter(x => !x.preview)));
  await s.p.screenshot({ path: OUT + 'p5_claim_dm_done_zh.png' }); await s.ctx.close();
  // 4. Discord（日文介面）
  s = await open('p5ui-discord', 'C00009', { lang: 'ja' }); await pick(s.p, 'discord'); await sleep(300);
  const t4a = await txt(s.p);
  ok('Discord：顯示 5 個步驟與加入連結', await s.p.evaluate(() => document.querySelectorAll('#modal .cdetail ol.steps li').length === 5 && /discord\.gg\/nFTsSR9HAf/.test(document.querySelector('#modal .cdetail a').href)) && /社團攤主/.test(t4a));
  await submit(s.p); await s.p.waitForSelector('#modal .claimremind', { timeout: 8000 }).catch(() => {});
  ok('Discord：送出成功（日文提醒）', /できるだけ早く加帕利/.test(await txt(s.p)) && s.posts.some(x => x.method === 'discord'));
  await s.p.screenshot({ path: OUT + 'p5_claim_discord_done_ja.png' }); await s.ctx.close();
  // 5. 重新打開：顯示待審核與目前方式
  s = await open('p5ui-discord', 'C00009', { lang: 'zh' });
  ok('重新打開待審核認領：顯示目前方式（Discord）並預選', /目前方式：③ 在動漫同人展資訊組 Discord 申請/.test(await txt(s.p)) && await s.p.evaluate(() => document.querySelector('#modal label.cm.on').dataset.m === 'discord'));
  await s.ctx.close();
  // 6. 後端還是 p4：Discord 改送 dm＋說明加 [Discord]，並提示把驗證碼寫在訊息裡
  s = await open('p5ui-p4compat', 'C00010', { p4: true }); await pick(s.p, 'discord'); await submit(s.p); await s.p.waitForSelector('#modal .claimremind', { timeout: 8000 }).catch(() => {});
  const sent6 = s.posts.filter(x => !x.preview);
  ok('p4 後端相容：Discord 送成 method=dm、說明加 [Discord]', sent6.length === 1 && sent6[0].method === 'dm' && /^\[Discord\]/.test(sent6[0].note), JSON.stringify(sent6));
  ok('p4 後端相容：顯示「網站後端更新中」提示與特別提醒', /網站後端更新中/.test(await txt(s.p)) && /特別提醒/.test(await txt(s.p)));
  await s.ctx.close();
  // 7. 站長佇列顯示方式
  s = { ctx: await b.createBrowserContext() }; const p = await s.ctx.newPage(); await p.setViewport({ width: 1280, height: 1000 });
  await p.goto(B + '?lang=zh&devlogin=dev-admin#/admin/queue', { waitUntil: 'networkidle0' }); await p.waitForSelector('.qi', { timeout: 15000 }); await sleep(800);
  const q = await p.$eval('#app', e => e.textContent);
  ok('站長佇列標示 💬 私訊粉專／LINE 與 🎮 Discord，並說明怎麼核對', /💬 私訊粉專／LINE/.test(q) && /🎮 Discord/.test(q) && /攤位整理系統後台 攤主權限申請/.test(q));
  await p.evaluate(() => { const x = [...document.querySelectorAll('.qi')].find(q => /🎮 Discord/.test(q.textContent)); x && x.scrollIntoView({ block: 'center' }); }); await sleep(300);
  await p.screenshot({ path: OUT + 'p5_admin_queue_discord.png' }); await s.ctx.close();
  ok('沒有未捕捉的頁面錯誤', errs.length === 0, errs.join(' | '));
  await b.close(); console.log(res.join('\n'));
})().catch(e => { console.error(e); console.log(res.join('\n')); process.exit(1); });
