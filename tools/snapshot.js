// 部署時（GitHub Actions）把公開資料抓成靜態檔，讓網站第一次打開不用等 Apps Script。
// 用法：API_URL=https://script.google.com/macros/s/…/exec node tools/snapshot.js site/data
// 抓不到時只警告、不寫檔（網站會自動改回直接讀 Apps Script），部署照常進行。
'use strict';
const fs = require('fs'), path = require('path');
const API = process.env.API_URL, OUT = process.argv[2] || 'site/data';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(action) {
  for (let i = 1; i <= 3; i++) {
    try {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 60000);
      const r = await fetch(API + '?action=' + action, { redirect: 'follow', signal: ac.signal }); clearTimeout(tm);
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'not ok');
      return j;
    } catch (e) { console.log(`::warning::${action} 第 ${i} 次失敗：${e.message}`); await sleep(5000 * i); }
  }
  return null;
}
(async () => {
  if (!API) { console.log('::warning::API_URL 未設定，略過快照'); return; }
  fs.mkdirSync(OUT, { recursive: true });
  const meta = await get('meta');
  if (meta) { delete meta.ok; meta.snapshotAt = new Date().toISOString(); fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta)); }
  const idx = await get('index');
  if (idx && idx.data && Array.isArray(idx.data.owners) && idx.data.owners.length > 100) { idx.data.snapshotAt = new Date().toISOString(); fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(idx.data)); console.log('index.json：' + idx.data.owners.length + ' 位攤主'); }
  else console.log('::warning::index 快照失敗，網站會直接讀 Apps Script');
  const rel = await get('relations');
  if (rel && rel.data) fs.writeFileSync(path.join(OUT, 'reloverlay.json'), JSON.stringify(rel.data));
})().catch(e => { console.log('::warning::快照失敗：' + e.message); });
