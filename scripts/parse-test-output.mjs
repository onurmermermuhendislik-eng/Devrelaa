#!/usr/bin/env node
// V8.2 Test sonucu ayristirici (install-and-build.sh kullanir). Tek bir cikti bicimine BAGLI DEGILDIR:
//   unit: node:test TAP ("# tests N" / "# pass N" / "# fail N") ve spec ("ℹ tests N" ...) bicimleri
//   ui:   "N/N kontrol basarili", "V8.x UI: N/N gecti[, M BASARISIZ]", "N/N passed"; ayrica "FAIL ..." satirlari sayilir
// Cikti (stdout): "<gecen> <toplam> <basarisiz>"   Cikis: 0 = ayristirildi, 2 = sonuc satiri taninmadi (BASARI SAYILMAZ).
//   node scripts/parse-test-output.mjs unit|ui <log>
import { readFileSync } from 'node:fs';

export function parseUnit(text) {
  const g = (k) => {
    const m = [...text.matchAll(new RegExp(`^(?:#|ℹ)\\s+${k}\\s+(\\d+)`, 'gm'))].pop();
    return m ? Number(m[1]) : null;
  };
  const total = g('tests'), pass = g('pass'), fail = g('fail');
  if (total === null || pass === null || fail === null) return null;
  return { pass, total, fail };
}
export function parseUi(text) {
  const ms = [...text.matchAll(/(\d+)\s*\/\s*(\d+)\s*(?:kontrol\s+basarili|gecti|passed|ok)\b/gi)];
  if (!ms.length) return null;
  const m = ms.at(-1);
  const failLines = (text.match(/^\s*(?:FAIL|HATA)\b/gm) || []).length;
  const sumFail = Number((text.match(/(\d+)\s+BASARISIZ/i) || [])[1] || 0);
  return { pass: Number(m[1]), total: Number(m[2]), fail: Math.max(failLines, sumFail, Number(m[2]) - Number(m[1])) };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const [kind, file] = process.argv.slice(2);
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { console.error('log okunamadi: ' + file); process.exit(2); }
  const r = kind === 'unit' ? parseUnit(text) : parseUi(text);
  if (!r) { console.error('sonuc satiri taninmadi (' + kind + ')'); process.exit(2); }
  console.log(`${r.pass} ${r.total} ${r.fail}`);
}
