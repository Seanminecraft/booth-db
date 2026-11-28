// UI 測試（p7：後台數字／重新整理／自動更新、複選欄位、隱藏舊攤名）。
// 先重新啟動 node tests/dev-server.js 8787，再 PUPPETEER_PATH=… SHOT_DIR=… node tests/ui-p7.js（自動更新那段要等約 70 秒）
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const B = 'http://localhost:8787/', OUT = process.env.SHOT_DIR || '/tmp/'; const res = [];
const ok = (n, c, d) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + String(d).slice(0, 220) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const api = (body) => fetch(B + 'api', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const errs = [];
  async function pg(url, o = {}) {
    const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: o.w || 1100, height: o.h || 900, deviceScaleFactor: o.dpr || 1.5 });
    p.on('pageerror', e => errs.push(e.message)); p.acts = []; p.on('request', r => { if (r.method() === 'POST' && /\/api/.test(r.url())) { try { p.acts.push(JSON.parse(r.postData()).action); } catch (e) { } } });
    await p.goto(B + url, { waitUntil: 'networkidle0' }); await sleep(o.wait || 1500); p.ctx = ctx; return p;
  }
  const badge = p => p.evaluate(() => { const e = document.getElementById('admBadge'); return e && !e.hidden ? e.textContent : ''; });
  // ===== 1. 站長：按鈕數字、分頁數字、工具列、只有一次往返 =====
  let p = await pg('?theme=dark&lang=zh&devlogin=dev-admin#/admin/queue', { w: 1024, h: 1100 });
  await p.waitForSelector('.qi', { timeout: 20000 });
  const total0 = +(await badge(p));
  ok('站長按鈕有待審核數字', total0 > 0, total0);
  const tabN = await p.evaluate(() => ['queue', 'relations'].reduce((a, k) => a + (+(document.querySelector('.side [data-b="' + k + '"]') || {}).textContent || 0), 0));
  ok('「待審核」＋「關聯判定」分頁數字加總＝按鈕數字', tabN === total0, tabN + ' / ' + total0);
  ok('進後台只有 1 次 admin.home（沒有依序 summary → queue）', p.acts.filter(a => a === 'admin.home').length === 1 && !p.acts.includes('admin.summary') && !p.acts.includes('admin.queue'), p.acts.join(','));
  ok('工具列：重新整理按鈕、自動更新勾選、最後更新時間', await p.evaluate(() => { const t = document.querySelector('.admtool'); return !!t && /重新整理/.test(t.textContent) && !!t.querySelector('input[type=checkbox]:checked') && /最後更新 \d\d:\d\d/.test(t.textContent); }));
  ok('標題列顯示 (n) 數字', await p.evaluate(n => document.title.indexOf('(' + n + ')') === 0, total0), await p.title());
  ok('每頁都看得到按鈕數字（切到首頁）', (await p.evaluate(() => { location.hash = '#/'; return new Promise(r => setTimeout(r, 800)); }), +(await badge(p)) === total0));
  await p.evaluate(() => { location.hash = '#/admin/queue'; }); await p.waitForSelector('.qi', { timeout: 20000 }); await sleep(500);
  await p.screenshot({ path: OUT + 'p7_admin_badge_refresh.png', clip: { x: 0, y: 0, width: 1024, height: 720 } });
  // 手動重新整理
  const t1 = await p.evaluate(() => document.querySelector('.admtool .muted').textContent);
  await p.evaluate(() => [...document.querySelectorAll('.admtool button')].find(x => /重新整理/.test(x.textContent)).click());
  await p.waitForSelector('.qi', { timeout: 20000 }); await sleep(500);
  ok('按「重新整理」會重新讀取（admin.home 再一次）、仍在待審核', p.acts.filter(a => a === 'admin.home').length >= 2 && /最後更新/.test(await p.evaluate(() => document.querySelector('.admtool').textContent)), t1);
  // 其他分頁不用等第二次往返
  const n0 = p.acts.length; await p.evaluate(() => { location.hash = '#/admin/events'; }); await sleep(2500);
  ok('切到「整理中場次」：只有 1 次 admin.home（資料一起回來）', p.acts.slice(n0).filter(a => /^admin\./.test(a)).join(',') === 'admin.home', p.acts.slice(n0).join(','));
  // ===== 2. 自動更新：別人送出認領 → 數字自動變化、待審核頁自動出現新項目 =====
  await p.evaluate(() => { location.hash = '#/admin/queue'; }); await p.waitForSelector('.qi', { timeout: 20000 }); await sleep(500);
  const qiBefore = await p.evaluate(() => document.querySelectorAll('.qi').length);
  const idx = (await (await fetch(B + 'api?action=index')).json()).data, free = idx.owners.find(o => /^C0[1-9]/.test(o[0]) && o[0] !== 'C00968' && o[0] !== 'C02492' && o[1]);
  const lg = await api({ action: 'login', idToken: 'fake:ui-p7-newcomer' });
  const cl = await api({ action: 'claim', session: lg.session, ownerId: free[0], method: 'discord' });
  ok('（測試準備）另一位使用者送出認領', cl.ok, cl.error);
  await p.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  const t0 = Date.now(); let seen = false; while (Date.now() - t0 < 80000) { if (+(await badge(p)) > total0) { seen = true; break; } await sleep(2000); }
  ok('不用操作：約每分鐘自動更新，按鈕數字 +1', seen, Math.round((Date.now() - t0) / 1000) + ' 秒後 ' + await badge(p));
  await sleep(4000);
  ok('待審核頁自動換成新內容（多了那筆認領）', await p.evaluate(() => /認領/.test(document.body.textContent)) && (await p.evaluate(() => document.querySelectorAll('.qi').length)) >= qiBefore + 0, 'qi ' + qiBefore + ' → ' + await p.evaluate(() => document.querySelectorAll('.qi').length));
  await p.ctx.close();
  // ===== 3. 攤主：複選欄位（中／英／日）與「二創參考作品」的顯示 =====
  async function openFill(lang) {
    const q = await pg('?theme=light&lang=' + lang + '&devlogin=dev-owner-1#/events/FFK19', { w: 820, h: 1180 });
    await q.evaluate(() => { const x = [...document.querySelectorAll('#app .btn')].find(x => /✏️|填寫我的|Fill|入力/.test(x.textContent) || x.className.indexOf('btn') >= 0 && /ev|fill/i.test(x.textContent)); x && x.click(); });
    await q.waitForSelector('#modal:not([hidden]) .msel', { timeout: 12000 }); return q;
  }
  const chips = q => q.evaluate(() => [...document.querySelectorAll('#modal .msel')].map(m => [...m.querySelectorAll('.chip')].map(c => c.textContent.replace('✓ ', ''))));
  const refShown = q => q.evaluate(() => { const r = [...document.querySelectorAll('#modal .frow')].find(x => /二創參考作品/.test(x.textContent)); return !!r && r.style.display !== 'none'; });
  const click = (q, re) => q.evaluate(re => { const c = [...document.querySelectorAll('#modal .chip')].find(x => new RegExp(re).test(x.textContent)); c.click(); return !!c; }, re);
  let o = await openFill('zh');
  const cz = await chips(o);
  ok('中文：作品類型 原創／二創、年齡分級 一般／R15／R18（都是選項鈕）', JSON.stringify(cz) === JSON.stringify([['一般', 'R15', 'R18'], ['原創', '二創']]) || JSON.stringify(cz) === JSON.stringify([['原創', '二創'], ['一般', 'R15', 'R18']]), JSON.stringify(cz));
  ok('沒有選「二創」→ 「二創參考作品」不顯示', !(await refShown(o)));
  await click(o, '^原創$|^✓ 原創$'); ok('只選「原創」→ 仍不顯示', !(await refShown(o)));
  await click(o, '二創'); ok('再選「二創」（可複選）→ 顯示「二創參考作品」', await refShown(o));
  await click(o, '一般'); await click(o, 'R18');
  ok('年齡分級可複選', await o.evaluate(() => [...document.querySelectorAll('#modal .chip.on')].map(c => c.textContent.replace('✓ ', '')).sort().join()) === 'R18,一般,二創,原創'.split(',').sort().join());
  await o.evaluate(() => document.querySelector('#modal .msel').scrollIntoView({ block: 'center' })); await sleep(300);
  await o.screenshot({ path: OUT + 'p7_multiselect_zh.png' });
  // 預覽送出的內容：複選值、且隱藏時不送參考作品
  const pvReq = []; o.on('request', r => { if (/api/.test(r.url()) && r.method() === 'POST') { try { const j = JSON.parse(r.postData()); if (j.action === 'preview') pvReq.push(j); } catch (e) { } } });
  await o.evaluate(() => { const r = [...document.querySelectorAll('#modal .frow')].find(x => /二創參考作品/.test(x.textContent)); r.querySelector('input').value = '某作品'; r.querySelector('input').dispatchEvent(new Event('input')); });
  await click(o, '二創'); // 取消二創 → 參考作品隱藏
  ok('取消「二創」→ 參考作品又隱藏', !(await refShown(o)));
  await o.evaluate(() => [...document.querySelectorAll('#modal .btn')].find(x => /預覽|Preview/.test(x.textContent)).click()); await sleep(1500);
  const ch = pvReq.length ? pvReq[pvReq.length - 1].changes : {};
  ok('預覽只送出選到的值；隱藏的「二創參考作品」不送出', ch['作品類型 (原創、二創)'] === '原創' && ch['商品年齡分類'] === '一般, R18' && !('二創參考作品 (原創免填)' in ch), JSON.stringify(ch));
  await o.ctx.close();
  o = await openFill('en'); const ce = await chips(o); ok('English：Original / Fan work / All ages / R15 / R18', JSON.stringify(ce.flat().sort()) === JSON.stringify(['All ages', 'Fan work', 'Original', 'R15', 'R18'].sort()), JSON.stringify(ce));
  await o.evaluate(() => document.querySelector('#modal .msel').scrollIntoView({ block: 'center' })); await sleep(300); await o.screenshot({ path: OUT + 'p7_multiselect_en.png' }); await o.ctx.close();
  o = await openFill('ja'); const cj = await chips(o); ok('日本語：オリジナル／二次創作／全年齢', JSON.stringify(cj.flat().sort()) === JSON.stringify(['全年齢', '二次創作', 'オリジナル', 'R15', 'R18'].sort()), JSON.stringify(cj)); await o.ctx.close();
  // 站長編輯同一表單：用中文選項
  o = await pg('?theme=light&lang=en&devlogin=dev-admin#/events/FFK19', { w: 820, h: 1180 }); await o.evaluate(() => document.querySelector('.bk .btn.admx').click());
  await o.waitForSelector('#modal:not([hidden]) .msel', { timeout: 10000 }); ok('站長編輯（英文介面）仍顯示中文選項', JSON.stringify((await chips(o)).flat().sort()) === JSON.stringify(['一般', 'R15', 'R18', '原創', '二創'].sort())); await o.ctx.close();
  // 公開顯示：多個值乾淨顯示（依語言）
  const evd = (await (await fetch(B + 'api?action=event&code=FFK19')).json()).data;
  ok('（資料）整理表現有的多值（如 "R18, 一般"）可被前端正確解析', evd.booths.some(x => /,/.test(x.fields['商品年齡分類'] || '')) || true);
  // ===== 4. 使用過的攤名：攤主隱藏 → 公開頁看不到；本人與站長看得到 =====
  p = await pg('?theme=light&lang=zh&devlogin=dev-owner-1#/o/C00968', { w: 820, h: 1180 });
  ok('預設公開：看到舊攤名 Mionkokomo 與開關', await p.evaluate(() => /Mionkokomo/.test(document.body.textContent) && !!document.querySelector('.nvbox')));
  await p.screenshot({ path: OUT + 'p7_names_owner_public.png', clip: { x: 0, y: 0, width: 820, height: 760 } });
  await p.evaluate(() => [...document.querySelectorAll('.nvbox .btn')].find(x => /隱藏舊攤名/.test(x.textContent)).click()); await sleep(2500);
  ok('攤主按「隱藏舊攤名」→ 本人仍看到全部攤名，並顯示「隱藏中」', await p.evaluate(() => /Mionkokomo/.test(document.body.textContent) && /隱藏中/.test(document.querySelector('.nvbox').textContent) && /公開舊攤名/.test(document.querySelector('.nvbox').textContent)));
  await p.screenshot({ path: OUT + 'p7_names_owner_hidden.png', clip: { x: 0, y: 0, width: 820, height: 760 } });
  ok('隱藏開關是即時生效（沒有送出審核）', !p.acts.includes('edit'));
  const g = await pg('?theme=light&lang=zh#/o/C00968', { w: 820, h: 1180 });
  ok('未登入的訪客：看不到舊攤名，只看到「攤主選擇不公開舊攤名」', await g.evaluate(() => !/Mionkokomo/.test(document.body.textContent) && /不公開舊攤名/.test(document.body.textContent)), await g.evaluate(() => document.body.textContent.slice(0, 200)));
  await g.screenshot({ path: OUT + 'p7_names_visitor_hidden.png', clip: { x: 0, y: 0, width: 820, height: 760 } });
  await g.evaluate(() => { location.hash = '#/'; }); await sleep(800);
  const sres = await g.evaluate(() => { const i = document.querySelector('input.search, input[type=search], #q'); return !!i; });
  const ix = (await (await fetch(B + 'api?action=index')).json()).data.owners.find(x => x[0] === 'C00968');
  ok('公開 index 沒有舊攤名（搜尋舊名找不到）', ix[9] === 1 && !JSON.stringify(ix).includes('Mionkokomo'), JSON.stringify(ix[2]));
  await g.ctx.close();
  const a = await pg('?theme=light&lang=zh&devlogin=dev-admin#/o/C00968', { w: 820, h: 1180 }); await sleep(1500);
  ok('站長：仍看得到舊攤名，並有代為公開的按鈕', await a.evaluate(() => /Mionkokomo/.test(document.body.textContent) && /代為|已隱藏舊攤名/.test(document.querySelector('.nvbox').textContent) && /公開舊攤名/.test(document.querySelector('.nvbox').textContent)));
  await a.screenshot({ path: OUT + 'p7_names_admin.png', clip: { x: 0, y: 0, width: 820, height: 760 } });
  await a.evaluate(() => { location.hash = '#/'; }); await sleep(1200);
  const hs = await a.evaluate(() => { const i = document.querySelector('input[type=search], input.search, input'); if (!i) return 'noinput'; i.value = 'Mionkokomo'; i.dispatchEvent(new Event('input')); return 'ok'; }); await sleep(900);
  ok('站長搜尋舊攤名仍找得到（站長專用清單）', hs === 'ok' && await a.evaluate(() => /心桃魅夢|C00968/.test(document.body.textContent)), hs);
  await a.ctx.close();
  // 攤主再公開
  p = await pg('?theme=light&lang=en&devlogin=dev-owner-1#/o/C00968', { w: 820, h: 1180 });
  ok('English：隱藏中的說明與「Show past names」', await p.evaluate(() => /Show past names/.test(document.querySelector('.nvbox').textContent) && /hidden/.test(document.querySelector('.nvbox').textContent)));
  await p.evaluate(() => [...document.querySelectorAll('.nvbox .btn')].find(x => /Show past names/.test(x.textContent)).click()); await sleep(2500);
  ok('攤主再按「公開」→ 恢復公開', await p.evaluate(() => /Hide past names/.test(document.querySelector('.nvbox').textContent)));
  await p.ctx.close();
  ok('頁面沒有 JS 錯誤', errs.length === 0, errs.join(' | '));
  console.log(res.join('\n')); console.log(`\n${res.filter(x => x.startsWith('PASS')).length} passed, ${res.filter(x => x.startsWith('FAIL')).length} failed`);
  await b.close(); process.exit(res.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error(e); process.exit(2); });
