// Enerji Macerasi (V7.9). Oyunlar ekraninda kendi kartiyla acilir (games/registry.js oyun kartlarina ve Gorevler hub'ina EKLENMEZ).
// Gorev motoru ve gorunumu Mantik ve Bilim ile ortaktir (createTaskGame + makeLogicView); bu modul yalniz bolge/coin/yol arkadasi ekler.
import { createTaskGame } from '../tasks/shell.js';
import { makeLogicView } from '../logic-science/view.js';
import { coinsOf, coinGain } from './coins.js';
import { tasksFor, progressOf } from '../../core/taskkit.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const GAME_ID = 'energy-adventure';

export function makeExtras({ data, storage, mascot }) {
  const cfg = () => data.game[GAME_ID];
  const T = () => cfg().text;
  return {
    // Liste ustu: yol arkadasi (maskot) alani, coin sayaci, bolge seridi (yalniz Pil ve Enerji acik; digerleri dogru sekilde "Yakinda")
    listTop() {
      const c = cfg();
      const coins = coinsOf(c, storage.getTasks(GAME_ID).done);
      const regions = (c.regions || [])
        .map((r) => `<li class="adv-region ${r.status === 'open' ? 'is-open' : 'is-soon'}" data-region="${esc(r.id)}" data-status="${esc(r.status)}"><span aria-hidden="true">${r.icon}</span><b>${esc(r.title)}</b>${r.status === 'open' ? '' : `<i>${esc(T().soonWord)}</i>`}</li>`)
        .join('');
      return `<div class="adv-top">
        <div class="adv-companion mascot-slot"></div>
        <p class="adv-coins" data-coins="${coins}" aria-label="${esc(T().coinsLabel)}: ${coins}"><span aria-hidden="true">🪙</span> <b>${coins}</b></p>
        <ul class="adv-regions" aria-label="${esc(T().regionsLabel)}">${regions}</ul>
      </div>`;
    },
    onList(stage) {
      const slot = stage.querySelector('.adv-companion');
      if (slot && mascot) {
        mascot.attach(slot, 'companion');
        mascot.react('adventure');
      }
    },
    onLeaveList() {
      mascot?.park(); // oyun/gorev ekraninda maskot gecici kose kipine doner
    },
    // Bitis: ilk (kaydedilen) cozumde coin kazanci; tekrar cozumde coin YOK
    done({ task, firstTime, saved }) {
      const n = coinGain(task, firstTime, saved);
      const total = coinsOf(cfg(), storage.getTasks(GAME_ID).done);
      if (!n) return '';
      return `<p class="adv-gain" data-gain="${n}" data-total="${total}"><span aria-hidden="true">🪙</span> +${n} ${esc(T().coinGain)}</p>`;
    },
    progress() {
      return progressOf(tasksFor(cfg(), storage.get().band), storage.getTasks(GAME_ID).done);
    }
  };
}

export default {
  id: GAME_ID,
  icon: '⚡',
  create: (ctx) => createTaskGame(ctx, { gameId: GAME_ID, cfg: ctx.data.game[GAME_ID], makeView: makeLogicView, cls: 'tk-ls tk-energy', extras: makeExtras(ctx) })
};
