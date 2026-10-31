// Basit ilerleme: sadece dogru cevap sayisi -> seviye.
// Seviyeler assets/data/levels.json'dan gelir (Baslangic, Cirak, Kalfa, Usta, Kasif, Mucit).
// Yalnizca status='active' seviyelere yukselinir; 'planned' seviyelerin icerigi/esigi yoktur.
const isActive = (l) => l.status === 'active' && Number.isFinite(l.min);

export function levelFor(correct, levels) {
  let index = 0;
  levels.forEach((l, i) => {
    if (isActive(l) && correct >= l.min) index = i;
  });
  const cur = levels[index];
  const next = levels.slice(index + 1).find(isActive) || null;
  const fraction = next ? (correct - cur.min) / (next.min - cur.min) : 1;
  return { index, level: cur, next, fraction: Math.max(0, Math.min(1, fraction)) };
}

// Bir dogru cevaptan sonra seviye atlandi mi?
export function didLevelUp(before, after, levels) {
  const a = levelFor(before, levels).index;
  const b = levelFor(after, levels).index;
  return b > a ? levels[b] : null;
}

// Bir seviyenin bir oyun icin icerigi (yoksa null): { tier }
export const contentFor = (level, gameId) => level?.content?.[gameId] ?? null;
