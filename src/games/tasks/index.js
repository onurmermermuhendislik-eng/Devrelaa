// "Gorevler" hub'i (V7.7): ana ekran footer'indaki tek giris; Elektrik Dedektifi ve Mantik ve Bilim kartlarini acar.
// Egitim gibi games/registry.js'teki oyun KARTLARININ disindadir (ana ekranda 3 kart degismez).
import { createGame } from './game.js';
import { tasksFor, progressOf } from '../../core/taskkit.js';
import { subGames } from './subgames.js';

export default {
  id: 'tasks',
  icon: '🕵️',
  create: createGame,
  // Ana ekran girisi icin toplam ilerleme (yas grubundaki gorevler): cozulen / toplam
  progress: ({ storage, data }) => {
    const band = storage.get().band;
    return subGames.reduce(
      (acc, g) => {
        const p = progressOf(tasksFor(data.game[g.id], band), storage.getTasks(g.id).done);
        return { done: acc.done + p.done, total: acc.total + p.total };
      },
      { done: 0, total: 0 }
    );
  }
};
