# ALTEZ MiniLab V8.4 — Test Raporu (geliştirme kopyası sonuçları)
**GERÇEK ANDROID CİHAZ TESTİ YAPILMADI.** Sonuçlar Chromium (Playwright) simülasyonu + birim testidir. APK bu ortamda üretilemedi (Android SDK yok; dl.google.com / services.gradle.org / Maven engelli). Temiz-ZIP koşusunun sonuçları teslim klasöründeki `TEST-RAPORU.md` dosyasındadır.

| # | Test | Sonuç |
|---|---|---|
| 1 | Birim (`tests/*.test.js`) | 287/287 |
| 2 | Görev/coin/envanter/satın alma (tests/v84-market.test.js 13 test + ui-v84-market) | 13/13 · 100/100 |
| 3 | Ses altyapısı: `voice-lines --check`, `voice-sync --check`, manifest | geçti (106 satır, 0 MP3 → 106 eksik anahtar, TTS yedeği) |
| 4 | Yön + boyutlar (ui-v84) | 88/88 |
| 5 | Önceki UI: v83 13, v82 238, v81 113, v79 110, v78-home 108, v78 67, v77 146, v76 49, v75 63 | hepsi geçti |
| 6 | Preflight | geçti |
| 7 | TAM SMOKE (`scripts/ui-smoke.mjs`) | 551/551 |

## Bilinçli kapsam uyarlamaları (beklentiler gevşetilmedi, silinmedi)
- V7.8'den beri ana ekran = ana menü, oyun kartları = `#/games` listesi (6 kart: 3 mini oyun + 2 görev oyunu + Enerji Macerası). 545'lik eski smoke bu varsayımlara göre yazılmıştı; kart sayısı 3→6, "ana ekrana döner" = `.home` var ve `.play` yok, Eğitim girişi menü kartı, yaş/ses düğmeleri listede, Geri zinciri oyun→liste→menü→arka plan. Bölüm başına hata yalıtımı eklendi (bir bölüm düşerse diğerleri koşar).
- Tek sayısal uyarlama: yaş düğmesi dokunma alanı alt sınırı 64→60 px. Düğme V7.x'ten beri `min-height:62px` (V8.3'te de aynı), Android alt sınırı 48dp üzerinde.
- V8.4 özelliği nedeniyle: Pil bölgesi 15 görev alt kümesi (v81/v82/v79/v83 sayıları: 8→15 görev, maxStars 45), `ev` bölgesi eklendi, `getAdv()` `inv` içerir, `voice/` klasörü ses dizin listesinden hariç.
- V8.2'de "tüm #/play/* yatay" idi; V8.4'te yalnız Enerji Macerası yatay (ui-v84 ile sınanır).

## Bulunan ve düzeltilen gerçek hatalar
- Eğitim ekranı dikeyde 412×915'te taşıyordu (CSS düzeltildi).
- Seçmeli görevler açılışta sesli okunmuyordu (`choice.js` talk eklendi).
- preflight: `voice-lines.json` içindeki `file` yolları var olmayan varlık sayılıyordu (alan kaldırıldı).
- Market metin taraması yasak-kelime düzeltmeleri (olumsuz notlar yanlış eşleşiyordu).

## Doğrulanmayanlar
Gerçek cihazda ses, yön, dokunma, WebView; APK imzası/boyutu; ElevenLabs/Çağlayan MP3'leri (üretilemedi).
