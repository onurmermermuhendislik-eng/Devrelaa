#!/usr/bin/env node
// ALTEZ MiniLab - RELEASE ASAMA KOPYASI. release/rules.json'daki dislama kurallariyla kaynak agaci temiz bir klasore kopyalar.
//   node scripts/release-stage.mjs <kaynak> <hedef(var olmamali)>
// Kaynak agaca YAZMAZ. Sembolik baglanti/ozel dosya bulursa durur. Cikti: kopyalanan ve dislanan oge listesi (stdout).
import { readFileSync, readdirSync, lstatSync, mkdirSync, copyFileSync, existsSync, chmodSync } from 'node:fs';
import { join, resolve, relative, sep, dirname } from 'node:path';

const [srcArg, dstArg] = process.argv.slice(2);
if (!srcArg || !dstArg) { console.error('kullanim: release-stage.mjs <kaynak> <hedef>'); process.exit(2); }
const SRC = resolve(srcArg), DST = resolve(dstArg);
if (existsSync(DST)) { console.error('HATA: hedef zaten var: ' + DST); process.exit(1); }
if (DST === SRC || DST.startsWith(SRC + sep) || SRC.startsWith(DST + sep)) { console.error('HATA: hedef kaynakla ic ice olamaz'); process.exit(1); }
const rules = JSON.parse(readFileSync(join(SRC, 'release/rules.json'), 'utf8'));
const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
const gl = rules.excludeGlobs.map(globRe), allow = rules.allowedDespiteGlobs.map(globRe);
const exName = (n, d) => d ? rules.excludeDirNames.includes(n) : (rules.excludeFileNames.includes(n) || (gl.some((r) => r.test(n)) && !allow.some((r) => r.test(n))));
const exPath = (r) => rules.excludePaths.some((p) => r === p || r.startsWith(p + '/'));
let copied = 0; const excluded = [];
mkdirSync(DST, { recursive: true, mode: 0o755 });
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name), rel = relative(SRC, full).split(sep).join('/'), st = lstatSync(full);
    if (st.isSymbolicLink()) { console.error('HATA: sembolik baglanti pakete alinmaz: ' + rel); process.exit(1); }
    const d = st.isDirectory();
    if (exName(name, d) || exPath(rel)) { excluded.push(rel + (d ? '/' : '')); continue; }
    if (d) { mkdirSync(join(DST, rel), { recursive: true }); walk(full); }
    else if (st.isFile()) { mkdirSync(dirname(join(DST, rel)), { recursive: true }); copyFileSync(full, join(DST, rel)); chmodSync(join(DST, rel), st.mode & 0o755 | 0o644); copied++; }
    else { console.error('HATA: ozel dosya turu: ' + rel); process.exit(1); }
  }
})(SRC);
// V8.1.1: calistirilmasi gereken dosyalarin izni kalici (0755) olmali; kaynakta kaybolmus olsa bile asamada duzeltilir.
for (const f of ['android/gradlew', 'install-and-build.sh']) { const p = join(DST, f); if (existsSync(p)) chmodSync(p, 0o755); }
if (existsSync(join(DST, 'scripts'))) for (const n of readdirSync(join(DST, 'scripts'))) if (n.endsWith('.sh')) chmodSync(join(DST, 'scripts', n), 0o755);
if (existsSync(join(DST, 'android/gradlew')) && (lstatSync(join(DST, 'android/gradlew')).mode & 0o111) !== 0o111) { console.error('HATA: android/gradlew asamada calistirilabilir yapilamadi'); process.exit(1); }
console.log(`kopyalanan: ${copied} dosya`);
console.log(`dislanan (${excluded.length}):`); excluded.forEach((e) => console.log('  - ' + e));
