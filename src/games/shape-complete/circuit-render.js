// Devre tahtasi ve komponent cizimi (SVG metni). Renkler/animasyonlar CSS'te (styles.css).
import { fmt } from './geometry.js';
import { esc } from './render.js';

// Sembolun kenar boyunca kapladigi uzunluk (kalan kisim kablo olarak cizilir)
export const SYMBOL_LEN = { battery: 38, led: 26, resistor: 30, switch: 34 };
export const TYPE_NAME = { wire: 'Kablo', battery: 'Pil', led: 'LED', resistor: 'Direnç', switch: 'Anahtar' };

function angleFor(type, dx, dy) {
  let a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (type !== 'battery') {
    // Pil disindaki parcalar ters donmesin
    if (a > 90) a -= 180;
    else if (a <= -90) a += 180;
  }
  return a;
}

// Yerel koordinat: parca merkezde (0,0), kenar boyunca +x
export function symbolMarkup(type, o = {}) {
  switch (type) {
    case 'battery': {
      // Artı/eksi işaretleri parça dönse bile dik okunsun (ters döndürülür)
      const up = (cx) => (o.ang ? ` transform="rotate(${fmt(-o.ang)} ${cx} 0)"` : '');
      return (
        '<g class="sym battery">' +
        '<rect class="b-nub" x="15" y="-3.6" width="5" height="7.2" rx="1.6"/>' +
        '<rect class="b-body" x="-19" y="-9.5" width="34.5" height="19" rx="4"/>' +
        '<rect class="b-cap" x="-19" y="-9.5" width="12" height="19" rx="4"/>' +
        `<path class="b-mark"${up(-13)} d="M-15 0H-11"/>` +
        `<path class="b-mark"${up(4.5)} d="M4.5 -3.6V3.6M0.9 0H8.1"/>` +
        '</g>'
      );
    }
    case 'resistor':
      return (
        '<g class="sym resistor">' +
        '<rect class="r-body" x="-13" y="-6.5" width="26" height="13" rx="3.5"/>' +
        '<rect class="rb1" x="-8.5" y="-6.5" width="3" height="13"/>' +
        '<rect class="rb2" x="-3.5" y="-6.5" width="3" height="13"/>' +
        '<rect class="rb3" x="1.5" y="-6.5" width="3" height="13"/>' +
        '<rect class="rb4" x="7.5" y="-6.5" width="2.6" height="13"/>' +
        '</g>'
      );
    case 'led': {
      const dome = 'M-9 9V-1A9 9 0 0 1 9 -1V9Z';
      return (
        `<g class="sym led" data-b="${o.level || 0}">` +
        (o.gid ? `<circle class="glow" r="24" fill="url(#gg-${esc(o.gid)})"/>` : '') +
        `<path class="l-off" d="${dome}"/>` +
        `<path class="l-on" d="${dome}" fill="${o.hex || '#ff3b30'}"/>` +
        '<path class="l-inner" d="M-3.2 9V1.5M3.2 9V-2.5"/>' +
        '<rect class="l-rim" x="-11" y="8" width="22" height="3.6" rx="1.6"/>' +
        '<ellipse class="l-shine" cx="-4.2" cy="-3.6" rx="1.8" ry="3.6"/>' +
        '<circle class="l-core" cx="0" cy="0" r="5" />' +
        '</g>'
      );
    }
    case 'switch':
      return (
        `<g class="sym switch${o.closed ? ' closed' : ''}">` +
        '<circle class="s-pin" cx="-13" cy="0" r="2.8"/><circle class="s-pin" cx="13" cy="0" r="2.8"/>' +
        `<path class="s-lever" d="${o.closed ? 'M-13 0L13 0' : 'M-13 0L10 -11'}"/>` +
        '</g>'
      );
    case 'wire':
    default:
      return '<g class="sym wire"><path class="lead" d="M-19 0H19"/></g>';
  }
}

// Secenek karosu (tepsideki komponent)
export function tileSvg(type, hex) {
  return (
    `<svg class="scene tile-sym" viewBox="-26 -20 52 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">` +
    symbolMarkup(type, { hex }) +
    '</svg>'
  );
}

export function gradientDefs(round) {
  return Object.entries(round.ledColors)
    .map(
      ([id, c]) =>
        `<radialGradient id="gg-${esc(id)}">` +
        `<stop offset="0" stop-color="${c.glow}" stop-opacity="1"/>` +
        `<stop offset="0.35" stop-color="${c.glow}" stop-opacity="0.55"/>` +
        `<stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>`
    )
    .join('');
}

// view: { powered, armed, hintSlots:Set, pop, switchHint }
export function boardSvg(round, view, sim) {
  const [vx, vy, vw, vh] = round.viewBox;
  const N = round.nodes;
  const used = new Set();
  let leads = '';
  let flows = '';
  let gaps = '';
  let syms = '';
  let slots = '';

  for (const part of round.parts) {
    const [ax, ay] = N[part.a];
    const [bx, by] = N[part.b];
    used.add(part.a).add(part.b);
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dir = sim.flows[part.id];
    const liveCls = dir ? ' live' : '';
    const flowCls = dir === 'ba' ? 'flow rv' : 'flow fw';
    const seg = (x1, y1, x2, y2) => {
      leads += `<line class="lead${liveCls}" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`;
      if (dir) flows += `<line class="${flowCls}" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`;
    };

    if (!part.type && part.fault) {
      // Bozuk parca: kopuk, kivilcimli kablo. Dokununca kalkar ve bos konum acilir (once "bozuk parcayi bul")
      const fang = angleFor('wire', dx, dy);
      const hintCls = view.hintFault ? ' hint' : '';
      slots +=
        `<g class="slot fault${hintCls}" data-slot="${esc(part.id)}" data-fault="1" transform="translate(${fmt(mx)} ${fmt(my)}) rotate(${fmt(fang)})">` +
        `<rect class="slot-hit" x="-30" y="-24" width="60" height="48" rx="12"/>` +
        `<path class="fault-stub" d="M${fmt(-len / 2 + 14)} 0H-9M9 0H${fmt(len / 2 - 14)}"/>` +
        '<path class="fault-mark" d="M-9 0L-3 -9L3 7L9 0"/></g>';
      continue;
    }
    if (!part.type) {
      // Bos konum: kopuk kablo (kesik cizgi) + yerlestirme alani
      gaps += `<line class="gap" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`;
      const ang = angleFor(part.accepts === 'wire' ? 'wire' : part.accepts, dx, dy);
      const hint = view.hintSlots?.has(part.id) ? ' hint' : '';
      const armed = view.armed ? ' armed' : '';
      let inner;
      if (round.silhouette && part.accepts !== 'wire') {
        inner =
          '<rect class="slot-box" x="-24" y="-17" width="48" height="34" rx="10"/>' +
          `<g class="ghost">${symbolMarkup(part.accepts, { hex: round.ledColors[part.id]?.hex, ang })}</g>`;
      } else if (round.silhouette) {
        inner = `<line class="ghost-wire" x1="${fmt(-len / 2 + 14)}" y1="0" x2="${fmt(len / 2 - 14)}" y2="0"/><circle class="slot-q" r="9"/><text class="qmark" font-size="13" text-anchor="middle" dominant-baseline="central" transform="rotate(${fmt(-ang)})">?</text>`;
      } else {
        inner = `<rect class="slot-box" x="-24" y="-17" width="48" height="34" rx="10"/><text class="qmark" font-size="18" text-anchor="middle" dominant-baseline="central" transform="rotate(${fmt(-ang)})">?</text>`;
      }
      const hitW = part.accepts === 'wire' ? len - 12 : 56;
      slots +=
        `<g class="slot${hint}${armed}" data-slot="${esc(part.id)}" transform="translate(${fmt(mx)} ${fmt(my)}) rotate(${fmt(ang)})">` +
        `<rect class="slot-hit" x="${fmt(-hitW / 2)}" y="-22" width="${fmt(hitW)}" height="44" rx="12"/>${inner}</g>`;
      continue;
    }

    if (part.type === 'wire') {
      seg(ax, ay, bx, by);
      continue;
    }

    const half = (len - SYMBOL_LEN[part.type]) / 2;
    seg(ax, ay, ax + ux * half, ay + uy * half);
    seg(bx - ux * half, by - uy * half, bx, by);
    const ang = angleFor(part.type, dx, dy);
    const level = sim.levels[part.id] || 0;
    const closed = part.state === 'closed';
    const klass = [
      'part',
      view.pop === part.id ? 'pop' : '',
      part.type === 'switch' && view.switchHint ? 'hint' : ''
    ]
      .filter(Boolean)
      .join(' ');
    const attrs = part.type === 'switch' ? ` data-switch="${esc(part.id)}"` : '';
    const hit = part.type === 'switch' ? '<rect class="slot-hit" x="-24" y="-20" width="48" height="40" rx="12"/>' : '';
    syms +=
      `<g class="${klass}"${attrs} transform="translate(${fmt(mx)} ${fmt(my)}) rotate(${fmt(ang)})">${hit}` +
      symbolMarkup(part.type, { gid: part.id, hex: round.ledColors[part.id]?.hex, level, closed, ang }) +
      '</g>';
  }

  const nodes = [...used].map((id) => `<circle class="node" cx="${N[id][0]}" cy="${N[id][1]}" r="3.4"/>`).join('');
  return (
    `<svg class="board${view.powered ? ' power' : ''}" viewBox="${vx} ${vy} ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">` +
    `<defs>${gradientDefs(round)}</defs>` +
    `<g class="gaps">${gaps}</g><g class="leads">${leads}</g><g class="flows">${flows}</g>` +
    `<g class="nodes">${nodes}</g><g class="syms">${syms}</g><g class="slots">${slots}</g></svg>`
  );
}
