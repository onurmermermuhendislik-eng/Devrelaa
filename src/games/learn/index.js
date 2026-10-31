// Egitim Bolumu (V7). games/registry.js'teki oyun listesine EKLENMEZ (mevcut oyun kartlari/testleri aynen kalir);
// app.js bu girisi yalniz '#/play/learn' yonlendirmesi icin ve ana ekrandaki Egitim giris dugmesi icin kullanir.
import { createGame } from './game.js';
import { buildCurriculum, progressCount } from './logic.js';

export default {
  id: 'learn',
  icon: '🎓',
  create: createGame,
  // Ana ekran girisi icin ilerleme: tamamlanan / toplam ders
  progress: ({ storage, data }) => progressCount(buildCurriculum(data.game.learn, data.levels), storage.getEdu().done)
};
