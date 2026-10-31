// Gizli tani sayfasi (#/voice-test; menuden baglanti YOK): cihazda Turkce sesli yonergenin duyulup duyulmadigini sinar.
export function renderVoiceTest(root, { voice, storage }) {
  root.innerHTML = `
    <section class="home" style="gap:12px;overflow:auto">
      <h1 style="margin:0;font-size:22px">Ses testi</h1>
      <p id="vt-note" style="margin:0;text-align:center"></p>
      <button class="btn chip" data-vt="say" style="min-height:64px">▶ "Doğru sayıyı bul."</button>
      <button class="btn chip" data-vt="say2" style="min-height:64px">▶ "Kaç tane yıldız var?"</button>
      <pre id="vt-out" style="width:min(100%,520px);white-space:pre-wrap;word-break:break-word;font-size:12px;background:#fff;padding:10px;border-radius:12px"></pre>
      <a href="#/" class="btn chip" style="min-height:56px;display:grid;place-items:center">🏠</a>
    </section>`;
  const out = root.querySelector('#vt-out');
  const refresh = async () => {
    const d = await voice.diagnose();
    root.querySelector('#vt-note').textContent = storage.get().sound ? '' : 'Ses kapalı: ana ekrandan 🔊 açın.';
    const back = globalThis.__altezBack?.status?.();
    const backLines = back
      ? [
          `GERI TUSU: ${back.plugin}${back.listening ? ' (dinleniyor)' : ' (dinleyici aktif degil)'}`,
          ...(back.plugin === 'error' || back.plugin === 'missing' || back.plugin === 'no-bridge'
            ? ['HATA/UYARI: Android Geri tusu koprusu beklenen durumda degil.']
            : [])
        ]
      : ['GERI TUSU: durum bilgisi yok'];
    out.textContent = JSON.stringify(d, null, 1) + '\n\n' + backLines.join('\n') + '\n\n' + voice.log().join('\n');
  };
  const onClick = (e) => {
    const b = e.target.closest('[data-vt]');
    if (!b) return;
    voice.prime();
    voice.say('vt', () => setTimeout(refresh, 100), b.dataset.vt === 'say' ? 'Doğru sayıyı bul.' : 'Kaç tane yıldız var?');
    setTimeout(refresh, 400);
  };
  root.addEventListener('click', onClick);
  refresh();
  return { unmount: () => root.removeEventListener('click', onClick) };
}
