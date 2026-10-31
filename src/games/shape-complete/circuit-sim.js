// Cocuk seviyesinde, saf mantik devre benzetimi (DOM yok).
// parts: [{id,type,a,b,state}]  type: wire|battery|led|resistor|switch|null(bos konum)
// Pil: a = eksi uc, b = arti uc. Akim arti uctan cikar, devreyi dolasip eksi uca doner.

export function conducts(part) {
  if (!part.type) return false;
  if (part.type === 'switch') return part.state === 'closed';
  return true;
}

// Parlaklik duzeyi: 0 sonuk, 1 cok soluk, 2 soluk, 3 tam parlak (CSS bu duzeylere gore cizer)
export function brightnessLevel(b) {
  if (b <= 0) return 0;
  if (b < 0.35) return 1;
  if (b < 0.9) return 2;
  return 3;
}

export function simulate(parts) {
  const battery = parts.find((p) => p.type === 'battery');
  const leds = {};
  for (const p of parts) if (p.type === 'led') leds[p.id] = 0;
  const result = { closed: false, leds, levels: {}, flows: {}, paths: 0 };
  if (battery) {
    const adj = {};
    for (const p of parts) {
      if (p === battery || !conducts(p)) continue;
      (adj[p.a] ||= []).push({ part: p, other: p.b });
      (adj[p.b] ||= []).push({ part: p, other: p.a });
    }
    const paths = [];
    const dfs = (node, visited, edges, nodes) => {
      if (node === battery.a) {
        paths.push({ edges: edges.slice(), nodes: nodes.slice() });
        return;
      }
      for (const { part, other } of adj[node] || []) {
        if (visited.has(other)) continue;
        visited.add(other);
        edges.push(part);
        nodes.push(other);
        dfs(other, visited, edges, nodes);
        edges.pop();
        nodes.pop();
        visited.delete(other);
      }
    };
    dfs(battery.b, new Set([battery.b]), [], [battery.b]);

    result.paths = paths.length;
    result.closed = paths.length > 0;
    for (const path of paths) {
      const ledCount = path.edges.filter((e) => e.type === 'led').length;
      const hasResistor = path.edges.some((e) => e.type === 'resistor');
      path.edges.forEach((part, i) => {
        if (part.type === 'led') {
          const b = (1 / Math.pow(ledCount, 0.8)) * (hasResistor ? 0.92 : 1);
          leds[part.id] = Math.max(leds[part.id], b);
        }
        if (!(part.id in result.flows)) result.flows[part.id] = part.a === path.nodes[i] ? 'ab' : 'ba';
      });
    }
    if (result.closed) result.flows[battery.id] = 'ab'; // pil icinde akim eksiden artiya
  }
  for (const id of Object.keys(leds)) result.levels[id] = brightnessLevel(leds[id]);
  return result;
}

export const litCount = (res) => Object.values(res.levels).filter((l) => l > 0).length;
