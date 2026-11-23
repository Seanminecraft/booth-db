// 主題：system（預設，跟隨系統）／light／dark。在 <head> 同步執行避免閃爍。
(function () {
  var m = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function pref() { var p = localStorage.getItem('theme'); return p === 'light' || p === 'dark' ? p : 'system'; }
  function apply() { var p = pref(), r = p === 'system' ? (m && m.matches ? 'light' : 'dark') : p; document.documentElement.setAttribute('data-theme', r); document.documentElement.setAttribute('data-theme-pref', p); window.dispatchEvent(new Event('themechange')); }
  var q = new URLSearchParams(location.search).get('theme'); if (q === 'light' || q === 'dark' || q === 'system') localStorage.setItem('theme', q);
  window.BOOTH_THEME = { pref: pref, set: function (p) { localStorage.setItem('theme', p); apply(); }, isLight: function () { return document.documentElement.getAttribute('data-theme') === 'light'; } };
  if (m && m.addEventListener) m.addEventListener('change', function () { if (pref() === 'system') apply(); });
  apply();
})();
