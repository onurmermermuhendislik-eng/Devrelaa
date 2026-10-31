// V8.5 SES MANZARASI katalogu: bolum/sahne -> { muzik, ortam }. Muzik (music.js) ve ortam sesi (ambience.js) BAGIMSIZDIR; bu tablo yalniz hangi
// sahnede hangisinin istenecegini soyler. `ready:false` = bolum henuz yapilmadi (tasarim). Yeni bolum = buraya satir + adventure.json'da gorev verisi.
// ORTAM SESI KURALI: su/selale/dere/pompa yalniz ilgili sahnelerde istenir; Karanlik Ev ve Pil/Ev bolgeleri ASLA su/orman sesi istemez.
export const SOUNDSCAPES = {
  harita: { music: 'tema', ambience: null, ready: true },
  menu: { music: 'tema', ambience: null, ready: true },
  pil: { music: 'tema', ambience: null, ready: true },
  ev: { music: 'tema', ambience: null, ready: true },
  karanlik: { music: 'ev-gizem', ambience: 'ev-gece', ready: true },
  orman: { music: 'orman', ambience: 'orman', ready: false },
  'orman-selale': { music: 'orman', ambience: 'orman-selale', ready: false },
  mahalle: { music: 'mahalle', ambience: 'mahalle', ready: false },
  koy: { music: 'koy', ambience: 'koy-dere', ready: false },
  'koy-pompa': { music: 'koy', ambience: 'pompa', ready: false },
  atolye: { music: 'atolye', ambience: 'atolye', ready: false }
};
export const soundscapeFor = (id) => SOUNDSCAPES[id] || { music: null, ambience: null, ready: false };
