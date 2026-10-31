// V8.2 Ebeveyn kilidi (cevrimdisi, cihazda; GUVENLIK DEGIL, cocugun yanlislikla asmasini onleyen cocuk kilidi).
//  - PIN (4 hane) yalniz ozet olarak saklanir. PIN yokken/unutulunca "yetiskin sorusu" (carpma+toplama) gecilir, sonra yeni PIN konur.
//  - Aktif iken: kilitli oyun/bolumler acilmaz (kart + dogrudan rota), yas grubu degisimi ebeveyn dogrulamasi ister.
//  - Pasif iken hicbir kisit yok. Ilerleme kayitlarina DOKUNMAZ (ayri alan).
export const GATE_KEYS = ['adventure', 'learn']; // oyun kimlikleri games kaydindan eklenir

// Hafif, senkron, tuzlu ozet (cyrb53). 4 haneli PIN icin kriptografik guc iddiasi yoktur.
export function hashPin(pin, salt) {
  let h1 = 0xdeadbeef ^ 0,
    h2 = 0x41c6ce57 ^ 0;
  const s = `${salt}:${pin}`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
export const validPin = (p) => typeof p === 'string' && /^\d{4}$/.test(p);

// Yetiskin sorusu: cocuk (4-8 yas) icin zor; yetiskin icin kolay. rng() 0..1
export function newChallenge(rng = Math.random) {
  const a = 12 + Math.floor(rng() * 8); // 12-19
  const b = 6 + Math.floor(rng() * 4); // 6-9
  const c = 3 + Math.floor(rng() * 7); // 3-9
  return { q: `${a} × ${b} + ${c}`, a: a * b + c };
}

export function createParental(storage, { rng = Math.random } = {}) {
  const st = () => storage.get().parent || {};
  const write = (patch) => storage.update({ parent: { ...st(), ...patch } });
  const api = {
    hasPin: () => !!st().pin,
    isOn: () => !!st().on && !!st().pin,
    blocked: () => [...(st().blocked || [])],
    // Erisim: yalniz kontrol AKTIFken kilitli sayilir
    isBlocked: (id) => api.isOn() && (st().blocked || []).includes(id),
    verifyPin: (p) => validPin(p) && !!st().pin && hashPin(p, st().salt) === st().pin,
    setPin(p) {
      if (!validPin(p)) return false;
      const salt = Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0');
      write({ pin: hashPin(p, salt), salt });
      return api.hasPin();
    },
    setOn(v) {
      if (v && !api.hasPin()) return false;
      write({ on: !!v });
      return api.isOn() === !!v;
    },
    setBlocked(id, blocked) {
      const cur = new Set(st().blocked || []);
      blocked ? cur.add(id) : cur.delete(id);
      write({ blocked: [...cur] });
      return cur.has(id) === !!blocked;
    },
    challenge: () => newChallenge(rng)
  };
  return api;
}
