#!/usr/bin/env bash
# Derlenmis debug APK'yi (varsayilan ALTEZ-MiniLab-V7.apk; scripts/version.env) olarak AYRI kopyalar ve teknik dogrulama yapar.
# Cikis kodu: 0 = kopyalandi VE aapt + apksigner dogrulamalari BASARILI
#             3 = kopyalandi ama dogrulamalardan biri/ikisi ATLANDI (arac yok) -> "dogrulanmis" SAYILMAZ
#             1 = BASARISIZ (kaynak yok, hedef zaten var, eski/taze degil, kopya farkli, aapt/apksigner HATA verdi)
# GERCEKLIK: APK yapisi (classes.dex, AndroidManifest.xml, imza blogu, assets/public) ve aapt/apksigner'in KENDI surum ciktisi denetlenir;
#   sahte/gecersiz arac veya APK "dogrulanmis" SAYILMAZ (ALLOW_FAKE_TOOLS=1 yalniz sandbox testi icin: cikis 3 verir, asla 0 vermez).
# Onceki APK'larin uzerine ASLA yazmaz. Ciktida makine-okur satirlar: VERIFY_AAPT=ok|fail|skipped  VERIFY_SIGN=ok|fail|skipped
set -u
cd "$(dirname "$0")/.."
. scripts/version.env || { echo "PACKAGE_STATUS=FAIL: scripts/version.env okunamadi"; exit 1; }
SRC=android/app/build/outputs/apk/debug/app-debug.apk
OUT="${OUT_DIR:-$(pwd)/..}/${APK_NAME:-$APK_NAME_DEFAULT}"
EXPECT_ID="${EXPECT_ID:-$APP_ID_DEFAULT}"; EXPECT_CODE="${EXPECT_CODE:-$VERSION_CODE_DEFAULT}"; EXPECT_NAME="${EXPECT_NAME:-$VERSION_NAME_DEFAULT}"
fail() { echo "PACKAGE_STATUS=FAIL: $*"; exit 1; }
[ -f "$SRC" ] || fail "$SRC yok. Once: cd android && ./gradlew assembleDebug"
[ ! -e "$OUT" ] || fail "$OUT zaten var; uzerine yazilmaz (eski dosya yeni sonuc sayilmaz). OUT_DIR ile baska klasor verin."
if [ -n "${REQUIRE_NEWER_THAN:-}" ]; then
  [ -e "$REQUIRE_NEWER_THAN" ] || fail "REQUIRE_NEWER_THAN isaret dosyasi yok"
  [ "$SRC" -nt "$REQUIRE_NEWER_THAN" ] || fail "$SRC isaretten eski: bu calistirmada uretilmemis"
fi
OUTD=$(dirname "$OUT"); [ -d "$OUTD" ] && [ -w "$OUTD" ] || fail "hedef klasor yok/yazilamaz: $OUTD"
case "$(realpath -m -- "$OUTD")/" in "$(realpath -m -- "$(pwd)")"/*) fail "hedef klasor proje agacinin icinde: $OUTD";; esac
[ ! -L "$OUT" ] || fail "$OUT sembolik baglanti"
# Dışlayici olusturma (noclobber): hedef bu arada olusmussa ezilmez; hata aninda YALNIZ bu betigin olusturdugu dosya silinir
( set -C; : > "$OUT" ) 2>/dev/null || fail "$OUT olusturulamadi/zaten var; uzerine yazilmaz"
cp "$SRC" "$OUT" || { rm -f "$OUT"; fail "kopyalanamadi"; }
cmp -s "$SRC" "$OUT" || { rm -f "$OUT"; fail "kopya kaynakla ayni degil"; }
echo "Kopyalandi: $OUT"
echo "Boyut (bayt): $(stat -c %s "$OUT")"
echo "SHA256: $(sha256sum "$OUT" | cut -d' ' -f1)"
STRUCT=$(python3 -I - "$OUT" <<'PYS'
import sys, zipfile
try:
    n = set(zipfile.ZipFile(sys.argv[1]).namelist())
except Exception as e:
    print('fail: zip degil ' + str(e)); sys.exit(1)
need = ['classes.dex', 'AndroidManifest.xml', 'assets/public/index.html']
miss = [x for x in need if x not in n]
if not (any(x.startswith('META-INF/') and x.rsplit('.', 1)[-1] in ('RSA', 'DSA', 'EC', 'SF') for x in n) or b'APK Sig Block 42' in open(sys.argv[1], 'rb').read()): miss.append('imza bloku (v1 META-INF veya v2+ APK Signing Block)')
print('fail: eksik ' + ', '.join(miss) if miss else 'ok'); sys.exit(1 if miss else 0)
PYS
); SRC_RC=$?
echo "APK yapisi: $STRUCT"; echo "VERIFY_STRUCT=$([ $SRC_RC = 0 ] && echo ok || echo fail)"
if [ $SRC_RC != 0 ]; then
  if [ "${ALLOW_FAKE_TOOLS:-0}" = 1 ]; then echo "PACKAGE_STATUS=PARTIAL: APK yapisi gercek bir Android derlemesi degil (ALLOW_FAKE_TOOLS=1 test modu) - DOGRULANMIS SAYILMAZ"; exit 3; fi
  mv "$OUT" "$OUT.DOGRULAMA-BASARISIZ" 2>/dev/null; fail "APK gercek bir Android debug APK'si degil ($STRUCT); dosya $OUT.DOGRULAMA-BASARISIZ olarak ayrildi"
fi
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/nonexistent}}"
AAPT=$(command -v aapt || ls "$SDK"/build-tools/*/aapt 2>/dev/null | sort -V | tail -1)
APKS=$(command -v apksigner || ls "$SDK"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)
VA=skipped; VS=skipped
GA=0; GS=0
[ -n "$AAPT" ] && [ -x "$AAPT" ] && timeout 60 "$AAPT" version 2>&1 | grep -q "Android Asset Packaging Tool" && GA=1
[ -n "$APKS" ] && [ -x "$APKS" ] && timeout 120 "$APKS" --version 2>&1 | head -1 | grep -Eq '^[0-9]+(\.[0-9]+)+' && GS=1
echo "arac kaniti: aapt=${AAPT:-yok} gercek=$GA | apksigner=${APKS:-yok} gercek=$GS"
if [ -n "$AAPT" ] && [ $GA = 0 ]; then echo "aapt gercek Android build-tools araci DEGIL ('aapt version' beklenen ciktiyi vermedi): dogrulama SAYILMAZ"; AAPT=""; fi
if [ -n "$APKS" ] && [ $GS = 0 ]; then echo "apksigner gercek DEGIL ('apksigner --version' beklenen ciktiyi vermedi): imza dogrulamasi SAYILMAZ"; APKS=""; fi
if [ -n "$AAPT" ] && [ -x "$AAPT" ]; then
  B=$("$AAPT" dump badging "$OUT" 2>&1); brc=$?
  PK=$(printf '%s\n' "$B" | grep -m1 '^package:')
  GID=$(printf '%s\n' "$PK" | awk -F"'" '/^package:/ {print $2; exit}'); GC=$(printf '%s\n' "$PK" | awk -F"'" '/^package:/ {print $4; exit}'); GN=$(printf '%s\n' "$PK" | awk -F"'" '/^package:/ {print $6; exit}')
  echo "aapt: paket=$GID versionCode=$GC versionName=$GN"
  if [ $brc = 0 ] && [ "$GID" = "$EXPECT_ID" ] && [ "$GC" = "$EXPECT_CODE" ] && [ "$GN" = "$EXPECT_NAME" ]; then VA=ok; else VA=fail; echo "aapt: BEKLENEN $EXPECT_ID / $EXPECT_CODE / $EXPECT_NAME ile UYUSMUYOR (aapt cikis=$brc)"; fi
else echo "aapt bulunamadi: paket/surum dogrulamasi ATLANDI"; fi
if [ -n "$APKS" ] && [ -x "$APKS" ]; then
  SG=$("$APKS" verify --verbose --print-certs "$OUT" 2>&1); src=$?
  printf '%s\n' "$SG" | head -8
  if [ $src = 0 ]; then VS=ok; else VS=fail; echo "apksigner: imza dogrulamasi BASARISIZ (cikis=$src)"; fi
  echo "NOT: derleme debug anahtariyla imzalidir (yayin imzasi degildir)."
else echo "apksigner bulunamadi: imza dogrulamasi ATLANDI"; fi
echo "VERIFY_AAPT=$VA"; echo "VERIFY_SIGN=$VS"
if [ "$VA" = fail ] || [ "$VS" = fail ]; then mv "$OUT" "$OUT.DOGRULAMA-BASARISIZ" 2>/dev/null; fail "dogrulama basarisiz; dosya $OUT.DOGRULAMA-BASARISIZ olarak ayrildi"; fi
if [ "$VA" != ok ] || [ "$VS" != ok ]; then echo "PACKAGE_STATUS=PARTIAL: APK kopyalandi ama dogrulama eksik (aapt=$VA, apksigner=$VS) - DOGRULANMIS SAYILMAZ"; exit 3; fi
echo "PACKAGE_STATUS=OK"; exit 0
