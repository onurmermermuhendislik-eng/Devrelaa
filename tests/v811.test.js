// V8.1.1: android/gradlew calistirilabilir izni KALICI (kaynak, asama, ZIP, betik kontrolleri, teslim dogrulamasi). Ozellik degisikligi yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const rd = (f) => readFileSync(join(ROOT, f), 'utf8');
const hasPy = spawnSync('python3', ['--version']).status === 0;

test('V8.2+ surum (V8.1.1 testinden genellendi): versionCode >= 22 / com.altez.minilab.v4 / APK adi ALTEZ-MiniLab-<tag>.apk (guncel surum tests/v82.test.js icinde sabitlenir)', () => {
  const env = rd('scripts/version.env');
  const g = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm'))[1];
  assert.match(g('VERSION_NAME_DEFAULT'), /^8\.\d+(\.\d+)?$/);
  assert.equal(g('RELEASE_TAG'), 'V' + g('VERSION_NAME_DEFAULT'));
  assert.ok(Number(g('VERSION_CODE_DEFAULT')) >= 22);
  assert.equal(g('APP_ID_DEFAULT'), 'com.altez.minilab.v4');
  assert.equal(g('APK_NAME_DEFAULT'), `ALTEZ-MiniLab-${g('RELEASE_TAG')}.apk`);
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionCode ${g('VERSION_CODE_DEFAULT')}\\b`));
  assert.match(JSON.parse(rd('package.json')).version, /^8\.\d+\.\d+$/);
});

test('kaynak agacta android/gradlew calistirilabilir (git modu 100755) ve betikler calistirilabilir', () => {
  for (const f of ['android/gradlew', 'install-and-build.sh', 'scripts/prepare-android.sh', 'scripts/pack-zip.py', 'scripts/verify-delivery.sh', 'scripts/release.sh']) {
    assert.equal(statSync(join(ROOT, f)).mode & 0o111, 0o111, f + ' calistirilabilir degil');
  }
});

test('install-and-build.sh ve prepare-android.sh Gradle oncesi gradlew varligini/izni kontrol eder; izin eksikse duzeltir ya da durur', () => {
  const ib = rd('install-and-build.sh');
  assert.match(ib, /\[ -x android\/gradlew \]/);
  assert.match(ib, /chmod \+x android\/gradlew/);
  assert.match(ib, /android\/gradlew mevcut ve calistirilabilir/);
  assert.ok(ib.indexOf('android/gradlew mevcut ve calistirilabilir') < ib.indexOf('./gradlew --rerun-tasks assembleDebug'), 'kontrol gradle cagrisindan once olmali');
  const pa = rd('scripts/prepare-android.sh');
  assert.match(pa, /-x android\/gradlew/);
  assert.match(pa, /bad "android\/gradlew/);
});

test('release.sh: temiz cikarimda test -x ve ZIP icinde 100755 zorunlu; chmod ile maskelenmez; preflight izni denetler; stage izni korur', () => {
  const rs = rd('scripts/release.sh');
  assert.match(rs, /\[ -x "\$CP\/android\/gradlew" \] \|\| die/);
  assert.doesNotMatch(rs, /chmod \+x "\$CP"[^\n]*gradlew/);
  assert.match(rs, /0o777 != 0o755/);
  assert.match(rd('scripts/preflight.mjs'), /android\/gradlew calistirilabilir/);
  assert.match(rd('scripts/release-stage.mjs'), /android\/gradlew/);
});

function fakeStage(mode) {
  const d = mkdtempSync(join(tmpdir(), 'alt811-'));
  const s = join(d, 'altez-minilab-test');
  mkdirSync(join(s, 'android'), { recursive: true });
  mkdirSync(join(s, 'scripts'), { recursive: true });
  writeFileSync(join(s, 'android/gradlew'), '#!/bin/sh\necho gradle\n'); chmodSync(join(s, 'android/gradlew'), mode);
  writeFileSync(join(s, 'install-and-build.sh'), '#!/bin/sh\n'); chmodSync(join(s, 'install-and-build.sh'), 0o755);
  writeFileSync(join(s, 'scripts/a.sh'), '#!/bin/sh\n');
  writeFileSync(join(s, 'README.md'), 'x\n');
  spawnSync('bash', ['-c', 'find . -type f ! -name MANIFEST.sha256 | sort | sed "s#^\\./##" | xargs -d "\\n" sha256sum > MANIFEST.sha256'], { cwd: s });
  return { d, s };
}

test('pack-zip.py: kaynakta gradlew 0644 olsa bile ZIP girdisi 100755; temiz cikarimda test -x gecer (verify-delivery.sh)', { skip: !hasPy }, () => {
  const { d, s } = fakeStage(0o644);
  try {
    const zip = join(d, 'out.zip');
    const p = spawnSync('python3', [join(ROOT, 'scripts/pack-zip.py'), s, zip], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr);
    const info = spawnSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);i=z.getinfo("altez-minilab-test/android/gradlew");print(oct((i.external_attr>>16)&0o777777))', zip], { encoding: 'utf8' });
    assert.equal(info.stdout.trim(), '0o100755');
    const v = spawnSync('bash', [join(ROOT, 'scripts/verify-delivery.sh'), zip], { encoding: 'utf8' });
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.match(v.stdout, /OK\s+test -x android\/gradlew/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('verify-delivery.sh: gradlew 100644 paketlenmis bir ZIP TESLIM DOGRULAMASINDA BASARISIZ olur (teslim durur)', { skip: !hasPy }, () => {
  const { d, s } = fakeStage(0o755);
  try {
    const zip = join(d, 'bad.zip');
    const mk = spawnSync('python3', ['-c', `
import zipfile,os,sys
s,out=sys.argv[1],sys.argv[2]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for dp,_,fs in os.walk(s):
        for f in fs:
            p=os.path.join(dp,f); rel=os.path.relpath(p,os.path.dirname(s))
            zi=zipfile.ZipInfo(rel,(2026,1,1,0,0,0)); zi.create_system=3; zi.external_attr=0o100644<<16
            z.writestr(zi,open(p,'rb').read())
`, s, zip], { encoding: 'utf8' });
    assert.equal(mk.status, 0, mk.stderr);
    const v = spawnSync('bash', [join(ROOT, 'scripts/verify-delivery.sh'), zip], { encoding: 'utf8' });
    assert.notEqual(v.status, 0);
    assert.match(v.stdout, /FAIL test -x android\/gradlew/);
    assert.match(v.stdout, /ZIP TESLIM EDILMEZ/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('release-stage.mjs: kaynakta gradlew 0644 olsa bile asama kopyasinda 0755 olur', () => {
  const d = mkdtempSync(join(tmpdir(), 'alt811s-'));
  try {
    const src = join(d, 'src'); const dst = join(d, 'dst');
    cpSync(join(ROOT, 'release'), join(src, 'release'), { recursive: true });
    mkdirSync(join(src, 'android'), { recursive: true });
    writeFileSync(join(src, 'android/gradlew'), '#!/bin/sh\n'); chmodSync(join(src, 'android/gradlew'), 0o644);
    const r = spawnSync('node', [join(ROOT, 'scripts/release-stage.mjs'), src, dst], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(statSync(join(dst, 'android/gradlew')).mode & 0o777, 0o755);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
