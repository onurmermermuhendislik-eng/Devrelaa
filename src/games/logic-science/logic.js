// Mantik ve Bilim saf mantigi (DOM yok). Gorev verisi assets/data/logic-science.json.
// Dort tur: order (gorsel siralama), pattern (orutu tamamlama), cause (neden-sonuc tahmini), science (bilim sorusu + gozlem).

// Siralama: ogeler yazildigi sirada DOGRU siradadir; ekranda karistirilir (tek ogeli degilse ayni sira cikmaz).
export function shuffledItems(task, rng) {
  const idx = task.items.map((_, i) => i);
  let out = rng.shuffle(idx);
  for (let k = 0; k < 8 && idx.length > 1 && out.every((v, i) => v === i); k++) out = rng.shuffle(idx);
  return out;
}
// placed: simdiye kadar dogru yerlestirilen oge sayisi; i: dokunulan oge (yazim sirasindaki indeks)
export const isNextInOrder = (placed, i) => i === placed;

// Secenekli gorevler (pattern/cause/science): secenekleri karistir (indeksi koru)
export const shuffledOptions = (task, rng) => rng.shuffle(task.options.map((o, i) => ({ ...o, i })));
export const correctIndex = (task) => task.options.findIndex((o) => o.ok);
export const isCorrect = (task, i) => !!task.options[i]?.ok;

// Veri dogrulama (test ve cagirici icin)
export function validateTask(t) {
  const errs = [];
  if (!['order', 'pattern', 'cause', 'science'].includes(t.kind)) errs.push('kind');
  if (t.kind === 'order') {
    if (!Array.isArray(t.items) || t.items.length < 3 || t.items.some((x) => !x.icon || !x.label || !x.hint)) errs.push('items');
  } else {
    const ok = Array.isArray(t.options) ? t.options.filter((o) => o.ok).length : 0;
    if (ok !== 1) errs.push('ok-count');
    if ((t.options || []).some((o) => !o.ok && !o.hint)) errs.push('hint');
    if (t.kind === 'pattern' && (!Array.isArray(t.seq) || t.seq.length < 3)) errs.push('seq');
    if ((t.kind === 'cause' || t.kind === 'science') && !(t.observe && t.observe.text)) errs.push('observe');
  }
  return errs;
}
