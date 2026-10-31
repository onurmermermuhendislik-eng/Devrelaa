// V6: Android fiziksel Geri tusu merkezi (src/core/back.js). Gercek cihaz testi DEGILDIR; Capacitor koprusu taklit edilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBack } from '../src/core/back.js';

const fakeCap = ({ headers = [{ name: 'App' }], failListener = false } = {}) => {
  const c = { PluginHeaders: headers, listeners: [], min: 0, calls: [] };
  c.addListener = (p, e, cb) => { c.calls.push([p, e]); c.listeners.push(cb); if (failListener) setTimeout(() => cb(null, new Error('yok')), 0); return { remove() {} }; };
  c.nativePromise = (p, m) => { c.calls.push([p, m]); if (p === 'App' && m === 'minimizeApp') c.min += 1; return Promise.resolve({}); };
  return c;
};
const mk = (cap, state = { view: 'home', left: 0 }) => {
  const b = createBack({ view: () => state.view, leave: () => { state.left += 1; }, cap: () => cap, log: () => {} });
  return { b, state };
};

test('Geri: dinleyici yalnizca BIR kez kaydedilir (tekrar install birikmez)', () => {
  const cap = fakeCap();
  const { b } = mk(cap);
  b.install(); b.install(); b.install();
  assert.equal(cap.listeners.length, 1);
  assert.deepEqual(cap.calls[0], ['App', 'backButton']);
  assert.equal(b.status().plugin, 'ok');
});

test('Geri: acik katman varsa yalniz onu kapatir; oyundan cikmaz', () => {
  const cap = fakeCap();
  const { b, state } = mk(cap, { view: 'game', left: 0 });
  b.install();
  let open = true;
  const off = b.onScreen(() => (open ? ((open = false), true) : false));
  assert.equal(b.handle(), 'screen');
  assert.equal(state.left, 0);
  b.reset();
  assert.equal(b.handle(), 'leave'); // katman kapali: ikinci Geri oyundan cikar
  assert.equal(state.left, 1);
  off();
});

test('Geri: oyunda cift Geri tek cikis yapar; reset sonrasi yeniden calisir', () => {
  const { b, state } = mk(fakeCap(), { view: 'game', left: 0 });
  b.install();
  assert.equal(b.handle(), 'leave');
  assert.equal(b.handle(), 'ignored');
  assert.equal(b.handle(), 'ignored');
  assert.equal(state.left, 1);
  b.reset(); // yeni rota
  assert.equal(b.handle(), 'leave');
  assert.equal(state.left, 2);
});

test('Geri: ana ekranda uygulamayi arka plana alir (dongu/cikis yok), her basista tutarli', () => {
  const cap = fakeCap();
  const { b, state } = mk(cap, { view: 'home', left: 0 });
  b.install();
  assert.equal(b.handle(), 'minimize');
  assert.equal(b.handle(), 'minimize');
  assert.equal(cap.min, 2);
  assert.equal(state.left, 0);
});

test('Geri: katman kaydi silinince eski isleyici kalmaz (sizinti yok)', () => {
  const { b, state } = mk(fakeCap(), { view: 'game', left: 0 });
  b.install();
  const off = b.onScreen(() => true);
  off();
  assert.equal(b.handle(), 'leave');
  assert.equal(state.left, 1);
});

test('Geri: @capacitor/app yuklu degilse dinleyici kaydedilmez, durum "missing" olarak raporlanir', () => {
  const cap = fakeCap({ headers: [{ name: 'TextToSpeech' }] });
  const { b } = mk(cap);
  b.install();
  assert.equal(cap.listeners.length, 0);
  assert.equal(b.status().plugin, 'missing');
  assert.equal(b.status().listening, false);
});

test('Geri: kopru yoksa (tarayici) hicbir sey kaydedilmez; native hata donerse durum "error"', async () => {
  const none = createBack({ view: () => 'home', leave() {}, cap: () => undefined, log: () => {} });
  none.install();
  assert.equal(none.status().plugin, 'no-bridge');
  const cap = fakeCap({ failListener: true });
  const { b } = mk(cap);
  b.install();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(b.status().plugin, 'error');
  assert.equal(b.status().listening, false);
});

test('Geri: native olay dinleyicisi handle()e yonlenir', () => {
  const cap = fakeCap();
  const { b, state } = mk(cap, { view: 'game', left: 0 });
  b.install();
  cap.listeners[0]({ canGoBack: true });
  assert.equal(state.left, 1);
  assert.equal(b.status().fired, 1);
});
