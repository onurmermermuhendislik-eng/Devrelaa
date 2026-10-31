# V8.5-dev — Mimari ve mevcut özellik inceleme raporu (A)

Kaynak: V8.4 (versionCode 25). İnceleme salt okunurdu; V8.4 ve V8.3 dizinleri SHA-256 ile değişmediği doğrulandı (355 dosya).

## Mevcut altyapı (yeniden kullanılan)
| Alan | Dosya | Not |
|---|---|---|
| Yönlendirme / kabuk | `src/core/app.js` | Hash rotaları; `#/adventure` ve `#/intro` macera. Her rota değişiminde `route()` çalışır. |
| Macera denetleyicisi | `src/games/adventure/index.js` | Harita → görev → ödül → market. Görev türleri `MOUNT` tablosunda (`circuit`, `choice`, `identify`, `judge`; V8.5: `darkhouse`). |
| İlerleme / coin modeli | `src/games/adventure/model.js` | Coin AYRI sayaçta değil: bakiye = görevlerden kazanılan − sahip olunan ekipman fiyatları. |
| Kayıt | `src/core/storage.js` | `altez-minilab:v1`, allow-list `sanitize`, `completeAdvTask` / `buyItem` ATOMİK ve yazma hatasında geri alınır. |
| Devre motoru | `adventure/circuit.js` + `shape-complete/circuit-sim.js` | Tahta + benzetim; taş/yaprak iletmez; anahtar durumu. |
| Ses (anlatım) | `src/core/voice.js` | `say(key, onEnd, text)`: kayıtlı MP3 varsa o, yoksa cihaz TTS'i; yeni konuşma eskisini keser. |
| Ses (efekt) | `src/core/audio.js` | Dosya ya da WebAudio sentezi; `playFile` (giriş sesi). |
| Yön | `src/core/orient.js` | Yalnız `#/adventure` ve `#/play/energy-adventure` yatay. |
| Android | Capacitor 8.5.3, `android/`, `scripts/android-prep.mjs` | applicationId `com.altez.minilab.v4`. |

## "Çağlayan sesi neden yalnız Enerji Macerası'nda çalışıyor?" (kod incelemesi)
Projede "Çağlayan", ElevenLabs'te seçilen ANLATICI SESİNİN adıdır (`CAGLAYAN`, `sJ0xHHPzz1LOio4QNlB0`); projede bir çağlayan/şelale ORTAM SESİ dosyası yoktur (`assets/sounds/` yalnız `intro-caglayan.mp3`, `minilab-jingle.mp3`, `voice/`). Bu raporda iki anlam ayrı ele alındı:
1. **Anlatıcı sesi:** MP3'ler yalnız (a) Macera cümleleri (`adv_<hash>.mp3`, `adventure/index.js > speak`), (b) 15 sabit yönerge (`strings.voice`) ve (c) giriş sesi için üretiliyor. Diğer oyunlarda (Mucit `inv_*`, Eğitim `learn_*`, Görevler `tk_*`, Sayı Avı `nh_*`) metin çalışma anında üretildiği/değiştiği için kayıt yok ve cihaz TTS'i konuşur. Bu bir hata değil, kapsam sınırıdır; genişletmek = yeni cümleleri `scripts/voice-lines.mjs` envanterine eklemek ve sunucuda ElevenLabs ile üretmek.
2. **Ortam sesi (çağlayan/orman):** hiçbir yerde yok. V8.5'te ortak `ambience.js` eklendi; katalog yalnız `ev-gece` ve `ev-isik` içerir. Orman/çağlayan sesi, dosyası ve katalog satırı eklenmeden HİÇBİR sahnede çalmaz (körlemesine eklenmez).
> Not: İsteğin "çağlayan" ile hangisini kastettiği kesin değildi; ikisi de karşılandı. Ortam sesi olarak çağlayan istendiyse gerçek bir kayıt dosyası gerekir (bkz. MACERA-PLATFORMU.md).

## Android / derleme durumu
Bu ortamda Android SDK yok → APK üretilemez. APK sunucuda (`/home/altez/...`) derlenir. Geliştirme kopyası sürüm numarasını DEĞİŞTİRMEDİ (8.4 / versionCode 25 / `com.altez.minilab.v4`); sürüm artırımı teslim aşamasında yapılacak.

## Riskler (ve alınan önlem)
- Yeni bölge ilerleme zincirine girer → toplam görev 15→16, toplam coin 27→30. Market (6 ekipman = 27) değişmez; fazla 3 coin bakiyede kalır. İlgili iki test beklentisi bilinçli değişti (gerekçe test dosyasında).
- Kilitli bölgenin ilk görevi bozuk/yapay kayıtla coin kazandırabiliyordu (V8.4'te de vardı; `model.js > deriveProgress`). V8.5'te düzeltildi + test eklendi.
- Yeni anlatım cümleleri (17 satır) için MP3 yok → cihaz TTS'i konuşur; MP3'ler sunucuda üretilmeli.
