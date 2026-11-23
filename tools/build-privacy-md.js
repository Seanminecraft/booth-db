// 由 site/assets/privacy.js 產生 docs/PRIVACY.md（三語）。用法：node tools/build-privacy-md.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site/assets/privacy.js'), 'utf8'), ctx);
const P = ctx.window.PRIVACY, contact = process.argv[2] || '〔聯絡方式：見 site/assets/config.js 的 CONTACT，待站長確認〕';
let md = '<!-- 自動產生：請改 site/assets/privacy.js 後執行 node tools/build-privacy-md.js -->\n\n';
for (const [l, upd] of [['zh', '最後更新'], ['en', 'Last updated'], ['ja', '最終更新日']]) {
  const p = P[l]; md += `# ${p.title}\n\n_${upd}: ${P.updated}_\n\n> ${p.draft}\n\n`;
  for (const [h, ps] of p.sections) md += `## ${h}\n\n` + ps.map(x => x.split('{CONTACT}').join(contact)).join('\n\n') + '\n\n';
  md += '---\n\n';
}
fs.writeFileSync(path.join(__dirname, '../docs/PRIVACY.md'), md); console.log('docs/PRIVACY.md written');
// 同時產生 site/privacy.html（不需 JavaScript 的靜態版本，供 Google OAuth 同意畫面填「隱私權政策網址」）
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const siteContact = process.argv[3] || '加帕利天藍怪預警中心 粉專 https://www.facebook.com/JapariWeatherBureau（待站長確認）';
let html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'">
<title>隱私權政策 Privacy Policy プライバシーポリシー</title><link rel="stylesheet" href="assets/style.css"></head><body><main>
<p><a href="./">← 攤位資料庫 Booth Database</a> ｜ <a href="#zh">中文</a> ・ <a href="#en">English</a> ・ <a href="#ja">日本語</a></p>\n`;
for (const [l, upd] of [['zh', '最後更新'], ['en', 'Last updated'], ['ja', '最終更新日']]) {
  const p = P[l]; html += `<section class="card pp" id="${l}" lang="${l === 'zh' ? 'zh-Hant' : l}"><h2>${esc(p.title)}</h2><div class="muted">${esc(upd)}: ${esc(P.updated)}</div><div class="note warn">${esc(p.draft)}</div>\n`;
  for (const [h, ps] of p.sections) html += `<h2>${esc(h)}</h2>` + ps.map(x => `<p>${esc(x.split('{CONTACT}').join(siteContact))}</p>`).join('') + '\n';
  html += '</section>\n';
}
html += '</main></body></html>\n';
fs.writeFileSync(path.join(__dirname, '../site/privacy.html'), html); console.log('site/privacy.html written');
