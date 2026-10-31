// Mini oyun modulu: ana altyapi sadece bu sozlesmeyi bilir -> { id, icon, create(ctx) -> { mount, unmount } }
import { createGame } from './game.js';

export default {
  id: 'shape-complete',
  icon: '🧩',
  create: createGame
};
