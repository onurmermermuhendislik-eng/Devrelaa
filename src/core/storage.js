// V4: oyun bazli ilerleme `games.<oyunId>.correct` (yalnizca o oyun oynanirsa yazilir; V3 kaydi aynen gecerlidir).
// Sekli Tamamla ilerlemesi geriye uyum icin ust duzeydeki `correct` alanindadir.
// Yerel, minimum veri. Sadece: ilerleme sayaci, yas bandi, ses tercihi, devre bolumu ilerlemesi, acilis ekrani goruldu mu.
// Konum/cihaz kimligi ASLA saklanmaz; hicbir sey cihazdan disari cikmaz (cevrimici hesap yok).
// V8.2: yalnizca CIHAZDA yerel `profile` (ad/soyad: baş harfleri gostermek icin) ve `parent` (ebeveyn kilidi: PIN ozeti, acik/kapali, kilitli oyunlar). EKLEMELI alanlar: eski kayitlarda yok -> varsayilan.
const KEY = 'altez-minilab:v1';

const DEFAULTS = () => ({
  correct: 0,
  band: '4-5',
  sound: true,
  seen: false,
  circuit: { '4-5': { stage: 0, plays: 0 }, '6-8': { stage: 0, plays: 0 } }
});

function memoryBackend() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v) };
}

export function defaultBackend() {
  try {
    const ls = globalThis.localStorage;
    ls.setItem('__t', '1');
    ls.removeItem('__t');
    return ls;
  } catch {
    return memoryBackend();
  }
}

// V5: oyun kaydi `correct` (zorunlu) + istege bagli `found` (kesif kimlikleri) ve `saved` (kayitli bulus taslaklari). Digerleri atilir.
const ID = /^[\w-]{1,30}$/;
const PART = ['wire', 'led', 'resistor', 'switch'];
function cleanGame(g) {
  const out = { correct: Math.floor(g.correct) };
  if (Array.isArray(g.found)) out.found = [...new Set(g.found.filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, 20);
  // V7.7: Gorevler (Elektrik Dedektifi, Mantik ve Bilim) tamamlanan gorev kimlikleri. EKLEMELI alan: eski kayitlarda yok -> bos sayilir.
  if (Array.isArray(g.done)) out.done = [...new Set(g.done.filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, 64);
  if (Array.isArray(g.saved)) {
    out.saved = g.saved
      .filter((x) => x && typeof x.layout === 'string' && ID.test(x.layout) && Array.isArray(x.slots) && x.slots.length >= 1 && x.slots.length <= 8)
      .map((x) => ({
        v: 1, // kayit bicimi surumu (eski kayitlarda yok -> 1 sayilir)
        layout: x.layout,
        slots: x.slots.map((t) => (PART.includes(t) ? t : null)),
        sw: x.slots.map((_, i) => (x.sw?.[i] === 'closed' ? 'closed' : 'open'))
      }))
      .slice(-6);
  }
  return out;
}

function sanitize(raw) {
  const d = DEFAULTS();
  if (!raw || typeof raw !== 'object') return d;
  if (Number.isFinite(raw.correct) && raw.correct >= 0) d.correct = Math.floor(raw.correct);
  if (raw.band === '4-5' || raw.band === '6-8') d.band = raw.band;
  if (typeof raw.sound === 'boolean') d.sound = raw.sound;
  if (typeof raw.seen === 'boolean') d.seen = raw.seen;
  for (const b of ['4-5', '6-8']) {
    const c = raw.circuit?.[b];
    if (c && Number.isFinite(c.stage) && Number.isFinite(c.plays) && c.stage >= 0 && c.plays >= 0) {
      d.circuit[b] = { stage: Math.floor(c.stage), plays: Math.floor(c.plays) };
    }
  }
  // Oyun bazli ilerleme (sadece gecerli kayitlar korunur; bilinmeyen oyun kimlikleri de saklanir, boylece yeni oyun eskileri silmez)
  if (raw.games && typeof raw.games === 'object') {
    const games = {};
    for (const [id, g] of Object.entries(raw.games)) {
      if (/^[\w-]{1,40}$/.test(id) && g && Number.isFinite(g.correct) && g.correct >= 0) games[id] = cleanGame(g);
    }
    if (Object.keys(games).length) d.games = games;
  }
  // V7: Egitim ilerlemesi AYRI alanda (`edu.done` = tamamlanan ders kimlikleri). Oyun kayitlarina dokunmaz; bozuk deger yok sayilir.
  if (raw.edu && typeof raw.edu === 'object' && Array.isArray(raw.edu.done)) {
    const done = [...new Set(raw.edu.done.filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, 64);
    if (done.length) d.edu = { done };
  }
  // V8.0 Macera: TEK ilerleme modeli. `adv.tasks` = { gorevKimligi: enIyiYildiz(1-3) }; coin, kilitler ve bolge durumu BUNDAN turetilir
  // (ayri sayac yok). `adv.intro` = tanitim animasyonu izlendi/atlandi. EKLEMELI alan: eski kayitlarda yok -> bos sayilir.
  if (raw.adv && typeof raw.adv === 'object') {
    const adv = {};
    if (typeof raw.adv.intro === 'boolean') adv.intro = raw.adv.intro;
    if (raw.adv.tasks && typeof raw.adv.tasks === 'object') {
      const t = {};
      for (const [id, st] of Object.entries(raw.adv.tasks).slice(0, 64)) if (ID.test(id) && Number.isFinite(st)) t[id] = Math.min(3, Math.max(1, Math.floor(st)));
      if (Object.keys(t).length) adv.tasks = t;
    }
    // V8.4 Enerji Marketi: `inv` = sahip olunan sanal ekipman kimlikleri (TEK SEFER; coin harcamasi buradan TURETILIR, ayri sayac yok).
    if (Array.isArray(raw.adv.inv)) {
      const inv = [...new Set(raw.adv.inv.filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, 32);
      if (inv.length) adv.inv = inv;
    }
    if (Object.keys(adv).length) d.adv = adv;
  }
  // V8.5 ses karisimi: `mix` = { music: muzik acik, vol: muzik seviyesi 0-1 (0.1 adim), amb: ortam sesleri acik }. EKLEMELI alan: eski kayitlarda yok -> varsayilan.
  // Ana `sound` (sessiz mod) HER ZAMAN ustundir: sound=false iken muzik/ortam/efekt/anlatim calmaz.
  if (raw.mix && typeof raw.mix === 'object') {
    const mx = {};
    if (typeof raw.mix.music === 'boolean') mx.music = raw.mix.music;
    if (typeof raw.mix.amb === 'boolean') mx.amb = raw.mix.amb;
    if (Number.isFinite(raw.mix.vol)) mx.vol = Math.round(Math.min(1, Math.max(0, raw.mix.vol)) * 10) / 10;
    if (Object.keys(mx).length) d.mix = mx;
  }
  // V8.2 yerel profil (yalnizca bu cihazda; ad ve soyad en fazla 20 harf). Bos/bozuk -> profil yok (giris yapilmamis).
  if (raw.profile && typeof raw.profile === 'object') {
    const clean = (v) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{M}\s'’-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20) : '');
    const first = clean(raw.profile.first);
    const last = clean(raw.profile.last);
    if (first && last) d.profile = { first, last };
  }
  // V8.2 ebeveyn kilidi: `on` acik/kapali, `pin`/`salt` = PIN OZETI (PIN kendisi saklanmaz), `blocked` = kilitli oyun/bolum kimlikleri.
  if (raw.parent && typeof raw.parent === 'object') {
    const pr = {};
    if (typeof raw.parent.on === 'boolean') pr.on = raw.parent.on;
    if (typeof raw.parent.pin === 'string' && /^[0-9a-f]{8,20}$/.test(raw.parent.pin) && typeof raw.parent.salt === 'string' && /^[0-9a-f]{4,16}$/.test(raw.parent.salt)) {
      pr.pin = raw.parent.pin;
      pr.salt = raw.parent.salt;
    }
    if (Array.isArray(raw.parent.blocked)) pr.blocked = [...new Set(raw.parent.blocked.filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, 32);
    if (pr.on && !pr.pin) pr.on = false; // PIN olmadan "aktif" olamaz
    if (Object.keys(pr).length) d.parent = pr;
  }
  return d;
}

export function createStorage(backend = defaultBackend()) {
  let state;
  try {
    const raw = backend.getItem(KEY);
    state = sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    state = DEFAULTS();
  }
  let lastOk = true;
  const save = () => {
    try {
      backend.setItem(KEY, JSON.stringify(state));
      lastOk = true;
    } catch {
      lastOk = false; // depolama dolu/kapali: oyun yine de calismaya devam eder; cagiran saveOk() ile ogrenebilir
    }
  };
  return {
    get: () => state,
    // Son yazma cihaza gercekten yazildi mi? (kayit basarisini cocuga yanlis bildirmemek icin)
    saveOk: () => lastOk,
    // V8.5 ses karisimi (varsayilanlarla birlesik). setMix yalniz `mix` alanini yazar.
    getMix: () => ({ music: true, amb: true, vol: 0.6, ...(state.mix || {}) }),
    setMix(patch) {
      state = sanitize({ ...state, mix: { ...(state.mix || {}), ...patch } });
      save();
      return { music: true, amb: true, vol: 0.6, ...(state.mix || {}) };
    },
    update(patch) {
      state = sanitize({ ...state, ...patch });
      save();
      return state;
    },
    // Oyun bazli ilerleme: ortak seviye adlari/esikleri ayni, sayac oyuna ozel
    getGame: (id) => ({ correct: 0, ...(state.games?.[id] || {}) }),
    updateGame(id, patch) {
      state = sanitize({ ...state, games: { ...(state.games || {}), [id]: { ...(state.games?.[id] || {}), ...patch } } });
      save();
      return { correct: 0, ...(state.games?.[id] || {}) };
    },
    // V7 Egitim: tamamlanan ders kimlikleri (yalniz bu alan yazilir)
    getEdu: () => ({ done: [...(state.edu?.done || [])] }),
    updateEdu(done) {
      state = sanitize({ ...state, edu: { done } });
      save();
      return { done: [...(state.edu?.done || [])] };
    },
    // V7.7 Gorevler: tamamlanan gorev kimlikleri (games.<id>.done). completeTask ATOMIKTIR: ayni gorev ikinci kez ODUL URETMEZ
    // (firstTime=false, hicbir sey yazilmaz). correct = ilk kez cozulen gorev sayisi.
    getTasks: (id) => ({ done: [...(state.games?.[id]?.done || [])] }),
    completeTask(id, taskId) {
      const cur = state.games?.[id];
      const done = cur?.done || [];
      if (!ID.test(id) || !ID.test(taskId) || done.includes(taskId) || done.length >= 64) return { firstTime: false, saved: true, done: [...done] };
      const prev = state;
      state = sanitize({ ...state, games: { ...(state.games || {}), [id]: { ...(cur || {}), correct: (cur?.correct || 0) + 1, done: [...done, taskId] } } });
      save();
      // V7.8: yazma cihaza gercekten yazilamadiysa bellekteki ilerleme geri alinir (rozet kazanilmis gorunmez, gorev tekrar cozulebilir)
      if (!lastOk) {
        state = prev;
        return { firstTime: false, saved: false, done: [...done] };
      }
      return { firstTime: true, saved: true, done: [...(state.games?.[id]?.done || [])] };
    },
    // V8.0 Macera ilerlemesi
    getAdv: () => ({ intro: !!state.adv?.intro, tasks: { ...(state.adv?.tasks || {}) }, inv: [...(state.adv?.inv || [])] }),
    setAdvIntro(v = true) {
      state = sanitize({ ...state, adv: { ...(state.adv || {}), intro: !!v } });
      save();
      return !!state.adv?.intro;
    },
    // ATOMIK: ayni gorev ikinci kez COIN uretmez (firstTime=false); yalniz daha iyi yildiz kaydedilir (improved). Yazma cihaza
    // yazilamadiysa bellekteki durum geri alinir (saved=false): odul kazanilmis gorunmez, gorev tekrar cozulebilir.
    completeAdvTask(taskId, stars) {
      if (!ID.test(taskId) || !Number.isFinite(stars)) return { firstTime: false, improved: false, saved: true, stars: 0 };
      const st = Math.min(3, Math.max(1, Math.floor(stars)));
      const cur = state.adv?.tasks || {};
      const best = cur[taskId] || 0;
      if (best && st <= best) return { firstTime: false, improved: false, saved: true, stars: best };
      if (!best && Object.keys(cur).length >= 64) return { firstTime: false, improved: false, saved: true, stars: 0 };
      const prev = state;
      state = sanitize({ ...state, adv: { ...(state.adv || {}), tasks: { ...cur, [taskId]: st } } });
      save();
      if (!lastOk) {
        state = prev;
        return { firstTime: false, improved: false, saved: false, stars: best };
      }
      return { firstTime: !best, improved: !!best, saved: true, stars: st };
    },
    // V8.4 ATOMIK satin alma: ayni ekipman ikinci kez alinamaz (cift tiklama/eszamanli cagri tek harcama). Fiyat/bakiye karari cagirandadir
    // (model.canBuy); burada yalniz tekrar ve kapasite korunur. Yazma cihaza yazilamadiysa bellekteki durum geri alinir (coin HARCANMAZ).
    buyItem(itemId) {
      const cur = state.adv?.inv || [];
      if (!ID.test(itemId) || cur.includes(itemId) || cur.length >= 32) return { ok: false, saved: true, owned: cur.includes(itemId), inv: [...cur] };
      const prev = state;
      state = sanitize({ ...state, adv: { ...(state.adv || {}), inv: [...cur, itemId] } });
      save();
      if (!lastOk) {
        state = prev;
        return { ok: false, saved: false, owned: false, inv: [...cur] };
      }
      return { ok: true, saved: true, owned: true, inv: [...(state.adv?.inv || [])] };
    },
    // V8.1 GERIYE UYUM: V8.0-proto1 gorev kimlikleri (a1-pil-lamba ...) yeni kimliklere tasinir ({eskiId: yeniId}); en iyi yildiz korunur,
    // eski anahtar silinir, yeni anahtar zaten varsa (daha iyi yildiz) dokunulmaz. Degisiklik yoksa YAZMAZ. Dondurur: tasinan sayi.
    migrateAdvIds(map) {
      const cur = state.adv?.tasks;
      if (!cur) return 0;
      const next = { ...cur };
      let n = 0;
      for (const [oldId, newId] of Object.entries(map || {})) {
        if (!(oldId in next) || oldId === newId || !ID.test(newId)) continue;
        next[newId] = Math.max(next[newId] || 0, next[oldId]);
        delete next[oldId];
        n += 1;
      }
      if (!n) return 0;
      const prev = state;
      state = sanitize({ ...state, adv: { ...(state.adv || {}), tasks: next } });
      save();
      if (!lastOk) {
        state = prev;
        return 0;
      }
      return n;
    },
    setCircuit(band, value) {
      state = sanitize({ ...state, circuit: { ...state.circuit, [band]: value } });
      save();
      return state;
    }
  };
}
