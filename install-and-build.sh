#!/usr/bin/env bash
# ALTEZ MiniLab V7 - ANA KURULUM / DERLEME BETIGI (temiz klasore acilmis ZIP icin).
#   bash install-and-build.sh
# Tekrar calistirilabilir: her calismada YENI bir cikis klasoru acar, hicbir eski APK'nin uzerine yazmaz.
# Her adimin GERCEK cikis kodu kontrol edilir; basarisiz adimin ustune basari yazilmaz.
# Cikis kodu: 0 = tum adimlar tam dogrulamayla gecti | 1 = HATA | 3 = bazi dogrulamalar CALISTIRILAMADI (basari sayilmaz)
# Ortam degiskenleri (hepsi istege bagli):
#   OUT_DIR=<klasor>      APK ve rapor buraya (varsayilan: <proje ustu>/altez-minilab-v7-out-<zaman>; VAR OLMAMALI)
#   SKIP_SMOKE=1          tarayici (UI) testini atla  -> EKSIK DOGRULAMA (cikis 3)
#   SMOKE_SCRIPT=<betik>  UI betigini sec (varsayilan scripts/ui-smoke.mjs; V8.4 hedefli: scripts/ui-v84.mjs (yon/ses) veya scripts/ui-v84-market.mjs (gorev/coin/market) (V8.3: scripts/ui-v83.mjs (V8.2: scripts/ui-v82.mjs (V8.1: scripts/ui-v81.mjs (V7.9.1: scripts/ui-v79.mjs (V7.8: scripts/ui-v78.mjs veya scripts/ui-v78-home.mjs; raporlar tam smoke KOSULMADIGINI acikca yazar)
#   SKIP_ANDROID=1        Capacitor/Gradle/APK adimlarini atla -> EKSIK DOGRULAMA (cikis 3)
#   PLAYWRIGHT_PATH=<yol> Playwright'in kurulu oldugu node_modules/playwright yolu (bkz. README-KURULUM.md)
#   ANDROID_HOME / ANDROID_SDK_ROOT veya android/local.properties icinde sdk.dir
set -u
cd "$(dirname "$0")" || exit 1
ROOT=$(pwd); TS=$(date +%Y%m%d-%H%M%S)
. scripts/version.env 2>/dev/null; _LT=$(echo "${RELEASE_TAG:-V7}" | tr A-Z a-z)
OUT_DIR="${OUT_DIR:-$(dirname "$ROOT")/altez-minilab-$_LT-out-$TS}"
[ ! -e "$OUT_DIR" ] || { echo "HATA: OUT_DIR zaten var (ustune yazilmaz): $OUT_DIR"; exit 1; }
case "$(realpath -m -- "$OUT_DIR")/" in "$ROOT"/*) echo "HATA: OUT_DIR proje agacinin icinde olamaz"; exit 1;; esac
mkdir -p "$OUT_DIR" || { echo "HATA: OUT_DIR olusturulamadi"; exit 1; }
LOGD="$OUT_DIR/logs"; mkdir -p "$LOGD"
REPORT="$OUT_DIR/BUILD-REPORT.md"
. scripts/version.env || { echo "HATA: scripts/version.env okunamadi"; exit 1; }
RELEASE_TAG="${RELEASE_TAG:-V7}"; TOOLV=()
STEPS=(); UT=; UP=; UF=; USMOKE=; NFAIL=0; NSKIP=0; MISSING=(); FACTS=()
rec() { STEPS+=("$1|$2|${3:-}"); case "$2" in FAIL) NFAIL=$((NFAIL+1));; SKIP) NSKIP=$((NSKIP+1));; esac; printf '  %-5s %s%s\n' "$2" "$1" "${3:+  ($3)}"; }
fact() { FACTS+=("$1"); echo "  $1"; }
stage() { echo; echo "=== $* ==="; }
finish() {
  local RES=OK; [ $NSKIP -gt 0 ] && RES=PARTIAL; [ $NFAIL -gt 0 ] && RES=FAILED
  { echo "# ALTEZ MiniLab $RELEASE_TAG - BUILD-REPORT"; echo; echo "- Sonuc: **$RES**"; echo "- Zaman: $TS"; echo "- Proje: $ROOT"
    echo "- Beklenen: $APP_ID_DEFAULT / versionCode $VERSION_CODE_DEFAULT / versionName $VERSION_NAME_DEFAULT"; echo
    echo "## Arac surumleri"; echo; for f in "${TOOLV[@]}"; do echo "- $f"; done; echo
    echo "## Adimlar"; echo; echo "| Adim | Durum | Not |"; echo "|---|---|---|"
    for s in "${STEPS[@]}"; do IFS='|' read -r a b c <<<"$s"; echo "| $a | $b | $c |"; done
    echo; echo "## Olgular"; echo; for f in "${FACTS[@]}"; do echo "- $f"; done
    if [ ${#MISSING[@]} -gt 0 ]; then echo; echo "## Eksik arac / calistirilamayan dogrulama"; echo; for m in "${MISSING[@]}"; do echo "- $m"; done; fi
    echo; echo "Gercek Android cihaz testi YAPILMADI (bu betik cihaz testi yapmaz)."; } > "$REPORT"
  { echo "# ALTEZ MiniLab $RELEASE_TAG - TEST-REPORT"; echo; echo "- Sonuc: **$RES**"; echo
    echo "## Otomatik testler"; echo; echo "- Birim/entegrasyon (npm test): toplam=${UT:-?} gecen=${UP:-?} basarisiz=${UF:-?}"
    echo "- UI smoke (Playwright/Chromium): ${USMOKE:-CALISTIRILMADI}"
    echo; echo "## Atlanan / calistirilamayan kontroller"; echo
    if [ ${#MISSING[@]} -gt 0 ]; then for m in "${MISSING[@]}"; do echo "- $m"; done; else echo "- yok"; fi
    echo; echo "## Ozellik envanteri (devralinan ozellikler regresyon testlerine bagli)"; echo; cat "$OUT_DIR/feature-inventory.md" 2>/dev/null || echo "(envanter uretilemedi)"
    echo; echo "## Cihaz testi"; echo; echo "**Cihaz testi yapilmadi.** Otomatik testler fiziksel cihaz testi yerine gecmez; ANDROID_TEST.md > V7 listesi elle uygulanmalidir."; } > "$OUT_DIR/TEST-REPORT.md"
  echo; echo "Raporlar: $REPORT  |  $OUT_DIR/TEST-REPORT.md"; echo "RESULT=$RES"
  case $RES in FAILED) echo "SONUC: FAILED ($NFAIL adim). Kayitlar: $LOGD"; exit 1;; PARTIAL) echo "SONUC: PARTIAL - $NSKIP dogrulama calistirilamadi; TAM BASARI DEGIL."; exit 3;; *) echo "SONUC: OK (tam dogrulama)"; exit 0;; esac
}
run() { # run <ad> <log> <komut...>  -> gercek cikis kodu
  local name="$1" log="$2"; shift 2
  "$@" >"$LOGD/$log" 2>&1; local rc=$?
  if [ $rc = 0 ]; then rec "$name" OK; else tail -12 "$LOGD/$log" | sed 's/^/    | /'; rec "$name" FAIL "cikis $rc, bkz logs/$log"; fi
  return $rc
}
stop_if_failed() { [ $NFAIL = 0 ] || finish; }

stage "1. Arac ve ortam kontrolu"
need() { command -v "$1" >/dev/null 2>&1 || { MISSING+=("$1 yok: $2"); return 1; }; }
need node "https://nodejs.org (Node 18+)"; need npm "Node ile gelir"; [ "${SKIP_ANDROID:-0}" = 1 ] || need java "JDK 17+ (Gradle icin)"
NODEV=$(node -v 2>/dev/null); NPMV=$(npm -v 2>/dev/null); JAVAV=$(java -version 2>&1 | grep -m1 -i version)
fact "node: ${NODEV:-YOK}  npm: ${NPMV:-YOK}  java: ${JAVAV:-YOK}"; TOOLV+=("Node: ${NODEV:-YOK}" "npm: ${NPMV:-YOK}" "Java: ${JAVAV:-YOK}")
if [ -n "$NODEV" ]; then [ "${NODEV#v}" != "$NODEV" ] && [ "$(echo "${NODEV#v}" | cut -d. -f1)" -ge 18 ] 2>/dev/null && rec "Node surumi >= 18" OK "$NODEV" || { rec "Node surumi >= 18" FAIL "$NODEV"; }; else rec "Node bulundu" FAIL "node yok"; fi
[ -n "$NPMV" ] && rec "npm bulundu" OK "$NPMV" || rec "npm bulundu" FAIL "npm yok"
if [ "${SKIP_ANDROID:-0}" != 1 ]; then
  [ -n "$JAVAV" ] && rec "Java bulundu" OK "$JAVAV" || rec "Java bulundu" FAIL "java yok (JDK 17+ kurun)"
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [ -z "$SDK" ] && [ -f android/local.properties ]; then SDK=$(sed -n 's/^sdk.dir=//p' android/local.properties | head -1); fi
  if [ -z "$SDK" ]; then for c in /usr/lib/android-sdk /opt/android-sdk "$HOME/Android/Sdk"; do [ -d "$c/platforms" ] || [ -d "$c/build-tools" ] || continue; SDK="$c"; fact "Android SDK otomatik bulundu: $c"; break; done; fi
  [ -n "$SDK" ] && { export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"; }
  if [ -n "$SDK" ] && [ -d "$SDK" ]; then rec "Android SDK" OK "$SDK"; else rec "Android SDK" FAIL "ANDROID_HOME/ANDROID_SDK_ROOT yok veya klasor yok"; MISSING+=("Android SDK yolu bulunamadi"); fi
  AAPT=$(command -v aapt || ls "${SDK:-/nonexistent}"/build-tools/*/aapt 2>/dev/null | sort -V | tail -1); APKS=$(command -v apksigner || ls "${SDK:-/nonexistent}"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)
  TOOLV+=("Android SDK: ${SDK:-YOK}" "build-tools: $(ls "${SDK:-/nonexistent}"/build-tools 2>/dev/null | sort -V | tail -1)" "platforms: $(ls "${SDK:-/nonexistent}"/platforms 2>/dev/null | tr '\n' ' ')")
  [ -n "$AAPT" ] && fact "aapt: $AAPT" || { MISSING+=("aapt yok -> APK paket/surum dogrulamasi YAPILAMAZ (build-tools kurun)"); fact "aapt: YOK"; }
  [ -n "$APKS" ] && fact "apksigner: $APKS" || { MISSING+=("apksigner yok -> APK imza dogrulamasi YAPILAMAZ (build-tools kurun)"); fact "apksigner: YOK"; }
fi
stop_if_failed
stage "1b. Release preflight (zorunlu dosyalar, importlar, JSON/varlik yollari, package<->lock, Android, ozellik envanteri, gizli bilgi)"
node scripts/preflight.mjs . --json "$LOGD/preflight.json" --inventory-md "$OUT_DIR/feature-inventory.md" >"$LOGD/preflight.log" 2>&1; rc=$?
grep -E "HATA|UYARI|PREFLIGHT" "$LOGD/preflight.log" | sed 's/^/    | /'
if [ $rc = 0 ]; then rec "preflight" OK "$(grep PREFLIGHT "$LOGD/preflight.log" | tail -1)"; else rec "preflight" FAIL "bkz logs/preflight.log - eksik dosya/bagimlilik ZIP/APK asamasina gecmeden durdu"; fi
stop_if_failed

stage "2. Bagimliliklar (npm ci - kilit dosyasina birebir)"
cp package.json "$LOGD/package.json.once"; cp package-lock.json "$LOGD/package-lock.json.once"
run "npm ci" npm-ci.log npm ci --no-audit --no-fund; stop_if_failed
cmp -s package.json "$LOGD/package.json.once" && cmp -s package-lock.json "$LOGD/package-lock.json.once" && rec "npm ci package.json/kilidi degistirmedi" OK || rec "npm ci package.json/kilidi degistirmedi" FAIL
stop_if_failed

stage "3. Birim testleri"
npm test >"$LOGD/unit-test.log" 2>&1; rc=$?
# V8.2: tek bir cikti bicimine bagli degil (TAP veya spec); taninmazsa BASARI SAYILMAZ (scripts/parse-test-output.mjs)
P=; T=; F=; if PR=$(node scripts/parse-test-output.mjs unit "$LOGD/unit-test.log" 2>/dev/null); then read -r P T F <<<"$PR"; fi; UT=$T; UP=$P; UF=$F
fact "birim testleri: toplam=${T:-?} gecen=${P:-?} basarisiz=${F:-?}"
if [ $rc = 0 ] && [ "${F:-x}" = 0 ] && [ -n "${T:-}" ] && [ "${T:-0}" -gt 0 ] && [ "${P:-x}" = "${T:-y}" ]; then rec "npm test" OK "$P/$T"; else tail -15 "$LOGD/unit-test.log" | sed 's/^/    | /'; rec "npm test" FAIL "cikis $rc"; fi
stop_if_failed

stage "4. Web derlemesi"
run "npm run build" build.log npm run build; stop_if_failed
[ -f www/index.html ] && [ -f www/src/games/learn/game.js ] && [ -f www/assets/data/learn.json ] && [ -f www/src/core/back.js ] && rec "www icinde Egitim + Geri tusu dosyalari" OK || rec "www icinde Egitim + Geri tusu dosyalari" FAIL
stop_if_failed

stage "5. Tarayici (UI) testi - Playwright proje bagimliligi DEGILDIR"
PWOK=0
for p in "${PLAYWRIGHT_PATH:-}" "$HOME/.npm-global/lib/node_modules/playwright" /usr/lib/node_modules/playwright /usr/local/lib/node_modules/playwright; do
  [ -n "$p" ] && [ -d "$p" ] && { PWOK=1; export PLAYWRIGHT_PATH="$p"; break; }; done
if [ "${SKIP_SMOKE:-0}" = 1 ]; then rec "UI smoke testi" SKIP "SKIP_SMOKE=1"; MISSING+=("UI smoke testi istekle atlandi")
elif [ $PWOK = 0 ]; then rec "UI smoke testi" SKIP "Playwright bulunamadi (PLAYWRIGHT_PATH / README-KURULUM.md)"; MISSING+=("Playwright yok -> tarayici (UI) testleri CALISTIRILAMADI")
else
  fact "Playwright: $PLAYWRIGHT_PATH"
  # V7.5: SMOKE_SCRIPT ile baska UI betigi secilebilir (ornek: SMOKE_SCRIPT=scripts/ui-v75.mjs = yalniz V7.5 HEDEFLI testi). Varsayilan TAM smoke'tur.
  SMK="${SMOKE_SCRIPT:-scripts/ui-smoke.mjs}"; [ -f "$SMK" ] || { rec "UI test betigi" FAIL "$SMK yok"; finish; }
  if [ "$SMK" != "scripts/ui-smoke.mjs" ]; then fact "UI test betigi: $SMK (HEDEFLI; tam scripts/ui-smoke.mjs bu calismada KOSULMADI)"; MISSING+=("Tam UI smoke (scripts/ui-smoke.mjs) bu calismada kosulmadi; yalniz $SMK calisti (hedefli)"); fi
  timeout 1500 node "$SMK" >"$LOGD/ui-smoke.log" 2>&1; rc=$?
  # V8.2: "N/N kontrol basarili" VE "N/N gecti" bicimleri (+ FAIL satirlari) taninir; taninmazsa/FAIL varsa BASARISIZ
  UP2=; UT2=; UF2=; L=; if PR=$(node scripts/parse-test-output.mjs ui "$LOGD/ui-smoke.log" 2>/dev/null); then read -r UP2 UT2 UF2 <<<"$PR"; L="$UP2/$UT2 kontrol (basarisiz: $UF2)"; fi
  fact "UI test: ${L:-sonuc satiri yok} (cikis $rc)"; USMOKE="${L:-sonuc satiri yok} (cikis $rc)"
  if [ $rc = 0 ] && [ -n "$L" ] && [ "${UT2:-0}" -gt 0 ] && [ "$UP2" = "$UT2" ] && [ "${UF2:-1}" = 0 ]; then rec "UI smoke testi" OK "$L"
  else grep -E "^  (FAIL|HATA)|BASARISIZ" "$LOGD/ui-smoke.log" | head -10 | sed 's/^/    | /'; rec "UI smoke testi" FAIL "cikis $rc, bkz logs/ui-smoke.log"; fi
fi
stop_if_failed

if [ "${SKIP_ANDROID:-0}" = 1 ]; then
  rec "Capacitor sync / Gradle / APK" SKIP "SKIP_ANDROID=1"; MISSING+=("Android adimlari istekle atlandi: APK URETILMEDI")
  finish
fi

stage "6. Capacitor hazirlik ve senkronizasyon (surum version.env'den)"
run "prepare-android.sh (cap sync + eklenti/surum kontrolleri)" prepare.log bash scripts/prepare-android.sh; stop_if_failed
GR=android/app/build.gradle
grep -Eq "applicationId[[:space:]]*=?[[:space:]]*\"$APP_ID_DEFAULT\"" $GR && grep -Eq "versionCode[[:space:]]*=?[[:space:]]*$VERSION_CODE_DEFAULT\b" $GR && grep -Eq "versionName[[:space:]]*=?[[:space:]]*\"$VERSION_NAME_DEFAULT\"" $GR && rec "Gradle surum/kimlik = version.env" OK || rec "Gradle surum/kimlik = version.env" FAIL
PL=android/app/src/main/assets/capacitor.plugins.json
if grep -q "TextToSpeech" "$PL" && grep -Eq "AppPlugin|\"name\"[[:space:]]*:[[:space:]]*\"App\"" "$PL"; then rec "Eklentiler kayitli: App (Geri tusu) + TextToSpeech" OK; else rec "Eklentiler kayitli: App (Geri tusu) + TextToSpeech" FAIL "$PL"; fi
npx cap ls android >"$LOGD/cap-ls.log" 2>&1; fact "cap ls: $(grep -E '@capacitor|capacitor-' "$LOGD/cap-ls.log" | tr -s ' ' | tr '\n' ';' | cut -c1-300)"
stop_if_failed

stage "7. Gradle assembleDebug"
WJ=android/gradle/wrapper/gradle-wrapper.jar; WS=0; [ -f "$WJ" ] && WS=$(stat -c %s "$WJ")
if [ "$WS" -lt 30000 ] || ! grep -q "distributionUrl" android/gradle/wrapper/gradle-wrapper.properties 2>/dev/null; then
  if [ "${ALLOW_FAKE_TOOLS:-0}" = 1 ]; then rec "Gradle wrapper gercekligi" SKIP "gradle-wrapper.jar yok/kucuk ($WS bayt): sahte arac (ALLOW_FAKE_TOOLS=1 test modu)"; MISSING+=("Gradle wrapper gercek degil: sahte arac, gercek derleme sayilmaz")
  else rec "Gradle wrapper gercekligi" FAIL "gradle-wrapper.jar yok/kucuk ($WS bayt) veya wrapper.properties'te distributionUrl yok"; fi
else fact "Gradle wrapper: gradle-wrapper.jar $WS bayt, SHA-256 $(sha256sum "$WJ" | cut -c1-16)..."; rec "Gradle wrapper gercekligi" OK; fi
stop_if_failed
# V8.1.1: wrapper var mi ve calistirilabilir mi? Paketleme bunu garanti eder; yine de eksikse (ornegin izin kaybeden bir kopya) acikca bildirip duzeltir.
if [ ! -f android/gradlew ]; then rec "android/gradlew mevcut ve calistirilabilir" FAIL "android/gradlew yok"
elif [ -x android/gradlew ]; then rec "android/gradlew mevcut ve calistirilabilir" OK
elif chmod +x android/gradlew 2>/dev/null && [ -x android/gradlew ]; then rec "android/gradlew mevcut ve calistirilabilir" OK "UYARI: izin eksikti, otomatik duzeltildi; paket 100755 olmali (scripts/pack-zip.py)"
else rec "android/gradlew mevcut ve calistirilabilir" FAIL "izin eksik ve duzeltilemedi (chmod +x android/gradlew)"; fi
stop_if_failed
MARK="$LOGD/gradle-start.marker"; : > "$MARK"; sleep 1
( cd android && ./gradlew --rerun-tasks assembleDebug ) >"$LOGD/gradle.log" 2>&1; rc=$?
if [ $rc = 0 ]; then rec "gradlew assembleDebug" OK; else tail -20 "$LOGD/gradle.log" | sed 's/^/    | /'; rec "gradlew assembleDebug" FAIL "cikis $rc"; fi
stop_if_failed

stage "8. APK kopyalama ve dogrulama (paket kimligi, surum, imza, SHA-256)"
REQUIRE_NEWER_THAN="$MARK" OUT_DIR="$OUT_DIR" bash scripts/package-apk.sh >"$LOGD/package.log" 2>&1; rc=$?
sed 's/^/    | /' "$LOGD/package.log"
APK="$OUT_DIR/$APK_NAME_DEFAULT"
case $rc in
  0) rec "APK paketleme + aapt + apksigner" OK;;
  3) rec "APK paketleme" SKIP "aapt/apksigner'dan biri yok: dogrulama eksik"; MISSING+=("APK kopyalandi ama paket/imza dogrulamasi eksik");;
  *) rec "APK paketleme + dogrulama" FAIL "cikis $rc";;
esac
if [ -f "$APK" ]; then fact "APK: $APK  boyut=$(stat -c %s "$APK") bayt  SHA-256=$(sha256sum "$APK" | cut -d' ' -f1)"; fact "$(grep -m1 '^aapt:' "$LOGD/package.log")"; fact "$(grep -E '^VERIFY_AAPT' "$LOGD/package.log") $(grep -E '^VERIFY_SIGN' "$LOGD/package.log")"; fi
finish
