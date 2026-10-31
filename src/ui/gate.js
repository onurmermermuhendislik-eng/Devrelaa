// V8.2 Ebeveyn dogrulamasi (cocuk kilidi). PIN varsa PIN, yoksa/unutulduysa "yetiskin sorusu"; sonra yeni PIN konur.
// opts: { parental, strings (mm.gate), rng, onPass, onCancel, forcePin }  -> { close(), isOpen() }
import { esc } from '../games/adventure/svg.js';
import { validPin } from '../core/parental.js';

export function openGate(root, { parental, strings: G, onPass, onCancel, mode = 'verify' }) {
  let step = mode === 'newpin' ? 'new' : parental.hasPin() ? 'pin' : 'challenge';
  let buf = '';
  let first = '';
  let err = '';
  let ch = parental.challenge();
  let wrong = 0;
  let lockUntil = 0;
  let afterChallenge = 'new';
  let open = true;
  const host = document.createElement('div');
  host.className = 'pc-gate adv-block';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', G.title);
  root.appendChild(host);
  const maxLen = () => (step === 'challenge' ? 4 : 4);
  const title = () => (step === 'pin' ? G.pinAsk : step === 'new' ? G.pinNew : step === 'again' ? G.pinAgain : `${G.challengeAsk}`);
  const paint = () => {
    const dots = step === 'challenge' ? `<p class="pc-q" aria-live="polite">${esc(ch.q)} = <b class="pc-ans">${esc(buf || '…')}</b></p>` : `<p class="pc-dots" aria-label="${buf.length} / 4">${[0, 1, 2, 3].map((i) => `<i class="${i < buf.length ? 'on' : ''}"></i>`).join('')}</p>`;
    host.innerHTML = `
      <div class="pc-card">
        <header class="pc-head"><button type="button" class="adv-btn round pc-x" data-g="cancel" aria-label="${esc(G.cancel)}"><span aria-hidden="true">←</span></button><h3>${esc(G.title)}</h3><span class="adv-spacer"></span></header>
        <p class="pc-sub">${esc(title())}</p>
        ${dots}
        <p class="pc-err" role="alert">${esc(err)}</p>
        <div class="pc-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="pc-key" data-k="${n}">${n}</button>`).join('')}
          <button type="button" class="pc-key util" data-g="del" aria-label="${esc(G.del)}">⌫</button><button type="button" class="pc-key" data-k="0">0</button>
          ${step === 'challenge' ? `<button type="button" class="pc-key util ok" data-g="ok">${esc(G.ok)}</button>` : '<span></span>'}</div>
        ${step === 'pin' ? `<button type="button" class="pc-link" data-g="forgot">${esc(G.forgot)}</button>` : ''}
      </div>`;
  };
  const shake = (msg) => {
    err = msg;
    buf = '';
    paint();
    host.classList.remove('shake');
    void host.offsetWidth;
    host.classList.add('shake');
  };
  const finish = () => {
    open = false;
    host.remove();
    onPass?.();
  };
  const submit = () => {
    if (step === 'pin') {
      if (Date.now() < lockUntil) return shake(G.wait);
      if (parental.verifyPin(buf)) return finish();
      wrong += 1;
      if (wrong >= 5) {
        lockUntil = Date.now() + 20000;
        wrong = 0;
        return shake(G.wait);
      }
      return shake(G.wrong);
    }
    if (step === 'challenge') {
      if (Number(buf) === ch.a) {
        step = afterChallenge;
        buf = '';
        err = '';
        return paint();
      }
      ch = parental.challenge();
      return shake(G.wrongAnswer);
    }
    if (step === 'new') {
      if (!validPin(buf)) return;
      first = buf;
      step = 'again';
      buf = '';
      err = '';
      return paint();
    }
    if (step === 'again') {
      if (buf !== first) {
        step = 'new';
        first = '';
        return shake(G.mismatch);
      }
      parental.setPin(buf);
      return finish();
    }
  };
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !open) return;
    if (b.dataset.k !== undefined) {
      if (buf.length >= maxLen()) return;
      buf += b.dataset.k;
      err = '';
      paint();
      if (step !== 'challenge' && buf.length === 4) submit();
    } else if (b.dataset.g === 'del') {
      buf = buf.slice(0, -1);
      paint();
    } else if (b.dataset.g === 'ok') submit();
    else if (b.dataset.g === 'forgot') {
      step = 'challenge';
      afterChallenge = 'new';
      ch = parental.challenge();
      buf = '';
      err = '';
      paint();
    } else if (b.dataset.g === 'cancel') api.cancel();
  });
  paint();
  const api = {
    isOpen: () => open,
    close() {
      if (!open) return;
      open = false;
      host.remove();
    },
    cancel() {
      if (!open) return;
      api.close();
      onCancel?.();
    }
  };
  return api;
}
