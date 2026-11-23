// Minimal Google Apps Script mocks for running apps-script/code.gs under Node (no network, no Google APIs).
'use strict';
const crypto = require('crypto');
const writes = [];       // every cell write: {file, sheet, a1, value}
const mails = [];
function colL(n) { let s = ''; n = n + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function colN(s) { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
const disp = v => { v = v === null || v === undefined ? '' : (v instanceof Date ? v.toISOString() : String(v)); return v.charAt(0) === "'" ? v.slice(1) : v; };
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  _cell(i, j) { const row = this.sh.data[this.r - 1 + i] || []; return row[this.c - 1 + j]; }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = this._cell(i, j); row.push(v === undefined || v === null ? '' : disp(v)); } o.push(row); } return o; }
  getDisplayValues() { return this.getValues().map(r => r.map(v => String(v))); }
  getValue() { return this.getValues()[0][0]; } getDisplayValue() { return String(this.getValue()); }
  getFormulas() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.formulas[(this.r + i) + ':' + (this.c + j)] || ''); o.push(row); } return o; }
  getFormulasR1C1() { return this.getFormulas(); }
  setFormulaR1C1(f) { for (let i = 0; i < this.nr; i++) { this.sh.formulas[(this.r + i) + ':' + this.c] = f; this.sh._set(this.r + i, this.c, '(formula)'); } return this; }
  setValue(v) { this.sh._set(this.r, this.c, v); this.sh._log(this.r, this.c, v); return this; }
  setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => { this.sh._set(this.r + i, this.c + j, v); this.sh._log(this.r + i, this.c + j, v); })); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) { if (this.sh.data[this.r - 1 + i]) this.sh.data[this.r - 1 + i][this.c - 1 + j] = ''; delete this.sh.formulas[(this.r + i) + ':' + (this.c + j)]; } return this; }
  offset(dr, dc) { return new Range(this.sh, this.r + dr, this.c + dc, 1, 1); }
  getRow() { return this.r; } getLastRow() { return this.r + this.nr - 1; } getColumn() { return this.c; } getLastColumn() { return this.c + this.nc - 1; } getSheet() { return this.sh; }
  getA1Notation() { return colL(this.c - 1) + this.r; }
}
class Sheet {
  constructor(file, name, data, formulas) { this.file = file; this.name = name; this.data = data.map(r => r.slice()); this.formulas = formulas || {}; this.maxRows = Math.max(this.data.length, 1000); }
  _set(r, c, v) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; if (r > this.maxRows) this.maxRows = r; }
  _log(r, c, v) { writes.push({ file: this.file.id, sheet: this.name, a1: colL(c - 1) + r, value: v }); }
  getName() { return this.name; } setName(n) { this.name = n; return this; }
  getLastRow() { for (let i = this.data.length; i > 0; i--) if ((this.data[i - 1] || []).some(v => v !== '' && v !== null && v !== undefined)) return i; return 0; }
  getLastColumn() { return Math.max(0, ...this.data.map(r => { for (let j = r.length; j > 0; j--) if (r[j - 1] !== '' && r[j - 1] !== undefined) return j; return 0; })); }
  getMaxRows() { return this.maxRows; } insertRowsAfter(_, n) { this.maxRows += n; } deleteRows(r, n) { this.data.splice(r - 1, n); this.maxRows -= n; }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(a, b, c, d) {
    if (typeof a === 'string') { const m = a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/); const c1 = colN(m[1]), r1 = +m[2], c2 = m[3] ? colN(m[3]) : c1, r2 = m[4] ? +m[4] : r1; return new Range(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1); }
    return new Range(this, a, b, c || 1, d || 1);
  }
  appendRow(row) { const r = this.getLastRow() + 1; row.forEach((v, j) => { this._set(r, j + 1, v); this._log(r, j + 1, v); }); return this; }
  createTextFinder(t) { const sh = this; return { matchEntireCell() { return this; }, replaceAllWith(x) { sh.data.forEach(r => r.forEach((v, j) => { if (typeof v === 'string' && v.includes(t)) r[j] = v.split(t).join(x); })); },
    findNext() { for (let i = 0; i < sh.data.length; i++) for (let j = 0; j < (sh.data[i] || []).length; j++) if (String(sh.data[i][j]).includes(t)) return new Range(sh, i + 1, j + 1, 1, 1); return null; } }; }
}
class SS {
  constructor(id, name, sheets) { this.id = id; this.name = name; this.sheets = sheets.map(([n, d, f]) => new Sheet(this, n, d, f)); }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; } getSheets() { return this.sheets; } getId() { return this.id; } getName() { return this.name; } getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
  insertSheet(n) { const s = new Sheet(this, n, [[]]); this.sheets.push(s); return s; }
  getOwner() { return { getEmail: () => 'owner@example.invalid' }; }
}
function makeEnv(opts) {
  const files = {}; let active = null; const props = Object.assign({}, opts.props || {}); const cache = new Map(); const ui = { prompts: [], alerts: [] };
  const now = () => Date.now();
  const toBytes = s => Array.from(Buffer.from(s, 'utf8')).map(b => b > 127 ? b - 256 : b);
  const fromBytes = a => Buffer.from(a.map(b => b < 0 ? b + 256 : b));
  const env = {
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, Error, encodeURIComponent, parseInt, isNaN,
    SpreadsheetApp: { getActive: () => active, openById: id => { if (!files[id]) throw new Error('no file ' + id); return files[id]; }, getUi: () => ({
      prompt: () => { const t = ui.prompts.shift(); return { getSelectedButton: () => 'OK', getResponseText: () => t || '' }; }, alert: (a, b) => { ui.alerts.push(b || a); return 'YES'; },
      ButtonSet: { OK_CANCEL: 1, YES_NO: 2 }, Button: { OK: 'OK', YES: 'YES' }, createMenu: () => ({ addItem() { return this; }, addSeparator() { return this; }, addToUi() { } }), showModalDialog() { } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => { const x = cache.get(k); return x && x.exp > now() ? x.v : null; }, put: (k, v, t) => { if (String(v).length > 100000) throw new Error('cache value too big'); cache.set(k, { v: String(v), exp: now() + t * 1000 }); },
      putAll: (o, t) => Object.keys(o).forEach(k => cache.set(k, { v: String(o[k]), exp: now() + t * 1000 })), getAll: ks => { const o = {}; ks.forEach(k => { const x = cache.get(k); if (x && x.exp > now()) o[k] = x.v; }); return o; }, remove: k => cache.delete(k) }) },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (m, k) => Array.from(crypto.createHmac('sha256', k).update(m, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      base64EncodeWebSafe: b => (typeof b === 'string' ? Buffer.from(b, 'utf8') : fromBytes(b)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => Array.from(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')).map(b => b > 127 ? b - 256 : b),
      newBlob: x => ({ getBytes: () => toBytes(x), getDataAsString: () => fromBytes(x).toString('utf8') }),
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, m) => Array.from(crypto.createHash(alg).update(String(m), 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      formatDate: (d, tz, f) => { const t = new Date(d.getTime() + 8 * 3600e3), p = n => String(n).padStart(2, '0');
        return f.replace('yyyy', t.getUTCFullYear()).replace('yy', String(t.getUTCFullYear()).slice(2)).replace('MM', p(t.getUTCMonth() + 1)).replace('dd', p(t.getUTCDate())).replace('HH', p(t.getUTCHours())).replace('mm', p(t.getUTCMinutes())).replace('ss', p(t.getUTCSeconds())); }
    },
    UrlFetchApp: { fetch: (url, o) => opts.fetch(url, o) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ content: s, setMimeType() { return this; }, getContent() { return s; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
    MailApp: { sendEmail: (to, subj, body) => mails.push({ to, subj, body }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.invalid' }), getActiveUser: () => ({ getEmail: () => env.activeUser === undefined ? 'owner@example.invalid' : env.activeUser }) },
    DriveApp: { getFileById: id => ({ getName: () => files[id].name, getParents: () => { let d = false; return { hasNext: () => !d, next: () => { d = true; return {}; } }; },
      makeCopy: (name) => { const src = files[id], nid = 'copy_' + crypto.randomBytes(12).toString('hex'); const c = new SS(nid, name, src.sheets.map(s => [s.name, s.data, Object.assign({}, s.formulas)])); files[nid] = c; return { getId: () => nid }; } }), getRootFolder: () => ({}) },
    HtmlService: { createTemplate: html => { const t = { evaluate: () => { t.html = renderTemplate(html, t); return { setWidth() { return this; }, setHeight() { return this; } }; } }; return t; } }
  };
  env.addFile = (id, name, sheets) => { files[id] = new SS(id, name, sheets); return files[id]; };
  env.setActive = id => { active = files[id]; };
  env.files = files; env.props = props; env.cache = cache; env.ui = ui; env.writes = writes; env.mails = mails;
  return env;
}
// Apps Script HtmlService template semantics: <?= x ?> = HTML-escaped output, <? code ?> = code
function renderTemplate(html, data) {
  let code = 'var __o="";with(__d){', i = 0;
  const re = /<\?(=|!)?([\s\S]*?)\?>/g; let m;
  while ((m = re.exec(html))) { code += '__o+=' + JSON.stringify(html.slice(i, m.index)) + ';'; if (m[1] === '=') code += '__o+=__esc(' + m[2] + ');'; else if (m[1] === '!') code += '__o+=(' + m[2] + ');'; else code += m[2]; i = re.lastIndex; }
  code += '__o+=' + JSON.stringify(html.slice(i)) + ';}return __o;';
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return new Function('__d', '__esc', code)(data, esc);
}
module.exports = { makeEnv, writes, mails, colL };
