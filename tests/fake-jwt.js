// 測試／開發用的假 Google ID token：形狀和真的一樣（3 段 base64url、RS256 header），簽章固定為 FAKE_SIG。
// 只有本機模擬的 tokeninfo 會接受它；真的 Google 一定拒絕。
'use strict';
const FAKE_SIG = 'ZmFrZS1zaWduYXR1cmUtZm9yLXRlc3RzLW9ubHktbm90LXZhbGlkLWF0LWdvb2dsZQ';
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function fakeJwt(sub, aud, o = {}) {
  const now = Math.floor(Date.now() / 1000);
  return b64u({ alg: 'RS256', kid: 'test', typ: 'JWT' }) + '.' + b64u(Object.assign({ iss: 'https://accounts.google.com', aud, sub, iat: now - (o.age || 0), exp: now + 3600 }, o.claims || {})) + '.' + FAKE_SIG;
}
/** 模擬 tokeninfo：回傳 payload，或 null（不是我們發的假 token）。 */
function readFake(tok) {
  const p = String(tok).split('.'); if (p.length !== 3 || p[2] !== FAKE_SIG) return null;
  try { return JSON.parse(Buffer.from(p[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); } catch (e) { return null; }
}
module.exports = { fakeJwt, readFake, FAKE_SIG };
