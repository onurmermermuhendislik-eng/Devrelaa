#!/usr/bin/env node
// ALTEZ MiniLab - RELEASE PREFLIGHT (Kalici Surum Teslim Standardi). TEK denetim mekanizmasi; hic bagimliligi yok.
//   node scripts/preflight.mjs [kok-klasor] [--ship] [--json dosya] [--inventory-md dosya]
// --ship : kok klasor ZIP'e girecek icerigi temsil eder; dislanmasi gereken HICBIR dosya/klasor bulunmamali (sizinti = HATA).
// Cikis: 0 = tum denetimler gecti | 1 = en az bir HATA (ZIP/APK asamasina GECILMEZ)
// Eksik dosyayi bos/sahte icerikle tamamlamaz; yalnizca bildirir.
import { readFileSync, readdirSync, statSync, lstatSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, relative, sep, basename, extname } from 'node:path';
import { builtinModules } from 'node:module';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const skipVals = new Set([opt('--json'), opt('--inventory-md')].filter(Boolean));
const ROOT = resolve(args.find((a) => !a.startsWith('--') && !skipVals.has(a)) || '.');
const SHIP = flag('--ship');
const results = []; let fails = 0, warns = 0;
const ok = (m) => { results.push(['OK', m]); console.log('  OK    ' + m); };
const bad = (m) => { fails++; results.push(['FAIL', m]); console.log('  HATA  ' + m); };
const warn = (m) => { warns++; results.push(['WARN', m]); console.log('  UYARI ' + m); };
const head = (m) => console.log('\n-- ' + m);
const P = (...a) => join(ROOT, ...a);
const rd = (f) => readFileSync(P(f), 'utf8');
const readJson = (f) => { try { return JSON.parse(rd(f)); } catch (e) { return null; } };

// -------- kurallar --------
const rules = readJson('release/rules.json'), feats = readJson('release/features.json');
if (!rules || !feats) { console.log('HATA  release/rules.json veya release/features.json okunamadi/gecersiz'); process.exit(1); }

const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
const excludeGlobs = rules.excludeGlobs.map(globRe), allowRe = rules.allowedDespiteGlobs.map(globRe);
const isExcludedName = (name, isDir) => isDir ? rules.excludeDirNames.includes(name)
  : (rules.excludeFileNames.includes(name) || (excludeGlobs.some((r) => r.test(name)) && !allowRe.some((r) => r.test(name))));
const isExcludedPath = (rel) => rules.excludePaths.some((p) => rel === p || rel.startsWith(p + '/'));

// -------- agac --------
const files = [], leaks = [], nonRegular = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name), rel = relative(ROOT, full).split(sep).join('/');
    const st = lstatSync(full);
    if (st.isSymbolicLink()) { nonRegular.push(rel); continue; }
    const isDir = st.isDirectory();
    if (isExcludedName(name, isDir) || isExcludedPath(rel)) { if (SHIP) leaks.push(rel); continue; }
    if (isDir) walk(full); else if (st.isFile()) files.push(rel); else nonRegular.push(rel);
  }
})(ROOT);
const fileSet = new Set(files);

// tam yol, buyuk/kucuk harfe duyarli varlik denetimi (hedef Linux)
function existsExact(abs) {
  const rel = relative(ROOT, abs); if (rel.startsWith('..')) return false;
  let cur = ROOT;
  for (const part of rel.split(sep)) { if (!part) continue; let ents; try { ents = readdirSync(cur); } catch { return false; } if (!ents.includes(part)) return false; cur = join(cur, part); }
  return true;
}
const exists = (rel) => existsExact(P(rel));

// ===== 1. Zorunlu dosyalar =====
head('1. Zorunlu dosyalar');
{ const miss = rules.required.filter((f) => !exists(f)); miss.length ? miss.forEach((f) => bad('zorunlu dosya eksik: ' + f)) : ok(`${rules.required.length} zorunlu dosya mevcut`);
  for (const f of rules.required) if (exists(f) && statSync(P(f)).size === 0) bad('zorunlu dosya BOS: ' + f); }

// ===== 2. Yerel import / modul referanslari =====
head('2. Yerel import ve modul referanslari');
const pkg = readJson('package.json'), lock = readJson('package-lock.json');
const declared = new Set([...Object.keys((pkg && pkg.dependencies) || {}), ...Object.keys((pkg && pkg.devDependencies) || {}), ...(rules.externalTestPackages || [])]);
const builtins = new Set([...builtinModules, ...builtinModules.map((m) => 'node:' + m)]);
{
  const jsFiles = files.filter((f) => /\.(m?js)$/.test(f) && /^(src|scripts|tests)\//.test(f));
  const reA = /(?:^|[\s;{}()])(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"\n]+)['"]/g, reB = /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g;
  let n = 0, errs = 0;
  for (const f of jsFiles) {
    const src = rd(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
    for (const re of [reA, reB]) { re.lastIndex = 0; let m;
      while ((m = re.exec(src))) { const spec = m[1]; n++;
        if (spec.startsWith('./') || spec.startsWith('../')) { const tgt = resolve(dirname(P(f)), spec); if (!existsExact(tgt)) { bad(`${f}: import cozumlenemiyor (dosya yok / harf buyuklugu): ${spec}`); errs++; } }
        else if (spec.startsWith('/')) { if (f.startsWith('src/')) { bad(`${f}: mutlak import yolu: ${spec}`); errs++; } /* scripts/tests: tarayici sayfasina giden dizge olabilir */ }
        else if (f.startsWith('src/')) { bad(`${f}: tarayici kodunda bare import (paketleyici yok): ${spec}`); errs++; }
        else { const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
          if (!spec.startsWith('node:') && !builtins.has(spec) && !builtins.has(name) && !declared.has(name)) { bad(`${f}: bildirilmemis paket importu: ${spec}`); errs++; } } } }
  }
  if (!errs) ok(`${jsFiles.length} betik/kaynak dosyasinda ${n} import cozumlendi`);
  // index.html ve CSS url()
  const refBad = [];
  const checkRef = (from, ref) => { if (!ref || /^(https?:|data:|#|mailto:|\/\/)/.test(ref)) return; const clean = ref.split(/[?#]/)[0]; if (!clean) return; if (!existsExact(resolve(dirname(P(from)), clean))) refBad.push(`${from}: ${ref}`); };
  if (exists('index.html')) for (const m of rd('index.html').matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) checkRef('index.html', m[1]);
  for (const f of files.filter((x) => x.endsWith('.css'))) for (const m of rd(f).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) checkRef(f, m[1]);
  refBad.length ? refBad.forEach((r) => bad('baglanti cozumlenemiyor: ' + r)) : ok('index.html ve CSS yerel baglantilari cozumlendi');
}

// ===== 3. JSON / yapilandirma / varlik yollari =====
head('3. JSON, yapilandirma ve varlik yollari');
{
  const jsons = files.filter((f) => f.endsWith('.json')); let badJ = 0;
  const assetStrings = [];
  for (const f of jsons) { let j; try { j = JSON.parse(rd(f)); } catch (e) { bad(`gecersiz JSON: ${f} (${e.message.slice(0, 80)})`); badJ++; continue; }
    if (f.startsWith('assets/')) (function w(v) { if (typeof v === 'string') { if (/^assets\/[^\s]+\.[A-Za-z0-9]+$/.test(v)) assetStrings.push([f, v]); } else if (Array.isArray(v)) v.forEach(w); else if (v && typeof v === 'object') Object.values(v).forEach(w); })(j); }
  if (!badJ) ok(`${jsons.length} JSON dosyasi gecerli`);
  const missA = assetStrings.filter(([, v]) => !exists(v)); missA.forEach(([f, v]) => bad(`${f}: varlik yolu yok: ${v}`));
  if (!missA.length) ok(`${assetStrings.length} varlik yolu (JSON icinde) mevcut`);
  const man = readJson('assets/manifest.json');
  if (man && man.gameData) { const m = Object.entries(man.gameData).filter(([, v]) => !exists(v)); m.forEach(([k, v]) => bad(`manifest.gameData.${k}: ${v} yok`)); if (!m.length) ok('manifest.gameData girdileri mevcut'); }
  const cc = readJson('capacitor.config.json');
  if (cc) { cc.webDir === 'www' ? ok('capacitor.config.json webDir=www') : bad('capacitor.config.json webDir www degil: ' + cc.webDir); } else bad('capacitor.config.json okunamadi');
}

// ===== 4. package.json / package-lock.json uyumu =====
head('4. package.json <-> package-lock.json');
{
  if (!pkg || !lock) bad('package.json veya package-lock.json okunamadi');
  else {
    const root = (lock.packages && lock.packages['']) || {};
    lock.lockfileVersion >= 2 ? ok('lockfileVersion ' + lock.lockfileVersion) : bad('lockfileVersion < 2');
    lock.name === pkg.name && root.name === pkg.name ? ok('ad uyumlu: ' + pkg.name) : bad(`ad uyumsuz (package.json ${pkg.name}, lock ${lock.name}/${root.name})`);
    lock.version === pkg.version && root.version === pkg.version ? ok('surum uyumlu: ' + pkg.version) : bad(`surum uyumsuz (package.json ${pkg.version}, lock ${lock.version}/${root.version})`);
    for (const k of ['dependencies', 'devDependencies']) { const a = pkg[k] || {}, b = root[k] || {};
      const same = JSON.stringify(Object.keys(a).sort().map((x) => [x, a[x]])) === JSON.stringify(Object.keys(b).sort().map((x) => [x, b[x]]));
      same ? ok(`${k}: lock koku ile ayni (${Object.keys(a).length})`) : bad(`${k}: package.json ile lock koku FARKLI -> 'npm install' ile kilit guncellenmeli (npm ci basarisiz olur)`); }
    const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [n, range] of Object.entries(all)) { const e = lock.packages['node_modules/' + n];
      if (!e) { bad(`lock'ta paket yok: ${n}`); continue; }
      if (/^\d+\.\d+\.\d+$/.test(range) && e.version !== range) bad(`lock surumu ${n}: ${e.version} != ${range}`);
      if (!e.resolved && !e.link) warn(`lock girdisinde resolved yok: ${n}`); }
    for (const n of rules.requiredPackages) (all[n] ? ok(`gerekli paket bildirilmis: ${n}@${all[n]}`) : bad(`gerekli paket package.json'da yok: ${n}`));
    if (!pkg.scripts || !pkg.scripts.test || !pkg.scripts.build) bad('package.json scripts.test / scripts.build eksik');
  }
}

// ===== 5. Surum / kimlik tutarliligi =====
head('5. Surum, versionCode, versionName, paket kimligi');
const ver = {};
if (exists('scripts/version.env')) for (const l of rd('scripts/version.env').split('\n')) { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) ver[m[1]] = m[2].trim(); }
{
  const need = ['APP_ID_DEFAULT', 'VERSION_CODE_DEFAULT', 'VERSION_NAME_DEFAULT', 'APK_NAME_DEFAULT', 'RELEASE_TAG'];
  const miss = need.filter((k) => !ver[k]); miss.forEach((k) => bad('version.env eksik anahtar: ' + k));
  if (!miss.length) {
    const tag = 'V' + ver.VERSION_NAME_DEFAULT.replace(/\.0$/, '');
    (ver.RELEASE_TAG === tag || /^V[0-9][0-9.]*-FIX[0-9]+$/.test(ver.RELEASE_TAG) && ver.RELEASE_TAG.startsWith(tag + '-FIX')) ? ok(`RELEASE_TAG=${ver.RELEASE_TAG} (surum ${tag}${ver.RELEASE_TAG === tag ? '' : ', FIX sürümü'})`) : bad(`RELEASE_TAG ${ver.RELEASE_TAG} != surumden turetilen ${tag} (veya ${tag}-FIX<n>)`);
    ver.APK_NAME_DEFAULT === `ALTEZ-MiniLab-${ver.RELEASE_TAG}.apk` ? ok('APK adi ' + ver.APK_NAME_DEFAULT) : bad('APK_NAME_DEFAULT beklenen ALTEZ-MiniLab-' + ver.RELEASE_TAG + '.apk degil');
    if (pkg) (String(pkg.version).startsWith(ver.VERSION_NAME_DEFAULT + '.') || pkg.version === ver.VERSION_NAME_DEFAULT) ? ok(`package.json surumu ${pkg.version} ~ ${ver.VERSION_NAME_DEFAULT}`) : bad(`package.json surumu ${pkg.version} version.env (${ver.VERSION_NAME_DEFAULT}) ile uyumsuz`);
    if (exists('android/app/build.gradle')) { const g = rd('android/app/build.gradle');
      const id = (g.match(/applicationId\s*=?\s*"([^"]+)"/) || [])[1], vc = (g.match(/versionCode\s*=?\s*(\d+)/) || [])[1], vn = (g.match(/versionName\s*=?\s*"([^"]+)"/) || [])[1];
      id === ver.APP_ID_DEFAULT ? ok('Gradle applicationId ' + id) : bad(`Gradle applicationId ${id} != ${ver.APP_ID_DEFAULT}`);
      vc === ver.VERSION_CODE_DEFAULT ? ok('Gradle versionCode ' + vc) : bad(`Gradle versionCode ${vc} != ${ver.VERSION_CODE_DEFAULT} (prepare-android.sh derleme sirasinda yazar; kaynakta da uyumlu olmali)`);
      vn === ver.VERSION_NAME_DEFAULT ? ok('Gradle versionName ' + vn) : bad(`Gradle versionName ${vn} != ${ver.VERSION_NAME_DEFAULT}`); }
    if (exists('assets/data/app-version.json')) { const av = readJson('assets/data/app-version.json');
      av && av.versionName === ver.VERSION_NAME_DEFAULT && String(av.versionCode) === ver.VERSION_CODE_DEFAULT && av.tag === ver.RELEASE_TAG ? ok('app-version.json (ekranda gorunen surum) version.env ile ayni: ' + av.tag) : bad('app-version.json version.env ile uyumsuz (node scripts/gen-version.mjs ile yeniden uretin)'); }
    else bad('assets/data/app-version.json yok (node scripts/gen-version.mjs)');
    const cc = readJson('capacitor.config.json'); if (cc && cc.appId !== ver.APP_ID_DEFAULT) warn(`capacitor.config.json appId (${cc.appId}) != applicationId (${ver.APP_ID_DEFAULT}); APK kimligini build.gradle belirler`);
  }
}

// ===== 6. Android / Capacitor =====
head('6. Android / Capacitor yapilandirmasi');
{
  const miss = rules.androidFiles.filter((f) => !exists(f)); miss.forEach((f) => bad('Android dosyasi eksik: ' + f));
  if (!miss.length) ok(`${rules.androidFiles.length} Android/Gradle giris dosyasi mevcut`);
  if (exists('android/gradlew') && statSync(P('android/gradlew')).size < 100) bad('android/gradlew bos/gecersiz');
  // V8.1.1: gradlew calistirilabilir (git modu 100755) olmali; 100644 paketlenirse sunucuda elle chmod gerekir.
  if (exists('android/gradlew')) (statSync(P('android/gradlew')).mode & 0o111) === 0o111 ? ok('android/gradlew calistirilabilir (0755)') : bad('android/gradlew calistirilabilir degil (chmod 755; ZIP 100644 paketlenir)');
  for (const [f, words] of Object.entries(rules.pluginEvidence)) if (exists(f)) { const t = rd(f); for (const w of words) t.includes(w) ? ok(`${f}: '${w}' eklentisi kayitli`) : bad(`${f}: '${w}' eklentisi kayitli degil (cap sync gerekir ve sonucu pakete girmeli)`); }
}

// ===== 7. Ozellik envanteri =====
head('7. Ozellik envanteri (kaynak + arayuz + veri + kayit + test)');
const inv = [];
{
  const usedTests = new Set();
  for (const ft of feats.features) {
    let okf = true;
    for (const k of ['sources', 'ui', 'data', 'tests']) for (const f of ft[k] || []) { if (!exists(f)) { bad(`[${ft.id}] ${k}: dosya yok: ${f}`); okf = false; } }
    if (!ft.sources.length || !ft.tests.length) { bad(`[${ft.id}] kaynak veya test eslesmesi bos`); okf = false; }
    for (const t of ft.tests) { usedTests.add(t); if (t.endsWith('.test.js') && exists(t) && !/\btest\(/.test(rd(t))) { bad(`[${ft.id}] ${t} test icermiyor`); okf = false; } }
    inv.push({ ...ft, ok: okf }); if (okf) ok(`ozellik tam: ${ft.id}`);
  }
  for (const t of files.filter((f) => /^tests\/.*\.test\.js$/.test(f))) if (!usedTests.has(t)) bad(`test dosyasi hicbir ozelligie bagli degil: ${t}`);
}

// ===== 8. Ornek yapilandirma ve gizli bilgi =====
head('8. Ornek yapilandirma, gizli bilgi, yol guvenligi');
{
  exists('.env.example') ? ok('.env.example mevcut') : bad('.env.example eksik');
  if (SHIP) { leaks.length ? leaks.forEach((l) => bad('ZIP\'e GIRMEMESI gereken oge: ' + l)) : ok('dislanmasi gereken hicbir oge yok (node_modules, www, local.properties, .env, anahtarlar, .v7-*, ...)'); }
  nonRegular.forEach((f) => bad('normal olmayan dosya (sembolik baglanti/ozel): ' + f));
  const textExt = new Set(['.js', '.mjs', '.json', '.md', '.sh', '.gradle', '.properties', '.xml', '.html', '.css', '.txt', '.env', '.example', '.yml', '.yaml', '.pro', '']);
  const pats = rules.secretPatterns.map((p) => new RegExp(p)); let hits = 0;
  for (const f of files) { if (rules.secretScanSkip.includes(f) || !textExt.has(extname(f)) || statSync(P(f)).size > 2_000_000) continue;
    const t = rd(f); for (const re of pats) if (re.test(t)) { bad(`olasi gizli bilgi (${re.source.slice(0, 30)}...): ${f}`); hits++; } }
  if (!hits) ok('metin dosyalarinda gizli anahtar/parola deseni yok');
  const low = new Map(); for (const f of files) { const k = f.toLowerCase(); if (low.has(k)) bad(`buyuk/kucuk harf cakismasi: ${f} <-> ${low.get(k)}`); else low.set(k, f); }
  const weird = files.filter((f) => /[\\\0\r\n]|^\s|\s$|\/\s|\s\//.test(f) || f.length > 200); weird.forEach((f) => bad('gecersiz dosya adi: ' + JSON.stringify(f)));
  if (!weird.length) ok(`${files.length} dosya yolu Linux icin gecerli ve benzersiz`);
}

// ===== 9. Betik sozdizimi (derlemeden once) =====
head('9. Betik ve kaynak sozdizimi');
{
  let n = 0, e = 0;
  for (const f of files) {
    let r = null;
    if (f.endsWith('.sh')) r = spawnSync('bash', ['-n', P(f)], { encoding: 'utf8' });
    else if (/\.m?js$/.test(f) && /^(src|scripts|tests)\//.test(f) && !f.startsWith('tests/fixtures/')) r = spawnSync(process.execPath, ['--check', P(f)], { encoding: 'utf8' });
    else if (f === 'install-and-build.sh') r = spawnSync('bash', ['-n', P(f)], { encoding: 'utf8' });
    else if (f.endsWith('.py') && f.startsWith('scripts/')) r = spawnSync('python3', ['-I', '-c', 'import sys; compile(open(sys.argv[1]).read(), sys.argv[1], "exec")', P(f)], { encoding: 'utf8' });
    if (!r) continue; n++;
    if (r.status !== 0) { e++; bad(`sozdizimi hatasi: ${f}: ${(r.stderr || '').split('\n')[0].slice(0, 120)}`); }
  }
  if (!e) ok(`${n} betik/kaynak dosyasinin sozdizimi gecerli`);
}

// -------- rapor --------
if (opt('--inventory-md')) {
  const md = ['| Ozellik | Devralinan | Kaynak | Arayuz | Veri | Kayit | Test | Durum |', '|---|---|---|---|---|---|---|---|',
    ...inv.map((f) => `| ${f.name} | ${f.inherited ? 'evet (regresyon)' : 'yeni'} | ${f.sources.length} | ${f.ui.length} | ${f.data.length} | ${f.storage} | ${f.tests.join(', ')} | ${f.ok ? 'tam' : 'EKSIK'} |`)];
  writeFileSync(opt('--inventory-md'), md.join('\n') + '\n');
}
if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify({ root: ROOT, ship: SHIP, files: files.length, fails, warns, results }, null, 1));
console.log(`\nPREFLIGHT: ${fails ? 'BASARISIZ' : 'GECTI'} (${files.length} dosya, ${fails} hata, ${warns} uyari)${SHIP ? ' [--ship]' : ''}`);
process.exit(fails ? 1 : 0);
