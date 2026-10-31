# ALTEZ MiniLab – V1

4–8 yaş için minimalist, reklamsız, çevrimdışı mini oyun altyapısı. İlk oyun: **Şekli Tamamla**
(geometri + basit elektrik devresi: pil, LED, direnç, kablo, anahtar, seri/paralel).

## Çalıştırma
```
npm start            # http://127.0.0.1:5173  (bağımlılık yok, sadece Node 20+)
npm test             # 26 mantık testi (node:test)
npm run test:ui      # Chromium'da uçtan uca test (Playwright makinede kurulu olmalı)
npm run build        # www/ üretir (harici adres varsa başarısız olur)
```

## Klasör yapısı
```
index.html            giriş (CSP: yalnızca kendi dosyaları, harici ağ yok)
assets/manifest.json  veri + ses/sesli yönerge yolları
assets/data/          shapes.json, colors.json, circuits.json, strings.tr.json
assets/sounds|voice/  sonradan konacak ses dosyaları (boşsa uygulama sentezler / cihaz TTS)
src/core/             rng, storage, progress, assets, audio, voice, app (yönlendirme)
src/ui/               home.js, styles.css
src/games/registry.js oyun kaydı
src/games/shape-complete/
  geometry.js rounds.js          şekil mantığı (saf, testli)
  circuit-sim.js circuit-rounds.js  devre benzetimi + bölümler (saf, testli)
  render.js circuit-render.js    SVG çizimi
  game.js                        DOM + zamanlama + ipuçları
tests/  scripts/  capacitor.config.json
```
Ana altyapı oyunların içini bilmez; yeni oyun = `src/games/<oyun>/` + `registry.js`'e bir satır.

## İçerik nasıl değişir
- **Şekiller/renkler:** `assets/data/shapes.json`, `colors.json` (kodda gömülü şekil yok).
- **Devre bölümleri:** `assets/data/circuits.json` (düğümler, parçalar, boş konumlar, `silhouette`, `finish`).
- **Sesler:** `assets/manifest.json` içinde `sounds.<ad>` yoluna dosya yazın (ör. `assets/sounds/success.mp3`); `null` = yerleşik sentez.
  Sesli yönerge: `voice.<ad>`; boşsa cihazın Türkçe TTS'i kullanılır, yoksa sessiz kalır.
- **Metinler / slogan / sesli yönerge cümleleri:** `assets/data/strings.tr.json`.
- **Seviyeler:** `assets/data/levels.json` (Başlangıç, Çırak, Kalfa, Usta, Kaşif, Mucit). `active` seviyelerin doğru cevap eşiği ve oyun içeriği (`content.<oyun>.tier`) vardır; `planned` seviyeler (Kaşif, Mucit) bilerek boştur: eşik/içerik yok, çocuk oraya yükselmez, ana ekranda soluk görünür. Yeni içerik: ilgili seviyeye `content` kaydı + `min` + `status: active`.
- **Şekli Tamamla V2 görevleri:** `assets/data/figures.json` (döndürme ve simetri şekilleri; yeni şekil = listeye kayıt). Görev tipleri: eksik parça, renk/şekil eşleştirme, örüntü, **döndürülmüş şekli bul**, **simetriyi tamamla**; yaş/seviyeye göre `rounds.js > kindWeights`; arka arkaya aynı tip gelmez. Yeni görevlerde ipucu doğru seçeneği parlatmaz, yanlışları eler.
- **Devre görevleri:** `assets/data/circuits.json`. Bölüm sırası yalnızca sona eklenerek büyür (kayıtlı ilerleme kaymasın); `fault: true` = bozuk kablo (önce dokunulur, sonra yerine doğru parça konur).
- **Marka:** `assets/brand/*.svg` (simge, yazı, ALTEZ yazısı kaynak dosyalardır); `npm run brand` lockup, ikon katmanları ve `android-res/` PNG'lerini üretir.
- **Açılış jingle'ı:** `assets/sounds/minilab-jingle.mp3` (özgün, kodla sentezlendi: `npm run jingle`, ffmpeg gerekir). Beğenmezseniz aynı dosya adıyla değiştirin ya da `manifest.json > sounds.jingle` yolunu değiştirin. Aynı kancanın kısa varyasyonu devre başarı müziğinde de çalar.

## Gizlilik
Saklanan tek veri (cihazda `localStorage`): doğru sayısı, yaş grubu, ses tercihi, devre bölümü ilerlemesi.
Reklam, analitik, hesap, satın alma, ağ isteği yok.

## Android (Capacitor) – kendi makinenizde
Adım adım komutlar ve gerçek cihaz kontrol listesi: **ANDROID_TEST.md**.
Marka ikonları `android-res/` altında hazırdır; `npx cap add android` sonrası `node scripts/android-prep.mjs` ile kopyalanır.

## Bilinen eksikler (V1)
Android derlemesi ve gerçek cihaz testi yapılmadı; ses kalitesi yalnızca ölçüm/dalga analiziyle doğrulandı (kulakla dinlenmedi);
TTS yalnızca cihazda denenebilir; LED kutupluluğu modellenmedi; ebeveyn paneli yok (bilinçli).


## Aşama 4: Sayı Avı + oyun seçimi
- Ana ekran artık oyun seçimi: 🧩 Şekli Tamamla ve 🔢 Sayı Avı kartları (`src/ui/home.js`, kartlar `games` kaydından üretilir). Yaş grubu ve ses ayarı iki oyunda ortaktır.
- Sayı Avı: `src/games/number-hunt/` (`rounds.js` saf mantık, `render.js` çizim, `game.js` denetleyici), veri `assets/data/numbers.json`, nesne görselleri `assets/numbers/objects/`.
- İlerleme: oyuna özel `games.<id>.correct` (storage `getGame/updateGame`); Şekli Tamamla'nın üst düzey `correct` alanı ve V3 kayıt biçimi aynen korunur.
- Yeni oyun eklemek: `src/games/<oyun>/` + `registry.js` satırı + `strings.tr.json > games.<id>` metni.
- Testler: `npm test` (67), `npm run build`, `npm run test:ui` (Playwright gerekir; 301 kontrol).


## Aşama 5 (V5 – Mucit): Mucit Atölyesi
- Üçüncü oyun: 💡 **Mucit Atölyesi** (`src/games/invent/`): sabit pilli tahtaya kablo / LED / direnç / anahtar yerleştirerek serbest devre kurulur. Sonuç canlı görülür (Şekli Tamamla ile aynı çizim ve aynı `simulate`; o oyunun koduna dokunulmadı).
- İki tahta: **Tek yol** (➰, seri) ve **İki yol** (🪜, paralel). Seri iki LED soluk, paralel iki LED parlak yanar; çocuk farkı kendi denemesiyle görür.
- Yanlış deneme cezası yok: boşluk/anahtar/LED eksikliği nazik ipucuyla gösterilir (💡 düğmesi + 12 sn sonra kendiliğinden); LED'siz yol "kısa devre" olarak gösterilir (LED'ler sönük).
- 6 keşif (💡 ilk ışık, 🔘 anahtarla aç-kapa, 🟫 direnç, ➰ seri, 🪜 paralel, ⚡ kısa devre) ve en fazla 6 kayıtlı **buluş** (⭐ kaydet, 📂 buluşlarım). Kayıt: `games.invent` (`correct` = keşif sayısı, `found`, `saved`); V3/V4 kayıt biçimi aynen geçerli.
- Ana ekran: 3 kart; Mucit kartında `Mucit n/6` rozeti (oyun `badge()` ile kendi rozetini tanımlar).
- `#/voice-test` tanı sayfası artık açılışı ele geçirmez (soğuk açılışta `#/` olur); menüde bağlantısı yoktur.
- Testler: `npm test` (98+), `npm run build`, `npm run test:ui` (363 kontrol).

## V5.1: Mucit Atölyesi sağlamlaştırma
**Devre modeli (bilerek basit, "çocuk modeli" – gerçek Ohm yasası DEĞİL):** `src/games/invent/logic.js`
- Pil ideal kabul edilir; pilin + ucundan − ucuna giden her yol bağımsız hesaplanır (paralel kollar birbirini etkilemez).
- Yol yükü `L = LED sayısı + 0,5 × direnç sayısı`; parlaklık `1 / L^0,8` (L<1 → tam). Daha çok direnç/LED asla daha parlak yapmaz.
- `L > 3` ise pil yetmez: o yoldaki LED'ler yanmaz, "Pil yetmedi" mesajı çıkar. (Bu eşik gerçek pil gerilimi değil, oyun kuralıdır.)
- LED'i/direnci olmayan tam bir yol = kısa devre: hiçbir LED yanmaz, sakin mesaj verilir. Çökme/döngü yok.
- Sınırlar: gerçek akım/gerilim/güç hesaplanmaz; LED renk/gerilim farkı yok; yalnız iki hazır tahta (`loop`, `ladder`).
- Keşifler yalnız gerçekten koşul sağlanınca: ilk ışık, anahtar (açıp kapatmak ışığı değiştirince), direnç (yanan LED'in yolunda), seri (aynı yolda ≥2 yanan LED), paralel (ayrı kollarda yanan LED'ler), kısa devre. Benzersiz sayılır (`Mucit n/6`), kalıcıdır.

**Kayıt (⭐/📂):** en fazla 6 buluş (`games.invent.saved`, her kayıtta `v:1`). Altıncıdan sonra eskisi silinmez; "Buluş kutun dolu" mesajı çıkar. Yüklenip değiştirilen buluş yerinde güncellenir; 🗑 ile silinir. Depolama yazamazsa `saveOk()` false olur ve başarı mesajı gösterilmez. Bozuk/eski kayıtlar okunurken ayıklanır veya "açılamadı" kutusu olarak gösterilir. Android Geri tuşu önce "Buluşlarım"ı kapatır.

Testler: `npm test` (115), `node scripts/ui-smoke.mjs` (tarayıcı duman testi). Android: `VERSION_CODE=6 VERSION_NAME=5.1 bash scripts/prepare-android.sh`, `cd android && ./gradlew assembleDebug`, `bash scripts/package-apk.sh`.

## V5.2: Android Geri tuşu ve oyun oturumu
- Kök neden: oyun ekranı tarayıcı geçmişinin tek/alt girdisi olabiliyordu (doğrudan açılış, yenileme, geri yükleme) ve "Buluşlarım" açıkken yenileme ölü bir geçmiş girdisi bırakıyordu. Geçmiş yoksa Android Geri tuşu uygulamayı oyun açıkken arka plana atar.
- Çözüm (`src/core/app.js`): ana ekrandan açılan oyun girdisi `history.state.altezGame` ile işaretlenir; işaretsiz (doğrudan) girdinin altına ana ekran girdisi eklenir. Böylece Geri her zaman ana menüye gider; ana menüde Geri geçmişi biter. `src/games/invent/game.js`: "Buluşlarım" çekmecesi açıkken yenilenmişse ölü girdi atılır; `unmount` geçici durumu temizler.
- Tanı: `node scripts/back-probe.mjs` (test değildir).

## V6 – Aşama B: Android fiziksel Geri tuşu
- **Kök neden (Capacitor 8.5.3 / @capacitor/app 8.1.2 kaynağı):** Capacitor çekirdeği Geri tuşunu işlemez. WebView geçmişine `goBack()` yapan kod ayrı `@capacitor/app` eklentisindedir. Eklenti yoksa Geri tuşu JS'e ulaşmaz ve Android uygulamayı, ekranda ne varsa onunla arka plana atar. Eklenti varsa ama JS dinleyicisi yoksa `canGoBack` false iken hiçbir şey yapmaz (ana ekranda Geri ölü kalır). V5.1/V5.2'deki `history` mantığı tarayıcıda doğruydu ama fiziksel tuş ona hiç ulaşmıyordu.
- **Çözüm:** `src/core/back.js` eklentinin `backButton` olayını TEK kez dinler (`Capacitor.addListener('App','backButton',…)`, paketleyici gerekmez): ① açık katman (Buluşlarım) varsa yalnız onu kapatır, ② oyundan ana ekrana döner, ③ ana ekranda `minimizeApp`. Çift Geri tek çıkış yapar. `history` tabanlı davranış (V5.2) tarayıcı için yedek olarak kalır.
- **Sunucuda bir kez:** `npm install @capacitor/app@8.1.2` sonra `npx cap sync android`. `scripts/prepare-android.sh` eklenti kayıtlı değilse HATA verir.
- Kalıcı kayıtlar hiçbir Geri akışında silinmez (yalnız ekran/oturum durumu temizlenir).
- **Doğrulama (V6, kaynak kodundan):** `Capacitor.addListener(plugin, olay, cb)` Capacitor 8.5.3'ün Android `native-bridge.js` dosyasında tanımlıdır (resmî `App.addListener` de `nativeCallback(plugin,'addListener',{eventName},cb)` ile aynı native çağrıya iner); `minimizeApp` eklentide `Promise` metodudur (`nativePromise`). `@capacitor/app` JS paketi uygulama çıktısına DAHİL EDİLMEZ ve gerekmez (build'de import yoktur); yalnızca native tarafın `cap sync` ile kaydı gerekir. `tests/fixtures/capacitor-8.5.3-native-bridge.js` gerçek köprü dosyasıdır; duman testi back.js'i onun üzerinde sınar. Bu bir CİHAZ testi değildir.
- Eklenti yoksa / dinleyici reddedilirse / köprü yoksa durum `missing` / `error` / `no-bridge` olur; gizli tanı sayfasında (`#/voice-test`) "GERI TUSU: … HATA/UYARI" satırı görünür.

## Test notu: Şekli Tamamla duman testindeki "devre turu cozulemedi" kararsizligi
Kök neden zamanlama degil: `ui-smoke.mjs` cozucusu "Bozuk parcayi bul" turunu (c12: once bozuk parcaya dokunulur, parca secimi yerlestirmez) bilmiyordu; Usta bandinda rastgele bu tur gelince hata veriyordu. Cozucu artik bozuk parcayi duzeltiyor (urun kodu degismedi). Dogrulama: eski cozucu ~108 turda 3 kez takildi; yeni cozucu 180 turda (60 devre, 7 bozuk-parca turu) 0 hata.

## V7 – Eğitim Bölümü (ilk sürüm)
- **Sürüm:** 7.0 / versionCode 9, uygulama kimliği `com.altez.minilab.v4` (değişmedi). Sürüm, kimlik ve APK adı TEK yerden gelir: `scripts/version.env` (`prepare-android.sh` bunu `android/app/build.gradle`'a yazar, `package-apk.sh` buradan doğrular; APK adı `ALTEZ-MiniLab-V7.apk`).
- **Giriş:** ana ekranın altındaki 🎓 **Eğitim** düğmesi (oyun kartları ve ana ekran düzeni değişmedi; `#/play/learn` rotası aynı geçmiş/Geri altyapısını kullanır). `src/games/registry.js > games` aynen kaldı; Eğitim ayrı `education` olarak dışa verilir.
- **Seviyeler:** Başlangıç → Çırak → Kalfa → Usta → Kaşif → Mucit (`assets/data/levels.json` sırası). Dersi olmayan seviye "Yakında" görünür. Dersler sırayla açılır (önceki bitmeden sonraki açılmaz); ilerleme oyun seviyelerinden BAĞIMSIZDIR.
- **Dersler** (`assets/data/learn.json`): Başlangıç: ① Elektrik devresi nedir? ② Anahtar; Çırak: ③ Direnç. Ders yapısı: anlatım adımları (devre örneği) → görev (devreyi kur) → soru → tamamlandı → sonraki ders. Yanlış cevapta ceza yoktur; ses kapalıyken de tüm adımlar tamamlanır (konuşma yalnız eşlik eder, hiçbir adım konuşmayı beklemez).
- **Devre mantığı:** ikinci bir benzetim motoru YOKTUR. Görevler Mucit Atölyesi'nin `analyze()` ve Şekli Tamamla'nın `simulate()` kodunu (değiştirilmeden) kullanır (`src/games/learn/logic.js`).
- **Kayıt:** tamamlanan dersler ayrı alanda: `edu.done` (`altez-minilab:v1` içinde). Eğitim hiç oynanmadıysa bu alan yazılmaz (V6 ile aynı biçim). Bozuk/eski değer yok sayılır; oyun kayıtları (Şekli Tamamla, Sayı Avı, Mucit Atölyesi) değiştirilmez.
- **Geri tuşu / ✖:** ders içinde ✖ ve fiziksel Geri yalnız dersi kapatıp ders listesine döner (ilerleme yazılmaz); listede Geri/🏠 ana ekrana döner.
- **Testler:** `npm test` (139: 123 V6 + 16 Eğitim), `node scripts/ui-smoke.mjs` (Eğitim bloğu "V7 egitim" ile başlayan kontroller).
- **Sunucu:** `v7-server-apply.sh` (V6'yı yedekleyip doğrular, V7 kopyasını oluşturur, derler, APK'yı doğrular; V6'ya yazmaz).
