// Sahne (Scene) -> SVG metni. Sekiller kod icine gomulu degil: geometri assets/data/shapes.json'dan gelir.
import { toPath, fmt } from './geometry.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function sceneToSvg(scene, cls = 'scene') {
  const [x, y, w, h] = scene.vb;
  const body = scene.items
    .map((it) => {
      if (it.text !== undefined) {
        return `<text class="${it.cls || ''}" x="${fmt(it.x)}" y="${fmt(it.y)}" font-size="${it.size || 20}" text-anchor="middle" dominant-baseline="central">${esc(it.text)}</text>`;
      }
      const klass = [it.cls, it.dash ? 'dashed' : ''].filter(Boolean).join(' ');
      return `<path class="${klass}" d="${toPath(it.geom)}" fill="${it.fill || 'none'}"${it.role ? ` data-role="${it.role}"` : ''}/>`;
    })
    .join('');
  return `<svg class="${cls}" viewBox="${x} ${y} ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
}
