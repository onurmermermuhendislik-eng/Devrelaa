// Mahalle Macerasi — ic mekan sahneleri (Asama 1: basit ama gorsel olarak tutarli; gorevler sonraki asamalarda). SVG 400x240, "meet" + genis zemin/duvar.
const O = '#3a2433';
const S = (w = 1.6) => `stroke="${O}" stroke-width="${w}" stroke-linejoin="round"`;
const kid = (x, y, sc = 0.95) => `<g class="mh-kid" transform="translate(${x} ${y}) scale(${sc})"><g transform="translate(-30 -94)">
  <ellipse cx="30" cy="94" rx="16" ry="3.4" fill="#000" opacity=".25"/>
  <rect x="19" y="64" width="10" height="28" rx="5" fill="#2f4a8a" ${S(1.2)}/><rect x="31" y="64" width="10" height="28" rx="5" fill="#2f4a8a" ${S(1.2)}/>
  <ellipse cx="24" cy="93" rx="8" ry="3.8" fill="#4a352b" ${S(1.2)}/><ellipse cx="36" cy="93" rx="8" ry="3.8" fill="#4a352b" ${S(1.2)}/>
  <rect x="9" y="42" width="7" height="22" rx="3.5" fill="#e5483e" ${S(1.2)}/><rect x="44" y="42" width="7" height="22" rx="3.5" fill="#e5483e" ${S(1.2)}/>
  <rect x="15" y="36" width="30" height="34" rx="12" fill="#ffb02e" ${S(1.4)}/><path d="M22 37l1 24M38 37l-1 24" stroke="#c9372e" stroke-width="3" stroke-linecap="round"/>
  <rect x="6" y="40" width="9" height="23" rx="4.5" fill="#ffb02e" ${S(1.2)}/><circle cx="10.5" cy="63" r="4.4" fill="#ffd2a6" ${S(1.2)}/>
  <rect x="45" y="40" width="9" height="23" rx="4.5" fill="#ffb02e" ${S(1.2)}/><circle cx="49.5" cy="63" r="4.4" fill="#ffd2a6" ${S(1.2)}/>
  <circle cx="30" cy="22" r="16" fill="#ffd2a6" ${S(1.4)}/><path d="M14 22q1-17 16-17t16 17q-7-8-16-8t-16 8z" fill="#5b3a1e" ${S(1.2)}/>
  <circle cx="14.2" cy="26" r="3" fill="#f2b88a" ${S(1)}/><circle cx="45.8" cy="26" r="3" fill="#f2b88a" ${S(1)}/>
  <circle cx="23.5" cy="26" r="2.6" fill="#2b2b2b"/><circle cx="36.5" cy="26" r="2.6" fill="#2b2b2b"/><circle cx="24.3" cy="25" r=".9" fill="#fff"/><circle cx="37.3" cy="25" r=".9" fill="#fff"/>
  <circle cx="19" cy="31.5" r="3" fill="#ff8f8f" opacity=".5"/><circle cx="41" cy="31.5" r="3" fill="#ff8f8f" opacity=".5"/><path d="M24 33q6 6 12 0" stroke="#8a3b2b" stroke-width="2" fill="none" stroke-linecap="round"/></g></g>`;
const shell = (wall, floor, trim, inner) => `<svg class="mh-in-svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
  <rect x="-600" y="-200" width="1600" height="440" fill="${wall}"/><rect x="-600" y="120" width="1600" height="52" fill="${trim}" opacity=".35"/><rect x="-600" y="114" width="1600" height="7" fill="${trim}"/>
  <rect x="-600" y="172" width="1600" height="200" fill="${floor}"/><path d="M-600 172h1600" stroke="${O}" stroke-width="2" opacity=".5"/>
  <g stroke="#000" stroke-width="1.6" opacity=".12"><path d="M-600 192h1600M-600 214h1600M-600 240h1600M60 172l-40 200M160 172l-14 200M250 172v200M340 172l20 200"/></g>${inner}</svg>`;
const door = (x) => `<g><rect x="${x}" y="54" width="46" height="118" rx="5" fill="#8a5a34" ${S(1.8)}/><rect x="${x + 8}" y="64" width="30" height="40" rx="4" fill="#00000020"/><circle cx="${x + 38}" cy="118" r="3.4" fill="#ffd23f" ${S(1)}/></g>`;
const win = (x, y, w, h, g = '#9fd8ff') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${g}" ${S(2)}/><path d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}" stroke="${O}" stroke-width="2"/>`;

export const INTERIORS = {
  okul: () => shell('#fbe9b8', '#c98a58', '#4a8f6a', `
    ${door(8)}
    <rect x="110" y="34" width="170" height="78" rx="6" fill="#2f7a55" stroke="#8a5a34" stroke-width="6"/><path d="M126 60q18-12 30 0t28 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/><text x="120" y="98" font-size="13" font-weight="800" fill="#fff" opacity=".9">A B C  1 2 3</text><rect x="120" y="106" width="150" height="5" fill="#8a5a34"/>
    <circle cx="316" cy="56" r="20" fill="#fff" ${S(2.4)}/><path d="M316 56v-12M316 56l9 4" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
    ${win(336, 30, 50, 60)}
    <g><rect x="130" y="150" width="60" height="22" rx="4" fill="#d9a066" ${S(1.8)}/><rect x="134" y="172" width="6" height="14" fill="#8a5a34"/><rect x="180" y="172" width="6" height="14" fill="#8a5a34"/><rect x="214" y="152" width="60" height="22" rx="4" fill="#d9a066" ${S(1.8)}/><rect x="218" y="174" width="6" height="14" fill="#8a5a34"/><rect x="264" y="174" width="6" height="14" fill="#8a5a34"/></g>
    <rect x="318" y="140" width="56" height="34" rx="5" fill="#e5483e" ${S(1.8)}/><circle cx="346" cy="132" r="14" fill="#6fb3ff" ${S(1.8)}/><path d="M334 128q12 8 24 0" stroke="#2f7a55" stroke-width="3" fill="none"/>
    ${kid(210, 208)}`),
  ev: () => shell('#f6d9a8', '#c98550', '#d4795a', `
    ${door(8)}
    <rect x="116" y="52" width="46" height="38" rx="4" fill="#fff5e0" stroke="#7a4f2e" stroke-width="4"/><path d="M122 84l12-16 10 10 8-8 8 14z" fill="#6fb36a"/>
    <path d="M200 0v22" stroke="${O}" stroke-width="2.2"/><path d="M176 40q0-18 24-18t24 18z" fill="#f2b632" ${S(1.8)}/><circle cx="200" cy="43" r="6" fill="#fff4c2" ${S(1.2)}/>
    ${win(236, 26, 84, 64, '#7fa8ff')}<path d="M226 22h22v78q-11 5-22 0z" fill="#e5584c" ${S(1.4)}/><path d="M312 22h22v78q-11 5-22 0z" fill="#e5584c" ${S(1.4)}/>
    <rect x="104" y="124" width="76" height="48" rx="10" fill="#3f8fb0" ${S(1.8)}/><rect x="96" y="138" width="18" height="34" rx="8" fill="#2f7a9a" ${S(1.6)}/><rect x="170" y="138" width="18" height="34" rx="8" fill="#2f7a9a" ${S(1.6)}/><rect x="116" y="142" width="26" height="20" rx="7" fill="#56a9c9" ${S(1.2)}/><rect x="144" y="142" width="26" height="20" rx="7" fill="#56a9c9" ${S(1.2)}/>
    <ellipse cx="270" cy="152" rx="26" ry="6" fill="#c98550" ${S(1.6)}/><rect x="262" y="156" width="16" height="20" rx="3" fill="#a8693c" ${S(1.4)}/>
    <ellipse cx="200" cy="212" rx="100" ry="15" fill="#3f9d9a" ${S(1.6)}/>
    ${kid(210, 210)}`),
  market: () => shell('#fff0c2', '#d9b98a', '#e5483e', `
    ${door(8)}
    <path d="M70 6h300v26H70z" fill="#fff" ${S(2)}/>${Array.from({ length: 10 }, (_, i) => `<path d="M${70 + i * 30} 6h30v26h-30z" fill="${i % 2 ? '#fff' : '#e5483e'}" ${S(1.4)}/>`).join('')}
    <text x="220" y="26" text-anchor="middle" font-size="14" font-weight="900" fill="#3a2433" stroke="#fff" stroke-width="3" paint-order="stroke">MARKET</text>
    <g><rect x="84" y="56" width="120" height="116" rx="5" fill="#c98550" ${S(1.8)}/>${[78, 108, 138].map((y) => `<rect x="90" y="${y}" width="108" height="5" fill="#8a5a34"/>`).join('')}
     ${[[100, 72, '#e5483e'], [124, 72, '#ffb02e'], [148, 72, '#7fd36a'], [172, 72, '#ffd23f'], [100, 102, '#7fd36a'], [124, 102, '#e5483e'], [148, 102, '#ffd23f'], [172, 102, '#ffb02e'], [100, 132, '#ffd23f'], [124, 132, '#7fd36a'], [148, 132, '#ffb02e'], [172, 132, '#e5483e']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}" ${S(1.3)}/>`).join('')}</g>
    <g><rect x="238" y="56" width="110" height="116" rx="5" fill="#c98550" ${S(1.8)}/>${[78, 108, 138].map((y) => `<rect x="244" y="${y}" width="98" height="5" fill="#8a5a34"/>`).join('')}
     ${[[254, 68, '#6fb3ff'], [280, 68, '#ff7aa8'], [306, 68, '#ffd23f'], [332, 68, '#7fd36a'], [254, 98, '#ff7aa8'], [280, 98, '#6fb3ff'], [306, 98, '#7fd36a'], [332, 98, '#ffd23f']].map(([x, y, c]) => `<rect x="${x - 8}" y="${y - 9}" width="17" height="19" rx="3" fill="${c}" ${S(1.3)}/>`).join('')}</g>
    <rect x="296" y="150" width="84" height="24" rx="5" fill="#3f9d6a" ${S(1.8)}/><rect x="330" y="138" width="30" height="14" rx="3" fill="#cfe9ff" ${S(1.4)}/>
    <path d="M44 156h32l-4 18H48z" fill="#e5483e" ${S(1.6)}/><path d="M48 156q12-14 24 0" stroke="${O}" stroke-width="2" fill="none"/>
    ${kid(210, 210)}`),
  atolye: () => shell('#bfe6e0', '#a8875e', '#3d4f66', `
    ${door(8)}
    <rect x="96" y="30" width="250" height="84" rx="6" fill="#d9c7a0" ${S(1.8)}/>${[[112, 46], [150, 46], [188, 46], [226, 46], [264, 46], [302, 46]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="22" height="${22 + (i % 3) * 8}" rx="3" fill="${['#e5483e', '#6fb3ff', '#ffd23f'][i % 3]}" ${S(1.3)}/>`).join('')}
    <circle cx="124" cy="96" r="9" fill="none" stroke="${O}" stroke-width="3"/><path d="M170 86l22 18M230 86v22" stroke="${O}" stroke-width="4" stroke-linecap="round"/><circle cx="300" cy="98" r="9" fill="#9aa7b5" ${S(1.6)}/>
    <rect x="86" y="140" width="190" height="34" rx="5" fill="#c98550" ${S(1.8)}/><rect x="96" y="174" width="8" height="14" fill="#8a5a34"/><rect x="258" y="174" width="8" height="14" fill="#8a5a34"/>
    <rect x="110" y="122" width="30" height="18" rx="3" fill="#e5483e" ${S(1.4)}/><rect x="112" y="116" width="6" height="8" fill="#5a3f33"/><circle cx="186" cy="132" r="9" fill="#ffe36b" ${S(1.4)}/><rect x="182" y="139" width="8" height="5" fill="#9a8a7a"/>
    <path d="M232 138l12-12 12 12z" fill="#ffd23f" ${S(1.4)}/><rect x="238" y="138" width="12" height="2" fill="${O}"/>
    <circle cx="326" cy="150" r="22" fill="#f0c75a" ${S(2)}/><circle cx="326" cy="150" r="9" fill="#a8875e" ${S(1.6)}/><circle cx="364" cy="122" r="14" fill="#9aa7b5" ${S(1.8)}/><circle cx="364" cy="122" r="5" fill="#6a7684"/>
    ${kid(210, 210)}`)
};
export const INFO = {
  okul: { title: 'OKUL', note: 'Yakında: eğlenceli elektrik dersleri burada başlayacak!' },
  ev: { title: 'EV', note: 'Yakında: Karanlık Ev görevi burada oynanacak!' },
  market: { title: 'MARKET', note: 'Yakında: alışveriş ve sayma görevleri burada olacak!' },
  atolye: { title: 'ATÖLYE', note: 'Yakında: elektrik ekipmanları ve devre kurma burada olacak!' }
};
