// Mantik ve Bilim (V7.7). games/registry.js'teki ana ekran oyun listesine EKLENMEZ: "Gorevler" hub'i (games/tasks) acar.
import { createTaskGame } from '../tasks/shell.js';
import { makeLogicView } from './view.js';

export default {
  id: 'logic-science',
  icon: '🔬',
  create: (ctx) => createTaskGame(ctx, { gameId: 'logic-science', cfg: ctx.data.game['logic-science'], makeView: makeLogicView, cls: 'tk-ls' })
};
