// Acilis ekrani (V7.7: lacivert/turkuaz/sari tema): logo -> kucuk enerji hareketi (LED yanar) -> jingle -> "Kesfet · Ogren · Uret" -> ana ekran.
// Alt satir: "Uygulama surumu V7.7" (data.version = scripts/version.env'den uretilen app-version.json; yoksa gosterilmez) + "ALTEZ Enerji".
// Sure sabit ve kisadir (muzik suresini uzatmaz). Ilk acilista biraz uzun, sonrakilerde daha kisa; dokununca atlanir.
// Sadece transform/opacity animasyonu (cihazi yormaz). Ses kapaliysa jingle calinmaz.
export function showSplash(root, { data, audio, first = true }) {
  const mark = data.manifest.brand;
  const total = first ? 2700 : 1900;
  const tag = data.strings.slogan ?? data.strings.tagline;
  const sp = data.strings.splash ?? {};
  const ver = data.version?.versionName ? (sp.versionLabel ?? '{v}').replace('{v}', 'V' + data.version.versionName) : '';
  root.innerHTML = `
    <section class="splash${first ? '' : ' quick'}" aria-label="${data.strings.app}">
      <div class="sp-plate">
        <div class="sp-stage">
          <div class="sp-glow"></div>
          <div class="sp-ring"></div>
          <img class="sp-mark" src="${mark.mark}" alt="" draggable="false">
          <i class="sp-spark l"></i><i class="sp-spark r"></i>
        </div>
        <img class="sp-altez" src="${mark.alteztext}" alt="" draggable="false">
        <img class="sp-word" src="${mark.wordmark}" alt="${data.strings.app}" draggable="false">
      </div>
      <p class="sp-tag">${tag}</p>
      <footer class="sp-foot">${ver ? `<span class="sp-ver">${ver}</span>` : ''}<span class="sp-dev">${sp.developer ?? 'ALTEZ Enerji'}</span></footer>
    </section>`;
  const el = root.querySelector('.splash');
  let finish;
  const done = new Promise((r) => (finish = r));
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(finish, 120);
  };
  const timer = setTimeout(end, total);
  el.addEventListener('pointerdown', () => {
    audio.unlock();
    audio.stop('jingle'); // dokunarak atlayan cocuk beklemesin, muzik de kesilsin
    end();
  });
  // Jingle: ses aciksa; WebView otomatik oynatmayi engellerse sessiz gecilir (suresi degismez)
  requestAnimationFrame(() => {
    el.classList.add('go');
    try {
      audio.play('jingle');
    } catch {
      /* sessiz gec */
    }
  });
  return { done, skip: end };
}
