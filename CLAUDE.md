# ALTEZ MiniLab — proje kuralları (Claude için kalıcı bellek)

Çevrimdışı, Android-öncelikli mini oyun uygulaması (4–8 yaş). Capacitor 8, vanilla ES modülleri. Kullanıcı Türkçe konuşur; yanıtlar Türkçe.

## Değişmez kurallar
- `applicationId` her sürümde `com.altez.minilab.v4`; imza düzeni korunur. Reklam, abonelik, uygulama içi satın alma, çevrimiçi hesap YOK. Gerçek para yok.
- Her sürüm kendi dizininde (`altez-minilab-vX.Y`) ve kendi çıktı klasöründe (`out-vX.Y-<zaman>`) geliştirilir. Eski kaynaklar, ZIP'ler ve APK'lar (V7.x … **V8.3**) salt okunurdur: ÜZERİNE YAZILMAZ, silinmez, yeniden adlandırılmaz. Başlangıç SHA-256 manifesti (`v84-baseline/`) ile bütünlük doğrulanır.
- Teslim = bağımsız TAM ZIP; temiz açma ile kanıtlanır: `sha256sum -c --strict MANIFEST.sha256`, dosya kümesi eşitliği, `test -x android/gradlew`, testler. `android/gradlew` ZIP'te **100755** olmalı (`scripts/pack-zip.py`, `scripts/verify-delivery.sh`, `install-and-build.sh`, `prepare-android.sh` kontrolleri birlikte); izin eksikse teslim BAŞARILI sayılmaz.
- Gerçek cihazda yapılmayan testi yapılmış gibi raporlama. Her raporda "GERÇEK ANDROID CİHAZ TESTİ YAPILMADI" ve simüle/gerçek ayrımı yazılır. Bu sandbox'ta Android SDK yok → APK üretilemez (PARTIAL; sunucu komutları verilir). APK kullanıcının sunucusunda derlenir (`/home/altez/...`, ANDROID_HOME=/opt/android-sdk, Java 21).
- Başarısız testi gizleme, test beklentisini düşürme. Beklenti değişimi bilinçli bir özellik değişikliğiyse gerekçesiyle belgelenir.
- Test düzeni: birim (`node --test tests/*.test.js`) → hedefli UI testleri (`ui-v75 … ui-v84`, `ui-v84-market`) → temiz ZIP üzerinde preflight → 545'lik tam `scripts/ui-smoke.mjs` (eski ana ekranı `?home=1` ile açar) → (sunucuda) APK. Son APK yalnız toplu test ve hata düzeltmeden SONRA üretilir; ara APK yok.
- Yeni ses modeli/kütüphane/eklenti yok: mevcut `voice.js` (Android TextToSpeech), `audio.js` ve kayıtlı yerel MP3'ler. ElevenLabs API anahtarı uygulamaya/APK'ya konmaz; kayıtlar yerel varlıktır (`assets/sounds/`). ElevenLabs çıktısı bu ortama indirilemez (storage.googleapis.com politika ile 403) → MP3'ler kullanıcının sunucusunda `scripts/gen-voice-elevenlabs.mjs` (anahtar YALNIZ ortam değişkeni) ile üretilir, `scripts/voice-sync.mjs` ile doğrulanıp manifestlenir. Satır sesleri `adv_<hash>.mp3` (metinden türetilir, `src/core/voicekey.js`); dosya yoksa cihaz TTS'i (eski davranış).
- `pkill -f` ile kendi komutuna uyan desenleri öldürme; PID ile öldür. Gereksiz refaktör/bağımlılık yok; küçük, güvenli değişiklik.

## Mimari notlar
- Hash yönlendirme `src/core/app.js`: `#/` menü, `#/games`, `#/play/<id>`, `#/adventure`, `#/intro`, `#/progress`, `#/settings`, `#/profile`, `#/parent`. Geri tuşu: `src/core/back.js` (`registerBack`).
- Yön: `src/core/orient.js`. **YALNIZ Enerji Macerası yatay** (`#/adventure`, `#/play/energy-adventure`); diğer her şey serbest. Android köprüsü `AltezOrientation` (MainActivity). Manifest `screenOrientation="unspecified"`.
- Kayıt: `altez-minilab:v1` (allow-list `sanitize`, yalnız eklemeli şema; sıfırlama yok). Macera (`#/adventure`): `adv.tasks` (en iyi yıldız) + `adv.inv` (market envanteri). Coin AYRI SAYAÇTA TUTULMAZ: bakiye = kazanılan (görevlerden) − sahip olunan ekipman fiyatları (`adventure/model.js`). Yazma hatasında geri alınır (`completeAdvTask`, `buyItem`).
- Macera bölgeleri `assets/data/adventure.json > regions`: `pil` (8 görev, DEĞİŞMEZ) → `ev` (Evde Enerji, 7 gerçek hayat görevi) → `gunes` (yakında). Market katalogu `adventure.json > market` (sanal ekipman, tek seferlik). Devre görevlerinde `led` ve `resistor` parçaları; `need.resistor` direnç zorunlu kılar. Güvenli eğitim: priz/şebeke ASLA doğru cevap/deney değildir (test denetler).
- Giriş sesi: `assets/sounds/intro-caglayan.mp3` (manifest `sounds.introVoice`), `audio.playFile`; `src/games/adventure/intro.js` bir kez çalar, ses kapalıysa çalmaz, yoksa/engelliyse Türkçe TTS yedeği.
- Yeni CSS, `src/ui/styles.css` içinde `/* V7.5: Egitim DERS ekranlari yatay` yorumundan ÖNCE eklenir (v75 testi kuyruğu denetler). `.ghost` sınıf adı kullanılmaz.
- Playwright: `/home/claude/.npm-global/lib/node_modules/playwright` (`NODE_PATH` ile). Sahte `speechSynthesis` `Object.defineProperty` ile kurulur.

## Test komutları
`node --test tests/*.test.js` · `node scripts/build.mjs` · `node scripts/preflight.mjs [--ship]` · `node scripts/ui-v84.mjs` (+ regresyon: ui-v83, v82, v81, v79, v78-home, v78, v77, v76, v75).

## V8.4 yol haritası (talimat sırası)
A kaynak inceleme/geri dönüş → B ekran yönü → C Çağlayan sesi → D gerçek hayat görevleri → E coin → F Enerji Marketi → son doğrulama. (Kullanıcının toplu talimatıyla D–F, ara APK olmadan tek V8.4 dalında yapıldı; cihaz doğrulaması BEKLEMEDE.) Her aşama sonunda rapor.
