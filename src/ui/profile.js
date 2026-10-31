// V8.2 Profil ekrani (#/profile): YEREL profil (ad + soyad, yalniz bu telefonda). Cevrimici hesap/Google girisi YOKTUR: sahte giris akisi yok.
// "Giris yap" = bu cihazda profil olustur; "Cikis yap" = yalniz ad/soyadi sil (ilerleme ve ebeveyn ayari ayri alanlardir, silinmez).
import { esc } from '../games/adventure/svg.js';
import { deriveProgress } from '../games/adventure/model.js';
import { initialsOf, fullName } from '../core/profile.js';

const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

export function renderProfile(root, svc) {
  const { data, storage, audio, mascot, registerBack, exit } = svc;
  const M = data.strings.mm;
  const P = M.profile;
  let editing = !storage.get().profile;
  let msg = '';
  let msgKind = '';
  const unreg = registerBack?.(() => {
    // Duzenleme formu acikken (ve profil varsa) Geri -> forma degil, goruntuleme
    if (editing && storage.get().profile) {
      editing = false;
      msg = '';
      paint();
      return true;
    }
    return false;
  });
  const paint = () => {
    const st = storage.get();
    const prof = st.profile;
    const adv = deriveProgress(storage.getAdv(), data.game.adventure);
    root.innerHTML = `
      <section class="adv mm mm-sub" data-screen="profile" data-signed="${prof ? 1 : 0}" aria-label="${esc(P.title)}">
        <header class="adv-hud task">
          <button type="button" class="adv-btn round" data-act="back" aria-label="${esc(M.back)}"><span aria-hidden="true">←</span></button>
          <h2 class="adv-title">${esc(P.title)}</h2><span class="adv-spacer"></span>
        </header>
        <main class="pf-body">
          <div class="pg-card pf-card adv-block">
            <span class="pf-avatar" aria-hidden="true">${prof ? esc(initialsOf(prof)) : '👤'}</span>
            ${
              editing
                ? `<form class="pf-form" data-form="profile" novalidate>
                     <label>${esc(P.first)}<input name="first" type="text" maxlength="20" autocomplete="off" autocapitalize="words" value="${esc(prof?.first || '')}"></label>
                     <label>${esc(P.last)}<input name="last" type="text" maxlength="20" autocomplete="off" autocapitalize="words" value="${esc(prof?.last || '')}"></label>
                     <button type="submit" class="adv-btn primary" data-act="save">${esc(prof ? P.save : P.signIn)}</button>
                   </form>`
                : `<p class="pg-big pf-name">${esc(fill(P.hello, { name: fullName(prof) }))}</p>
                   <p class="pg-line"><span>${esc(P.band)}: <b>${st.band === '4-5' ? '4–5' : '6–8'}</b></span><span>🗺️ <b>${adv.done}/${adv.total}</b></span></p>
                   <div class="pf-actions"><button type="button" class="adv-btn soft" data-act="edit">${esc(P.edit)}</button><button type="button" class="adv-btn soft" data-act="out">${esc(P.signOut)}</button></div>`
            }
            <p class="st-msg ${msgKind}" role="status" aria-live="polite">${esc(msg)}</p>
            <p class="pf-note">${esc(P.note)}</p>
          </div>
        </main>
      </section>`;
  };
  const save = (form) => {
    const first = form.elements.first.value;
    const last = form.elements.last.value;
    storage.update({ profile: { first, last } });
    if (!storage.get().profile) {
      msg = P.needBoth;
      msgKind = 'warn';
      return;
    }
    editing = false;
    msg = P.saved;
    msgKind = 'good';
    audio.play('correct');
  };
  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    audio.unlock?.();
    const a = b.dataset.act;
    if (a === 'back') {
      audio.play('tap');
      exit?.();
    } else if (a === 'edit') {
      editing = true;
      msg = '';
      paint();
    } else if (a === 'out') {
      storage.update({ profile: null });
      editing = true;
      msg = P.out;
      msgKind = 'good';
      paint();
    }
  };
  const onSubmit = (e) => {
    e.preventDefault();
    const f = e.target.closest('form[data-form="profile"]');
    if (!f) return;
    save(f);
    paint();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  paint();
  mascot?.park();
  return {
    unmount() {
      unreg?.();
      root.removeEventListener('click', onClick);
      root.removeEventListener('submit', onSubmit);
    }
  };
}
