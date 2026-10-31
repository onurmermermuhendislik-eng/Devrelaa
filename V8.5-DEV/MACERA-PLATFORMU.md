# V8.5-dev — Ortak macera platformu: teknik plan (C) ve yeni bölüm ekleme kılavuzu

## Katmanlar (hepsi mevcut altyapının üstüne; baştan yazma yok)
1. **Veri** — `assets/data/adventure.json`: `regions[]` (bölge, harita, sıra), `tasks[]` (görev türü `kind`, coin, anlatım cümleleri), `market`. Coin/yıldız/kilit YALNIZ buradan + `adv.tasks` kaydından türetilir.
2. **Model** — `adventure/model.js`: saf mantık (DOM yok). Tek seferlik coin, sıralı kilit, bakiye.
3. **Denetleyici** — `adventure/index.js`: `MOUNT[kind]` tablosu. Yeni sahne türü = bir `mountXxx(host, args)` yazıp tabloya bir satır eklemek. `args`: `{ task, text, audio, voice, mascot, speak, ambience, band, onSolved }`.
4. **Sahne araç kutusu (V8.5)** — `adventure/scene-kit.js`: `createSceneRuntime` (zamanlayıcı temizliği, ses/maskot hatası yutma, konuşma + ortam sesi yaşam döngüsü, arka plana geçince susma), `idleHint` (boşta kalma ipucu), `reducedMotion`.
5. **Ortam sesi (V8.5)** — `core/ambience.js`: tek anda tek sahne sesi; ses kapalıysa susar; arka plana geçince durur, öne gelince aynı sahne yeniden başlar; rota değişince `app.js` kesip ses ayarına göre yeniden açar. Dosya varsa (`manifest.ambience[sahne]`, döngü, kısık) o, yoksa/bozuksa WebAudio oda tonu.
6. **Anlatım sesi** — mevcut `voice.js`; her cümle `scripts/voice-lines.mjs` envanterine girer (`adv_<hash>.mp3`), MP3 yoksa cihaz TTS'i.
7. **Kayıt** — mevcut `completeAdvTask` (atomik, tek seferlik coin). Yeni alan YOK.

## Yeni bölüm ekleme adımları (ör. Orman Macerası)
1. `adventure.json > regions`: bölgeyi `ev`/`karanlik`'tan sonra, `gunes`'ten önce ekle (`unlocks`, `map`, `finalTitle`); görevleri `tasks[]`'e ekle (`kind`, `coins`, `say`, `win`, `scenes[].learn`, `spots[].say`, `hints`).
2. Sahne yeni türdeyse `adventure/<bolum>.js` yaz (`createSceneRuntime` kullan); `index.js > MOUNT`'a ekle. Mevcut türler (`circuit`, `choice`, `identify`, `judge`, `darkhouse`) yeniden kullanılabilir.
3. Ortam sesi: `ambience.js > SCENES`'e satır (`orman`), `manifest.ambience.orman` = `assets/sounds/ambience/orman.mp3` (çağlayan/kuş/rüzgâr kaydı). Dosya yoksa sentez yedeği devreye girer; çağlayan yalnız burada istenirse çalar.
4. `node scripts/voice-lines.mjs` (envanter) → sunucuda `voice:gen` → `voice:sync`.
5. Testler: birim (veri/mantık), `scripts/ui-v85.mjs` kalıbında tarayıcı akışı. Mevcut regresyon testlerinin beklentileri (bölge listesi, görev/coin toplamı) bilinçli değişiklik olarak, gerekçesiyle güncellenir.

## Görsel yaklaşım: 3D film atmosferi için seçenekler (rapor)
Mevcut teknoloji: katmanlı SVG/CSS (paralaks, ışık, gölge, hareket), sıfır bağımlılık, çevrimdışı, düşük bellek. V8.5 sahneleri bunu kullanır; "3D animasyon filmi" kalitesine ULAŞMAZ ve öyle sunulmamalıdır.
| Seçenek | Artı | Eksi |
|---|---|---|
| Önceden render edilmiş kısa video (MP4/WebM) | Gerçek 3D film görünümü | APK boyutu (≈1–3 MB/sn), etkileşimle bağ zor, bellek/codec riski, her sahne için üretim maliyeti |
| Rive / Lottie (vektör animasyon) | Küçük dosya, akıcı karakter animasyonu, etkileşim durumları | Yeni kütüphane/çalışma zamanı; tasarım aracı gerekir |
| three.js / WebGL | Gerçek zamanlı 3D, ışık | Ağır paket, düşük kademe Android'de akıcılık/ısınma riski, kontrollü bellek zor |
| Mevcut SVG/CSS (seçilen) | Sıfır bağımlılık, güvenli, test edilebilir | 2D; sinematik kalite sınırlı |
Öneri: sinematik açılışlar için kısa (≤6 sn, 720p) önceden render edilmiş video + etkileşimli kısımlar SVG/CSS; önce tek sahnede cihazda boyut/akıcılık ölçülmeli. Yeni bağımlılık eklemeden önce onay gerekir (proje kuralı).
