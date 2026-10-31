# ALTEZ MiniLab V8.1 — Kurulum ve Derleme

Sürüm **8.2** · versionCode **23** · applicationId **com.altez.minilab.v4** (tek kaynak: `scripts/version.env`).
Uygulama tamamen çevrimdışıdır; gizli anahtar/parola gerektirmez. Bu ZIP **yama değil, tam kaynak paketidir**.
ZIP'te `node_modules`, `www`, derleme önbellekleri, `android/local.properties`, gerçek `.env`, imza anahtarları, `.v7-*` kayıtları **yoktur** (kurallar: `release/rules.json`). `android/app/src/main/assets/public` ve üretilen `capacitor*.json` dosyaları `cap sync` ile yeniden oluşur.

## Gerekenler
| Araç | Sürüm | Not |
|---|---|---|
| Node.js + npm | Node 18+ | `npm ci` kilit dosyasından kurar |
| JDK | 17+ | Gradle için |
| Android SDK | build-tools (aapt, apksigner) + platform | `ANDROID_HOME` veya `ANDROID_SDK_ROOT` (örnek: `.env.example`) |
| Playwright + Chromium | kurulu, **projeye eklenmez** | UI smoke testi için zorunlu; yoksa sonuç PARTIAL olur |

Playwright kurulumu (proje bağımlılığı değildir):
```bash
npm install -g playwright
npx playwright install chromium
export PLAYWRIGHT_PATH="$(npm root -g)/playwright"
```

## Temiz kurulum ve derleme (tek komut)
```bash
mkdir /temiz/klasor && cd /temiz/klasor
unzip /yol/ALTEZ-MiniLab-V8.2-FULL.zip
cd altez-minilab-v8.2
sha256sum -c --strict MANIFEST.sha256      # dosya bütünlüğü
export ANDROID_HOME=/usr/lib/android-sdk   # yoksa betik /usr/lib/android-sdk, /opt/android-sdk arar
bash install-and-build.sh
```
Sıra: araç kontrolü → **preflight** (zorunlu dosyalar, importlar, JSON/varlık yolları, package↔lock, Android/Capacitor, özellik envanteri, gizli bilgi) → `npm ci` → birim testleri → web derlemesi → UI smoke → `cap sync` + eklenti kontrolü (App/Geri tuşu, TextToSpeech) → `gradlew assembleDebug` → APK paket kimliği/sürüm/imza/SHA-256 → `BUILD-REPORT.md` + `TEST-REPORT.md`.

* Her çalıştırma **yeni** bir çıkış klasörü açar (`../altez-minilab-v7-out-<zaman>` veya `OUT_DIR=`); var olan klasör/APK'nın üzerine yazılmaz.
* Sonuç: `RESULT=OK` (çıkış 0) · `RESULT=PARTIAL` (3: bir doğrulama çalıştırılamadı, tam teslim değil) · `RESULT=FAILED` (1).
* `SKIP_SMOKE=1` / `SKIP_ANDROID=1` yalnızca PARTIAL sonuç verir.

## Teslim paketini üretmek (geliştirici)
V7 proje klasöründe: `bash scripts/make-release.sh` — preflight → tam ZIP → yeni klasöre açma → manifest doğrulama → ZIP'ten açılan kaynaktan `install-and-build.sh` → `SHA256SUMS` ve raporlar. Preflight başarısızsa ZIP/APK üretilmez. Çıktılar `../altez-minilab-v7-release-<zaman>/` içindedir:
`ALTEZ-MiniLab-V7-FULL.zip`, `ALTEZ-MiniLab-V7.apk`, `MANIFEST.sha256`, `SHA256SUMS`, `BUILD-REPORT.md`, `TEST-REPORT.md`, `README-KURULUM.md`, `ANDROID_TEST.md`.

## Elle adımlar
```bash
node scripts/preflight.mjs .            # release denetimi
npm ci && npm test && npm run build
node scripts/ui-smoke.mjs               # Playwright gerekir (~10 dk)
bash scripts/prepare-android.sh
(cd android && ./gradlew assembleDebug)
OUT_DIR=/yeni/klasor bash scripts/package-apk.sh
```
APK **debug anahtarıyla** imzalıdır (yayın imzası değildir).

## Gerçek cihaz testi
Betikler cihaz testi yapmaz; raporlar “cihaz testi yapılmadı” der. `ANDROID_TEST.md` içindeki **V7** listesini telefonda elle uygulayın.

## V7.8 notu: hedefli UI testi
`bash install-and-build.sh` varsayılan olarak TAM `scripts/ui-smoke.mjs` testini koşar (V7.4'te 545 kontrol; V7.7 ve V7.8'de bilinçli olarak koşulmadı).
V7.8'de değişen davranışları (yeni vakalar, küçük ekran/yatay yerleşim, tekrar yanlış, ses zamanlaması, kayıt hatası) koşmak için:
```bash
SMOKE_SCRIPT=scripts/ui-v78.mjs bash install-and-build.sh      # ya da: PLAYWRIGHT_PATH=... npm run test:ui78
SMOKE_SCRIPT=scripts/ui-v78-home.mjs bash install-and-build.sh # yeni Ana Menu + maskot + animasyon (106 kontrol)
```
Kısa regresyonlar: `npm run test:ui77` (146), `scripts/ui-v76.mjs` (49), `scripts/ui-v75.mjs` (63). Raporlar tam smoke'un KOŞULMADIĞINI açıkça yazar. Tam smoke için `SMOKE_SCRIPT` vermeyin.

## Sürüm bilgisi (tek kaynak)
Ekranda görünen "Uygulama sürümü V8.1" ile Android `versionName` aynı kaynaktan gelir: `scripts/version.env`.
`node scripts/build.mjs` her derlemede `assets/data/app-version.json` dosyasını bu kaynaktan yeniden üretir (elle düzenlemeyin);
`node scripts/preflight.mjs` ikisinin uyumunu denetler. Yeni sürümde yalnızca `version.env` (ve build.gradle/package.json) güncellenir.

## V7.8 yeni Ana Menü, maskot ve animasyon
Ana ekran 4 kartlıdır: **Oyunlar** (Şekli Tamamla, Sayı Avı, Mucit Atölyesi, Elektrik Dedektifi, Mantık ve Bilim), **Eğitim**, **Profil**, **Ebeveyn**.
Profil ve Ebeveyn yalnızca "Geliştirme Aşamasında" bilgi panelidir; profil, PIN veya süre sınırı YOKTUR.
Maskot (`src/ui/mascot.js`) satır içi SVG'dir, çevrimdışıdır, yeni ses üretmez. Animasyonlar yalnız transform/opacity kullanır ve cihazın "hareketi azalt" tercihine uyar.
Kayıt biçimi değişmedi. Görevler merkezi `#/play/tasks` ile hâlâ açılır, Oyunlar ekranındaki kartlar doğrudan oyunlara gider.

## V7.9 Maskot V2 + Enerji Macerası (ilk dilim)
- Maskot büyütüldü ve duygusal durumlar eklendi (karşılama, başarı, cesaretlendirme, ipucu); oyun içinde cevap/oyun alanını örtmeyecek güvenli yerleşim; `prefers-reduced-motion` desteği. Yeni ses/model YOK.
- Enerji Macerası: yalnız **Pil ve Enerji** bölgesi oynanır (4–5 yaş 6, 6–8 yaş 8 görev); diğer 4 bölge "Yakında". Coin yalnız ilk tamamlamada, görsel ödüldür (reklam, satın alma, enerji sınırı, coin kaybı yok). Eski kayıtlar korunur; yeni kayıt alanı yok.
- Hedefli test: `SMOKE_SCRIPT=scripts/ui-v79.mjs bash install-and-build.sh` ya da `npm run test:ui79`.

## V7.9.1 (V7.9 fix1 üzerine sürüm yükseltmesi)
Yatay ekranda görev bitişinde maskot "Görev listesi"/"Sonraki görev" düğmelerine binmez (kenar taramalı güvenli yerleşim). Sürüm 7.9 / 18 → **7.9.1 / 19** (applicationId aynı: com.altez.minilab.v4; aynı imzayla güncelleme için bkz. DEBUG-KULLANIMI.txt). Hedefli test: `scripts/ui-v79.mjs` (110 kontrol).

## V8.0 Aşama 1 — yatay macera prototipi (V7.9.1 üzerine)
Maskotlu tanıtım (ilk açılış, atlanır/tekrar izlenir) → yatay macera haritası (Pil ve Enerji: 5 görev + final, ilerleyen bölge kilitli) → pil+lamba devre görevi → ödül → sıradaki görev. Eski Mini oyunlar/Eğitim, haritadaki ☰ menüsünden "Mini oyunlar" ile (ve eski ana ekrandaki 🗺️ Macera düğmesiyle geri) erişilir.
- Uygulama **yatay kilitli** (`AndroidManifest.xml` → `android:screenOrientation="sensorLandscape"`); tarayıcıda dikeyde "cihazı çevir" uyarısı çıkar. Bu kilit eski oyunları da yataya zorlar (bilinen etki).
- Tüm ödül/koordinat/metin ayarı `assets/data/adventure.json` içindedir (yıldız eşikleri, coin değerleri, görev konumları). İlerleme tek kayıt alanından türetilir: `adv { intro, tasks { görevId: en iyi yıldız 1-3 } }`; coin/kilit/bölge durumu bundan hesaplanır, ayrı kayıt tutulmaz.
- `?home=1` adres parametresi soğuk açılışta eski ana ekrana gider (geliştirme/regresyon testleri için).
- Hedefli testler: `node --test tests/*.test.js` (238), `node scripts/ui-v81.mjs` (112 kontrol). Tam 545 smoke bilinçli olarak koşulmaz.
- GERÇEK ANDROID CİHAZ TESTİ YAPILMADI; bu pakette APK yoktur (bkz. V8.1-TESLIM/KURULUM-DERLEME.md).

## V8.1 — ana menü, sesli yönerge, 8 görev
- Açılışta Enerji Macerası otomatik başlamaz: yatay ana menü (Enerji Macerası, Oyna, Eğitim, İlerlemem, Ayarlar). Tanıtım yalnız ilk açılışta, atlanabilir.
- Ses: menüde ve Ayarlar'da aç/kapa; her görevde "Tekrar dinle"; ses motoru yok/Türkçe yok/çalmıyor ise uyarı gösterilir. Ses testi gerçekten konuşma başlayınca "çalıştı" der.
- 8 veri tabanlı görev (`assets/data/adventure.json`), sıralı kilit, ödül yalnız ilk tamamlamada. V8.0-proto1 kayıtları `legacy` eşlemesiyle taşınır.
- Hedefli testler: `node --test tests/*.test.js`, `node scripts/ui-v81.mjs`. Tam 545 smoke koşulmaz.
- GERÇEK ANDROID CİHAZ TESTİ YAPILMADI (ses çıkışı, yatay kilit, sürükleme, performans cihazda doğrulanmadı).


## V8.2 (versionCode 23)
Menü ve tanıtım dikey/yatay çalışır; yalnız oyun/macera ekranları yatay kilitlenir (MainActivity `AltezOrientation` köprüsü, yeni eklenti yok). Ana ekranda ayrı Profil (yerel ad/soyad, çevrimiçi hesap YOK) ve Ebeveyn (PIN + yetişkin sorusu; çocuk kilidi, güvenlik sistemi değil) düğmeleri. Tanıtım sesi mevcut TTS/ses altyapısıyla çalışır. Sunucuda derleme: `SMOKE_SCRIPT=scripts/ui-v82.mjs bash install-and-build.sh`. `android/gradlew` ZIP'te 100755 olmalıdır; `scripts/verify-delivery.sh` kontrol eder.


## V8.3 (versionCode 24)
Yalnız giriş sesi: `assets/sounds/intro-caglayan.mp3` (ElevenLabs CAGLAYAN, yerel; API anahtarı/internet yok). Tanıtımda bir kez çalar, ses ayarına uyar, çalmazsa V8.2 TTS yedeği devreye girer. Oyun içi sesler sonraki aşamadır. Sunucuda: `SMOKE_SCRIPT=scripts/ui-v83.mjs bash install-and-build.sh`.


## V8.3 (versionCode 24)
Yalnız giriş sesi eklendi: ElevenLabs ile üretilmiş CAGLAYAN kaydı `assets/sounds/intro-caglayan.mp3` (yerel varlık; API anahtarı/internet yok). Tanıtımda bir kez çalar, ses ayarına uyar, yüklenemezse V8.2'deki Türkçe TTS yedeği devreye girer. Oyun içi sesler sonraki aşamadır. Sunucuda derleme: `SMOKE_SCRIPT=scripts/ui-v83.mjs bash install-and-build.sh`.


## V8.4 (Aşama A–C, versionCode 25)
Yön kilidi kapsamı daraltıldı: YALNIZ Enerji Macerası yatay, diğer tüm oyunlar dikey ve yatay serbest. Eğitim ders kartlarının dikeyde taşması giderildi. Çağlayan giriş sesi: otomatik oynatma engeline karşı ilk-dokunuş yeniden denemesi, arka planda durma. Görevler/coin/market sonraki aşamalardır. Sunucuda derleme: `SMOKE_SCRIPT=scripts/ui-v84.mjs bash install-and-build.sh`. Proje kuralları: `CLAUDE.md`.
