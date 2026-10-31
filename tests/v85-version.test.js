// V8.5-dev surum sabitleme (guncel surum). applicationId ve imza duzeni DEGISMEZ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('V8.5 surum: 8.5 / versionCode 26 (>25) / com.altez.minilab.v4 / APK adi ALTEZ-MiniLab-V8.5.apk / dev kanali isaretli', () => {
  const env = rd('scripts/version.env');
  const g = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm'))[1];
  assert.equal(g('VERSION_NAME_DEFAULT'), '8.5');
  assert.equal(g('RELEASE_TAG'), 'V8.5');
  assert.equal(g('VERSION_CODE_DEFAULT'), '26');
  assert.equal(g('APP_ID_DEFAULT'), 'com.altez.minilab.v4');
  assert.equal(g('APK_NAME_DEFAULT'), 'ALTEZ-MiniLab-V8.5.apk');
  const gr = rd('android/app/build.gradle');
  assert.match(gr, /versionCode 26\b/);
  assert.match(gr, /versionName "8\.5"/);
  assert.match(gr, /applicationId "com\.altez\.minilab\.v4"/);
  assert.equal(JSON.parse(rd('assets/data/app-version.json')).versionName, '8.5');
  assert.equal(JSON.parse(rd('package.json')).version, '8.5.0');
  const lock = JSON.parse(rd('package-lock.json'));
  assert.equal(lock.version, '8.5.0');
  assert.equal(lock.packages[''].version, '8.5.0');
  const vj = JSON.parse(rd('VERSION.json'));
  assert.equal(vj.versionCode, 26);
  assert.equal(vj.channel, 'dev');
  assert.match(rd('VERSION.txt'), /V8\.5-dev/);
});
