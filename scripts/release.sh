#!/usr/bin/env bash
# ALTEZ MiniLab - TEK ANA TESLIM KOMUTU:   bash scripts/release.sh      (DevreLab Pro ile ayni yaklasim: dogrudan Android SDK -> Gradle assembleDebug)
# Sira: 1-3 kaynak/varlik/import/yapilandirma/package<->lock denetimi (preflight; hata varsa DERLEMEDEN durur) -> 4 testler -> 5 web derlemesi
#       -> 6-7 Android SDK + Capacitor hazirligi, npx cap sync android -> 8 android/gradlew assembleDebug -> 9 APK paket kimligi/surum/imza/SHA-256
#       -> 10 bagimsiz FULL.zip (--ship preflight + MANIFEST.sha256) -> 11 YENI bos klasore ac, manifest dogrula, ayni zinciri ZIP'ten yeniden calistir
#       -> 12 ZIP + APK + SHA256SUMS + raporlar AYRI, benzersiz teslim klasorune. Korunan surumlere (V3/V4/V5.2/V6, APK'lar) dokunmaz; var olan hicbir dosyanin uzerine yazmaz.
# Bir kontrol basarisiz olursa DURUR (RESULT=FAILED). Atlanan/calistirilamayan kontrol BASARI sayilmaz (RESULT=PARTIAL, cikis 3).
# Sure: UI smoke iki kez (kaynak + temiz dizin) kosar; toplam ~30-40 dk surebilir.
# Yardimci komut (yalniz bir kez, yedekli):  bash scripts/release.sh --fix-version   # package.json/package-lock.json surum etiketini version.env ile esitler
# Ortam: REL_DIR | SMOKE_SCRIPT=<betik> (V7.6: alt surece aktarilir; varsayilan TAM scripts/ui-smoke.mjs) | SKIP_SMOKE=1 | SKIP_ANDROID=1 (ikisi PARTIAL) | PROTECT_DIRS="dizin ..." | PROTECT_APKS="apk ..." | ANDROID_HOME | PLAYWRIGHT_PATH
# Cikis: 0 OK (tam) | 1 FAILED | 3 PARTIAL
set -u
cd "$(dirname "$0")/.." || exit 1
SRC=$(pwd -P); TS=$(date +%Y%m%d-%H%M%S)
. scripts/version.env 2>/dev/null || { echo "HATA: scripts/version.env okunamadi"; exit 1; }
TAG="${RELEASE_TAG:?version.env RELEASE_TAG yok}"; LTAG=$(echo "$TAG" | tr 'A-Z' 'a-z'); NAME="altez-minilab-$LTAG"
REL_DIR="${REL_DIR:-$(dirname "$SRC")/$NAME-release-$TS}"
# FIX surumu (create-fix-release.sh --prepare-only ile hazirlandiysa) VERSION.json'daki "fix" kaydi OTOMATIK okunur: elle version.env duzenlemesi gerekmez.
FIXINFO=""; PARENT_DIR=""
if [ -f VERSION.json ]; then
  FIXINFO=$(python3 -I - <<'PYF'
import json, sys
try: v = json.load(open('VERSION.json'))
except Exception as e: print('HATA|VERSION.json okunamadi: %s' % e); sys.exit(0)
f = v.get('fix') or {}
print('|'.join(['OK', str(v.get('name') or ''), str(f.get('tag') or ''), str(f.get('parentTag') or ''), str(v.get('parentPath') or '')]))
PYF
)
  IFS='|' read -r _st FX_NAME FX_TAG FX_PTAG PARENT_DIR <<<"$FIXINFO"
  [ "$_st" = OK ] || { echo "HATA: ${FIXINFO#*|}"; exit 1; }
  [ -z "$FX_NAME" ] || [ "$FX_NAME" = "$NAME" ] || { echo "HATA: VERSION.json adi ($FX_NAME) version.env RELEASE_TAG'inden turetilen ad ($NAME) ile uyusmuyor: FIX devri (handoff) uygulanmamis veya klasor elle degistirilmis"; exit 1; }
  [ -z "$FX_TAG" ] || [ "$FX_TAG" = "$TAG" ] || { echo "HATA: VERSION.json fix.tag ($FX_TAG) != version.env RELEASE_TAG ($TAG)"; exit 1; }
  [ -z "$FX_PTAG" ] || [ "$FX_PTAG" != "$TAG" ] || { echo "HATA: FIX etiketi ana surum etiketiyle ayni ($TAG): normal surumun ZIP/APK adlariyla cakisir"; exit 1; }
fi
PROTECT_DIRS="${PROTECT_DIRS-/home/altez/altez-minilab-v3 /home/altez/altez-minilab-v4 /home/altez/altez-minilab-v52 /home/altez/altez-minilab-v6}"
PROTECT_APKS="${PROTECT_APKS-/home/altez/ALTEZ-MiniLab-V5.2.apk /home/altez/ALTEZ-MiniLab-V6.apk}"
[ -z "${PARENT_DIR:-}" ] || { [ -d "$PARENT_DIR" ] && [ "$(realpath -e -- "$PARENT_DIR")" != "$SRC" ] && PROTECT_DIRS="$PROTECT_DIRS $PARENT_DIR"; }
die() { echo; echo "HATA: $*" >&2; echo "RESULT=FAILED  (ZIP/APK teslimi tamamlanmadi)" >&2; [ -d "${REL_DIR:-/nonexistent}" ] && [ ! -e "$REL_DIR/RELEASE-STATUS.txt" ] && printf "RESULT=FAILED\ntarih=%s\nneden: %s\n" "$TS" "$*" > "$REL_DIR/RELEASE-STATUS.txt"; exit 1; }
say() { echo; echo "=== $* ==="; }
PARTIAL=0; WHY=()
[ ! -e "$REL_DIR" ] && [ ! -L "$REL_DIR" ] || die "REL_DIR zaten var (uzerine yazilmaz): $REL_DIR"
case "$(realpath -m -- "$REL_DIR")/" in "$SRC"/*) die "REL_DIR kaynak agacinin icinde olamaz";; esac
if [ "${1:-}" = "--fix-version" ]; then
  BK="$(dirname "$SRC")/$NAME-version-backup-$TS"; [ ! -e "$BK" ] || die "yedek klasoru var: $BK"; mkdir -m 700 "$BK" || die "yedek klasoru olusturulamadi"
  cp -p package.json package-lock.json "$BK/" || die "yedek alinamadi"; cmp -s package.json "$BK/package.json" && cmp -s package-lock.json "$BK/package-lock.json" || die "yedek dogrulanamadi"
  node - "$VERSION_NAME_DEFAULT" <<'NODE' || die "surum guncellenemedi"
const fs = require('fs'); const vn = process.argv[2] + '.0';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')), lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const old = pkg.version; pkg.version = vn; lock.version = vn; lock.packages[''].version = vn;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n'); fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log(`package.json/lock surumu ${old} -> ${vn} (yalniz surum etiketi)`);
NODE
  echo "Yedek: $BK"; echo "Simdi: bash scripts/release.sh"; exit 0
fi
command -v node >/dev/null && command -v python3 >/dev/null && command -v sha256sum >/dev/null || die "node, python3 ve sha256sum gerekli"
treehash() { (cd "$1" && find . -type f -not -path './node_modules/*' -not -path './www/*' -not -path './.git/*' -not -path './android/build/*' -not -path './android/app/build/*' -not -path './android/.gradle/*' -not -path './android/.cxx/*' -not -path './android/app/.cxx/*' -not -path './android/.idea/*' -not -path './android/local.properties' -print0 | LC_ALL=C sort -z | xargs -0 sha256sum 2>/dev/null | sha256sum | cut -d' ' -f1); }
PREV=$(dirname "$SRC"); mkdir -m 700 "$REL_DIR" || die "REL_DIR olusturulamadi"; LOGD="$REL_DIR/logs"; mkdir "$LOGD"

say "0. Onceki release denemeleri (kor yeniden baslatma yapilmaz)"
{ n=0; for d in "$PREV"/$NAME-release-*; do [ -d "$d" ] && [ "$d" != "$REL_DIR" ] || continue; n=$((n+1))
    echo "[$d]"; [ -f "$d/RELEASE-STATUS.txt" ] && sed 's/^/    /' "$d/RELEASE-STATUS.txt" || echo "    RELEASE-STATUS.txt yok (yarim kalmis olabilir)"
    ls "$d" | sed 's/^/    icerik: /' | head -12; [ -f "$d/logs/clean-build.log" ] && { echo "    son clean-build satirlari:"; tail -6 "$d/logs/clean-build.log" | sed 's/^/      /'; }; done
  [ $n = 0 ] && echo "(onceki release denemesi klasoru bulunamadi: $PREV/$NAME-release-*)"; } | tee "$LOGD/previous-attempts.txt"

say "1. Korunan surumlerin oncesi (kaynak agac ozetleri + APK SHA-256)"
PROT_BEFORE="$LOGD/protected-before.txt"; : > "$PROT_BEFORE"
for d in $PROTECT_DIRS; do if [ -d "$d" ]; then echo "$d $(treehash "$d")" >> "$PROT_BEFORE"; else echo "$d YOK" >> "$PROT_BEFORE"; fi; done
for a in $PROTECT_APKS; do if [ -f "$a" ]; then echo "$a $(sha256sum "$a" | cut -d' ' -f1)" >> "$PROT_BEFORE"; else echo "$a YOK" >> "$PROT_BEFORE"; fi; done
sed 's/^/  /' "$PROT_BEFORE"

say "2. KAYNAK AGACINDA zincir: preflight -> npm ci -> test -> build -> UI smoke -> cap sync -> Gradle assembleDebug -> APK dogrulama"
SB="$REL_DIR/source-build-out"
( OUT_DIR="$SB" SMOKE_SCRIPT="${SMOKE_SCRIPT:-scripts/ui-smoke.mjs}" SKIP_SMOKE="${SKIP_SMOKE:-0}" SKIP_ANDROID="${SKIP_ANDROID:-0}" bash ./install-and-build.sh ) 2>&1 | tee "$LOGD/source-build.log"; SRC_RC=${PIPESTATUS[0]}
echo "  kaynak agaci derleme cikis kodu: $SRC_RC"
[ "$SRC_RC" != 1 ] || die "kaynak agacinda derleme/denetim BASARISIZ (bkz $SB/BUILD-REPORT.md ve $LOGD/source-build.log). ZIP uretilmedi. Ipucu: package.json surum etiketi uyumsuzsa once: bash scripts/release.sh --fix-version (yedekli)."
[ "$SRC_RC" != 3 ] || { PARTIAL=1; WHY+=("kaynak agacindaki derlemede atlanan/calistirilamayan dogrulama var"); }

say "3. Asama kopyasi (release/rules.json dislama kurallari; derlemeden SONRA, APK'yi ureten kaynak)"
ST="$REL_DIR/stage/$NAME"
node scripts/release-stage.mjs "$SRC" "$ST" >"$LOGD/stage.log" 2>&1 || { cat "$LOGD/stage.log"; die "asama kopyasi basarisiz"; }
head -1 "$LOGD/stage.log"; echo "  dislanan oge sayisi: $(grep -c '^  - ' "$LOGD/stage.log") (liste: logs/stage.log)"

say "4. PREFLIGHT (--ship) ZIP icerigi - basarisizsa ZIP ve APK asamasina GECILMEZ"
( cd "$ST" && node scripts/preflight.mjs . --ship --json "$LOGD/preflight-ship.json" --inventory-md "$REL_DIR/feature-inventory.md" ) 2>&1 | tee "$LOGD/preflight-ship.log" | grep -E "^--|HATA|UYARI|PREFLIGHT" ; PRC=${PIPESTATUS[0]}
[ "$PRC" = 0 ] || die "preflight basarisiz: eksik/uyumsuz dosya veya bagimlilik. ZIP ve APK uretilmedi. Ayrinti: $LOGD/preflight-ship.log"
echo "  preflight GECTI"

say "5. VERSION.txt + MANIFEST.sha256 (teslim dosyalarinin tamami; manifestin kendisi SHA256SUMS ile ayri dogrulanir)"
printf 'ALTEZ MiniLab %s\nSurum: %s (versionCode %s)\nApplicationId: %s\nUretim: %s\nKaynak: tam kaynak ZIP (yama degildir)\n' "$TAG" "$VERSION_NAME_DEFAULT" "$VERSION_CODE_DEFAULT" "$APP_ID_DEFAULT" "$TS" > "$ST/VERSION.txt"
( cd "$ST" && find . -type f ! -name MANIFEST.sha256 -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > MANIFEST.sha256 ) || die "manifest uretilemedi"
NFILES=$(wc -l < "$ST/MANIFEST.sha256"); echo "  manifest: $NFILES dosya"

say "6. FULL.zip olustur ve arsiv butunlugunu dogrula"
ZIP="$REL_DIR/ALTEZ-MiniLab-$TAG-FULL.zip"
python3 -I - "$REL_DIR/stage" "$ZIP" <<'PY' || die "ZIP olusturulamadi"
import sys, os, zipfile
base, out = sys.argv[1], sys.argv[2]
names = []
for root, dirs, files in os.walk(base):
    dirs.sort()
    for f in sorted(files): names.append(os.path.relpath(os.path.join(root, f), base).replace(os.sep, '/'))
names.sort()
for n in names:
    if n.startswith('/') or '..' in n.split('/') or '\\' in n or n != n.strip(): sys.exit('guvensiz yol: ' + n)
with zipfile.ZipFile(out, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for n in names:
        p = os.path.join(base, n); zi = zipfile.ZipInfo.from_file(p, n); zi.compress_type = zipfile.ZIP_DEFLATED
        zi.date_time = (2026, 1, 1, 0, 0, 0)
        with open(p, 'rb') as fh: z.writestr(zi, fh.read())
print('ok', len(names))
PY
python3 -I - "$ZIP" "$NFILES" <<'PY' || die "ZIP butunluk dogrulamasi basarisiz"
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1]); exp = int(sys.argv[2]) + 1   # manifest dosyalari + MANIFEST.sha256
bad = z.testzip(); n = z.namelist()
print('  testzip:', bad or 'temiz', '| girdi sayisi:', len(n), '| beklenen:', exp)
if bad or len(n) != exp or n != sorted(n): sys.exit(1)
for x in n:
    if x.startswith('/') or '..' in x.split('/') or '\\' in x: sys.exit('guvensiz yol ' + x)
g = [i for i in z.infolist() if i.filename.endswith('android/gradlew')]
if len(g) != 1 or (g[0].external_attr >> 16) & 0o777 != 0o755: sys.exit('android/gradlew ZIP icinde 0755 (100755) degil: teslim durduruldu')
print('  android/gradlew modu ZIP icinde 100755')
PY
echo "  ZIP: $(stat -c %s "$ZIP") bayt"

say "7. ZIP'i YENI bos klasore ac ve manifesti dogrula"
CL="$REL_DIR/clean"; mkdir "$CL"
python3 -I - "$ZIP" "$CL" <<'PY' || die "ZIP acilamadi"
import sys, os, zipfile
z = zipfile.ZipFile(sys.argv[1]); d = os.path.realpath(sys.argv[2])
for zi in z.infolist():
    t = os.path.realpath(os.path.join(d, zi.filename))
    if not t.startswith(d + os.sep): sys.exit('dizin disina cikis: ' + zi.filename)
    os.makedirs(os.path.dirname(t), exist_ok=True)
    with open(t, 'wb') as fh: fh.write(z.read(zi))
    os.chmod(t, (zi.external_attr >> 16) & 0o755 or 0o644)
PY
CP="$CL/$NAME"; [ -d "$CP" ] || die "ZIP beklenen ust klasoru icermiyor: $NAME/"
( cd "$CP" && sha256sum -c --strict MANIFEST.sha256 >"$LOGD/manifest-check.log" 2>&1 ) || { tail -5 "$LOGD/manifest-check.log"; die "acilan dosyalar MANIFEST.sha256 ile eslesmiyor"; }
ACT=$(cd "$CP" && find . -type f | sed 's#^\./##' | LC_ALL=C sort); EXP=$( (awk '{print $2}' "$CP/MANIFEST.sha256" | sed 's#^\./##'; echo MANIFEST.sha256) | LC_ALL=C sort)
[ "$ACT" = "$EXP" ] || die "acilan dosya kumesi manifestten farkli (fazla/eksik dosya)"
echo "  OK: $NFILES dosya manifestle eslesti; fazlalik/eksik yok"
# V8.1.1: gradlew izni ZIP icinde KALICI olmali; chmod ile maskelenmez. Eksikse teslim DURUR.
[ -x "$CP/android/gradlew" ] || die "ZIP'ten acilan android/gradlew calistirilabilir degil (test -x basarisiz): ZIP 100644 paketlenmis. Teslim durduruldu (scripts/pack-zip.py kullanin)"
echo "  OK: test -x android/gradlew (temiz cikarimda ek chmod olmadan calistirilabilir)"

say "8. ZIP'ten acilan TEMIZ kaynakta ayni zincir (preflight, npm ci, test, build, UI smoke, cap sync, Gradle, APK dogrulama)"
CO="$REL_DIR/clean-build-out"
( cd "$CP" && OUT_DIR="$CO" SMOKE_SCRIPT="${SMOKE_SCRIPT:-scripts/ui-smoke.mjs}" SKIP_SMOKE="${SKIP_SMOKE:-0}" SKIP_ANDROID="${SKIP_ANDROID:-0}" bash ./install-and-build.sh ) 2>&1 | tee "$LOGD/clean-build.log"; BRC=${PIPESTATUS[0]}
echo "  install-and-build.sh cikis kodu: $BRC"
[ "$BRC" != 1 ] || { echo "  temiz dizinde derleme BASARISIZ"; }
case $BRC in 0) ;; 3) PARTIAL=1; WHY+=("temiz derlemede atlanan/calistirilamayan dogrulama var (bkz TEST-REPORT)");; *) ;; esac

say "9. Teslim dosyalari ve SHA-256"
APK_SRC="$CO/$APK_NAME_DEFAULT"; APK_OUT="$REL_DIR/$APK_NAME_DEFAULT"; HAVEAPK=0
if [ -f "$APK_SRC" ] && [ "$BRC" != 1 ]; then cp "$APK_SRC" "$APK_OUT" && cmp -s "$APK_SRC" "$APK_OUT" && HAVEAPK=1 || die "APK kopyalanamadi"; else [ "$BRC" = 1 ] || { PARTIAL=1; WHY+=("APK uretilmedi"); }; fi
APK_SB="$SB/$APK_NAME_DEFAULT"; APKCMP="APK karsilastirmasi yapilmadi (iki APK da yok)"
if [ $HAVEAPK = 1 ] && [ -f "$APK_SB" ]; then
  APKCMP=$(python3 -I - "$APK_SB" "$APK_OUT" <<'PY'
import sys, zipfile
def load(p): return {i.filename: i.CRC for i in zipfile.ZipFile(p).infolist() if not i.filename.startswith('META-INF/') and not i.is_dir()}
a, b = load(sys.argv[1]), load(sys.argv[2])
diff = sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k))
crit = [k for k in diff if k.startswith('assets/public/') or k == 'AndroidManifest.xml']
print(f"{len(a)} girdi; fark: {len(diff)}" + (f" (kritik: {len(crit)}: {', '.join(crit[:5])})" if crit else (f" (kritik olmayan: {', '.join(diff[:5])})" if diff else " - icerik ozdes")))
sys.exit(1 if crit else 0)
PY
  ) || die "kaynak agacindaki APK ile ZIP'ten uretilen APK'nin uygulama icerigi FARKLI: $APKCMP"
  echo "  APK karsilastirmasi (kaynak vs temiz ZIP): $APKCMP"
elif [ $HAVEAPK = 1 ]; then PARTIAL=1; WHY+=("kaynak agacinda APK yok; ZIP'ten uretilenle karsilastirilamadi"); fi
cp "$CP/MANIFEST.sha256" "$REL_DIR/MANIFEST.sha256"; cp "$CP/README-KURULUM.md" "$REL_DIR/README-KURULUM.md"; cp "$CP/ANDROID_TEST.md" "$REL_DIR/ANDROID_TEST.md"
( cd "$REL_DIR" && sha256sum "ALTEZ-MiniLab-$TAG-FULL.zip" MANIFEST.sha256 $( [ $HAVEAPK = 1 ] && echo "$APK_NAME_DEFAULT" ) > SHA256SUMS && sha256sum -c --strict SHA256SUMS >/dev/null ) || die "SHA256SUMS"
cmp -s "$REL_DIR/MANIFEST.sha256" "$ST/MANIFEST.sha256" || die "teslim MANIFEST.sha256 zip iceriginden farkli"
sed 's/^/  /' "$REL_DIR/SHA256SUMS"

say "10. Korunan surumler degismedi mi? (V3, V4, V5.2, V6 kaynaklari ve APK'lar)"
PROT_AFTER="$LOGD/protected-after.txt"; : > "$PROT_AFTER"
for d in $PROTECT_DIRS; do if [ -d "$d" ]; then echo "$d $(treehash "$d")" >> "$PROT_AFTER"; else echo "$d YOK" >> "$PROT_AFTER"; fi; done
for a in $PROTECT_APKS; do if [ -f "$a" ]; then echo "$a $(sha256sum "$a" | cut -d' ' -f1)" >> "$PROT_AFTER"; else echo "$a YOK" >> "$PROT_AFTER"; fi; done
cmp -s "$PROT_BEFORE" "$PROT_AFTER" && echo "  OK: hicbiri degismedi (oncesi=sonrasi)" || { diff "$PROT_BEFORE" "$PROT_AFTER"; die "KORUNAN BIR SURUM/KAYNAK DEGISTI!"; }
grep -c ' YOK$' "$PROT_BEFORE" | grep -qx 0 || { PARTIAL=1; WHY+=("bazi korunan yollar bulunamadi, karsilastirilamadi: $(grep ' YOK$' "$PROT_BEFORE" | awk '{print $1}' | tr '\n' ' ')"); }

STATUS=OK; [ $PARTIAL = 1 ] && STATUS=PARTIAL; [ "$BRC" = 1 ] && STATUS=FAILED
ZSHA=$(sha256sum "$ZIP" | cut -d' ' -f1); ASHA=""; [ $HAVEAPK = 1 ] && ASHA=$(sha256sum "$APK_OUT" | cut -d' ' -f1)
{ echo "RESULT=$STATUS"; echo "tarih=$TS"; echo "tag=$TAG"; echo "ad=$NAME"; echo "zip=ALTEZ-MiniLab-$TAG-FULL.zip dosya=$((NFILES+1))"; echo "zip_sha256=$ZSHA"; echo "apk=${APK_NAME_DEFAULT} apk_sha256=${ASHA:-yok}"; [ -z "${PARENT_DIR:-}" ] || echo "ebeveyn=$PARENT_DIR"; echo "install-and-build cikis=$BRC"; for w in "${WHY[@]:-}"; do [ -n "$w" ] && echo "neden: $w"; done; } > "$REL_DIR/RELEASE-STATUS.txt"
for r in BUILD TEST; do { echo "# ALTEZ MiniLab $TAG - $r-REPORT"; echo; echo "## 1. Kaynak agacinda zincir (cikis $SRC_RC)"; echo; sed '1,2d' "$SB/$r-REPORT.md" 2>/dev/null || echo "(rapor yok)"; echo; echo "## 2. ZIP'ten acilan temiz dizinde zincir (cikis $BRC)"; echo; sed '1,2d' "$CO/$r-REPORT.md" 2>/dev/null || echo "(rapor yok)"; } > "$REL_DIR/$r-REPORT.md"; done
{ echo; echo "## Teslim ozeti (release.sh)"; echo; echo "- Sonuc: **$STATUS**"; echo "- Etiket/ad: $TAG / $NAME"; echo "- ZIP SHA-256: $ZSHA"; echo "- APK SHA-256: ${ASHA:-APK URETILMEDI}"; echo "- ZIP: ALTEZ-MiniLab-$TAG-FULL.zip, $(stat -c %s "$ZIP") bayt, $((NFILES+1)) dosya (MANIFEST dahil)"; echo "- Preflight (--ship): GECTI"; echo "- Temiz dizinde acma + manifest dogrulamasi: BASARILI"; echo "- Korunan surumler (V3/V4/V5.2/V6 kaynaklari ve APK) oncesi=sonrasi: DEGISMEDI"; echo "- APK karsilastirmasi (kaynak vs temiz ZIP): $APKCMP"; echo; echo '```'; cat "$REL_DIR/SHA256SUMS"; echo '```'; [ ${#WHY[@]} -gt 0 ] && { echo; echo "Kismi/uyari nedenleri:"; for w in "${WHY[@]}"; do echo "- $w"; done; }; } | tee -a "$REL_DIR/BUILD-REPORT.md" >> "$REL_DIR/TEST-REPORT.md"
rm -rf "$REL_DIR/stage"
# V7.2: sabit adli teslim klasoru (teslim/): ALTEZ-MiniLab-<surum>.zip, .apk, SHA256SUMS.txt, TEST-RAPORU.txt. FAILED ise OLUSTURULMAZ.
if [ "$STATUS" != FAILED ]; then
  TD="$REL_DIR/teslim"; mkdir -p "$TD"; VTAG="${TAG}"
  cp "$ZIP" "$TD/ALTEZ-MiniLab-$VTAG.zip"
  [ $HAVEAPK = 1 ] && cp "$APK_OUT" "$TD/ALTEZ-MiniLab-$VTAG.apk"
  APKINFO="APK uretilmedi"; if [ $HAVEAPK = 1 ]; then AAPT_BIN=$(command -v aapt || ls "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/x}}"/build-tools/*/aapt 2>/dev/null | sort -V | tail -1); [ -n "$AAPT_BIN" ] && APKINFO=$("$AAPT_BIN" dump badging "$APK_OUT" 2>/dev/null | grep -E "^package:" | head -1) || APKINFO="aapt bulunamadi: paket bilgisi okunamadi"; fi
  { echo "ALTEZ MiniLab $VTAG - TEST RAPORU (otomatik, release.sh)"; echo "SONUC: $STATUS"; echo "Tarih: $TS"
    echo "APK paket bilgisi: $APKINFO"
    echo "APK imzasi: debug anahtariyla imzali (Play Store surumu DEGIL)"
    echo "ZIP: ALTEZ-MiniLab-$VTAG.zip  $(stat -c %s "$ZIP") bayt  sha256=$ZSHA"
    if [ $HAVEAPK = 1 ]; then echo "APK: ALTEZ-MiniLab-$VTAG.apk  $(stat -c %s "$APK_OUT") bayt  sha256=$ASHA"; else echo "APK: URETILMEDI"; fi
    echo; [ ${#WHY[@]} -gt 0 ] && { echo "Kismi/uyari nedenleri:"; for w in "${WHY[@]}"; do echo " - $w"; done; echo; }
    echo "Cihaz testi: YAPILMADI (gercek telefonda elle test gerekir; bkz. ANDROID_TEST.md)"; echo; echo "--- TEST-REPORT.md (ozet) ---"; cat "$REL_DIR/TEST-REPORT.md"; } > "$TD/TEST-RAPORU.txt"
  ( cd "$TD" && sha256sum "ALTEZ-MiniLab-$VTAG.zip" $( [ $HAVEAPK = 1 ] && echo "ALTEZ-MiniLab-$VTAG.apk" ) > SHA256SUMS.txt && sha256sum -c --strict SHA256SUMS.txt >/dev/null ) || die "teslim/SHA256SUMS.txt"
  echo "  teslim/: $(ls "$TD" | tr '\n' ' ')"
fi
echo; echo "Teslim klasoru: $REL_DIR"; ls -l "$REL_DIR" | tail -n +2
case $STATUS in OK) echo "RESULT=OK"; exit 0;; PARTIAL) echo "RESULT=PARTIAL (tam teslim degil):"; printf '  - %s\n' "${WHY[@]}"; exit 3;; *) echo "RESULT=FAILED"; exit 1;; esac
