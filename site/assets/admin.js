/* 站長後台（只有中文）。權限一律由伺服器判斷：每個 admin.* 請求都驗證 session 簽章與 uid 是否在 ADMIN_UIDS；
 * 前端隱藏選單只是介面，不是安全機制。所有資料以 textContent 呈現；外部連結一律 noopener noreferrer nofollow。 */
window.viewAdmin = function (C, parts) {
  'use strict';
  var h = C.h, add = C.add, clear = C.clear, app = C.app, tab = parts[0] || 'queue';
  C.setNav('admin');
  if (!C.S.session) { C.loading(); clear(app); add(app, h('div', { class: 'card note warn', text: '請先登入（站長 Google 帳號）：到「我的攤位」登入後再回來。' })); return; }
  var TABS = [['queue', '📥 待審核'], ['events', '🗓 整理中場次'], ['relations', '🔗 關聯判定'], ['owners', '⛔ 停權／鎖定'], ['audit', '🧾 稽核紀錄'], ['settings', '⚙️ 站長與安全'], ['help', '📘 使用說明']];
  var ACT = { queue: 'admin.queue', events: 'admin.events', relations: 'admin.relations', owners: 'admin.suspensions' }, PRE = {};
  var FRESH = !!window.__admFresh; window.__admFresh = false; // 按「重新整理」時要求伺服器略過快取
  /** 呼叫站長 API；伺服器要求重新登入（REAUTH）時跳出 Google 登入，完成後自動重試一次。 */
  function call(body) {
    return C.apiPost(body).catch(function (e) {
      if (/^REAUTH:/.test(e.message)) return C.reauth(e.message.replace(/^REAUTH:/, '')).then(function () { return C.apiPost(body); });
      throw e;
    }).then(function (j) { return j.data; });
  }
  /** 分頁資料：進後台時已隨 admin.home 一起回來（不用再等第二次往返）；之後才自己呼叫。 */
  function take(key) { if (PRE[key] !== undefined) { var d = PRE[key]; delete PRE[key]; return Promise.resolve(d); } return call({ action: ACT[key], fresh: FRESH }); }

  /* ---- 骨架：先畫出側欄與工具列（用上次的數字），資料回來再補 ---- */
  var AUTO_KEY = 'bdb_adm_auto';
  function autoOn() { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch (e) { return true; } }
  function sig(s) { var c = (s && s.counts) || {}; return [c.queue, c.relations, c.owners, s && s.needsMySecond].join('|'); }
  function hhmm(ms) { var d = new Date(ms || Date.now()); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function sideNode(sum) {
    var st = C.admState && C.admState(), cn = (sum && sum.counts) || (st && st.counts) || {};
    return h('nav', { class: 'card side' }, sum ? h('div', { class: 'muted', style: 'padding:0 12px 8px' }, (sum.role === 'owner' ? '👑 擁有者站長 ' : '站長 '), h('b', { text: sum.admin })) : null,
      TABS.map(function (x) { var n = cn[x[0]]; return h('a', { href: '#/admin/' + x[0], class: x[0] === tab ? 'on' : '', 'data-tab': x[0] }, h('span', { text: x[1] }), h('span', { class: 'badge', 'data-b': x[0], hidden: !n, text: n || '' })); }),
      sum ? h('div', { class: 'muted', style: 'padding:10px 12px 0;font-size:12px' }, sum.twoAdmin ? '站長 ' + sum.admins.length + ' 位：身分欄位需第二位站長確認' : '目前只有 1 位站長') : null);
  }
  var side = sideNode(null), main = h('div'), stampEl = h('span', { class: 'muted', text: '更新中…' }), stateEl = h('span', { class: 'muted' }), banner = h('div'), shownSig = null;
  var btnRefresh = h('button', { class: 'btn ghost', type: 'button', text: '🔄 重新整理' }), chk = h('input', { type: 'checkbox', 'data-auto': '1' });
  chk.checked = autoOn(); chk.addEventListener('change', function () { try { localStorage.setItem(AUTO_KEY, chk.checked ? '1' : '0'); } catch (e) { } stateEl.textContent = chk.checked ? '' : '自動更新已關閉（仍會更新按鈕上的數字）'; });
  btnRefresh.addEventListener('click', function () { window.__admFresh = true; btnRefresh.disabled = true; btnRefresh.textContent = '更新中…'; C.route(); });
  var tool = h('div', { class: 'admtool' }, btnRefresh, h('label', null, chk, h('span', { text: '自動更新（每分鐘）' })), stampEl, stateEl);
  clear(app); add(app, h('div', { class: 'adm' }, side, main)); add(main, tool, banner); var ph = h('div', { class: 'card muted', text: '讀取中…' }); add(main, ph);
  function busy() { return !!document.querySelector('#modal:not([hidden])') || !!main.querySelector('input[type=checkbox]:checked:not([data-auto])') || (document.activeElement && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName) && main.contains(document.activeElement) && document.activeElement !== chk); }
  function paint(s) {
    TABS.forEach(function (x) { var b = side.querySelector('[data-b="' + x[0] + '"]'); if (!b) return; var n = (s.counts || {})[x[0]]; b.hidden = !n; b.textContent = n || ''; });
    if (s.fetchedAt) stampEl.textContent = '最後更新 ' + hhmm(s.fetchedAt);
    stateEl.textContent = s.error === 'reauth' ? '⚠ 登入已逾時，自動更新暫停；按「重新整理」重新登入' : s.error ? '⚠ 暫時連不上，稍後自動重試' : (chk.checked ? '' : '自動更新已關閉（仍會更新按鈕上的數字）');
  }
  function onAdm() {
    if (!/^#\/admin/.test(location.hash)) { window.removeEventListener('bdb-adm', onAdm); return; }
    var s = C.admState(); if (!s) return; paint(s);
    if (shownSig === null || s.error || sig(s) === shownSig || !ACT[tab]) return;
    if (chk.checked && !busy()) { C.route(); return; }
    clear(banner); add(banner, h('div', { class: 'card note warn admnew', onclick: function () { C.route(); }, text: '🔔 有新的待審核項目（目前 ' + (s.total || 0) + ' 筆）。點這裡更新' + (busy() ? '（你正在操作，所以沒有自動換頁面）' : '') }));
  }
  if (window.__admL) window.removeEventListener('bdb-adm', window.__admL); window.__admL = onAdm; window.addEventListener('bdb-adm', onAdm);

  function loadHome() {
    return call({ action: 'admin.home', tab: ACT[tab] ? tab : '', fresh: FRESH }).catch(function (e) {
      if (!/unknown admin action/.test(e.message)) throw e;
      return call({ action: 'admin.summary' }).then(function (sum) {
        var p = ACT[tab] ? call({ action: ACT[tab], fresh: FRESH }) : Promise.resolve(null);
        return p.then(function (tabData) { return { summary: sum, tabKey: ACT[tab] ? tab : '', tabData: tabData, legacy: true }; });
      });
    });
  }
  loadHome().then(function (res) {
    var sum = res.summary; if (res.tabKey) PRE[res.tabKey] = res.tabData;
    C.admPush(sum); shownSig = sig(sum); var ns = sideNode(sum); side.parentNode.replaceChild(ns, side); side = ns; paint(C.admState());
    ph.remove();
    if (res.legacy) add(main, h('div', { class: 'card note warn', text: '後端還沒換成這個版本：右上數字和自動更新暫時無法使用，請先按「重新整理」。隱藏舊攤名也還不能用。請到試算表把後端更新後再重新整理這個網頁。' }));
    if (sum.needsMySecond) add(main, h('div', { class: 'card note warn' }, '🔐 有 ', h('b', { text: sum.needsMySecond }), ' 筆身分欄位等你做第二位確認（在「待審核」最上面）。'));
    var HID = { queue: 'queue', events: 'event', relations: 'merge', owners: 'suspend', audit: 'revert', settings: 'editors' }[tab];
    if (HID) add(main, h('div', { class: 'muted', style: 'text-align:right;margin:-4px 0 8px;font-size:13px' }, h('a', { href: '#/admin/help/' + HID, text: '這一頁怎麼用' }), ' ', window.BOOTH_HELP.q(HID, true)));
    if (sum.sheetEditors > 1 && tab !== 'settings') add(main, h('div', { class: 'card note warn' }, '⚠ 試算表目前有 ', h('b', { text: sum.sheetEditors }), ' 位編輯者。只在網站審核的站長不要給試算表編輯權（編輯者可以看到密鑰、改程式）。', h('a', { href: '#/admin/settings', text: '查看' })));
    ({ queue: queue, events: events, relations: relations, owners: ownersTab, audit: audit, settings: settings, help: helpTab }[tab] || queue)(main, sum);
  }).catch(function (e) {
    clear(app); add(app, h('div', { class: 'card note bad' }, h('b', { text: '無法進入站長後台' }), h('div', { text: e.message }),
      h('p', { class: 'muted', text: '若你是站長：到「我的攤位」按「取得站長配對碼」，再請試算表擁有者在選單「👑 新增站長帳號」輸入。' })));
  });

  function ask(title, hint, required) {
    return new Promise(function (ok) {
      var inp = h('textarea', { class: 'in', placeholder: hint || '', maxlength: 300 }), msg = h('div');
      C.modal(title, [inp, msg, h('p', { class: 'acts' }, h('button', { class: 'btn ghost', onclick: function () { C.closeModal(); ok(null); }, text: '取消' }),
        h('button', { class: 'btn', onclick: function () { var v = inp.value.trim(); if (required && v.length < (required === true ? 1 : required)) { msg.className = 'note bad'; msg.textContent = '此欄必填'; return; } C.closeModal(); ok(v); }, text: '確定' }))]);
      setTimeout(function () { inp.focus(); }, 30);
    });
  }
  function report(d) {
    var parts2 = [];
    if (d.done) parts2.push('已處理 ' + d.done + ' 筆'); if (d.waiting) parts2.push(d.waiting + ' 筆等待第二位站長確認'); if (d.skipped) parts2.push('略過 ' + d.skipped);
    (d.handled || []).forEach(function (x) { parts2.push('已由 ' + (x.by || '其他站長') + ' 處理（' + x.status + '）'); });
    (d.results || []).filter(function (r) { return !r.ok && r.error; }).slice(0, 3).forEach(function (r) { parts2.push(r.error); });
    C.toast(parts2.join('；') || '沒有變更');
  }
  function decide(ids, decision, note) { if (!ids.length) return C.toast('沒有選取項目'); return call({ action: 'admin.decide', ids: ids, decision: decision, note: note || '' }).then(function (d) { report(d); C.route(); }).catch(function (e) { C.toast(e.message); }); }
  function riskCls(r) { return r >= 50 ? 'hi' : r >= 30 ? 'mid' : 'lo'; }
  function riskTag(r) { return h('span', { class: 'conf ' + (r >= 50 ? 'single' : r >= 30 ? 'medium' : 'high'), text: '風險 ' + r }); }
  function linkPreview(u, flags) {
    var s = C.safeUrl(u); if (!s) return h('div', { class: 'lp' }, h('span', { text: u }));
    return h('div', { class: 'lp' }, h('div', { class: 'fav', text: C.platOf(s).slice(0, 3) }),
      h('div', { style: 'min-width:0' }, h('div', null, h('b', { text: C.hostOf(s) }), ' ', h('span', { class: 'muted', text: s.replace(/^https?:\/\/[^\/]+/, '') })),
        h('div', null, (flags || []).map(function (f) { return h('span', { class: 'flag ' + f[0], text: f[1] }); }))),
      h('a', { href: s, target: '_blank', rel: 'noopener noreferrer nofollow', referrerpolicy: 'no-referrer', class: 'pill sm', style: 'margin-left:auto', text: '開啟 ↗' }));
  }
  function val(v, flags) { var us = C.urls(v); if (us.length) return us.map(function (u) { return linkPreview(u, flags); }); return h('div', { style: 'white-space:pre-wrap', text: v || '（空白）' }); }

  /* ---- 待審核 ---- */
  function queue(main, sum) {
    take('queue').then(function (q) {
      var sel = {}, cnt = h('b', { text: '0' });
      var bulk = h('div', { class: 'bulk' }, h('span', null, '已選 ', cnt, ' 筆'),
        h('button', { class: 'btn ok', onclick: function () { decide(Object.keys(sel), 'approve'); }, text: '✅ 核准所選' }),
        h('button', { class: 'btn no', onclick: function () { decide(Object.keys(sel), 'reject'); }, text: '✖ 拒絕所選' }),
        h('button', { class: 'pill', onclick: function () { main.querySelectorAll('input[data-low]').forEach(function (c) { c.checked = true; c.dispatchEvent(new Event('change')); }); }, text: '選取所有低風險（<30、非身分欄位）' }),
        h('span', { class: 'muted', style: 'margin-left:auto', text: '批次核准需 10 分鐘內登入；身分欄位需逐筆二次驗證' }));
      var nItems = q.batches.reduce(function (a, b) { return a + b.items.length; }, 0);
      add(main, h('div', { class: 'card', style: 'padding:14px 18px' }, h('h3', { style: 'margin:0' }, '待審核 ', h('small', { text: '認領 ' + q.claims.length + '・修改／填寫 ' + nItems + ' 欄（' + q.batches.length + ' 批）・場次填寫模式：' + (q.mode === 'live' ? '即時制' : '審核制') }))));
      add(main, bulk);
      function cb(id, low) { var c = h('input', { type: 'checkbox', 'data-low': low ? '1' : null }); c.addEventListener('change', function () { if (c.checked) sel[id] = 1; else delete sel[id]; cnt.textContent = Object.keys(sel).length; }); return c; }
      q.claims.forEach(function (c) {
        add(main, h('div', { class: 'qi ' + (c.match ? 'lo' : 'hi') },
          h('div', { class: 'qh' }, cb(c.id, false), h('span', { class: 'tag act', text: '認領' }), h('a', { class: 'nm', href: '#/o/' + c.ownerId, text: c.ownerName }), h('span', { class: 'muted', text: c.ownerId + '・申請者 ' + c.who + '・' + c.at }),
            c.competing ? h('span', { class: 'flag bad', text: '⚠ 同一攤主有 ' + c.competing + ' 筆認領' }) : null),
          h('div', { class: 'kv', style: 'margin-top:8px' }, h('div', { text: '驗證方式' }), h('div', null, h('span', { class: 'tag', text: (/Discord/i.test(c.method) ? '🎮 ' : /私訊|LINE/.test(c.method) ? '💬 ' : '🔗 ') + c.method })), h('div', { text: '驗證碼' }), h('div', null, h('span', { class: 'code', style: 'font-size:14px;padding:2px 8px', text: c.code })),
            h('div', { text: '驗證貼文' }), h('div', null, c.proof ? linkPreview(c.proof, [c.match ? ['ok', '✓ 帳號相符，仍需確認貼文含驗證碼'] : ['bad', '✗ 貼文帳號不在此攤主的 SNS 內']]) : h('span', { class: 'muted', text: /Discord/i.test(c.method) ? '（Discord 申請：到動漫同人展資訊組「攤位整理系統後台 攤主權限申請」頻道核對驗證碼）' : /私訊|LINE/.test(c.method) ? '（私訊 FB 粉專／LINE 官方帳號：核對訊息裡的驗證碼）' : '（尚未提供貼文網址：請攤主補上，或改用私訊／Discord）' })),
            h('div', { text: '資料庫既有 SNS' }), h('div', { class: 'tags', style: 'margin:0' }, c.known.length ? c.known.map(function (k) { return h('span', { class: 'tag', text: k }); }) : h('span', { class: 'muted', text: '（無）' })),
            c.note ? h('div', { text: '說明' }) : null, c.note ? h('div', { text: c.note }) : null),
          h('div', { class: 'qb' }, h('button', { class: 'btn ok', onclick: function () { decide([c.id], 'approve'); }, text: '✅ 核准' }), h('button', { class: 'btn no', onclick: function () { decide([c.id], 'reject'); }, text: '✖ 拒絕' }),
            h('button', { class: 'pill', onclick: function () { ask('停權此申請帳號', '原因（會記錄在稽核紀錄）', true).then(function (n) { if (n) decide([c.id], 'suspend', n); }); }, text: '⛔ 停權此帳號' }))));
      });
      q.batches.forEach(function (b) {
        var max = Math.max.apply(null, b.items.map(function (x) { return x.risk; })), second = b.items.some(function (x) { return x.status === '待第二位確認'; });
        add(main, h('div', { class: 'qi ' + (second ? 'mid' : riskCls(max)) },
          h('div', { class: 'qh' }, h('span', { class: 'tag ' + (b.type === '場次填寫' ? 'ev' : ''), text: b.type }), b.ownerId ? h('a', { class: 'nm', href: '#/o/' + b.ownerId, text: b.ownerName }) : h('span', { class: 'nm', text: b.key }),
            h('span', { class: 'muted', text: (b.ownerId || '') + '・' + b.target + (b.key ? '／' + b.key : '') + '・' + b.who + '・' + b.at }), riskTag(max), second ? h('span', { class: 'flag warn', text: '🔐 待第二位站長確認' }) : null),
          h('table', { class: 't diff', style: 'margin-top:8px' }, h('thead', null, h('tr', null, ['', '欄位', '目前', '修改為（連結預覽）', '檢查'].map(function (x) { return h('th', { text: x }); }))),
            h('tbody', null, b.items.map(function (it) {
              var acts;
              if (it.status === '待第二位確認') acts = [h('div', { class: 'muted', text: '一審：' + it.firstBy }),
                it.firstIsMe ? h('span', { class: 'flag', text: '需要另一位站長確認' }) : h('button', { class: 'btn', onclick: function () { ask('第二位站長確認：' + it.field, '你如何確認（例：用原認領的 X 帳號私訊確認）', true).then(function (n) { if (n) decide([it.id], 'approve2', n); }); }, text: '🔐 第二位確認並套用' })];
              else if (it.sensitive) acts = [h('button', { class: 'btn', onclick: function () { ask((q.twoAdmin ? '一審：' : '二次驗證後核准：') + it.field, '驗證方式（必填，例：已用官方粉專私訊確認）', true).then(function (n) { if (n) decide([it.id], 'approve2', n); }); }, text: q.twoAdmin ? '🔐 二次驗證（一審）' : '🔐 二次驗證後核准' })];
              else acts = [h('button', { class: 'btn ok', onclick: function () { decide([it.id], 'approve'); }, text: '✅' })];
              if ((it.sensitive || it.status === '待第二位確認') && q.role === 'owner') acts.push(h('button', { class: 'pill sm', onclick: function () { ask('👑 擁有者覆核：' + it.field, '覆核理由（必填，至少 4 字，會記錄）', 4).then(function (n) { if (n) decide([it.id], 'override', n); }); }, text: '👑 覆核' }));
              acts.push(h('button', { class: 'btn no', onclick: function () { decide([it.id], 'reject'); }, text: '✖' }));
              return h('tr', null, h('td', null, cb(it.id, it.risk < 30 && !it.sensitive && it.status !== '待第二位確認')), h('td', null, h('b', { text: it.field }), it.cell ? h('div', { class: 'muted', text: it.cell }) : null),
                h('td', { class: 'o' }, val(it.old)), h('td', { class: 'n' }, val(it.val, it.flags)),
                h('td', null, riskTag(it.risk), it.sensitive ? h('div', null, h('span', { class: 'flag bad', text: '身分欄位：需二次驗證' })) : null, h('div', null, (it.notes || []).map(function (n) { return h('div', { class: 'muted', style: 'font-size:12px', text: '・' + n }); })),
                  h('div', { class: 'qb', style: 'margin-top:6px' }, acts)));
            }))),
          h('div', { class: 'qb' }, h('button', { class: 'btn ok', onclick: function () { decide(b.items.filter(function (x) { return !x.sensitive && x.status !== '待第二位確認'; }).map(function (x) { return x.id; }), 'approve'); }, text: '✅ 核准此批（略過身分欄位）' }),
            h('button', { class: 'btn no', onclick: function () { decide(b.items.map(function (x) { return x.id; }), 'reject'); }, text: '✖ 整批拒絕' }))));
      });
      if (!q.claims.length && !q.batches.length) add(main, h('div', { class: 'card muted', text: '沒有待審核項目 🎉' }));
    }).catch(function (e) { add(main, h('div', { class: 'card note bad', text: e.message })); });
  }

  /* ---- 整理中場次 ---- */
  function events(main, sum) {
    take('events').then(function (d) {
      add(main, h('div', { class: 'card' }, h('div', { class: 'ghead' }, h('h3', { style: 'margin:0', text: '場次填寫模式' }),
        h('div', null, h('button', { class: 'pill' + (d.mode === 'queue' ? ' on' : ''), onclick: function () { setMode('queue'); }, text: '🛡 審核制（預設）' }), h('button', { class: 'pill' + (d.mode === 'live' ? ' on' : ''), onclick: function () { if (confirm('切換為即時制？已核准攤主的低風險填寫會立即寫入整理表（可復原）。')) setMode('live'); }, text: '⚡ 即時制' }))),
        h('p', { class: 'muted', text: '審核制：攤主填寫全部進入待審核。即時制：已核准攤主、風險 < 30、非身分欄位的填寫立即寫入整理表（記錄套用前值，可一鍵復原）。站長在場次頁的直接修改不受此設定影響。' })));
      function setMode(m) { call({ action: 'admin.mode', mode: m }).then(function () { C.toast('已切換'); C.route(); }).catch(function (e) { C.toast(e.message); }); }
      add(main, h('h3', { text: '整理中場次（網站「整理中場次」頁的分頁）' }));
      add(main, h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(320px,1fr))' }, d.active.map(function (e) {
        return h('div', { class: 'card', style: 'margin:0' }, h('div', { class: 'qh' }, h('span', { class: 'tag act', text: e.code }), h('span', { class: 'nm', text: e.name }), h('span', { class: 'flag ok', text: e.status })),
          h('div', { class: 'kv', style: 'margin-top:10px' }, h('div', { text: '開場' }), h('div', { text: e.start || '—' }), h('div', { text: '整理表' }), h('div', null, h('a', { href: e.url, target: '_blank', rel: 'noopener noreferrer', text: e.fileName || e.url })), h('div', { text: '分頁' }), h('div', { text: e.tab || '（自動偵測）' }),
            h('div', { text: '攤位數' }), h('div', { text: (e.booths || 0) + ' 攤（已對應攤主 ' + e.mapped + '）' }), h('div', { text: '待審核填寫' }), h('div', { text: e.pending + ' 欄' }), h('div', { text: '同名多列' }), h('div', { text: (e.dups || []).length ? e.dups.join('、') + '（不會自動寫入）' : '無' })),
          e.error ? h('div', { class: 'note bad', text: e.error }) : null,
          h('div', { class: 'qb' }, h('a', { class: 'pill', href: '#/events/' + encodeURIComponent(e.code), text: '🛠 到場次頁直接修改' }),
            h('button', { class: 'pill', onclick: function () { var pol = confirm('衝突時以「場次整理表」為準？\n確定＝場次為準（與 PF45 相同）；取消＝保留主資料庫、衝突送審核') ? 'event_wins' : 'db_wins';
              if (!confirm('將把 ' + e.code + ' 併入「新攤位資料庫」（全部記錄、整批可復原）。繼續？')) return; call({ action: 'admin.mergeEvent', code: e.code, policy: pol }).then(function (s) { C.toast('補空白 ' + s.filled + '、衝突 ' + s.conflicts + '、新增列 ' + s.appended + (s.pending ? '、轉待審核 ' + s.pending : '')); }).catch(function (x) { C.toast(x.message); }); }, text: '📤 併入主資料庫…' }),
            h('button', { class: 'pill', onclick: function () { if (confirm('把 ' + e.code + ' 移出整理中清單？（不刪任何檔案）')) call({ action: 'admin.eventRemove', code: e.code }).then(function () { C.route(); }); }, text: '🏁 結束整理（移出清單）' })));
      })));
      var code = h('input', { class: 'in', placeholder: '代碼（例 FF48）' }), name = h('input', { class: 'in', placeholder: '名稱' }), start = h('input', { class: 'in', type: 'date' }), url = h('input', { class: 'in', placeholder: 'https://docs.google.com/spreadsheets/d/…' });
      var src = h('input', { class: 'in', placeholder: '主辦名單試算表網址' }), tpl = h('select', { class: 'in' }, d.active.map(function (e) { return h('option', { value: e.code, text: e.code + ' ' + (e.fileName || '') }); })), pv = h('div');
      add(main, h('div', { class: 'card', style: 'margin-top:16px' }, h('h3', { text: '➕ 新增整理中場次' }),
        h('div', { class: 'note ' + (sum.role === 'owner' ? '' : 'warn'), text: sum.role === 'owner' ? '只有擁有者站長能新增／匯入；試算表必須在允許的雲端資料夾內（ALLOWED_FOLDER_IDS，未設定時＝整理中場次所在資料夾）。' : '⚠ 新增場次與匯入只有擁有者站長能用，你按了會被伺服器拒絕。' }),
        h('div', { class: 'filters', style: 'grid-template-columns:1fr 2fr 1fr' }, code, name, start),
        h('div', { class: 'note' }, h('b', { text: 'A. 已經有整理表：' }), '貼上試算表網址直接登記（系統會檢查第 1 列 A 欄是「攤位名稱」）',
          h('div', { class: 'filters', style: 'grid-template-columns:3fr 1fr' }, url, h('button', { class: 'btn ghost', onclick: function () { call({ action: 'admin.eventAdd', code: code.value, name: name.value, start: start.value, sheetUrl: url.value }).then(function (r) { C.toast('已登記（' + r.booths + ' 列）'); C.route(); }).catch(function (x) { C.toast(x.message); }); }, text: '檢查並登記' }))),
        h('div', { class: 'note' }, h('b', { text: 'B. 匯入主辦攤位名單，自動建立整理表：' }),
          h('label', { class: 'fl', text: '主辦名單（Google 試算表網址；xlsx/csv 先上傳雲端並用試算表開啟）' }), src, h('label', { class: 'fl', text: '沿用格式的範本整理表' }), tpl,
          h('p', { class: 'acts' }, h('button', { class: 'btn ghost', onclick: function () { imp(true); }, text: '🔍 預覽（不寫入）' }))), pv));
      function imp(dry) {
        clear(pv); add(pv, h('div', { class: 'spin', text: '處理中…' }));
        call({ action: dry ? 'admin.importPreview' : 'admin.importCreate', code: code.value, name: name.value, start: start.value, srcUrl: src.value, templateCode: tpl.value }).then(function (r) {
          clear(pv); add(pv, h('div', { class: 'card', style: 'margin:0;background:var(--bg)' }, h('h3', { text: dry ? '預覽結果（尚未寫入）' : '✅ 已建立並登記' }),
            h('div', { class: 'kv' }, h('div', { text: '讀到攤位' }), h('div', { text: r.booths + ' 攤（同名已合併）' }), h('div', { text: '主資料庫同名' }), h('div', { text: r.matched + ' 攤（會預先帶入 SNS）' }), r.sheetId ? h('div', { text: '新整理表' }) : null, r.sheetId ? h('div', { text: r.sheetId }) : null),
            r.sample ? h('table', { class: 't', style: 'margin-top:8px' }, h('thead', null, h('tr', null, ['攤位名稱', '第一天', '第二天'].map(function (x) { return h('th', { text: x }); }))), h('tbody', null, r.sample.map(function (b) { return h('tr', null, h('td', { text: b.name }), h('td', { text: (b.d1 || []).join(',') }), h('td', { text: (b.d2 || []).join(',') })); }))) : null,
            dry ? h('p', { class: 'acts' }, h('button', { class: 'btn', onclick: function () { imp(false); }, text: '✅ 建立整理表並登記' })) : null));
        }).catch(function (x) { clear(pv); add(pv, h('div', { class: 'note bad', text: x.message })); });
      }
    }).catch(function (e) { add(main, h('div', { class: 'card note bad', text: e.message })); });
  }

  /* ---- 關聯判定 ---- */
  function relations(main) {
    Promise.all([take('relations'), C.loadIndex(), C.loadRel()]).then(function (r) {
      var d = r[0], rel = r[2], done = {}, items = [], page = 0, PER = 15;
      d.decisions.forEach(function (x) { if (x.status === '有效') done[[x.a, x.b].sort().join('|')] = x.decision; });
      d.reports.forEach(function (x) { if (/^C\d{5,}$/.test(x.b)) items.push({ a: x.a, b: x.b, reason: '攤主回報：' + x.kind + (x.note ? '（' + x.note + '）' : ''), reported: true }); });
      Object.keys(rel.w).sort().forEach(function (a) { rel.w[a].forEach(function (w) { if (a < w[0] && !done[[a, w[0]].sort().join('|')]) items.push({ a: a, b: w[0], reason: w[1] }); }); });
      var seen = {}; items = items.filter(function (x) { var k = [x.a, x.b].sort().join('|'); if (seen[k] || done[k]) return false; seen[k] = 1; return !!C.S.byId[x.a] && !!C.S.byId[x.b]; });
      add(main, h('div', { class: 'card' }, h('h3', null, '微弱關聯（未合併） ', h('small', { text: items.length + ' 組待判定・攤主回報 ' + d.reports.length + ' 筆・已判定 ' + Object.keys(done).length })),
        h('p', { class: 'muted', text: '合併：B 的所有資料列與出展紀錄改成 A 的攤主ID，舊ID 自動導向（整批記錄在「修改申請」與「ID 合併對照」，可從稽核紀錄整批復原；需 10 分鐘內登入）。確認無關：關聯圖不再顯示。判定立即生效於網站關聯圖。' })));
      var list = h('div'), pg = h('div', { class: 'pager' }); add(main, list); add(main, pg);
      function card(id) { var o = C.S.byId[id] || [id, id, [], '', [], '', [], 0, []]; return h('div', { class: 'oc', style: 'cursor:default' }, C.thumb(o[5]), h('div', { class: 'bd' }, h('a', { class: 'nm', href: '#/o/' + id, text: o[1] }), h('div', { class: 'meta', text: id + '・' + (o[3] || '—') + '・' + (o[4] || []).length + ' 場' }), h('div', { class: 'aka', text: (o[2] || []).filter(function (v) { return v !== o[1]; }).slice(0, 4).join('、') }), h('div', { class: 'tags' }, (o[8] || []).slice(0, 4).map(function (s) { return h('span', { class: 'tag', text: s }); })))); }
      function rd(x, dec) {
        var go = function (note) { call({ action: 'admin.relationDecide', a: x.a, b: x.b, decision: dec, note: note || '' }).then(function (res) { C.toast(dec === 'merge' ? '已合併（移動 ' + res.moved + ' 列）' : '已記錄'); C.S.rel = null; C.route(); }).catch(function (e) { C.toast(e.message); }); };
        if (dec === 'merge') ask('合併：' + x.b + ' → ' + x.a, '判定依據（會記錄）', true).then(function (n) { if (n) go(n); }); else go('');
      }
      function render() {
        clear(list); clear(pg);
        items.slice(page * PER, page * PER + PER).forEach(function (x) {
          var sa = (C.S.byId[x.a] || [])[4] || [], sb = (C.S.byId[x.b] || [])[4] || [], same = sa.filter(function (e) { return sb.indexOf(e) >= 0; });
          add(list, h('div', { class: 'qi ' + (x.reported ? 'mid' : '') }, h('div', { class: 'two', style: 'gap:10px' }, card(x.a), card(x.b)),
            h('div', { style: 'margin-top:6px' }, h('span', { class: 'flag warn', text: '原因：' + x.reason }), same.length ? h('span', { class: 'flag', text: '同場出展：' + same.slice(0, 4).join('、') + '（可能是不同人）' }) : null),
            h('div', { class: 'qb' }, h('button', { class: 'btn', onclick: function () { rd(x, 'merge'); }, text: '🔗 合併（B → A）' }), h('button', { class: 'btn', onclick: function () { rd({ a: x.b, b: x.a }, 'merge'); }, text: '🔗 合併（A → B）' }),
              h('button', { class: 'btn ghost', onclick: function () { rd(x, 'unrelated'); }, text: '🚫 確認無關' }), h('button', { class: 'pill', onclick: function () { rd(x, 'skip'); }, text: '略過' }))));
        });
        var pages = Math.ceil(items.length / PER);
        if (pages > 1) add(pg, h('button', { class: 'pill', disabled: page <= 0, onclick: function () { page--; render(); }, text: '‹' }), h('span', { class: 'muted', text: ' ' + (page + 1) + ' / ' + pages + ' ' }), h('button', { class: 'pill', disabled: page >= pages - 1, onclick: function () { page++; render(); }, text: '›' }));
      }
      render();
      if (d.decisions.length) add(main, h('div', { class: 'card' }, h('h3', { text: '已判定' }), h('table', { class: 't' }, h('thead', null, h('tr', null, ['時間', 'A（保留）', 'B', '判定', '站長', '狀態', '備註'].map(function (x) { return h('th', { text: x }); }))),
        h('tbody', null, d.decisions.slice().reverse().slice(0, 50).map(function (x) { return h('tr', null, h('td', { text: x.at }), h('td', null, h('a', { href: '#/o/' + x.a, text: x.a })), h('td', { text: x.b }), h('td', { text: x.decision }), h('td', { text: x.by }), h('td', { text: x.status }), h('td', { class: 'muted', text: x.note })); })))));
    }).catch(function (e) { add(main, h('div', { class: 'card note bad', text: e.message })); });
  }

  /* ---- 停權 ---- */
  function ownersTab(main) {
    take('owners').then(function (list) {
      var tg = h('input', { class: 'in', placeholder: '攤主ID（C00045）或申請者代號（u_…）' });
      function sus(t, restore) { ask((restore ? '恢復：' : '停權／鎖定：') + t, '原因（會記錄）', !restore).then(function (n) { if (n === null) return; call({ action: 'admin.suspend', target: t, restore: restore, note: n }).then(function (r) { C.toast('已處理 ' + r.n + ' 筆'); C.route(); }).catch(function (e) { C.toast(e.message); }); }); }
      add(main, h('div', { class: 'card' }, h('h3', { text: '停權／鎖定' }),
        h('p', { class: 'muted', text: '帳號停權：該帳號所有認領暫停，待審核申請一併拒絕。攤主鎖定：所有帳號都不能修改此攤主。需 10 分鐘內登入。' }),
        h('div', { class: 'filters', style: 'grid-template-columns:3fr 1fr' }, tg, h('button', { class: 'btn warn', onclick: function () { if (tg.value.trim()) sus(tg.value.trim(), false); }, text: '⛔ 停權／鎖定' })),
        h('table', { class: 't', style: 'margin-top:12px' }, h('thead', null, h('tr', null, ['對象', '類型', '時間', '原因', ''].map(function (x) { return h('th', { text: x }); }))),
          h('tbody', null, list.length ? list.map(function (r) { return h('tr', null, h('td', { text: r.target }), h('td', { text: r.kind }), h('td', { text: r.at }), h('td', { class: 'muted', text: r.note }), h('td', null, h('button', { class: 'pill sm', onclick: function () { sus(r.target, true); }, text: '恢復' }))); }) : h('tr', null, h('td', { colspan: 5, class: 'muted', text: '目前沒有停權或鎖定' }))))));
    }).catch(function (e) { add(main, h('div', { class: 'card note bad', text: e.message })); });
  }

  /* ---- 稽核 ---- */
  function audit(main) {
    var q = h('input', { class: 'in', placeholder: '搜尋攤主／欄位／站長／內容' }), kind = h('select', { class: 'in' }, ['', '核准', '拒絕', '直接修改', '一審', '覆核', '復原', '合併', '關聯', '停權', '認領', '場次', '匯入', '站長', '模式'].map(function (x) { return h('option', { value: x, text: x || '全部動作' }); })),
      from = h('input', { class: 'in', type: 'date' }), body = h('div');
    add(main, h('div', { class: 'card' }, h('h3', null, '稽核紀錄 ', h('small', { text: '「站長操作紀錄」分頁：每個網站後台動作與試算表選單的站長動作（誰、何時、舊值→新值、位置）' })),
      h('div', { class: 'filters', style: 'grid-template-columns:2fr 1fr 1fr 1fr' }, q, kind, from, h('button', { class: 'btn ghost', onclick: csv, text: '⬇ 匯出 CSV' })), body));
    function params(all) { return { action: 'admin.audit', q: q.value, kind: kind.value, from: from.value ? from.value + ' 00:00:00' : '', all: !!all }; }
    function load() {
      clear(body); add(body, h('div', { class: 'spin', text: '載入中…' }));
      call(params()).then(function (d) {
        clear(body);
        add(body, h('table', { class: 't', style: 'margin-top:12px' }, h('thead', null, h('tr', null, ['時間', '站長', '動作', '對象', '欄位：舊值 → 新值', '位置', ''].map(function (x) { return h('th', { text: x }); }))),
          h('tbody', null, d.rows.length ? d.rows.map(function (r) {
            return h('tr', null, h('td', { text: r.at }), h('td', null, h('b', { text: r.admin }), h('div', { class: 'muted', style: 'font-size:11px', text: r.adminUid })),
              h('td', null, h('span', { class: 'tag ' + (/復原/.test(r.action) ? 'act' : /核准|直接修改|覆核|合併/.test(r.action) ? 'ev' : ''), text: r.action })), h('td', { text: r.target }),
              h('td', null, r.field ? h('b', { text: r.field + '：' }) : null, r.old || r.val ? h('span', null, h('span', { class: 'o', style: 'text-decoration:line-through;opacity:.7', text: r.old || '（空白）' }), ' → ', h('span', { text: r.val || '（空白）' })) : null, r.note ? h('div', { class: 'muted', text: r.note }) : null),
              h('td', { class: 'muted', text: r.where }),
              h('td', null, r.revertable ? h('button', { class: 'pill sm', onclick: function () { if (confirm('復原這筆？（只有目前值仍是當初寫入的值才會還原）')) call({ action: 'admin.revert', ids: [r.ref] }).then(function (x) { C.toast(x.ok ? '已復原' : x.already ? '已經復原過' : '復原失敗：此格之後又被修改'); load(); }).catch(function (e) { C.toast(e.message); }); }, text: '↩️ 復原' }) : null,
                r.batchRevertable ? h('button', { class: 'pill sm', onclick: function () { if (confirm('整批復原此合併？')) call({ action: 'admin.revert', batch: r.batch }).then(function (x) { C.toast('已復原 ' + x.ok + ' 列'); load(); }).catch(function (e) { C.toast(e.message); }); }, text: '↩️ 整批復原' }) : null));
          }) : h('tr', null, h('td', { colspan: 7, class: 'muted', text: '沒有紀錄' })))));
        add(body, h('div', { class: 'muted', style: 'margin-top:8px', text: '顯示 ' + d.rows.length + ' 筆（共 ' + d.total + ' 筆）' }));
      }).catch(function (e) { clear(body); add(body, h('div', { class: 'note bad', text: e.message })); });
    }
    function csv() {
      call(params(true)).then(function (d) {
        var cols = ['at', 'admin', 'adminUid', 'action', 'target', 'field', 'old', 'val', 'where', 'batch', 'ref', 'note'];
        var cell = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
        var txt = '\ufeff' + ['時間', '站長', '站長代號', '動作', '對象', '欄位', '舊值', '新值', '位置', '批次ID', '申請ID', '備註'].map(cell).join(',') + '\n' + d.rows.map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(','); }).join('\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = '站長操作紀錄.csv'; document.body.appendChild(a); a.click(); a.remove();
      }).catch(function (e) { C.toast(e.message); });
    }
    var tm; q.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(load, 300); }); kind.addEventListener('change', load); from.addEventListener('change', load); load();
  }

  /* ---- 使用說明（站長版，只有中文） ---- */
  function helpTab(main) { add(main, window.BOOTH_HELP.body(window.ADMIN_HELP, parts[1], '#/admin/help/', '常見問題', '目錄')); }
  /* ---- 站長與安全 ---- */
  function settings(main, sum) {
    var me = sum.admins.filter(function (a) { return a.me; })[0] || {};
    add(main, h('div', { class: 'card' }, h('h3', { text: '站長帳號' }),
      h('table', { class: 't' }, h('thead', null, h('tr', null, ['暱稱', '角色', '代號', '加入時間', '最後操作', ''].map(function (x) { return h('th', { text: x }); }))),
        h('tbody', null, sum.admins.map(function (a) {
          var canRm = a.me ? a.role !== 'owner' : (sum.role === 'owner' && a.role !== 'owner');
          return h('tr', null, h('td', null, h('b', { text: a.label }), a.me ? h('span', { class: 'tag', text: '你' }) : null), h('td', { text: a.role === 'owner' ? '👑 擁有者站長' : '站長' }), h('td', { class: 'muted', text: a.uid }), h('td', { text: a.added }), h('td', { text: a.last || '—' }),
            h('td', null, canRm ? h('button', { class: 'pill sm', onclick: function () { if (confirm((a.me ? '退出站長？' : '移除站長「' + a.label + '」？') + '（需 10 分鐘內登入）')) call({ action: 'admin.adminRemove', u: a.u }).then(function () { C.toast('已移除'); C.route(); }).catch(function (e) { C.toast(e.message); }); }, text: a.me ? '退出' : '移除' }) : null));
        }))),
      h('p', { class: 'acts', style: 'justify-content:flex-start' }, h('button', { class: 'pill', onclick: function () { ask('修改我的站長暱稱', '例：小編A（稽核紀錄顯示用，不要填真名）', true).then(function (n) { if (n) call({ action: 'admin.adminLabel', label: n }).then(function () { C.route(); }); }); }, text: '✏️ 修改我的暱稱（' + (me.label || '') + '）' })),
      h('div', { class: 'note' }, h('b', { text: '新增站長（配對碼）：' }), '對方在網站登入後到「我的攤位」按「取得站長配對碼」（10 分鐘內有效），試算表擁有者到試算表選單「🗂 攤位資料庫網站 › 👑 新增站長帳號」輸入配對碼。只有試算表擁有者能執行此選單；網站上無法自行升級。'),
      h('div', { class: 'note warn', text: '多位站長規則：站長 2 位以上時，身分欄位（攤位名稱，以及取代或清空任何 SNS／網址欄位：FB、X、IG、Pixiv、噗浪、Bluesky、官方網站、賣場、縮圖等；空白欄位第一次填入不算）需兩位不同站長核准；擁有者站長可填必填理由覆核。兩位站長同時處理同一筆時，伺服器以鎖確保只套用一次，後按的人會看到「已由 X 處理」。' })));
    add(main, h('div', { class: 'card note ' + (sum.sheetEditors > 1 ? 'bad' : 'warn') }, h('b', { text: '⚠ 試算表編輯權＝全部權限' }),
      h('p', { text: '試算表的編輯者可以打開 Apps Script、看到 HMAC_SECRET 等指令碼屬性、修改程式碼，等於繞過網站所有審核。' }),
      h('ul', null, h('li', { text: '只在網站上審核的站長，不要加成試算表編輯者。' }), h('li', { text: '試算表只分享給擁有者本人（其他人最多給「檢視者」）。' }),
        h('li', { text: '網站上的「新增場次」與「匯入整理表」只有擁有者站長能用，且試算表必須在允許的雲端資料夾（指令碼屬性 ALLOWED_FOLDER_IDS；未設定時＝整理中場次所在資料夾）。' })),
      h('p', null, '目前試算表編輯者：', h('b', { text: sum.sheetEditors < 0 ? '無法讀取' : sum.sheetEditors + ' 位' }), sum.sheetEditors > 1 ? '（⚠ 超過 1 位，請到試算表「共用」檢查）' : '（✅）')));
    add(main, h('div', { class: 'card' }, h('h3', { text: '安全狀態' }), h('div', { class: 'kv' },
      h('div', { text: 'Safe Browsing' }), h('div', { text: sum.safeBrowsing ? '✅ 已設定' : '⚠ 未設定（連結只做網域白名單檢查）' }), h('div', { text: '通知信箱' }), h('div', { text: sum.alertEmail }),
      h('div', { text: '站長登入' }), h('div', { text: '2 小時後需重新登入；批次核准、身分欄位、合併、匯入、停權、移除站長需 10 分鐘內重新登入' + (sum.fresh ? '（目前：10 分鐘內 ✅）' : '（目前：超過 10 分鐘，執行時會要求重新登入）') }),
      h('div', { text: '緊急停用' }), h('div', { text: '指令碼屬性 ADMIN_WEB_DISABLED=1 → 網站後台全部停用' }),
      h('div', { text: '後端版本' }), h('div', { text: sum.version }))));
  }
};
