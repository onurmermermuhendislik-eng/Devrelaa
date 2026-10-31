// Elektrik Dedektifi (V7.7). games/registry.js'teki ana ekran oyun listesine EKLENMEZ: "Gorevler" hub'i (games/tasks) acar.
import { createTaskGame } from '../tasks/shell.js';
import { makeDetectiveView } from './view.js';

export default {
  id: 'detective',
  icon: '🕵️',
  create: (ctx) => createTaskGame(ctx, { gameId: 'detective', cfg: ctx.data.game.detective, makeView: makeDetectiveView, cls: 'tk-det' })
};
