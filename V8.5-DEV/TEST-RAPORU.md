# V8.5-dev — Test Raporu (son kod; donmuş kopya üzerinde)
**GERÇEK ANDROID CİHAZ TESTİ YAPILMADI. Hiçbir ses bu ortamda duyulmadı.** Testler yalnızca durum, çağrı sayısı ve OfflineAudioContext ile sayısal içeriği doğrular.
APK: **üretilmedi** (bu ortamda Android SDK yok; `ANDROID_HOME` boş, `android.jar` yok).

| Grup | Geçti / Toplam | Başarısız | Zaman aşımı | Not |
|---|---|---|---|---|
| Birim (`node --test tests/*.test.js`) | 318 / 318 | 0 | 0 | yeni: v85-darkhouse 13, v85-music 11, v85-world 7 |
| UI V7.5 | 63 / 63 | 0 | 0 | |
| UI V7.6 | 49 / 49 | 0 | 0 | |
| UI V7.7 | 146 / 146 (tek başına) | 0 | 0 | ilk koşuda 145/146: K3 açılış süresi 3631 ms (eşik 3600), iki grup paralel koşarken; **eşik gevşetilmedi**, tek başına 146/146. Süre 343 sn |
| UI V7.8-home | 108 / 108 | 0 | 0 | F3 tohumu bilinçli değişti (aşağıda) |
| UI V7.8 | 67 / 67 | 0 | 0 | |
| UI V7.9 | 110 / 110 | 0 | 0 | |
| UI V8.1 | 113 / 113 | 0 | 0 | görev sayısı beklentisi 15→16 (bilinçli) |
| UI V8.2 | 238 / 238 | 0 | 0 | 15→16 (bilinçli) |
| UI V8.3 | 13 / 13 | 0 | 0 | |
| UI V8.4 | 88 / 88 | 0 | 0 | |
| UI V8.4 market | 104 / 104 | 0 | 0 | 15→16 ve harita kapısı (bilinçli) |
| UI V8.5 (Karanlık Ev + dünya) | 54 / 54 | 0 | 0 | A–K |
| UI V8.5 SES (14 senaryo + sayısal) | 37 / 37 | 0 | 0 | S1–S14, N1–N3 |
| Tam duman (`ui-smoke`) | 552 / 552 | 0 | 0 | 568 sn |

## Bilinçli beklenti değişiklikleri (gevşetme değil; gerekçeli)
1. **Görev sayısı 15→16** (Karanlık Ev eklendi): v81 B9/C5 (0/16, 0/48 yıldız), v82 F8/H2, v84-market E1/E6/E8/E12, v84-market ve v85 birim bölge listesi.
2. **Bölge `gunes` → `orman`** ("Ormanda Gece Kurtarma", yapım aşamasında): v84-market E6 artık Ev bitince **Karanlık Ev** kapısının açıldığını ve gidilebilir olduğunu denetler.
3. **v78-home F3**: menüde artık ana tema müziği çalar (osilatör). Testin amacı "maskot ses eklemez" olduğundan müzik tercihi KAPALI tohumlanır; maskot denetimi aynı. Müziğin kendisi ui-v85-audio S1'de denetlenir.
4. **v85 birim**: ortam sahne kataloğu 2 → 8 sahne (diğer maceralar için tasarım; yalnız 2'si `ready`).

## Ses testlerinin NEYİ kanıtladığı / kanıtlamadığı
- **Kanıtlanan (Chromium):** doğru parçanın/sahnenin istenmesi ve `state`'i; konuşma sırasında müzik/ortam `ducked` durumu ve seviye <%50; efekt çağrı sayıları (başarı tam 1 kez, yanlışta `gentle`); tekrar girişte çoğalmama; market/rota değişiminde ortamın durması; tercihlerin kayıtta korunması; arka plan/ön plan; eksik MP3 manifest girdisinde çökmeme (sentetiğe düşer); tekrar dinle düğmesi; her müzik parçası ve ortam sahnesi için OfflineAudioContext render (NaN yok, tepe <0,95, sessiz değil).
- **Kanıtlanmayan:** sesin **kulakla** nasıl duyulduğu, ses seviyelerinin dengesi (özellikle ortam sesi RMS'i müzikten yüksek: ortam ≈0,03, müzik ≈0,015×seviye 0,48), konuşma ile gerçek TTS'in karışımı, Android WebView autoplay davranışı, gecikme/bellek. Bunlar `CIHAZ-KONTROL-LISTESI-V85.md`'de.
- Bulunan ve düzeltilen gerçek hatalar: (a) arka plandayken istenen yeni müzik parçası öne dönünce başlamıyordu; (b) kilitli bölgede sahte kayıtla coin kazanılabiliyordu (V8.4'ten gelen gizli hata); (c) `success` iki kez çalıyordu; (d) ortam sesi konuşma sırasında kısılmıyordu (şimdi ×0,5).

## Teslim paketi (TERMIUS-READY) notu
- Yukaridaki tablo, sürüm devrinden (8.4→8.5, versionCode 25→26) ÖNCEKİ kayıttır. Sürüm devrinde yalnız şunlar değişti: `scripts/version.env`, `android/app/build.gradle`, `package.json`/`package-lock.json` sürüm alanı, `VERSION.json/txt`, `assets/data/app-version.json`; `tests/v84.test.js` sürüm testi genelleştirildi (V8.1–V8.3'te izlenen yöntem) ve güncel sürüm `tests/v85-version.test.js` içinde sabitlendi (319 birim test).
- Paket oluşturulduktan sonra temiz dizine çıkarılıp yeniden koşulan testlerin sonuçları bu dosyada DEĞİL, teslim raporunda (ZIP dışında) ayrı verilir; eski sonuçlarla karıştırılmaz.

## r2 notu (ikinci teslim adayı)
- Yeni birim test dosyası `tests/v85-import-voice.test.js` (5 test; gerçek MPEG Layer III çerçeve doğrulaması + SHA-256 raporu dahil); toplam birim test **324**.
- `npm ci` kök nedeni: paketi hazırlayan ortamda `NO_PROXY` listesi `registry.npmjs.org`'u içeriyordu → npm doğrudan bağlanmaya çalışıp DNS'te takıldı ("Exit handler never called" + ENOTFOUND). Paket/lock hatası değildi. Proxy üzerinden `npm ci` başarılı: 100 paket, lock/package.json değişmedi; `npx cap sync android` başarılı (2 eklenti).

## r5 (106 gerçek MP3 eklendikten sonra) — BU SÜRÜMDE yeniden çalıştırılan testler (2026-10-24, Chromium/Node; GERÇEK ANDROID CİHAZ TESTİ YAPILMADI, ses kulakla dinlenmedi)
| Test | Sonuç |
|---|---|
| Birim (`node --test tests/*.test.js`) | 324/324 |
| ui-v85-audio (S1–S15, N1–N3; S15 = gerçek MP3 yolu) | 40/40 |
| ui-v85 | EXIT=0 |
| ui-v84 / ui-v84-market | 88/88 / 104/104 |
| ui-v83 / v82 / v81 | 13/13 / 238/238 / 113/113 |
| ui-v79 / v78 / v78-home / v77 / v76 / v75 | 110/110 / 67/67 / 108/108 / 146/146 / 49/49 / 63/63 |
| ui-smoke | 552/552 |
| MP3 çözme (ayrı, tek seferlik betik, pakete konmadı) | 106/106 Chromium `decodeAudioData` ile çözüldü, sessiz değil, toplam ≈329 sn |
| SHA-256 | 106/106 kaynak ZIP ile birebir aynı; yinelenen içerik 0; manifest bayt/SHA uyumsuzluğu 0 |

**Bulgu ve düzeltme:** 106 MP3 pakete girince v81 (F8) ve v82 (H5/H6) başarısız oldu — uygulama hatası değil: bu testler "kayıtlı ses dosyası yok → Türkçe TTS yedeği" yolunu sınar; dosya varken uygulama (doğru olarak) MP3 çalar, TTS konuşmaz. Test beklentileri DÜŞÜRÜLMEDİ. `scripts/serve.mjs` artık varsayılan olarak `assets/manifest.json > voice` kayıtlarını boş sunar (dosya yok gibi; eski testler TTS yolunu aynen sınar); gerçek MP3 yolunu sınayan `ui-v85-audio` (S15a–c) ve `ui-v84-market` `startServer(0, { voiceMp3: true })` ile açar. Not: ilk denemede 404 döndürmek konsol hatası üretip başka testleri bozdu; bırakıldı. Paralel koşuda görülen v77 K3/smoke süre testleri yük kaynaklı zaman aşımıydı, tek başına/ardışık koşuda geçti.
**Yapılmadı:** ses çıktısını kulakla doğrulama; testler çalma çağrısını/çözmeyi doğrular, hoparlör çıktısını değil. Android WebView/MediaPlayer davranışı denenmedi.

## R6 (123 MP3 + Karanlık Ev ses bağlantısı) — BU SÜRÜMDE çalıştırılan testler (2026-10-24, Chromium/Node)
GERÇEK ANDROID CİHAZ TESTİ YAPILMADI; hiçbir ses kulakla dinlenmedi. Testler `play()` çağrısını, HTTP 200'ü, çözmeyi ve durum/ducking'i doğrular; hoparlör çıktısını DEĞİL.
| Test | Sonuç |
|---|---|
| Birim | 324/324 |
| ui-v85-audio (S1–S16 + N1–N3; son sürüm) | 46/46 |
| ui-v85 | EXIT=0 |
| ui-v84 / v84-market / v83 / v82 / v81 | 88/88 / 104/104 / 13/13 / 238/238 / 113/113 |
| ui-v79 / v78 / v78-home / v77 / v76 / v75 | 110/110 / 67/67 / 108/108 / 146/146 / 49/49 / 63/63 |
| ui-smoke | 552/552 |
| MP3 çözme (Chromium `decodeAudioData`, ayrı tek seferlik betik) | 123/123, sessiz yok, toplam ≈387 sn |
| SHA-256/içerik | 123/123 dosya listeyle uyumlu; 106 eski dosya R6 paketiyle birebir aynı; yinelenen içerik 0; kendi `voice-sync` çıktım paketin manifestleriyle birebir aynı |

**Başarısız koşular (gizlenmedi):** ui-v85-audio'nun ilk R6 koşusu 42/45 (S3, S3b, S13 başarısız): test sahte TTS'in ~200 ms'lik konuşmasına göre yazılmıştı; Karanlık Ev satırları artık gerçek MP3 (3–5 sn) çalınca zamanlama varsayımı tutmadı. Uygulama ducking'i MP3 yolunda da çalışıyor (yeni S16f kanıtlar). Test beklentileri düşürülmedi: S1–S14 TTS yolunu (ses kaydı yokmuş gibi), S15–S16 gerçek MP3 yolunu ayrı sunucuyla sınar. Önceki turlarda paralel koşuda görülen süre testi (v77 K3/smoke) zaman aşımları yük kaynaklıydı.
**Yapılan kod değişiklikleri (yalnız Karanlık Ev, `darkhouse.js`):** (1) devre aşaması başlarken `hints.start` sesli okunur (eski görevlerde index.js yapıyordu); (2) ışık yanınca kutlama aşamasında "Başardın…" ikinci kez sesli okunmaz (devre aşaması zaten okur; art arda aynı MP3 tekrarı kalktı). `scripts/serve.mjs`: eski testler için varsayılan "ses kaydı yok" (manifest `voice` boşaltılır).
