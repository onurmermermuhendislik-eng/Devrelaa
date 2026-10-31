// V8.0 Macera ilerleme modeli (SAF mantik; DOM yok). Gorsel katman (harita, gorev ekranlari) YALNIZ bu turetilmis durumu okur.
// Tek kaynak: kayittaki `adv.tasks` = { gorevKimligi: enIyiYildiz }. Coin, yildiz toplami, kilitler ve bolge durumu BURADAN turetilir;
// ayri sayac/kilit alani yoktur, bu yuzden bilesenler birbiriyle celisemez. Degerler assets/data/adventure.json'dadir.

export const taskById = (cfg, id) => cfg.tasks.find((t) => t.id === id) || null;

// V8.4 Enerji Marketi (SAF mantik). Bakiye AYRI SAYACTA SAKLANMAZ: kazanilan coin (gorevlerden turetilir) - sahip olunan ekipmanlarin
// fiyatlari toplami. Boylece coin ile envanter birbiriyle celisemez; yarim kalan islem (yazma hatasi) geri alinir.
export const itemById = (cfg, id) => (cfg.market?.items || []).find((i) => i.id === id) || null;
export const ownedItems = (adv, cfg) => (cfg.market?.items || []).filter((i) => (adv?.inv || []).includes(i.id));
export const spentOf = (adv, cfg) => ownedItems(adv, cfg).reduce((n, i) => n + i.price, 0);
export const regionOf = (cfg, taskId) => cfg.regions.findIndex((r) => r.tasks.includes(taskId));
export const regionMap = (cfg, ri) => cfg.regions[ri]?.map || cfg.map;

// Satin alma karari (yazmaz): { ok, reason: 'unknown'|'owned'|'poor', need }
export function canBuy(adv, cfg, itemId, balance) {
  const it = itemById(cfg, itemId);
  if (!it) return { ok: false, reason: 'unknown', need: 0 };
  if ((adv?.inv || []).includes(it.id)) return { ok: false, reason: 'owned', need: 0 };
  if (balance < it.price) return { ok: false, reason: 'poor', need: it.price - balance };
  return { ok: true, reason: '', need: 0 };
}

// V8.5 BAGLANTILI DUNYA (SAF mantik; ayri sayac YOK). Asamalar `cfg.world.stages`; ekipman kimlikleri market katalogundakilerle AYNIDIR.
// Durum: 'done' (bolge bitti) | 'open' (oynanabilir) | 'needs' (acik ama gereken ekipman eksik) | 'locked' (onceki bitmedi) | 'soon' (yapim asamasinda; ASLA oynanabilir sayilmaz).
export const worldStages = (cfg) => cfg.world?.stages || [];
export const ownedIds = (adv, cfg) => ownedItems(adv, cfg).map((i) => i.id);
// Sahip olunmayan ekipman KULLANILAMAZ
export const canUseItem = (adv, cfg, itemId) => ownedIds(adv, cfg).includes(itemId);
export function worldStatus(adv, cfg) {
  const prog = deriveProgress(adv, cfg);
  const own = ownedIds(adv, cfg);
  return worldStages(cfg).map((st) => {
    const reg = st.region ? prog.regions.find((r) => r.id === st.region) : null;
    const needs = (st.needs || []).map((id) => {
      const it = itemById(cfg, id);
      return { id, title: it?.title || id, icon: it?.icon || '', price: it?.price || 0, owned: own.includes(id) };
    });
    const missing = needs.filter((n) => !n.owned);
    let state;
    if (st.status !== 'playable' || !reg) state = 'soon';
    else if (reg.done) state = 'done';
    else if (!reg.unlocked) state = 'locked';
    else state = missing.length ? 'needs' : 'open';
    return { id: st.id, n: st.n, title: st.title, icon: st.icon, learn: st.learn, state, needs, missing, missingCost: missing.reduce((n, m) => n + m.price, 0) };
  });
}
// Bir sonraki (henuz bitmemis) asama: "sonraki macera icin gerekenler" gosterimi
export const nextStage = (adv, cfg) => worldStatus(adv, cfg).find((s) => s.state !== 'done') || null;

// Hata sayisindan yildiz: 3 = hatasiz, 2 = en fazla maxMistakesForTwoStars, aksi 1 (hicbir zaman 0: tamamlanan gorev en az 1 yildiz alir)
export function starsFor(mistakes, rewards) {
  const m = Math.max(0, Math.floor(mistakes) || 0);
  if (m <= rewards.maxMistakesForThreeStars) return 3;
  if (m <= rewards.maxMistakesForTwoStars) return 2;
  return 1;
}

export function deriveProgress(adv, cfg) {
  const tasks = adv?.tasks || {};
  const nodes = {};
  const regions = [];
  let coins = 0;
  let stars = 0;
  let done = 0;
  let total = 0;
  let prevRegionDone = true;
  let nextId = null;
  for (const r of cfg.regions) {
    const unlocked = prevRegionDone;
    let prevDone = true;
    for (const id of r.tasks) {
      const t = taskById(cfg, id);
      const isDone = unlocked && !!tasks[id] && prevDone; // sirali: onceki bitmeden (ve bolge acilmadan) kayitli gorev sayilmaz (bozuk kayit coin/kilit kazandirmaz; V8.5: kilitli bolgenin ilk gorevi de sayilmaz)
      const state = !unlocked ? 'locked' : isDone ? 'done' : prevDone ? 'open' : 'locked';
      nodes[id] = { id, region: r.id, state, stars: tasks[id] || 0, final: !!t?.final };
      if (isDone && t) {
        coins += t.coins;
        stars += tasks[id];
        done += 1;
      }
      total += 1;
      if (state === 'open' && !nextId) nextId = id;
      prevDone = isDone;
    }
    const finalDone = !!r.final && !!tasks[r.final];
    const regionDone = unlocked && r.tasks.length > 0 && finalDone && r.tasks.every((i) => tasks[i]);
    regions.push({ id: r.id, unlocked, done: regionDone, soon: !!r.soon });
    prevRegionDone = regionDone;
  }
  // V8.4: `earned` = gorevlerden kazanilan toplam; `spent` = sahip olunan ekipmanlarin fiyati; `coins` = HARCANABILIR BAKIYE (earned - spent, hic eksiye dusmez)
  const spent = spentOf(adv, cfg);
  return { nodes, regions, coins: Math.max(0, coins - spent), earned: coins, spent, stars, maxStars: total * cfg.rewards.starsMax, done, total, nextId, tasks: { ...tasks }, inv: ownedItems(adv, cfg).map((i) => i.id) };
}

// Bu gorev su an oynanabilir mi? (acik, ya da tamamlanmis = tekrar oynanabilir; kilitli degil)
export const canPlay = (progress, id) => !!progress.nodes[id] && progress.nodes[id].state !== 'locked';

// Gorev tamamlaninca ekranda gosterilecek ozet (kayit YAZMAZ; yazan storage.completeAdvTask)
export function describeCompletion(before, after, id, cfg) {
  const t = taskById(cfg, id);
  const regionBefore = before.regions.findIndex((r) => r.done);
  const justFinishedRegion = after.regions.some((r, i) => r.done && !before.regions[i].done);
  const unlockedRegion = after.regions.find((r, i) => r.unlocked && !before.regions[i].unlocked) || null;
  const newlyOpen = after.nextId && after.nextId !== before.nextId ? after.nextId : null;
  return { coinGain: after.earned - before.earned, stars: after.nodes[id]?.stars || 0, justFinishedRegion, unlockedRegion, newlyOpen, final: !!t?.final, regionBefore };
}
