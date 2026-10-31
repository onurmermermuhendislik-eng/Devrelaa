// Mini oyun kaydi. Yeni oyun eklemek = games/<oyun>/ klasoru + buraya bir satir
// (+ assets/data/strings.tr.json > games.<id> kart metni, + isterse manifest.gameData).
// Ana altyapi (core/, ui/) oyunlarin icini bilmez; sadece { id, icon, create(ctx) } sozlesmesini kullanir.
import shapeComplete from './shape-complete/index.js';
import numberHunt from './number-hunt/index.js';
import invent from './invent/index.js';
import learn from './learn/index.js';
import tasksHub from './tasks/index.js';

export const games = [shapeComplete, numberHunt, invent];

// V7: Egitim Bolumu oyun listesinin (ana ekran kartlari) disindadir; yalniz ayni yonlendirme/Geri-tusu altyapisini kullanir.
export const education = learn;

// V7.7: Gorevler hub'i (Elektrik Dedektifi + Mantik ve Bilim) da oyun kartlarinin disindadir; ana ekran footer'inda tek dugme.
export const tasks = tasksHub;
