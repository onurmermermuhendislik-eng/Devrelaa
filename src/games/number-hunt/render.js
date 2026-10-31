// Sayi Avi cizimi: yapisal tanimlar (rounds.js) -> HTML metni. Nesne gorselleri assets/numbers/objects/*.svg dosyalarindan gelir.
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const fileOf = (nh, id) => nh.objects.find((o) => o.id === id).file;

// 4-5 yas: buyuk nesneler (en fazla 3 sutun). 6-8 yas: 5'erli siralar (sayilmasi kolay)
export const colsFor = (n, band) => (band === '4-5' ? (n <= 3 ? n : n === 4 ? 2 : 3) : Math.min(n, 5));

// Tek nesne. state: '' | 'cnt' (dokununca sayilir) | 'crossed' | 'slot' | 'new'
function obj(nh, id, i, { cls = '', num = '' } = {}) {
  const img = cls.includes('slot') ? '' : `<img src="${esc(fileOf(nh, id))}" alt="" draggable="false">`;
  return `<span class="obj ${cls}" style="--i:${i}">${img}<b class="bub">${num}</b></span>`;
}

function grid(nh, band, items, n) {
  return `<div class="nh-grid" style="--cols:${colsFor(n, band)}">${items.join('')}</div>`;
}

export function promptHtml(nh, spec, band) {
  const solved = spec.solved ? ' solved' : '';
  switch (spec.type) {
    case 'objects': {
      const items = Array.from({ length: spec.count }, (_, i) => obj(nh, spec.object, i, { cls: 'cnt', num: spec.solved ? i + 1 : '' }));
      return `<div class="nh-scene${solved}">${grid(nh, band, items, spec.count)}</div>`;
    }
    case 'numeral':
      return `<div class="nh-scene${solved}"><span class="nh-big">${spec.value}</span></div>`;
    case 'target':
      return `<div class="nh-scene${solved}"><div class="nh-target"><span class="nh-big">${spec.count}</span><img class="nh-icon" src="${esc(fileOf(nh, spec.object))}" alt="" draggable="false"></div></div>`;
    case 'slots': {
      const was = spec.was ?? spec.filled;
      const items = Array.from({ length: spec.total }, (_, i) =>
        i < was ? obj(nh, spec.object, i, { cls: 'cnt' }) : spec.filled > i ? obj(nh, spec.object, i, { cls: 'new' }) : obj(nh, spec.object, i, { cls: 'slot' })
      );
      return `<div class="nh-scene${solved}">${grid(nh, band, items, spec.total)}</div>`;
    }
    case 'seq': {
      const cells = spec.items
        .map((v, i) =>
          v === null
            ? '<span class="cell hole" data-role="hole"><b>?</b></span>'
            : `<span class="cell${spec.solved && i === spec.hole ? ' solved-piece' : ''}">${v}</span>`
        )
        .join('');
      return `<div class="nh-scene${solved}"><div class="nh-seq">${cells}</div></div>`;
    }
    case 'sum': {
      let k = 0;
      const mk = (n) => Array.from({ length: n }, () => obj(nh, spec.object, k, { cls: 'cnt', num: spec.solved ? ++k : (k++, '') }));
      const A = grid(nh, band, mk(spec.a), spec.a);
      const B = grid(nh, band, mk(spec.b), spec.b);
      const res = spec.solved ? `<span class="cell solved-piece">${spec.result}</span>` : '<span class="cell hole" data-role="hole"><b>?</b></span>';
      return `<div class="nh-scene nh-sum${solved}">${A}<b class="op">+</b>${B}<b class="op">=</b>${res}</div>`;
    }
    case 'take': {
      let k = 0;
      const items = Array.from({ length: spec.total }, (_, i) => {
        const gone = i >= spec.total - spec.away;
        return obj(nh, spec.object, i, { cls: gone ? 'crossed' : 'cnt', num: !gone && spec.solved ? ++k : '' });
      });
      return `<div class="nh-scene${solved}">${grid(nh, band, items, spec.total)}</div>`;
    }
    default:
      throw new Error(`Bilinmeyen sayi avi cizimi: ${spec.type}`);
  }
}

export function optionHtml(nh, view, band) {
  if (view.type === 'numeral') {
    const dots = view.dots ? `<span class="dots">${'<i></i>'.repeat(view.value)}</span>` : '';
    return `<span class="numeral">${view.value}</span>${dots}`;
  }
  const items = Array.from({ length: view.count }, (_, i) => obj(nh, view.object, i));
  const cols = view.count <= 3 ? view.count : view.count === 4 ? 2 : view.count <= 6 ? 3 : 5;
  void band;
  return `<span class="nh-grid mini" style="--cols:${cols}">${items.join('')}</span>`;
}
