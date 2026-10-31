// V8.0 Macera: olceklenebilir SVG parcalari (hazir resim yok; hepsi vektor). Gorsel katman: oyun mantigi (model.js, circuit.js) bunlara bagli degildir.
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Noktalardan yumusak (Catmull-Rom -> kubik Bezier) yol dilimleri: [{ d, from, to }]
export function roadSegments(points) {
  const f = (n) => Math.round(n * 10) / 10;
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    out.push({ d: `M${f(p1.x)} ${f(p1.y)}C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`, from: i, to: i + 1 });
  }
  return out;
}

// Devre parcalari (64x64). type: battery | lamp | led | resistor | switch | wire | stone | leaf
export function partSvg(type, o = {}) {
  const c = (inner, cls = '') => `<svg class="part-svg ${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${inner}</svg>`;
  switch (type) {
    case 'battery':
      return c(
        '<rect x="5" y="19" width="46" height="26" rx="6" fill="#e5483e"/><rect x="5" y="19" width="15" height="26" rx="6" fill="#2b86e8"/><rect x="51" y="27" width="7" height="10" rx="2.5" fill="#cfd6e4"/>' +
          '<path d="M9.5 32h6" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M38 32h8M42 28v8" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><rect x="8" y="22" width="40" height="5" rx="2.5" fill="#fff" opacity=".22"/>',
        'p-battery'
      );
    case 'lamp':
      return c(
        '<g class="lamp"><circle class="lamp-glow" cx="32" cy="26" r="28"/><g class="rays"><path d="M32 2v6M10 10l4 4M54 10l-4 4M4 26h6M54 26h6"/></g>' +
          '<circle class="bulb" cx="32" cy="26" r="15"/><path class="fil" d="M25 31q3.5-9 7 0q3.5-9 7 0"/><ellipse class="shine" cx="26" cy="19" rx="3" ry="5" transform="rotate(25 26 19)"/>' +
          '<rect class="base" x="24.5" y="40" width="15" height="6" rx="2"/><rect class="base2" x="26.5" y="46" width="11" height="6" rx="2.5"/></g>',
        'p-lamp'
      );
    case 'switch':
      return c(
        `<rect x="6" y="38" width="52" height="14" rx="5" fill="#5b6b86"/><circle cx="16" cy="38" r="4.5" fill="#cfd6e4"/><circle cx="48" cy="38" r="4.5" fill="#cfd6e4"/>` +
          (o.closed ? '<path class="lever" d="M16 38L48 38" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/>' : '<path class="lever" d="M16 38L42 16" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/><circle cx="43" cy="15.5" r="4.2" fill="#ffd23f"/>'),
        `p-switch ${o.closed ? 'closed' : 'open'}`
      );
    case 'led':
      // V8.4: LED = kucuk kirmizi kubbe + iki bacak (lamba ile ayni "yanma" siniflari: .lamp/.bulb)
      return c(
        '<g class="lamp"><circle class="lamp-glow" cx="32" cy="26" r="28"/><g class="rays"><path d="M32 2v6M10 10l4 4M54 10l-4 4M4 26h6M54 26h6"/></g>' +
          '<path class="bulb" d="M20 36V24a12 12 0 0124 0v12z"/><ellipse class="shine" cx="26" cy="19" rx="3" ry="5" transform="rotate(25 26 19)"/>' +
          '<rect class="base" x="17" y="36" width="30" height="5" rx="2"/><path d="M26 41v14M38 41v10" stroke="#cfd6e4" stroke-width="3.4" stroke-linecap="round"/></g>',
        'p-lamp p-led'
      );
    case 'resistor':
      return c(
        '<path d="M4 32h13M47 32h13" stroke="#cfd6e4" stroke-width="4" stroke-linecap="round"/><rect x="16" y="21" width="32" height="22" rx="9" fill="#e8c98a"/>' +
          '<rect x="22" y="21" width="4.5" height="22" fill="#b23a2e"/><rect x="30" y="21" width="4.5" height="22" fill="#2d2d2d"/><rect x="38" y="21" width="4.5" height="22" fill="#e0a21a"/>',
        'p-resistor'
      );
    case 'wire':
      return c('<path d="M4 32h56" stroke="#c46a2b" stroke-width="7" stroke-linecap="round"/><path d="M4 32h56" stroke="#f0a35e" stroke-width="2.6" stroke-linecap="round"/>', 'p-wire');
    case 'stone':
      return c('<path d="M10 42l5-16 14-8 16 4 9 14-5 12-24 3z" fill="#8b93a1"/><path d="M15 26l14-8 16 4-10 10z" fill="#b2b9c6"/><path d="M26 52l9-20 14 4-5 12z" fill="#6f7886"/>', 'p-stone');
    case 'leaf':
      return c('<path d="M12 50C8 28 24 10 52 12c2 26-12 42-40 38z" fill="#4cb860"/><path d="M12 50C24 38 34 28 48 16" stroke="#2f8f45" stroke-width="3" fill="none" stroke-linecap="round"/>', 'p-leaf');
    default:
      return c('');
  }
}

// Harita dugumu icerigi: kilit, bayrak, kale
export const lockSvg = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="7" y="14" width="18" height="13" rx="3.5" fill="#cdd5ea"/><path d="M11 14v-3.5a5 5 0 0110 0V14" fill="none" stroke="#cdd5ea" stroke-width="3"/><circle cx="16" cy="20.5" r="2" fill="#5b6a94"/></svg>';
export const flagSvg = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 28V5" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M10 6l15 5.5L10 17z" fill="#ff5a64"/></svg>';
export const castleSvg = '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M6 34V15h5v-4h4v4h4v-4h4v4h4v-4h4v4h5v19z" fill="#fff"/><path d="M16 34v-8a4 4 0 018 0v8z" fill="#5b6a94"/><path d="M20 8V2l7 2.5-7 2.5" fill="#ff5a64"/></svg>';
export const starSvg = (on) => `<svg class="star ${on ? 'on' : 'off'}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.4l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.2 6 20.5l1.3-6.6L2.4 9.3l6.7-.8z"/></svg>`;

// Harita dekoru (viewBox 800x340): arka plan, ay, agaclar, calilar, kristaller. Yalniz suslemedir; etkilesimsiz.
export function mapDecor() {
  const tree = (x, y, s, c = '#2c9a74') =>
    `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="0" width="6" height="16" rx="2" fill="#3a2a6e"/><circle cx="0" cy="-6" r="14" fill="${c}"/><circle cx="-10" cy="2" r="10" fill="${c}"/><circle cx="10" cy="2" r="10" fill="${c}"/><circle cx="-4" cy="-10" r="5" fill="#fff" opacity=".12"/></g>`;
  const bush = (x, y, s, c = '#7a4fd6') => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="17" ry="10" fill="${c}"/><ellipse cx="-9" cy="3" rx="11" ry="8" fill="${c}"/><ellipse cx="10" cy="3" rx="12" ry="8" fill="${c}"/></g>`;
  const crystal = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -22l7 12-3 16h-8l-3-16z" fill="#46d8e8"/><path d="M0 -22l7 12-7 3z" fill="#fff" opacity=".4"/></g>`;
  let stars = '';
  for (const [x, y, r] of [[40, 40, 1.6], [120, 70, 1.2], [210, 30, 1.8], [330, 60, 1.2], [450, 28, 1.6], [560, 58, 1.2], [650, 34, 1.8], [720, 70, 1.2], [780, 36, 1.4], [260, 90, 1], [610, 96, 1]]) stars += `<circle class="twinkle" cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".75"/>`;
  return (
    '<defs><linearGradient id="adv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#171a6a"/><stop offset=".55" stop-color="#2d2a8f"/><stop offset="1" stop-color="#3b2f9e"/></linearGradient>' +
    '<radialGradient id="adv-moon"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient></defs>' +
    '<rect width="800" height="340" fill="url(#adv-sky)"/>' +
    '<circle cx="690" cy="62" r="70" fill="url(#adv-moon)"/><circle cx="690" cy="62" r="22" fill="#fff3b8"/>' +
    stars +
    '<ellipse cx="400" cy="372" rx="520" ry="120" fill="#2a2380"/>' +
    tree(36, 140, 1.15) + tree(78, 100, 0.9, '#34b085') + tree(330, 300, 1.1) + tree(470, 112, 0.95, '#34b085') + tree(560, 292, 1.15) + tree(765, 130, 1.1) + tree(230, 118, 0.85, '#26866a') +
    bush(24, 300, 1.2) + bush(150, 312, 1) + bush(420, 318, 1.1, '#8a5be0') + bush(690, 316, 1.2) + bush(612, 128, 0.8, '#8a5be0') +
    crystal(120, 168, 1) + crystal(380, 110, 0.9) + crystal(720, 205, 1)
  );
}
