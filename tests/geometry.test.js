import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { area, contains, bbox, silhouetteKey, toPath, centered } from '../src/games/shape-complete/geometry.js';
import { createRng } from '../src/core/rng.js';

const { shapes } = loadData().shapes;

test('her bolumleme: parca alanlari toplami = sekil alani', () => {
  for (const [name, s] of Object.entries(shapes)) {
    for (const [part, cuts] of Object.entries(s.partitions)) {
      cuts.forEach((pieces, ci) => {
        const sum = pieces.reduce((t, p) => t + area(p.geom), 0);
        assert.ok(Math.abs(sum - area(s.outline)) < 0.05, `${name}/${part}#${ci}: ${sum} != ${area(s.outline)}`);
      });
    }
  }
});

test('her bolumleme: her nokta tam olarak bir parcaya ait (ortusme/bosluk yok)', () => {
  const rng = createRng(7);
  for (const [name, s] of Object.entries(shapes)) {
    for (const [part, cuts] of Object.entries(s.partitions)) {
      cuts.forEach((pieces, ci) => {
        for (let i = 0; i < 4000; i++) {
          const x = rng.next() * 100;
          const y = rng.next() * 100;
          const hits = pieces.filter((p) => contains(p.geom, x, y)).length;
          const inside = contains(s.outline, x, y);
          assert.equal(hits, inside ? 1 : 0, `${name}/${part}#${ci} @ ${x.toFixed(2)},${y.toFixed(2)} -> ${hits}`);
        }
      });
    }
  }
});

test('tum geometri 0..100 kutusunun icinde', () => {
  for (const s of Object.values(shapes)) {
    for (const g of [s.outline, ...Object.values(s.partitions).flat(2).map((p) => p.geom)]) {
      const b = bbox(g);
      assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 100 && b.y1 <= 100, JSON.stringify(b));
    }
  }
});

test('siluet anahtari: kare sol/sag yarim ayni, daire sol/sag yarim farkli', () => {
  const sq = Object.fromEntries(shapes.square.partitions.half.flat().map((p) => [p.id, p.geom]));
  assert.equal(silhouetteKey(sq.left), silhouetteKey(sq.right));
  assert.notEqual(silhouetteKey(sq.left), silhouetteKey(sq.top)); // dikey vs yatay dikdortgen
  const ci = Object.fromEntries(shapes.circle.partitions.half.flat().map((p) => [p.id, p.geom]));
  assert.notEqual(silhouetteKey(ci.left), silhouetteKey(ci.right));
  assert.notEqual(silhouetteKey(ci.top), silhouetteKey(ci.bottom));
});

test('ortalama konum degistirir ama siluet anahtari ayni kalir', () => {
  for (const s of Object.values(shapes)) {
    for (const p of Object.values(s.partitions).flat(2)) {
      assert.equal(silhouetteKey(centered(p.geom)), silhouetteKey(p.geom));
    }
  }
});

test('SVG yolu uretilir ve NaN icermez', () => {
  for (const s of Object.values(shapes)) {
    for (const g of [s.outline, ...Object.values(s.partitions).flat(2).map((p) => p.geom)]) {
      const d = toPath(g);
      assert.ok(d.startsWith('M') && d.endsWith('Z') && !d.includes('NaN'), d);
    }
  }
});
