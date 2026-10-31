#!/usr/bin/env bash
# Termius/sunucu icin Android HAZIRLIK betigi. APK URETMEZ (assembleDebug calistirmaz).
#   bash scripts/prepare-android.sh
# Adimlar: npm test -> npm run build -> (surum bilgisi) -> npx cap sync android -> android-prep -> hazirlik kontrolleri.
# V7: surum scripts/version.env'den (7.0 / versionCode 9); ornek: bash scripts/prepare-android.sh   (once: npm install @capacitor/app@8.1.2)
# Bitince:  cd android && ./gradlew assembleDebug   sonra:  bash scripts/package-apk.sh
set -u
cd "$(dirname "$0")/.."
# V7: surum, uygulama kimligi ve APK adi TEK yerden gelir: scripts/version.env (ortam degiskenleri gecersiz kilar).
# shellcheck source=version.env
. scripts/version.env || { echo "scripts/version.env okunamadi"; exit 1; }
VCODE="${VERSION_CODE:-$VERSION_CODE_DEFAULT}"
VNAME="${VERSION_NAME:-$VERSION_NAME_DEFAULT}"
EXPECT_ID="${EXPECT_APP_ID:-$APP_ID_DEFAULT}"
fail=0
ok()   { echo "  OK    $*"; }
bad()  { echo "  HATA  $*"; fail=1; }
step() { echo; echo "== $* =="; }

step "1/5 npm test"
if npm test 2>&1 | tee /tmp/prep-test.log | grep -E "^# (tests|pass|fail)"; then :; fi
grep -q "^# fail 0" /tmp/prep-test.log && ok "testler gecti" || bad "test basarisiz (/tmp/prep-test.log)"
[ "$fail" = 0 ] || { echo; echo "DURDU: once testleri duzeltin."; exit 1; }

step "2/5 npm run build"
npm run build 2>&1 | tail -2
[ -f www/index.html ] && grep -q "ses-3-nativePromise" www/src/core/voice.js && [ -f www/src/core/back.js ] && [ -f www/assets/data/invent.json ] && ok "www hazir (ses duzeltmesi + Mucit Atolyesi icinde)" || bad "www eksik veya voice.js duzeltmesi yok"
[ "$fail" = 0 ] || exit 1

step "3/5 Android surum bilgisi"
GR=android/app/build.gradle
if [ ! -f "$GR" ]; then
  echo "  android/ yok -> once: npx cap add android  (sonra bu betigi yeniden calistirin)"; exit 1
fi
[ -n "$VCODE" ] && sed -i -E "s/^([[:space:]]*versionCode)[[:space:]]*=?[[:space:]]*[0-9]+/\1 $VCODE/" "$GR"
[ -n "$VNAME" ] && sed -i -E "s/^([[:space:]]*versionName)[[:space:]]*=?[[:space:]]*\"[^\"]*\"/\1 \"$VNAME\"/" "$GR"
echo "  surum (olduğu gibi): $(grep -E 'versionCode|versionName' "$GR" | tr -s ' ' | tr '\n' ';')"
[ -z "$VCODE" ] || { grep -Eq "versionCode[[:space:]]*=?[[:space:]]*$VCODE\b" "$GR" && ok "versionCode $VCODE" || bad "versionCode $VCODE yazilamadi"; }
[ -z "$VNAME" ] || { grep -Eq "versionName[[:space:]]*=?[[:space:]]*\"$VNAME\"" "$GR" && ok "versionName $VNAME" || bad "versionName $VNAME yazilamadi"; }
grep -Eq "applicationId[[:space:]]*=?[[:space:]]*\"$EXPECT_ID\"" "$GR" && ok "applicationId $EXPECT_ID" || bad "applicationId $EXPECT_ID degil (dosyada: $(grep -E 'applicationId' "$GR" | head -1 | tr -s ' '))"
[ "$fail" = 0 ] || exit 1

step "3b Tani sayfasi acilisi ele gecirmiyor mu?"
refs=$(grep -rn "voice-test" src index.html capacitor.config.json 2>/dev/null | grep -v "^src/ui/voicetest.js" | grep -v "^src/core/voice.js")
echo "$refs" | sed 's/^/    /'
n=$(echo "$refs" | grep -c .)
# Beklenen tek yer: app.js (rota + soguk acilista #/ 'a normallestirme). Baska yerde varsa otomatik acilis kodu kalmis demektir.
other=$(echo "$refs" | grep -v "^src/core/app.js" | grep -c .)
[ "$other" = 0 ] && ok "acilisi yonlendiren baska voice-test referansi yok" || bad "app.js disinda voice-test referansi var (yukaridaki satirlar): otomatik acilis kodunu kaldirin"
step "4/5 npx cap sync android + android-prep"
if [ "${SKIP_SYNC:-0}" = 1 ]; then echo "  (SKIP_SYNC=1: yalnizca benim benzetim testim icin)"; else
  npx cap sync android 2>&1 | tail -15
  [ "${PIPESTATUS[0]}" = 0 ] && ok "cap sync" || bad "cap sync basarisiz"
fi
node scripts/android-prep.mjs && ok "android-prep" || bad "android-prep basarisiz"
[ "$fail" = 0 ] || exit 1

step "5/5 Gradle hazirlik kontrolleri (APK uretilmez)"
PL=android/app/src/main/assets/capacitor.plugins.json
[ -f "$PL" ] && grep -q "TextToSpeech" "$PL" && ok "TextToSpeech eklentisi capacitor.plugins.json icinde" || bad "TextToSpeech eklentisi kayitli degil ($PL)"
# V6: Android fiziksel Geri tusu icin @capacitor/app ZORUNLU (cekirdek Geri tusunu islemez; eklenti yoksa Geri uygulamayi arka plana atar).
grep -q "capacitorjs.plugins.app.AppPlugin\|\"name\"[[:space:]]*:[[:space:]]*\"App\"" "$PL" 2>/dev/null && ok "@capacitor/app eklentisi capacitor.plugins.json icinde (Geri tusu)" || bad "@capacitor/app kayitli degil -> Geri tusu calismaz. Cozum: npm install @capacitor/app@8.1.2 && npx cap sync android"
grep -q "@capacitor/app" package.json 2>/dev/null && ok "package.json: @capacitor/app" || echo "  UYARI package.json'da @capacitor/app gorunmuyor (yukaridaki kontrol kayit durumunu gosterir)"
MF=android/app/src/main/AndroidManifest.xml
grep -q "android.intent.action.TTS_SERVICE" "$MF" && ok "AndroidManifest <queries> TTS_SERVICE" || bad "manifestte TTS_SERVICE <queries> yok"
[ -f android/app/src/main/assets/public/src/core/voice.js ] && grep -q "ses-3-nativePromise" android/app/src/main/assets/public/src/core/voice.js && ok "Android assets icinde guncel voice.js" || bad "Android assets/public icinde guncel voice.js yok (cap sync calismadi mi?)"
if [ ! -f android/gradlew ]; then bad "android/gradlew yok"
elif [ -x android/gradlew ]; then ok "gradlew calistirilabilir"
elif chmod +x android/gradlew 2>/dev/null && [ -x android/gradlew ]; then ok "gradlew izni eksikti, otomatik duzeltildi (UYARI: paket 100755 olmali; scripts/pack-zip.py)"
else bad "android/gradlew calistirilabilir degil ve duzeltilemedi (chmod +x android/gradlew)"; fi
if [ -f android/local.properties ] && grep -q "^sdk.dir" android/local.properties; then ok "local.properties sdk.dir: $(grep ^sdk.dir android/local.properties)"
elif [ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]; then ok "ANDROID_HOME/ANDROID_SDK_ROOT: ${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
else bad "Android SDK yolu yok (ANDROID_HOME veya android/local.properties sdk.dir)"; fi
command -v java >/dev/null && ok "java: $(java -version 2>&1 | grep -m1 -i version)" || bad "java yok"

echo
if [ "$fail" = 0 ]; then
  echo "HAZIR. APK uretmek icin:  cd android && ./gradlew assembleDebug"
  echo "Beklenen APK: $(pwd)/android/app/build/outputs/apk/debug/app-debug.apk"
  echo "Sonra (ayri ad, eskilerin uzerine yazmaz):  bash scripts/package-apk.sh"
else
  echo "HAZIR DEGIL: yukaridaki HATA satirlarini duzeltin."; exit 1
fi
