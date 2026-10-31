// Mucit Atolyesi (V5): serbest devre kurma. Ana altyapi sadece { id, icon, create(ctx), badge } sozlesmesini bilir.
import { createGame } from './game.js';

export default {
  id: 'invent',
  icon: '💡',
  create: createGame,
  // Ana ekran kartindaki ilerleme rozeti: kesfedilen / toplam kesif
  badge: ({ storage, data }) => {
    const total = data.game.invent.discoveries.length;
    const found = (storage.getGame('invent').found || []).length;
    return { emoji: '💡', name: `Mucit ${found}/${total}`, fraction: total ? found / total : 0 };
  }
};
