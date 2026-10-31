# ALTEZ MiniLab V8.5-dev — Termius ile derleme rehberi

**Sürüm:** V8.5-dev (versionName `8.5`, versionCode `26`, applicationId `com.altez.minilab.v4` — değişmedi, imza düzeni değişmedi).
**Durum:** Bu paket **kaynak ZIP**'tir (APK DEĞİLDİR). APK bu paketi hazırlayan ortamda üretilmedi (orada Android SDK yok). **GERÇEK ANDROID CİHAZ TESTİ YAPILMADI; hiçbir ses cihazda dinlenmedi.**

## 0. Bilmeniz gerekenler (önce okuyun)
0. **123/123 gerçek Türkçe MP3 BU PAKETTE VARDIR (V8.5-dev R6).** 106 eski kayıt (V8.4) + 17 yeni kayıt, hepsi `assets/sounds/voice/` altında; her dosyanın SHA-256'sı `V8.5-DEV/SES-123-SHA256.tsv`. Kaynaklar (sizin sunucunuzda hazırlanan, bu ortamda yeniden doğrulanan paketler): `ALTEZ-MiniLab-V8.4-106-SES.zip` (SHA-256 `bee23348481a03e7cf1a0b5f9553f2ec806bf384b034722f242bf27fc276f879`) ve `ALTEZ-MiniLab-V8.5-dev-R6-SES-PAKETI.zip` (123 MP3; SHA-256 `4f25a6382ac5970f854db8410a21799985044860eb56cdb9b45ead97b12ca22c`). **Hiçbiri kulakla/cihazda dinlenmedi.** Bu kaynak ZIP ses paketinden AYRIDIR (ses paketi yalnız MP3 + 3 manifest içerir). Sunucuya erişimim yok; sunucudaki dosyaları değil, bana verilen kopyaları doğruladım.
1. **Kullanılmayan 2 geçerli dosya (R6 incelemesi):** `adv_1af7bacb` (`hints.incomplete`) ve `adv_51f3721e` (`next`, "Sıradaki macera…") MP3'leri geçerli ama oyun akışı bunları sesli OKUMAZ: `incomplete` bütün devre görevlerinde (eski 8 görev dahil) yalnız maskot balonunda yazıdır; `next` ödül ekranında yalnız yazılı nottur. Ses envanteri tüm metinleri kapsadığı için üretilmişlerdir; akış değiştirilmedi. Diğer 15 yeni dosya testle doğru olayda çağrılıyor (ui-v85-audio S16).
2. 123 satırdan **17'si yeni/yeniden yazılmıştır** (`V8.5-DEV/YENI-SESLENDIRME-SATIRLARI.txt`): bunların gerçek MP3'ü hiçbir yerde yoktur → cihaz TTS'i. Bunlar `scripts/gen-voice-elevenlabs.mjs` ile sunucuda üretilir (API anahtarı YALNIZ ortam değişkeni; `.env.example` bilgi amaçlıdır, anahtar içermez).
3. Müzik ve ortam sesleri dosya değildir: kodla (WebAudio) üretilen özgün sentezdir (`src/core/music.js`, `ambience.js`); lisans sorunu yoktur, dosya yolu yoktur (`assets/manifest.json > music/ambience` = `null`). Çağlayan anlatıcı sesinin ticari kullanım koşulları **sizin tarafınızdan doğrulanmalıdır**.
4. Aşağıdaki ortam bilgileri (JDK 21, Node 22, `ANDROID_HOME=/opt/android-sdk`, Playwright yolu) **önceki V8.4 teslim belgesinden** alınmıştır; sunucunuzda komutlarla **doğrulayın** (adım 3).

## 1. Paket içeriği
Kaynak (`src/`, `assets/`), `package.json` + `package-lock.json`, `capacitor.config.json`, `android/` (Gradle wrapper dahil, `android/gradlew` 0755), `android-res/` (ikonlar), `tests/`, `scripts/` (build, test, sürüm, ses araçları), `install-and-build.sh`, belgeler (`V8.5-DEV/`, `V8.4-TESLIM/`), `MANIFEST.sha256`.
**ZIP'te yok (temiz kurulumla yeniden üretilir):** `node_modules/` (`npm ci`), `www/` (`node scripts/build.mjs`), `android/app/build/`, `android/app/src/main/assets/public` (`npx cap sync android` üretir).
Capacitor sürümleri (kilit dosyasından): `@capacitor/core|cli|android` 8.5.3, `@capacitor/app` 8.1.2, `@capacitor-community/text-to-speech` 8.0.2. Gradle wrapper 8.14.3, Android Gradle Plugin 8.13.0, compileSdk/targetSdk 36, minSdk 24, Java 21 uyumluluğu.

## 2. ZIP'i doğrulayıp açın
```
cd ~                                   # ZIP'in bulunduğu klasör (yolu kendinize göre düzeltin)
sha256sum ALTEZ-MiniLab-V8.5-dev-TERMIUS-READY.zip     # teslim raporundaki SHA-256 ile karşılaştırın
python3 -m zipfile -t ALTEZ-MiniLab-V8.5-dev-TERMIUS-READY.zip   # arşiv bütünlüğü ("Done testing" beklenir)
mkdir -p ~/v85 && unzip -q ALTEZ-MiniLab-V8.5-dev-TERMIUS-READY.zip -d ~/v85
cd ~/v85/altez-minilab-v8.5-dev
sha256sum -c --strict MANIFEST.sha256 | tail -3        # tümü OK olmalı
test -x android/gradlew && echo "gradlew calistirilabilir"
```
`unzip` yoksa: `python3 -c "import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" <zip> ~/v85` (izinler için ardından `chmod +x android/gradlew install-and-build.sh scripts/*.sh`).

## 2b. Bağımlılık kurulumu hakkında
`npm ci` lock dosyasına birebir kurar ve `package.json`/`package-lock.json` dosyalarını DEĞİŞTİRMEZ (paketi hazırlayan ortamda temiz dizinde doğrulandı: 100 paket, lock aynı kaldı; `npx cap sync android` o dizinde başarıyla çalıştı, 2 eklenti buldu). npm kayıt sunucusuna (registry.npmjs.org) erişim gerekir. Bir proxy/`NO_PROXY` ayarı kayıt sunucusunu "doğrudan" bağlanılacaklar listesine koyuyorsa (ENOTFOUND hatası) bu paketin değil ortamın sorunudur; o ortamda `env -u NO_PROXY -u no_proxy -u npm_config_noproxy npm ci` gerekebilir.

## 3. Ortamı denetleyin (hiçbir şey kurmaz)
```
node -v && npm -v          # Node 20+ gerekir (V8.4 sunucusunda 22 idi)
java -version 2>&1 | head -1   # JDK 21 beklenir (capacitor.build.gradle Java 21 hedefler)
echo "$ANDROID_HOME"; ls "$ANDROID_HOME/platforms" "$ANDROID_HOME/build-tools" 2>&1 | head   # platforms;android-36 + build-tools gerekir
```
Ağ gerekir: npm kaydı (npm ci), `services.gradle.org` (wrapper 8.14.3), Google Maven + Maven Central (Gradle bağımlılıkları). Gradle/AGP indirmeleri ilk derlemede yapılır.
`ANDROID_HOME` ayarlı değilse: `export ANDROID_HOME=/opt/android-sdk` (yolu doğrulayın) veya `android/local.properties` içine `sdk.dir=...` yazın (bu dosya ZIP'e KONMAZ).

## 4. Seslendirmeler (123/123 pakette)
```
# 4.1 Paketteki 123 dosyayı doğrulayın (SHA-256 listesi V8.5-DEV/SES-123-SHA256.tsv)
ls assets/sounds/voice/*.mp3 | wc -l                                    # 123 beklenir
tail -n +2 V8.5-DEV/SES-123-SHA256.tsv | awk -F'\t' '{print $2"  assets/sounds/voice/"$1}' | sha256sum -c --quiet && echo SES-SHA-OK
# 4.2 (isteğe bağlı) Sunucudaki ses paketlerini doğrulayın
sha256sum /home/altez/ALTEZ-MiniLab-V8.5-dev-R6-SES-PAKETI.zip         # 4f25a6382ac5970f854db8410a21799985044860eb56cdb9b45ead97b12ca22c beklenir
# 4.3 Manifesti denetleyin
node scripts/voice-sync.mjs                                              # "ses dosyasi 123/123 ... eksik 0" beklenir
node --test "tests/*.test.js"
```
Başka bir kaynaktan yeniden aktarma gerekirse: `node scripts/import-voice.mjs <kaynak-proje-dizini> --dry|--report /tmp/x.tsv` (kaynağa yazmaz, üzerine yazmaz, yer tutucuyu ve geçersiz MPEG'i reddeder). Sesler değişirse `voice-sync` ile manifest güncellenir.

**Lisans:** Çağlayan sesi (ElevenLabs ses kimliği `sJ0xHHPzz1LOio4QNlB0`, kategori `professional`, kütüphane sesi) ve tüm kayıtların ticari kullanım lisansı **doğrulanmadı**; ticari kullanıma uygun diye İŞARETLENMEMİŞTİR. Yayın öncesi ElevenLabs plan/lisans koşullarınızı siz doğrulayın. Müzik/ortam/efektler kodla üretilen sentezdir (dosya yok, kulakla dinlenmedi).

## 5. Kurulum + test + Capacitor senkronu + APK
**Tek komut (önerilen; tam test + APK; her adımın çıkış kodu denetlenir):**
```
OUT_DIR=$HOME/out-v8.5-$(date +%Y%m%d-%H%M%S) bash install-and-build.sh
# UI testleri için Playwright gerekir: PLAYWRIGHT_PATH=<.../node_modules/playwright> ekleyin (V8.4 sunucusunda: /home/altez/v7-browser-tools/node_modules/playwright — doğrulayın)
# UI testi atlanırsa çıkış kodu 3 olur ("eksik doğrulama"); başarı sayılmaz.
```
**Elle, adım adım:**
```
npm ci --no-audit --no-fund                 # lock dosyasına birebir
node --test "tests/*.test.js"               # birim testleri (324 bekleniyor)
node scripts/build.mjs                      # www/ üretir (harici adres varsa BAŞARISIZ olur)
npx cap sync android                        # www + eklentiler -> android/ (internet gerekmez; node_modules gerekir)
bash scripts/prepare-android.sh             # sürüm/eklenti/applicationId kontrolleri (APK üretmez)
cd android && ./gradlew assembleDebug && cd ..
```

## 6. APK'yı doğrulayın
```
APK=android/app/build/outputs/apk/debug/app-debug.apk       # install-and-build.sh ise: $OUT_DIR/ALTEZ-MiniLab-V8.5.apk
ls -l "$APK"; sha256sum "$APK"
"$ANDROID_HOME"/build-tools/*/aapt dump badging "$APK" | grep -E "^package:|versionCode|versionName"
```
Beklenen: paket `com.altez.minilab.v4`, versionCode **26**, versionName **8.5**. `bash scripts/package-apk.sh` APK'yı `ALTEZ-MiniLab-V8.5.apk` adıyla ayrı kopyalar ve teknik doğrulama yapar. Debug APK debug anahtarıyla imzalanır: V8.3/V8.4 APK'larını **güncelleyip güncellemediği** (imza aynı mı) kurulumda `adb install -r` ile görülür — bu kontrol yapılmadı.

## 7. Sorun giderme
- `npm ci` "lock ile uyumsuz": `package.json`/`package-lock.json` değiştirilmiş olabilir; ZIP'i yeniden açın. `npm install` KULLANMAYIN.
- `cap sync` "www yok": önce `node scripts/build.mjs`.
- Gradle "SDK location not found": `ANDROID_HOME` / `local.properties`.
- Gradle "Unsupported class file / Java": JDK 21 kullanın.
- `build.mjs` "harici adres": yeni eklenen bir dosya dış URL içeriyor demektir (uygulama çevrimdışıdır).
- UI test (Playwright) yoksa birim testleri + build + APK yine çalışır; UI testi çıkış kodu 3 verir.

## 7b. Neyin nerede doğrulandığı
- **Yalnızca yerel geliştirme (sandbox) ortamında doğrulandı:** birim testler, Chromium UI/smoke testleri (simülasyon), preflight, ZIP bütünlüğü/manifest, temiz açmada `npm ci` (çıkış 0) ve `cap sync android` (çıkış 0).
- **GERÇEK SUNUCUDA doğrulanmadı (erişim yoktu):** V8.4 yolu, 106 MP3, ses aktarımı, Android SDK/Gradle, APK, imza. Bunları Termius adımlarıyla siz doğrularsınız.
- Kalan oyun geliştirmeleri: `V8.5-DEV/GELISTIRME-DURUMU-V85.md`.

## 8. Cihazda kontrol
`V8.5-DEV/CIHAZ-KONTROL-LISTESI-V85.md` (ses dinleme dahil). Bilinen eksikler: `V8.5-DEV/DEGISIKLIK-OZETI.md`, test sonuçları: `V8.5-DEV/TEST-RAPORU.md`, ses/müzik mimarisi: `V8.5-DEV/SES-VE-MUZIK.md`, sunucu adımları: `V8.5-DEV/SUNUCU-ADIMLARI.md`.
