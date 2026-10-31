// Uygulama kabugu: servisleri kurar, hash tabanli yonlendirme yapar (#/ ana ekran, #/play/<oyun>).
// Hash yonlendirme sayesinde Android "geri" tusu oyundan ana ekrana doner, ana ekranda uygulamayi kapatir.
import { loadAssets } from './assets.js';
import { createStorage } from './storage.js';
import { createAudio } from './audio.js';
import { createVoice } from './voice.js';
import { createAmbience } from './ambience.js';
import { createMusic } from './music.js';
import { createRng } from './rng.js';
import { games, education, tasks } from '../games/registry.js';
import { subGames } from '../games/tasks/subgames.js';
import energyAdventure from '../games/energy-adventure/index.js';
import adventure from '../games/adventure/index.js';
import mahalle from '../games/mahalle/index.js';
import { createMascot } from '../ui/mascot.js';
import { renderHome } from '../ui/home.js';
import { renderMainMenu, renderProgress, renderSettings } from '../ui/mainmenu.js';
import { showSplash } from '../ui/splash.js';
import { renderVoiceTest } from '../ui/voicetest.js';
import { renderProfile } from '../ui/profile.js';
import { renderParent } from '../ui/parent.js';
import { createParental } from './parental.js';
import { createOrientation, routeNeedsLandscape } from './orient.js';
import { createBack } from './back.js';

export async function start(root) {
  let data;
  try {
    data = await loadAssets();
  } catch (err) {
    root.innerHTML = '<div class="fatal"><p>Yüklenemedi</p><button class="btn chip" aria-label="Yenile">↻</button></div>';
    root.querySelector('button').addEventListener('click', () => location.reload());
    console.error(err);
    return;
  }
  const storage = createStorage();
  const audio = createAudio({ manifest: data.manifest, base: data.base, enabled: storage.get().sound });
  const voice = createVoice({ manifest: data.manifest, strings: data.strings, base: data.base, enabled: storage.get().sound });
  // V8.5 ORTAK SES KARISIMI: anlatim > efekt > ortam > muzik. Muzik ve ortam sesi ayni WebAudio baglamini paylasir (bellek) ama BAGIMSIZ acilip kapanir.
  // Sessiz mod (storage.sound=false) hepsinin ustundedir; Ayarlar'daki muzik/ortam anahtarlari yalniz ek kisitlamadir.
  const sharedCtx = () => {
    audio.unlock();
    return audio.context;
  };
  const mix0 = storage.getMix();
  const ambience = createAmbience({ manifest: data.manifest, base: data.base, enabled: storage.get().sound && mix0.amb, getContext: sharedCtx });
  const music = createMusic({ getContext: sharedCtx, manifest: data.manifest, base: data.base, enabled: storage.get().sound && mix0.music, volume: mix0.vol });
  const applyMix = () => {
    const st = storage.get();
    const m = storage.getMix();
    music.setEnabled(st.sound && m.music);
    music.setVolume(m.vol);
    ambience.setEnabled(st.sound && m.amb);
  };
  window.__altezAmbience = ambience; // tani/test icin
  window.__altezMusic = music;
  const rng = createRng(crypto.getRandomValues(new Uint32Array(1))[0]);
  // V7.8 maskot: yeni ses uretmez; mevcut ses calislarini DINLER (audio.play'i sarar) ve gorsel tepki verir. Ses calismasini degistirmez.
  const mascot = createMascot({ strings: data.strings.mascot });
  const rawPlay = audio.play.bind(audio);
  const sfxLog = (window.__altezSfx = []); // tani/test icin: cagrilan efekt adlari (son 200)
  audio.play = (...a) => {
    sfxLog.push(a[0]);
    if (sfxLog.length > 200) sfxLog.shift();
    const r = rawPlay(...a);
    try {
      mascot.onSound(a[0]);
    } catch {
      /* maskot hatasi sesi/oyunu etkilemez */
    }
    return r;
  };
  const parental = createParental(storage);
  // Konusma onceligi: sesli yonerge baslayinca muzik kisilir, bitince (veya kesilince) yumusakca geri gelir. Yeni konusma eskisini keser; eskisinin gec gelen bitisi yeni konusmanin kismasini bozmaz.
  let speechTok = 0;
  const rawSay = voice.say.bind(voice);
  const rawStop = voice.stop.bind(voice);
  voice.say = (key, onEnd, text) => {
    const my = ++speechTok;
    music.duck(true);
    ambience.duck(true);
    rawSay(
      key,
      () => {
        if (my === speechTok) {
          music.duck(false);
          ambience.duck(false);
        }
        onEnd?.();
      },
      text
    );
  };
  voice.stop = () => {
    speechTok += 1;
    music.duck(false);
    ambience.duck(false);
    rawStop();
  };
  const services = { data, storage, audio, voice, rng, mascot, parental, ambience, music, applyMix };
  // V8.2: ekran yonu. Menu/tanitim/ayarlar/profil/ebeveyn serbest; oyun ekranlari yatay (bkz. orient.js).
  const orient = createOrientation();
  window.__altezOrient = orient; // tani/test icin

  // Ilk dokunusta konusma motorunu uyandir (Android WebView TTS ilk cagriyi yutabiliyor)
  window.addEventListener('pointerdown', () => { voice.prime(); audio.unlock(); }, { capture: true }); // V8.5: ilk dokunusta ses baglami acilir (muzik/ortam otomatik oynatma kisiti)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') orient.set(routeNeedsLandscape(location.hash) ? 'landscape' : 'free', true);
    // V8.5: arka plana gecince muzik susar; one gelince ayni parca devam eder (ortam sesi kendi dinleyicisiyle ayni davranir; konusma intro/sahne dinleyicileriyle durur)
    if (document.visibilityState === 'hidden') music.suspend();
    else music.resume();
  });
  window.addEventListener('pagehide', () => music.suspend());

  const go = (hash) => {
    location.hash = hash;
  };
  let current = null;
  let view = 'home'; // 'home' | 'game' | 'other' (Geri tusu karari icin)
  let leaveGame = null;
  // Android fiziksel Geri tusu (bkz. back.js): oyundan ana ekrana, ana ekranda arka plana.
  const back = createBack({ view: () => view, leave: () => (view === 'game' && leaveGame ? leaveGame() : location.replace('#/')) });
  window.__altezBack = back; // tani/test icin (yalniz okuma amacli)
  // Oyun ana ekrandan acildiysa 🏠 "geri" gibi calisir (gecmis sisimez); dogrudan acildiysa ana ekrana degistirir
  let fromHome = false;
  let fromMenu = false; // Oyunlar bolumu Ana Menu'den acildiysa Geri/ok history.back() ile doner

  function route() {
    ambience.stop();
    applyMix(); // V8.5: her rota degisiminde onceki ortam sesi kesilir (sahne kendi sesini yeniden ister)
    // V8.5 muzik hedefi: ana menu, ayarlar ve macera haritasi = ana tema; tanitim/oyunlar/ebeveyn/profil = sessiz. Ayni parca YENIDEN BASLAMAZ.
    const h0 = location.hash;
    if (h0 === '' || h0 === '#/' || h0 === '#/settings' || h0 === '#/adventure') music.play('tema');
    else music.stop();
    mascot.park(); // ekran degisirken maskot bos 'dock'a alinir (ekran DOM'u silinmeden once)
    mascot.setExplicit(false);
    orient.set(routeNeedsLandscape(location.hash) ? 'landscape' : 'free');
    current?.unmount();
    current = null;
    leaveGame = null;
    view = 'home';
    back.reset();
    root.innerHTML = '';
    if (location.hash === '#/voice-test') {
      view = 'other';
      current = renderVoiceTest(root, { voice, storage });
      return;
    }
    // V8.2 ebeveyn kilidi: kilitli oyun/bolum dogrudan rotadan da acilmaz (kart + rota tutarli)
    if (location.hash === '#/adventure' && parental.isBlocked('adventure')) {
      location.replace('#/');
      return;
    }
    if (location.hash === '#/profile') {
      view = 'game';
      leaveGame = () => location.replace('#/');
      current = renderProfile(root, { ...services, registerBack: back.onScreen, exit: leaveGame });
      return;
    }
    if (location.hash === '#/parent') {
      view = 'game';
      leaveGame = () => location.replace('#/');
      current = renderParent(root, { ...services, games: [...games, ...subGames, energyAdventure], education, registerBack: back.onScreen, exit: leaveGame });
      return;
    }
    if (location.hash === '#/intro' || location.hash === '#/adventure') {
      // V8.0 Macera: tanitim ve harita. Harita ana ekran gibi davranir (Geri = arka plana); tanitim/gorev Geri'yi kendisi tuketir.
      // V8.1: harita/tanitim ana menunun alt ekranidir: Geri -> ana menu (view 'game' + leave).
      view = 'game';
      leaveGame = () => location.replace('#/');
      current = adventure.create({ ...services, registerBack: back.onScreen, exit: leaveGame, entry: location.hash === '#/intro' ? 'intro' : 'map' });
      current.mount(root);
      return;
    }
    if (location.hash === '#/mahalle') {
      // Mahalle Macerasi Asama 1 (R1) prototipi: bagimsiz ekran; mevcut oyun/kayit/ses akisina dokunmaz. Ana menu Geri'si -> ana menu.
      view = 'game';
      leaveGame = () => location.replace('#/');
      current = mahalle.create({ ...services, registerBack: back.onScreen, exit: leaveGame });
      current.mount(root);
      return;
    }
    if (location.hash === '#/progress' || location.hash === '#/settings') {
      view = 'game';
      leaveGame = () => location.replace('#/');
      const fn = location.hash === '#/progress' ? renderProgress : renderSettings;
      current = fn(root, { ...services, games: [...games, ...subGames, energyAdventure], education, registerBack: back.onScreen, exit: leaveGame });
      return;
    }
    const m = location.hash.match(/^#\/play\/([\w-]+)/);
    const game = m && [...games, education, tasks, ...subGames, energyAdventure].find((g) => g.id === m[1]);
    if (game && parental.isBlocked(game.id)) {
      location.replace('#/');
      return;
    }
    if (game) {
      // Gecmis guvenligi (V5.2): oyun ekrani gecmisin TEK/ALT girdisi olmamali. Yoksa Android Geri tusu uygulamayi
      // oyun ekrani acikken arka plana atar. Ana ekrandan acilan girdi isaretlenir (history.state); isaretsiz
      // dogrudan/geri yuklenen girdinin altina ana ekran girdisi eklenir. Sayfa yenilense de isaret korunur.
      try {
        if (history.state && (history.state.altezGame || history.state.invMine)) fromHome = true;
        else if (fromHome) history.replaceState({ altezGame: 1 }, '');
        else {
          history.replaceState(null, '', location.pathname + location.search + '#/');
          history.pushState({ altezGame: 1 }, '', location.pathname + location.search + `#/play/${game.id}`);
          fromHome = true;
        }
      } catch {
        /* history API yoksa eski davranis: exit() replace ile ana ekrana doner */
      }
      view = 'game';
      leaveGame = () => (fromHome ? history.back() : location.replace('#/'));
      current = game.create({ ...services, registerBack: back.onScreen, exit: leaveGame });
      current.mount(root);
    } else {
      fromHome = false;
      const isGames = location.hash === '#/games';
      if (!isGames) fromMenu = false;
      const legacy = /[?&]home=1\b/.test(location.search); // eski (V7.8) ana menu: yalniz gelistirme/regresyon testleri
      if (!isGames && !legacy) {
        // V8.1: yatay ana menu (Enerji Macerasi yalniz cocuk secince acilir)
        current = renderMainMenu(root, {
          ...services,
          education,
          registerBack: back.onScreen,
          play: (id) => {
            fromHome = true;
            go(`#/play/${id}`);
          }
        });
        return;
      }
      const homeSvc = {
        ...services,
        games,
        education,
        tasks,
        taskGames: [...subGames, energyAdventure], // V7.9: Enerji Macerasi Oyunlar ekraninda kendi kartiyla (Gorevler hub'ina girmez)
        registerBack: back.onScreen,
        play: (id) => {
          fromHome = true;
          go(`#/play/${id}`);
        }
      };
      if (isGames) {
        // Oyunlar bolumu: Geri/ok -> Ana Menu (menuden acildiysa gecmis geri; dogrudan acildiysa menuye degistir)
        view = 'game';
        leaveGame = () => (fromMenu ? history.back() : location.replace('#/'));
        current = renderHome(root, { ...homeSvc, mode: 'games', goMenu: leaveGame });
      } else {
        current = renderHome(root, {
          ...homeSvc,
          mode: 'menu',
          goGames: () => {
            fromMenu = true;
            go('#/games');
          }
        });
      }
    }
  }

  // Tanilama sayfasi (#/voice-test) acilisi ele gecirmez: soguk acilista hash ne olursa olsun normal ana ekran gelir.
  // (Sayfaya yalnizca uygulama acikken elle gidilir; menuden baglanti yoktur.)
  if (location.hash === '#/voice-test') history.replaceState(null, '', location.pathname + location.search + '#/');
  back.install();
  window.addEventListener('hashchange', route);
  // Acilis ekrani sadece uygulama acilisinda (ana ekrandaysa) bir kez; kisa, dokununca atlanir.
  if (location.hash && location.hash !== '#/') route();
  else {
    const first = !storage.get().seen;
    mascot.setMuted(true);
    const splash = showSplash(root, { data, audio, first });
    splash.done.then(() => {
      mascot.setMuted(false);
      storage.update({ seen: true });
      // V8.1: soguk acilis HER ZAMAN ana menu. Kisa tanitim yalniz ilk acilista (atlanabilir); sonra menuye doner. Macera otomatik baslamaz.
      // (?home=1: eski V7.8 ana menu; gelistirme/regresyon testleri icin)
      if (!/[?&]home=1\b/.test(location.search) && !storage.getAdv().intro) history.replaceState(null, '', location.pathname + location.search + '#/intro');
      route();
    });
  }
}
