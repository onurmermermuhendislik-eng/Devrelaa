# V8.4 — Ses envanteri ve SHA-256 manifesti

**Durum özeti (dürüst):** Yeni Çağlayan MP3 satırları bu ortamda **ÜRETİLİP PAKETE EKLENEMEDİ**: ElevenLabs çıktıları `storage.googleapis.com` üzerinde duruyor ve bu sandbox'ın ağ politikası o adresi 403 ile engelliyor (aşılmaya çalışılmadı). Bu yüzden pakette 0 yeni MP3 vardır; ses hattı hazırdır ve dosya eklenene kadar mevcut davranış (cihaz TTS'i) aynen sürer. Cihazda duyulan/duyulmayan HİÇBİR ses doğrulanmadı.

## 1. Mevcut sesler (V8.3'ten beri DEĞİŞMEDİ)
| Dosya | Boyut | Biçim | Süre | SHA-256 |
|---|---|---|---|---|
| `assets/sounds/intro-caglayan.mp3` | 195 822 B | MP3 44.1 kHz 128 kbps | 11.15 sn | `5660c82a30e5ece38710e1069933d38d78843d1fc873044ace02bd6fe988fc53` |
| `assets/sounds/minilab-jingle.mp3` | 35 884 B | MP3 44.1 kHz 112 kbps | 2.53 sn | `e05f8d1f10a6a2e6e24e21d6d2f8e4a18522dbc92aab0cc0ba36d59c43104a4b` |
Efektler (`tap, gentle, place, correct, circuitOn, success, levelUp`) uygulamanın kendi sentezidir (dosya yok). Giriş sesi `audio.playFile('introVoice')` ile TEK sefer çalar; yeni satır sesleri `voice.js` hattından geçer ve giriş sesiyle çakışmaz (`voice.stop()`/kuşak sayacı).

## 2. Anlatıcı kimliği
Voice **CAGLAYAN** (`sJ0xHHPzz1LOio4QNlB0`, ElevenLabs kütüphane sesi, Türkçe). Klonlama YOK. Ticari kullanım lisansı bu ortamdan doğrulanamadı → hesabınızda onaylayın. Başka bir ses aynı kişiymiş gibi sunulmaz.

## 3. Satır envanteri (`assets/data/voice-lines.json`, 106 satır, 4 181 karakter)
- 91 Macera satırı (`adv_<hash>`): 15 görev yönergesi + ödül/ final cümleleri + öğretici (`learn`), ipucu (`hint`), kazanma (`win`) ve `hints.*` cümleleri + market cümleleri (karşılama, "çantana girdi", "yetmiyor", "zaten sende").
- 15 sabit yönerge (`strings.tr.json > voice`, ör. `circuit_fix`, `circuitSwitch` …): dosya adı anahtarın kendisi.
- `{n}` gibi değişken içeren cümleler MP3 değildir (ör. "N coin eksik"): cihaz TTS'i.
- Dosya yolu: `assets/sounds/voice/<anahtar>.mp3`. Anahtar metinden türer (`src/core/voicekey.js`, FNV-1a): **metin değişirse anahtar değişir; eski MP3 yanlış cümleyle çalınmaz.**

## 4. MP3 biçimi (teslim şartı)
MP3, 44.1 kHz, mono/stereo, ≤128 kbps (önerilen 96), satır başı ≈1–8 sn, başta kısa sessizlik, giriş sesiyle benzer ses düzeyi, tek anlatıcı. `scripts/voice-sync.mjs` reddeder: MP3 olmayan, >300 KB, >20 sn ya da bilinmeyen satıra ait dosya.

## 5. Üretim ve doğrulama
Bkz. `KURULUM-DERLEME.md` §4. `scripts/voice-sync.mjs` → `assets/sounds/voice/VOICE-MANIFEST.json` (dosya, anahtar, metin, bayt, süre, codec, SHA-256) ve `assets/manifest.json > voice` otomatik eşitlenir. Testler: manifest yolları var, her MP3 bilinen satıra ait, VOICE-MANIFEST eşit.

## 6. Cihazda DOĞRULANMAMIŞ
Tüm yeni satır sesleri (henüz yok), giriş sesinin tek seferliği, otomatik oynatma/arka plan davranışı, TTS okuma ve ses kapalıyken sessizlik **gerçek cihazda doğrulanmadı** (yalnız Chromium + sahte konuşma motoru).
