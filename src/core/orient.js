// V8.4 Ekran yonu: ana menu/tanitim/ayarlar/profil/ebeveyn ve DIGER TUM oyunlar SERBEST (dikey+yatay); YALNIZ Enerji Macerasi YATAY (V8.2 mantigi korunur, kapsam daraltildi).
// Mekanizma (yeni eklenti YOK): (1) Android'de MainActivity'nin kucuk JavascriptInterface koprusu `AltezOrientation`
// (lockLandscape / unlock), (2) tarayici/WebView'de screen.orientation.lock/unlock (varsa), (3) hicbiri calismazsa CSS "cihazi cevir"
// uyarisi (.adv-rotate) yatay ekran gereken sayfalarda dikeyde gorunur. Idempotent; hata oyunu/menuyu bozmaz.
export function createOrientation({ win = globalThis.window } = {}) {
  let mode = 'free'; // 'free' | 'landscape'
  const calls = [];
  const bridge = () => {
    try {
      const b = win?.AltezOrientation;
      return b && typeof b.lockLandscape === 'function' && typeof b.unlock === 'function' ? b : null;
    } catch {
      return null;
    }
  };
  const apply = (want) => {
    const b = bridge();
    let via = 'none';
    try {
      if (b) {
        want === 'landscape' ? b.lockLandscape() : b.unlock();
        via = 'native';
      } else {
        const so = win?.screen?.orientation;
        if (so) {
          if (want === 'landscape' && typeof so.lock === 'function') {
            const p = so.lock('landscape');
            p && p.catch && p.catch(() => {});
            via = 'web';
          } else if (want === 'free' && typeof so.unlock === 'function') {
            so.unlock();
            via = 'web';
          }
        }
      }
    } catch {
      via = 'error';
    }
    calls.push({ want, via });
    return via;
  };
  return {
    // Yalniz mod degisince cagrilir (ayni mod tekrar istenirse yeniden kilitlemez); sayfa yenilenince yeniden uygulanir (force).
    set(want, force = false) {
      if (!force && want === mode) return mode;
      mode = want;
      apply(want);
      return mode;
    },
    get mode() {
      return mode;
    },
    get calls() {
      return calls.slice();
    },
    hasNative: () => !!bridge()
  };
}
// V8.4: YALNIZ Enerji Macerasi yatay zorunlu (harita/gorevler '#/adventure' ve Oyunlar listesindeki Enerji Macerasi '#/play/energy-adventure').
// Diger TUM oyunlar (Sekli Tamamla, Sayi Avi, Mucit, Egitim/Ders, Gorevler hub'i ve alt oyunlari), menu, tanitim, oyun SECIM listesi, ilerleme,
// ayarlar, profil, ebeveyn SERBEST (hem dikey hem yatay). (V8.2/V8.3 hatasi: tum '#/play/*' rotalari yatay kilitliydi.)
export const LANDSCAPE_ROUTE = /^#\/(adventure|play\/energy-adventure)(?![\w-])/;
export function routeNeedsLandscape(hash) {
  return LANDSCAPE_ROUTE.test(hash || '');
}
