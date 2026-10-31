// Sayi Avi: ikinci mini oyun. Ana altyapi sadece { id, icon, create(ctx) } sozlesmesini bilir.
import { createGame } from './game.js';

export default {
  id: 'number-hunt',
  icon: '🔢',
  create: createGame
};
