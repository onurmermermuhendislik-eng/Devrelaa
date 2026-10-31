# ALTEZ MiniLab V8.4 — Değişiklik özeti (V8.3 → V8.4, sürüm 8.4 / versionCode 25)

applicationId `com.altez.minilab.v4` ve imza şeması DEĞİŞMEDİ.

## Ekran yönü
- Yalnız Enerji Macerası (`#/adventure`, `#/play/energy-adventure`) yatay kilitli; diğer oyunlar serbest (dikey + yatay).
- Eğitim ekranı dikeyde taşma düzeltildi (ders kartları / "Başla").

## Görevler (Enerji Macerası)
- Yeni bölge "Evde Enerji" (🏠), 7 gerçek hayat görevi: Fener, Oda Lambası, Kablonun Kılıfı, Güvenli Deney, LED + Direnç, Gece Lambası, Mucit Evi Finali.
- Pil bölgesinin 8 görevi aynen korunur; bölgeler sırayla açılır; "Güneş" bölgesi "çok yakında".
- Güvenlik: priz/şebeke elektriği hiçbir görevde doğru cevap değildir; öğretici cümle yetişkine sormayı söyler.
- Devre simülasyonu LED + direnç destekler; direnç şart olan görevde direnç yoksa görev bitmez (bir kez nazik ipucu).

## Coin
- Coin türetilir: bakiye = kazanılan coin − sahip olunan ekipman fiyatları. Ayrı sayaç yok → çift ödül/çift harcama yapısal olarak engellenir.
- Görev başına yalnız ilk (en iyi) tamamlamada coin; tekrar oynamak coin vermez.
- Yazma hatasında geri alma (atomik yazım); eski kayıtlar geriye uyumlu (`adv.inv` eklendi).

## Enerji Marketi
- Harita sağ üstte 🛒. 6 sanal ekipman: gözlük 2, pil kutusu 3, kablo seti 4, anahtar kiti 5, LED seti 6, çanta 7 (toplam 27 = tüm görev coin'i 15 + 12).
- Her ekipman yalnız bir kez alınır (yeniden satın alma yok); yetersiz coin reddedilir; onay penceresi; çift tıklama güvenli; kalıcı envanter.
- Gerçek para, reklam, abonelik, can/enerji sistemi YOK.

## Ses
- Merkezi altyapı (`voice.js`): satır başına MP3 varsa çalınır, yoksa/yüklenemezse Türkçe TTS yedeği; ses kapalıyken hiçbir şey çalmaz; yeni konuşma eskisini keser.
- Çağlayan satırları için hat hazır: `assets/data/voice-lines.json` (106 satır), `scripts/gen-voice-elevenlabs.mjs` (anahtar yalnız ortam değişkeni), `scripts/voice-sync.mjs` (doğrulama + manifest + SHA-256).
- Bu pakette YENİ MP3 YOK (üretim ortamından indirilemedi) → görev sesleri şimdilik cihaz TTS'iyle; bkz. SES-ENVANTERI.md.

## Test altyapısı
- 545'lik eski smoke paketi V7.8+ gezinmesine uyarlandı (ana menü ≠ Oyunlar listesi; kart sayısı 3→6; Geri zinciri liste→menü→arka plan). Beklentiler silinmedi; bölüm başına hata yalıtımı eklendi. Ayrıntı TEST-RAPORU.md.
