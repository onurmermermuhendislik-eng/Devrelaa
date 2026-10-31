// V8.0 Macera: yatay harita ekrani (HTML + SVG). Yalniz GORSEL: durumlar model.js'ten gelir (kilitli / acik / tamamlandi); koordinatlar,
// odul degerleri ve metinler assets/data/adventure.json'dadir.
import { roadSegments, mapDecor, partSvg, lockSvg, flagSvg, castleSvg, starSvg, esc } from './svg.js';
import { taskById, regionMap } from './model.js';

const pct = (v, total) => `${Math.round((v / total) * 10000) / 100}%`;

// V8.4: harita BOLGE basina cizilir (`region` = cfg.regions dizin numarasi). Bolge verisi (koordinat) yoksa cfg.map kullanilir.
export function mapHtml({ cfg, prog, text, sound, music = true, newly = null, region = 0 }) {
  const M = regionMap(cfg, region);
  const { w: W, h: H } = M;
  const R = cfg.regions[region];
  const NEXT = cfg.regions[region + 1] || null;
  const PREV = cfg.regions[region - 1] || null;
  const ids = R.tasks;
  const tasks = ids.map((id) => taskById(cfg, id));
  const pts = [M.start, ...tasks.map((t) => t.map), M.gate];
  const regionDone = prog.regions[region].done;
  const segs = roadSegments(pts)
    .map((s) => {
      const reached = s.to <= ids.length ? prog.nodes[ids[s.to - 1]].state === 'done' : regionDone;
      return `<path class="adv-road${reached ? ' done' : ''}" d="${s.d}"/>`;
    })
    .join('');
  const nodes = tasks
    .map((t, i) => {
      const n = prog.nodes[t.id];
      const label = `${i + 1}. ${t.title}. ${text.hexAria[n.state]}${n.state === 'done' ? `. ${n.stars} ${text.rewardStars}` : ''}`;
      const inner = n.state === 'locked' ? lockSvg : t.final ? castleSvg : `<b>${i + 1}</b>`;
      const stars = n.state === 'done' ? `<span class="adv-nstars" aria-hidden="true">${[1, 2, 3].map((k) => starSvg(k <= n.stars)).join('')}</span>` : '';
      return `<button type="button" class="adv-node adv-block ${n.state}${t.final ? ' final' : ''}${newly === t.id ? ' fresh' : ''}" data-act="node" data-id="${esc(t.id)}" data-state="${n.state}" style="left:${pct(t.map.x, W)};top:${pct(t.map.y, H)}" aria-label="${esc(label)}" ${n.state === 'locked' ? 'aria-disabled="true"' : ''}><span class="hex">${inner}</span>${stars}</button>`;
    })
    .join('');
  // Kapi: sonraki bolge. Acik + gorevli ise "gec" dugmesi; "yakinda" bolge icin etiket (eski davranis); kilitliyken kilit.
  const g = NEXT;
  const gateOpen = !!g && !!prog.regions[region + 1]?.unlocked;
  const gateGo = gateOpen && !g.soon && g.tasks.length > 0;
  const gateLabel = gateGo ? g.title : gateOpen ? text.soon : text.locked;
  const gateStyle = `left:${pct(M.gate.x, W)};top:${pct(M.gate.y, H)}`;
  const gate = g
    ? gateGo
      ? `<button type="button" class="adv-gate adv-block open go" data-act="region" data-region="${esc(g.id)}" style="${gateStyle}" aria-label="${esc(text.goRegion + ': ' + g.title)}"><span class="hex">${esc(g.icon)}</span><small>${esc(gateLabel)}</small></button>`
      : `<div class="adv-gate adv-block ${gateOpen ? 'open' : 'closed'}" style="${gateStyle}" role="img" aria-label="${esc(g.title + '. ' + gateLabel)}"><span class="hex">${gateOpen ? esc(g.icon) : lockSvg}</span><small>${esc(gateLabel)}</small></div>`
    : '';
  const startStyle = `left:${pct(M.start.x, W)};top:${pct(M.start.y, H)}`;
  const start = PREV
    ? `<button type="button" class="adv-start adv-block back" data-act="region" data-region="${esc(PREV.id)}" style="${startStyle}" aria-label="${esc(text.backRegion + ': ' + PREV.title)}"><span class="hex">${esc(PREV.icon)}</span><small>${esc(PREV.title)}</small></button>`
    : `<div class="adv-start adv-block" style="${startStyle}" aria-hidden="true"><span class="hex">${flagSvg}</span><small>${esc(text.start)}</small></div>`;
  const maxStars = prog.maxStars;
  const pctDone = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
  return `
    <section class="adv adv-mapscreen" data-screen="map" data-region="${esc(R.id)}" aria-label="${esc(text.mapAria)}">
      <header class="adv-hud">
        <button type="button" class="adv-btn round" data-act="menu" aria-label="${esc(text.menu)}" aria-haspopup="dialog"><span aria-hidden="true">☰</span></button>
        <div class="adv-pills">
          <div class="adv-pill adv-block coin" aria-label="${esc(text.hudCoin)}: ${prog.coins}"><i aria-hidden="true">🪙</i><b data-coins="${prog.coins}">${prog.coins}</b></div>
          <div class="adv-pill adv-block star" aria-label="${esc(text.hudStar)}: ${prog.stars} / ${maxStars}"><i aria-hidden="true">⭐</i><b data-stars="${prog.stars}">${prog.stars}</b><small>/ ${maxStars}</small></div>
          <div class="adv-pill adv-block prog" aria-label="${prog.done} / ${prog.total} ${esc(text.hudTasks)}"><span class="bar"><span class="fill" style="width:${pctDone}%"></span></span><b data-done="${prog.done}">${prog.done}</b><small>/ ${prog.total} ${esc(text.hudTasks)}</small></div>
        </div>
        <button type="button" class="adv-btn round adv-shopbtn" data-act="shop" aria-label="${esc(text.marketBtn)}"><span aria-hidden="true">🛒</span></button>
        <button type="button" class="adv-btn round" data-act="sound" aria-label="${esc(sound ? text.menuSoundOn : text.menuSoundOff)}" aria-pressed="${sound}"><span aria-hidden="true">${sound ? '🔊' : '🔇'}</span></button>
      </header>
      <div class="adv-stage">
        <div class="adv-map" style="--mw:${W};--mh:${H}">
          <svg class="adv-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${mapDecor()}<g class="adv-roads">${segs}</g></svg>
          ${start}${nodes}${gate}
        </div>
      </div>
      <div class="adv-sheet" data-open="0" hidden role="dialog" aria-modal="true" aria-label="${esc(text.menu)}">
        <div class="adv-sheet-in">
          <button type="button" class="adv-btn wide" data-act="mini">🎮 ${esc(text.menuMini)}</button>
          <button type="button" class="adv-btn wide" data-act="world">🌍 ${esc(text.menuWorld)}</button>
          <button type="button" class="adv-btn wide" data-act="musictoggle" aria-pressed="${music}">${music ? '🎵' : '🔕'} <span>${esc(music ? text.menuMusicOn : text.menuMusicOff)}</span></button>
          <button type="button" class="adv-btn wide" data-act="intro">🎬 ${esc(text.menuIntro)}</button>
          <button type="button" class="adv-btn wide soft" data-act="close">${esc(text.menuClose)}</button>
        </div>
      </div>
      <div class="adv-rotate" aria-hidden="true"><span class="phone">📱</span><p>${esc(text.rotate)}</p></div>
    </section>`;
}
