// V8.0 Macera: maskotlu tanitim (yaklasik 12 sn, uygulama ici SVG/CSS animasyonu; video/ses dosyasi YOK). 5 sahne:
// 1 logo + maskot, 2 selam, 3 pil-kablo-lamba (lamba yanar), 4 macera yolu acilir, 5 maskot ilk goreve davet eder + "Haydi baslayalim!".
// Atla dugmesi her an gorunur; son sahne cocuk dokunana kadar bekler. Hareket azaltma: sahneler animasyonsuz gecer.
// V8.2 SES: onceki surumde tanitim HIC ses calmiyordu (kok neden: kodda ses cagrisi yoktu; WebView engeli degil). Simdi mevcut altyapiyla:
// her sahnenin yazisi Turkce SESLI okunur (voice.say; ses kapaliysa sessiz) + lamba yanarken kisa 'circuitOn' sesi. Her sahne en fazla BIR kez
// konusur; yeni sahne eskisini keser (voice.say zaten keser); Atla/cikista konusma durur. Ses dosyasi/motor yoksa hata yakalanir, tanitim akar.
import { mascotSvg } from '../../ui/mascot.js';
import { partSvg, esc } from './svg.js';

// V8.3 SES: giris sesi artik kayitli ElevenLabs CAGLAYAN dosyasi (assets/sounds/intro-caglayan.mp3, yerel varlik; internet/API anahtari YOK).
// Tanitim acilinca BIR kez calar (audio.playFile; ses kapaliysa calmaz). Dosya calarsa sahne yazilari TTS ile OKUNMAZ (iki ses ust uste binmesin);
// dosya yok/bozuk/engelli ise V8.2'deki Turkce TTS yedegi aynen devam eder. Atla/cikis/destroy dosyayi durdurur.
const SCENES = [0, 2600, 5200, 9400, 12000]; // sahne baslangic zamanlari (ms)
const MOODS = ['wave', 'wave', 'think', 'cheer', 'party'];

export function mountIntro(host, { brand, text, onDone, audio = null, voice = null }) {
  const caps = text.intro;
  host.innerHTML = `
    <section class="adv adv-intro" data-scene="1" data-lit="0" aria-label="${esc(text.appName)}">
      <div class="in-sky" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <button type="button" class="adv-btn soft in-skip" data-act="skip">${esc(text.introSkip)}</button>
      <div class="in-stage">
        <div class="in-logo"><img src="${brand.lockup}" alt="${esc(text.appName)}" draggable="false"></div>
        <div class="in-circ" aria-hidden="true">
          <svg viewBox="0 0 360 150" focusable="false">
            <path class="w w1" d="M70 96H40V60H110"/><path class="w w2" d="M250 60H320V96H290"/><path class="w w3" d="M70 96H290" />
            <path class="flow" d="M70 96H40V60H110M250 60H320V96H290M70 96H290"/>
          </svg>
          <div class="c-bat">${partSvg('battery')}</div><div class="c-lamp">${partSvg('lamp')}</div>
        </div>
        <div class="in-path" aria-hidden="true">
          <svg viewBox="0 0 360 150" focusable="false"><path class="road" d="M20 120C70 120 80 70 130 80S190 125 230 95 300 40 340 52"/>
            ${[[20, 120], [130, 80], [230, 95], [340, 52]].map(([x, y], i) => `<g class="hx" style="--i:${i}"><polygon points="${x - 13},${y} ${x - 6.5},${y - 11} ${x + 6.5},${y - 11} ${x + 13},${y} ${x + 6.5},${y + 11} ${x - 6.5},${y + 11}"/></g>`).join('')}
          </svg>
        </div>
        <div class="mascot in-mascot show" data-mood="wave" aria-hidden="true"><div class="m-art">${mascotSvg()}</div></div>
      </div>
      <p class="in-cap" aria-live="polite"></p>
      <button type="button" class="adv-btn primary big in-go pulse" data-act="go" hidden>${esc(text.introGo)}</button>
    </section>`;
  const el = host.querySelector('.adv-intro');
  const cap = el.querySelector('.in-cap');
  const mascot = el.querySelector('.in-mascot');
  const go = el.querySelector('.in-go');
  const timers = [];
  let ended = false;
  const spoken = new Set(); // ayni sahne iki kez konusmaz
  const safe = (fn) => {
    try {
      fn();
    } catch {
      /* ses hatasi tanitimi bozmaz */
    }
  };
  let recorded = false; // kayitli giris sesi calmaya basladi mi
  let started = false; // bu tanitim ornegi icin dosya yalniz BIR kez denenir
  const stopRecorded = () => safe(() => audio?.stop?.('introVoice'));
  const t0 = Date.now();
  const GESTURE_WINDOW_MS = 4000; // otomatik oynatma engellenirse: ilk dokunusta yalniz tanitimin ilk saniyelerinde bir kez daha denenir
  let gestureArmed = false;
  const onGesture = () => {
    gestureArmed = false;
    if (ended || recorded || Date.now() - t0 > GESTURE_WINDOW_MS) return;
    started = false; // tek yeniden deneme
    playRecorded(true);
  };
  const armGesture = () => {
    if (gestureArmed || ended) return;
    gestureArmed = true;
    el.addEventListener('pointerdown', onGesture, { once: true });
  };
  const playRecorded = (retry = false) => {
    if (started || !audio?.playFile) return;
    started = true;
    Promise.resolve()
      .then(() => audio.playFile('introVoice'))
      .then((ok) => {
        if (ok && !ended) {
          recorded = true;
          safe(() => voice?.stop()); // erken baslamis TTS varsa kes
        } else if (ok && ended) stopRecorded();
        else if (!ok && !retry && audio.enabled !== false) armGesture(); // WebView otomatik oynatma engeli olabilir
      })
      .catch(() => {});
  };
  // Uygulama arka plana alinirsa kayitli ses + konusma DURUR; geri donunce yeniden BASLAMAZ (beklenmedik tekrar yok).
  const onVis = () => {
    if (document.visibilityState === 'hidden') {
      safe(() => voice?.stop());
      stopRecorded();
    }
  };
  document.addEventListener('visibilitychange', onVis);
  const speak = (i, line) => {
    if (!line || recorded || spoken.has(i)) return;
    spoken.add(i);
    safe(() => voice?.say('adv-intro', undefined, line));
  };
  const scene = (i) => {
    el.dataset.scene = String(i + 1);
    mascot.dataset.mood = MOODS[i];
    cap.textContent = i === 0 ? '' : caps[Math.min(i - 1, caps.length - 1)];
    if (i > 0) speak(i, cap.textContent);
    if (i === 2)
      timers.push(
        setTimeout(() => {
          el.dataset.lit = '1';
          mascot.dataset.mood = 'joy';
          safe(() => audio?.play('circuitOn'));
        }, 2000)
      );
    if (i === 4) go.hidden = false;
  };
  safe(() => voice?.prime?.());
  safe(() => playRecorded());
  SCENES.forEach((t, i) => timers.push(setTimeout(() => scene(i), t)));
  const finish = (how) => {
    if (ended) return;
    ended = true;
    timers.forEach(clearTimeout);
    safe(() => voice?.stop());
    stopRecorded();
    document.removeEventListener('visibilitychange', onVis);
    onDone(how);
  };
  el.querySelector('[data-act="skip"]').addEventListener('click', () => finish('skip'));
  go.addEventListener('click', () => finish('go'));
  return {
    destroy() {
      ended = true;
      timers.forEach(clearTimeout);
      safe(() => voice?.stop());
      stopRecorded();
      document.removeEventListener('visibilitychange', onVis);
    },
    skip: () => finish('skip'),
    scene: () => Number(el.dataset.scene)
  };
}
