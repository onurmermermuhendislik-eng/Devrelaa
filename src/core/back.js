// Android FIZIKSEL Geri tusu merkezi (V6).
//
// KOK NEDEN (Capacitor 8.5.3 + @capacitor/app 8.1.2 kaynaklarindan): Capacitor CEKIRDEGI Geri tusunu islemez; WebView gecmisine
// goBack() yapan kod ayri @capacitor/app eklentisindedir. Eklenti yoksa Geri tusu JS'e HIC ulasmaz ve Android ana etkinligi,
// ekranda ne varsa onunla arka plana atar. Eklenti varsa ama JS 'backButton' dinleyicisi yoksa: canGoBack ise goBack, degilse
// HICBIR sey yapmaz (ana ekranda Geri olu kalir). Bu modul eklentinin 'backButton' olayini TEK kez dinler ve davranisi acikca tanimlar:
//   1) ekran-ici katman acikse (Buluslarim cekmecesi) yalniz onu kapatir,
//   2) oyundan ana ekrana doner (ekrandaki 🏠/X ile ayni cikis),
//   3) ana ekranda uygulamayi arka plana alir (minimizeApp) - dongu/takilma yok.
// Paketleyici yok: @capacitor/core JS'i sayfada yuklu degil, yalnizca native-bridge var; bu yuzden window.Capacitor.addListener /
// nativePromise kullanilir (voice.js ile ayni yol).
const GUARD_MS = 700;

export function createBack({ view, leave, cap = () => globalThis.Capacitor, log = (...a) => console.warn(...a) }) {
  let screen = null;
  let timer = null;
  const st = { installed: false, plugin: 'unknown', listening: false, fired: 0, last: null, leaving: false };

  function minimize() {
    try {
      const p = cap()?.nativePromise?.('App', 'minimizeApp', {});
      p?.catch?.(() => {});
      return 'minimize';
    } catch {
      return 'none';
    }
  }

  function reset() {
    st.leaving = false;
    clearTimeout(timer);
  }

  function handle() {
    st.fired += 1;
    let r;
    if (screen && screen() === true) r = 'screen'; // acik katman kapatildi
    else if (view() === 'home') r = minimize(); // ana ekran: arka plana
    else if (st.leaving) r = 'ignored'; // cift Geri: ikinci basis bekleyen cikisi bozmaz
    else {
      st.leaving = true;
      clearTimeout(timer);
      timer = setTimeout(() => (st.leaving = false), GUARD_MS); // cikis gerceklesmezse takilmasin
      leave();
      r = 'leave';
    }
    st.last = r;
    return r;
  }

  function install() {
    if (st.installed) return st; // tek dinleyici
    st.installed = true;
    const C = cap();
    if (!C || typeof C.addListener !== 'function' || typeof C.nativePromise !== 'function') {
      st.plugin = 'no-bridge'; // tarayici / test: tarayicinin kendi Geri akisi (history) gecerli
      return st;
    }
    const headers = Array.isArray(C.PluginHeaders) ? C.PluginHeaders : null;
    if (headers && !headers.some((h) => h && h.name === 'App')) {
      st.plugin = 'missing';
      log('ALTEZ: @capacitor/app yuklu degil -> Android Geri tusu uygulamayi arka plana atar. npm install @capacitor/app && npx cap sync android');
      return st;
    }
    try {
      C.addListener('App', 'backButton', (data, err) => {
        if (err) {
          st.plugin = 'error';
          st.listening = false;
          return;
        }
        handle();
      });
      st.plugin = 'ok';
      st.listening = true;
    } catch (e) {
      st.plugin = 'error';
      log('ALTEZ: backButton dinleyicisi kaydedilemedi', e);
    }
    return st;
  }

  return {
    install,
    handle,
    reset,
    // Etkin ekranin Geri isleyicisi (true = isledi). Dondurulen fonksiyon kaydi siler.
    onScreen(fn) {
      screen = fn;
      return () => {
        if (screen === fn) screen = null;
      };
    },
    status: () => ({ ...st })
  };
}
