// Enerji Macerasi coin mantigi (saf, DOM yok). Coin YALNIZ gorsel bir oduldur: kayip, sinir, harcama zorunlulugu, satin alma YOK.
// Toplam coin ayri bir kayit alaninda SAKLANMAZ: cozulen gorevlerden (games.energy-adventure.done) TURETILIR. Boylece:
//  - ayni gorevi tekrar cozmek coin uretemez (completeTask atomiktir, ayni gorev ikinci kez kaydedilmez),
//  - kayit sisemaz/bozulmaz, eski kayitlarla uyumludur (alan eklenmedi),
//  - coin hicbir kosulda azalmaz.
import { validTasks } from '../../core/taskkit.js';

export const MAX_COIN = 5;
export const coinValue = (t) => (Number.isInteger(t?.coins) && t.coins >= 1 ? Math.min(t.coins, MAX_COIN) : 1);

// Toplam coin: kayitli (cozulmus) gorevlerin coin degerleri toplami (yas bandindan bagimsiz; gorev bir kez cozuldu mu hep sayilir)
export function coinsOf(cfg, done) {
  const d = new Set(Array.isArray(done) ? done : []);
  return validTasks(cfg).reduce((n, t) => n + (d.has(t.id) ? coinValue(t) : 0), 0);
}

// Bir bolgede secilen yas bandinda kazanilabilecek toplam coin
export const coinsAvailable = (cfg, band) => validTasks(cfg).filter((t) => t.bands.includes(band)).reduce((n, t) => n + coinValue(t), 0);

// Gorev bitisinde kazanilan coin: yalniz ILK ve gercekten kaydedilen cozumde
export const coinGain = (task, firstTime, saved = true) => (firstTime && saved !== false ? coinValue(task) : 0);
