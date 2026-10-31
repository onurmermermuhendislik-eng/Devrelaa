// V8.4 Ses satirlari envanteri: uygulamanin SESLI okuyabilecegi tum sabit cumleler (Macera gorev/odul/market metinleri + sabit yonergeler).
// Cikti: assets/data/voice-lines.json (uretilmis dosya; testler guncel olup olmadigini denetler). Kullanim:
//   node scripts/voice-lines.mjs          -> dosyayi yeniden yazar
//   node scripts/voice-lines.mjs --check  -> guncel degilse cikis kodu 1
// MP3 dosya adi: Macera cumleleri `assets/sounds/voice/adv_<hash>.mp3` (hash = cumle metninden, src/core/voicekey.js); sabit yonergeler
// (strings.tr.json > voice) `assets/sounds/voice/<anahtar>.mp3` (manifest.voice[<anahtar>]). {n} gibi degisken iceren cumleler MP3 DEGIL, cihaz TTS'idir.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineKey, normalizeLine } from '../src/core/voicekey.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rd = async (p) => JSON.parse(await readFile(resolve(root, p), 'utf8'));
const DIR = 'assets/sounds/voice';

export async function collectLines() {
  const adv = await rd('assets/data/adventure.json');
  const strings = await rd('assets/data/strings.tr.json');
  const manifest = await rd('assets/manifest.json');
  const out = [];
  const seen = new Map();
  const add = (kind, key, text, source) => {
    const t = normalizeLine(text);
    if (!t || /\{\w+\}/.test(t)) return; // degisken iceren cumle: TTS
    if (seen.has(key)) {
      if (seen.get(key) !== t) throw new Error(`anahtar cakismasi: ${key} (${seen.get(key)} / ${t})`);
      return;
    }
    seen.set(key, t);
    out.push({ key, kind, text: t, source, file: `${DIR}/${key}.mp3` });
  };
  const advLine = (text, source) => add('adv', lineKey(text), text, source);
  const T = adv.text;
  // Macera ortak cumleleri
  for (const k of ['rewardTitle', 'finalTitle', 'tryAgain', 'boardWin']) advLine(T[k], `adventure.text.${k}`);
  for (const r of adv.regions) if (r.finalTitle) advLine(r.finalTitle, `adventure.regions.${r.id}.finalTitle`);
  // Gorevler
  for (const t of adv.tasks) {
    const s = `adventure.tasks.${t.id}`;
    advLine(t.say, `${s}.say`);
    if (t.win) advLine(t.win, `${s}.win`);
    if (t.learn) advLine(t.learn, `${s}.learn`);
    if (t.hint) advLine(t.hint, `${s}.hint`);
    for (const [k, v] of Object.entries(t.hints || {})) advLine(v, `${s}.hints.${k}`);
    (t.rounds || []).forEach((r, i) => ['say', 'learn', 'hint'].forEach((k) => r[k] && advLine(r[k], `${s}.rounds[${i}].${k}`)));
    (t.scenes || []).forEach((r, i) => ['learn', 'hint'].forEach((k) => r[k] && advLine(r[k], `${s}.scenes[${i}].${k}`)));
    (t.spots || []).forEach((r, i) => r.say && advLine(r.say, `${s}.spots[${i}].say`)); // V8.5 Karanlik Ev kesif cumleleri
    if (t.next) advLine(t.next, `${s}.next`);
  }
  // Enerji Marketi
  for (const k of ['say', 'sayBought', 'sayNo', 'already']) advLine(adv.market.text[k], `adventure.market.text.${k}`);
  // Sabit yonergeler (voice.say(<anahtar>)): yalniz manifest'te anahtari olanlar
  for (const [k, v] of Object.entries(strings.voice || {})) if (k in (manifest.voice || {})) add('named', k, v, `strings.voice.${k}`);
  return out;
}

const file = resolve(root, 'assets/data/voice-lines.json');
// `file` alani JSON'a YAZILMAZ (yol bicimli dizgeler preflight'ta "varlik yolu" sayilir; dosya henuz uretilmemis olabilir). Yol = assets/sounds/voice/<key>.mp3
const render = (lines) => JSON.stringify({ note: 'Uretilmis dosya: node scripts/voice-lines.mjs. El ile DEGISTIRME. MP3 yolu: assets/sounds/voice/<key>.mp3', voice: 'CAGLAYAN', count: lines.length, lines: lines.map(({ file, ...rest }) => rest) }, null, 2) + '\n';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lines = await collectLines();
  const text = render(lines);
  if (process.argv.includes('--check')) {
    const cur = await readFile(file, 'utf8').catch(() => '');
    if (cur !== text) {
      console.error('voice-lines.json guncel degil: node scripts/voice-lines.mjs');
      process.exit(1);
    }
    console.log(`voice-lines.json guncel (${lines.length} satir)`);
  } else {
    await writeFile(file, text);
    console.log(`voice-lines.json yazildi (${lines.length} satir: ${lines.filter((l) => l.kind === 'adv').length} macera, ${lines.filter((l) => l.kind === 'named').length} sabit yonerge)`);
  }
}
