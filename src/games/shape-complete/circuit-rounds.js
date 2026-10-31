// Devre bolumlerinin (stage) tur uretimi ve ilerleme mantigi (saf, DOM yok).
import { simulate } from './circuit-sim.js';

export const stagesFor = (data, band) => data.circuits.stages.filter((s) => s.bands.includes(band));
export const playsFor = (data, band) => data.circuits.playsPerStage[band] ?? 1;
export const initialCircuitState = () => ({ stage: 0, plays: 0 });

// Bir bolum tamamlaninca ilerleme: yeterince oynanirsa siradaki bolume gec.
// stage === bolum sayisi  =>  hepsi tamamlandi (rastgele tekrar).
export function advanceCircuit(state, data, band) {
  const total = stagesFor(data, band).length;
  let { stage, plays } = state;
  if (stage >= total) return { stage: total, plays: 0 };
  plays += 1;
  if (plays >= playsFor(data, band)) {
    stage += 1;
    plays = 0;
  }
  return { stage, plays };
}

export function makeCircuitRound({ data, rng, band, circuitState }) {
  const stages = stagesFor(data, band);
  const idx = circuitState.stage >= stages.length ? rng.int(stages.length) : circuitState.stage;
  const stage = stages[idx];
  const parts = stage.parts.map((p) => ({ ...p, state: p.type === 'switch' ? 'open' : undefined }));
  const slots = parts.filter((p) => !p.type).map((p) => ({ id: p.id, accepts: p.accepts }));
  const types = [...new Set([...slots.map((s) => s.accepts), ...stage.options])];
  const options = rng.shuffle(types).map((type, i) => ({ id: `t${i}`, type }));
  // Her LED farkli renkte (ayni bolumde iki LED varsa ayirt edilsin)
  const palette = data.colors.ledColors;
  const start = rng.int(palette.length);
  const ledColors = {};
  parts
    .filter((p) => p.type === 'led' || p.accepts === 'led')
    .forEach((p, i) => {
      ledColors[p.id] = palette[(start + i) % palette.length];
    });
  return {
    id: `circuit:${stage.id}`,
    kind: 'circuit',
    voice: parts.some((p) => p.fault) ? 'circuit_fix' : slots.length === 1 ? `circuit_${slots[0].accepts}` : 'circuit_multi',
    stageId: stage.id,
    stageIndex: idx,
    nodes: data.circuits.layouts[stage.layout],
    viewBox: data.circuits.viewBox,
    parts,
    slots,
    options,
    ledColors,
    silhouette: !!stage.silhouette,
    finish: stage.finish,
    startPowered: !!stage.startPowered
  };
}

// Tum konumlar dogru dolduruldu mu?
export const allFilled = (round) => round.slots.every((s) => round.parts.find((p) => p.id === s.id).type);

// Devre tamam mi? (anahtar bolumunde anahtar da kapatilmis olmali)
export function isComplete(round) {
  if (!allFilled(round)) return false;
  if (round.finish === 'switch' && round.parts.some((p) => p.type === 'switch' && p.state !== 'closed')) return false;
  const res = simulate(round.parts);
  return res.closed && Object.values(res.levels).every((l) => l > 0);
}
