# V8.5-dev — Ses envanteri (pakette ne var / ne yok)
**GERÇEK ANDROID CİHAZ TESTİ YAPILMADI; hiçbir ses cihazda dinlenmedi.**

## A. Pakette gerçek dosya olarak bulunanlar
| Dosya | Boyut | Not |
|---|---|---|
| `assets/sounds/intro-caglayan.mp3` | 195.822 bayt | Çağlayan giriş anlatımı; V8.3/V8.4 ile birebir aynı (SHA-256 `5660c82a30e5ece38710e1069933d38d78843d1fc873044ace02bd6fe988fc53`, testle sabit) |
| `assets/sounds/minilab-jingle.mp3` | 35.884 bayt | açılış jingle'ı (özgün, kodla sentezlenmiş) |

## B. Türkçe seslendirme satırları (Çağlayan) — 123/123 MP3 pakette (R6)
- Toplam 123 satır (`assets/data/voice-lines.json`): hepsinin MP3'ü var (`VOICE-MANIFEST.json`: fileCount 123, missingKeys 0). SHA-256 listesi: `SES-123-SHA256.tsv` (R5'teki 106'lık liste `SES-106-SHA256.tsv` tarihçe için duruyor).
- **106 eski kayıt:** V8.4 ses paketi (`ALTEZ-MiniLab-V8.4-106-SES.zip`, SHA-256 `bee23348…f879`); R6 paketindeki karşılıklarıyla SHA-256 olarak birebir aynı.
- **17 yeni kayıt:** `ALTEZ-MiniLab-V8.5-dev-R6-SES-PAKETI.zip` (SHA-256 `4f25a638…a22c`) içinden alındı; hepsi geçerli MPEG Layer III (96 kbps, 44,1 kHz, 1,75–4,73 sn), metin ve dosya adı `YENI-SESLENDIRME-SATIRLARI.tsv` ile eşleşiyor, yinelenen içerik yok. Bu ortamda ElevenLabs'ten İNDİRİLMEDİ/üretilmedi; sunucunuzdaki paket kullanıldı. Kulakla dinlenmedi.
- **Uygulamada çağrılma (ui-v85-audio S16, Chromium, `play()` çağrısı + HTTP 200; hoparlör çıktısı DEĞİL):** 17'den 15'i kendi olayında çalınıyor (3 sahne cümlesi, `say`, `idle`, 6 nesne cümlesi, `start`, `insulator`, `win`, bölge bitiş başlığı). **2'si kullanılmayan geçerli dosya:** `hints.incomplete` (`adv_1af7bacb`; tüm devre görevlerinde yalnız maskot balonu yazısı) ve `next` (`adv_51f3721e`; ödül ekranında yalnız yazılı not). Oyun akışı için gerekli değil, çağrılmazlar.
- Çağlayan kaynağı/lisansı: ElevenLabs ses kimliği `sJ0xHHPzz1LOio4QNlB0`, ad CAGLAYAN, kategori `professional`, kütüphane sesi. Ticari kullanım hakkı **doğrulanmadı**; ticari kullanıma uygun diye işaretlenmedi.
- Dosya yoksa: cihaz TTS'i (yedek). Bu gerçek seslendirme sayılmaz.

## C. Harici dosya GEREKTİRMEYEN sentetik sesler (kaynak kodları pakette)
| Ne | Kaynak | Yapılandırma |
|---|---|---|
| Müzik (8 parça: `tema, ev-gizem, ev-heyecan, ev-basari, orman, mahalle, koy, atolye`) | `src/core/music.js` (WebAudio, özgün) | `assets/manifest.json > music` (hepsi `null`; ileride dosya yolu verilebilir) |
| Ortam sesi (8 sahne: `ev-gece, ev-isik, orman, orman-selale, mahalle, koy-dere, pompa, atolye`) | `src/core/ambience.js` | `assets/manifest.json > ambience` (hepsi `null`) |
| Eşleme (hangi bölüm hangi müzik/ortam) | `src/core/soundscape.js` | — |
| Efektler (`tap, place, correct, gentle, circuitOn, success, levelUp, pick, coin, retry`) | `src/core/audio.js` | `assets/manifest.json > sounds` (`jingle` ve `introVoice` dışında `null`) |
| Ses önceliği/ducking, müzik/ortam/seviye tercihi | `src/core/app.js`, `src/core/storage.js` (`mix`) | Ayarlar ekranı |
Bunlar dosya olmadığı için lisans sorunu yoktur; **kulakla dinlenmediler** (yalnızca çevrimdışı sayısal render + durum testleri).
`orman`, `orman-selale`, `mahalle`, `koy`, `atolye` müzik/ortamları **henüz çağıran bölüm olmadığı için** uygulamada hiç çalmaz (tasarım).
