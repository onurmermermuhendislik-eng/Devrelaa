# V8.4 — Kurulum ve derleme (kullanıcının sunucusunda)

Bu paket **kaynak ZIP**'tir; APK bu sandbox'ta ÜRETİLEMEZ (Android SDK ve Google/Gradle/Maven ağları yok). APK sunucuda üretilir.

## 1. Gereksinimler (sunucuda)
- JDK 21, Node 22, npm, Python 3; `ANDROID_HOME=/opt/android-sdk` (cmdline-tools, platform-tools, `platforms;android-36`, build-tools 36.x, lisanslar kabul edilmiş).
- Ağ: Gradle wrapper dağıtımı (8.14.3), Google Maven, Maven Central, npm kaydı.
- Playwright: `/home/altez/v7-browser-tools/node_modules/playwright` (UI testleri için).

## 2. Kaynağı aç ve derle (tek komut, TAM test + APK)
```
unzip ALTEZ-MiniLab-V8.4-FULL.zip -d altez-minilab-v8.4 && cd altez-minilab-v8.4 && test -x android/gradlew
OUT_DIR=/home/altez/out-v8.4-$(date +%Y%m%d-%H%M%S) PLAYWRIGHT_PATH=/home/altez/v7-browser-tools/node_modules/playwright bash install-and-build.sh
```
Varsayılan UI testi **tam smoke** (`scripts/ui-smoke.mjs`). Hedefli: `SMOKE_SCRIPT=scripts/ui-v84.mjs` (yön/ses) veya `scripts/ui-v84-market.mjs` (görev/coin/market).

## 3. APK doğrulama (üretildikten sonra)
```
APK=<OUT_DIR>/ALTEZ-MiniLab-V8.4.apk
/opt/android-sdk/build-tools/*/aapt dump badging "$APK" | grep -E "package:|versionCode|versionName"   # com.altez.minilab.v4, 25, 8.4
/opt/android-sdk/build-tools/*/apksigner verify --print-certs "$APK"
ls -l "$APK"; sha256sum "$APK"
```
Beklenen: paket `com.altez.minilab.v4`, versionCode **25**, versionName **8.4**, imza V8.3 ile AYNI sertifika (üzerine güncelleme, veri korunur).

## 4. Çağlayan satır seslerini üretme (isteğe bağlı; yapılmazsa cihaz TTS'i çalışır)
ElevenLabs çıktısı bu ortama indirilemediği için MP3'ler sunucuda üretilir. **API anahtarı yalnız ortam değişkenidir; koda/APK'ya girmez.**
```
node scripts/gen-voice-elevenlabs.mjs --dry                      # 106 satırı listeler (ağ yok)
ELEVENLABS_API_KEY=... node scripts/gen-voice-elevenlabs.mjs --limit 3   # önce 3 örnek: DİNLE, intro-caglayan.mp3 ile aynı kişi mi?
ELEVENLABS_API_KEY=... node scripts/gen-voice-elevenlabs.mjs             # kalan satırlar (var olanı atlar)
node scripts/voice-lines.mjs && node scripts/voice-sync.mjs      # doğrula + SHA-256 manifesti + assets/manifest.json
node --test tests/*.test.js                                      # ses testleri (manifest yolları, MP3 başlığı, boyut)
```
Intro'yu üretirken kullandığınız model/ayarları `ELEVEN_MODEL`, `ELEVEN_STABILITY`, `ELEVEN_SIMILARITY`, `ELEVEN_STYLE`, `ELEVEN_SPEED` ile verin (anlatıcı tutarlılığı). Ses lisansı/ticari kullanım hakkı bu ortamdan doğrulanamadı: **ElevenLabs hesabınızda CAGLAYAN sesinin ticari kullanımını siz onaylayın.**

## 5. Geri dönüş
V8.3 kaynağına, ZIP'ine ve APK'sına dokunulmadı. Sorun olursa V8.3 APK'sını yeniden kurun (aynı imza/paket kimliği; kayıt `altez-minilab:v1` eklemeli olduğu için V8.4 → V8.3 geri dönüşte `adv.inv` alanı yok sayılır, veri bozulmaz).
