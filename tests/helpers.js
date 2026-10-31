import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export function loadData() {
  const manifest = load('assets/manifest.json');
  return {
    manifest,
    shapes: load(manifest.data.shapes),
    colors: load(manifest.data.colors),
    circuits: load(manifest.data.circuits),
    strings: load(manifest.data.strings),
    levels: load(manifest.data.levels).levels,
    figures: load(manifest.data.figures),
    game: Object.fromEntries(Object.entries(manifest.gameData || {}).map(([id, p]) => [id, load(p)]))
  };
}
