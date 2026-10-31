# V8.5-dev — Sunucuda yapılacaklar (kullanıcının sunucusu; bu sandbox'ta yapılamaz)
Bu ortamda **Android SDK yok → APK üretilemez**, ElevenLabs çıktısı indirilemez → yeni MP3'ler üretilemez.

1. Kaynağı sunucuya al (V8.4 dizinine DOKUNMA): `altez-minilab-v8.5-dev`.
2. 123/123 MP3 bu pakette (R6); doğrulama: README-TERMIUS.md adım 4.1–4.3 (SHA-256 listesi V8.5-DEV/SES-123-SHA256.tsv).
3. **17 yeni/yeniden yazılmış satır için MP3 üret** (`V8.5-DEV/YENI-SESLENDIRME-SATIRLARI.txt`):
   `ELEVENLABS_API_KEY=... node scripts/gen-voice-elevenlabs.mjs` (anahtar YALNIZ ortam değişkeni; uygulamaya/APK'ya girmez).
   Çıktıyı **dinleyip** sıcak/kısa/anlaşılır mı kontrol et; ticari kullanım lisansını doğrula.
4. `node scripts/voice-sync.mjs` (doğrular + manifestler; "eksik 0" beklenir) → `node scripts/build.mjs`.
5. `node --test tests/*.test.js`, hedefli UI testleri, `node scripts/preflight.mjs`, tam `scripts/ui-smoke.mjs`.
6. APK (Java 21, ANDROID_HOME=/opt/android-sdk): proje kurallarındaki derleme betikleri; paket adı/sürüm/boyut/SHA-256'yı raporla.
7. Cihazda `CIHAZ-KONTROL-LISTESI-V85.md` maddelerini yürüt.
