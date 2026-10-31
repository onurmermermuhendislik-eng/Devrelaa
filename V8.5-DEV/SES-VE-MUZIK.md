# V8.5-dev — Ses, Müzik ve Seslendirme Mimarisi

> **GERÇEK ANDROID CİHAZ TESTİ YAPILMADI.** Bu belgedeki "çalışıyor" ifadeleri yalnızca kod yolu, durum, çağrı sayısı ve
> çevrimdışı (OfflineAudioContext) sayısal render anlamına gelir. Hiçbir ses bu ortamda **duyulmadı**.

## 1. Telif / lisans
- **Müzik ve ortam sesleri ürüne eklenen hiçbir dış dosya değildir.** Hepsi `src/core/music.js` ve `src/core/ambience.js` içinde WebAudio ile
  **bu projede üretilen özgün sentezdir** (telif sorunu yok, dosya boyutu 0). `assets/manifest.json > music/ambience` alanları `null`'dır;
  ileride lisanslı bir dosya konursa o parça için `manifest.music[id]` yolu verilir, **lisans kaydı** önce `V8.5-DEV/` altına yazılmalıdır.
- Mevcut gerçek dosyalar: `assets/sounds/intro-caglayan.mp3` (Çağlayan anlatıcı sesi; ElevenLabs çıktısı — **ticari kullanım koşulları kullanıcı
  tarafından doğrulanmalıdır**, burada doğrulanamadı) ve `assets/sounds/minilab-jingle.mp3` (V8.4'ten, değişmedi).
- Efektler (`tap, place, correct, gentle, circuitOn, success, levelUp, pick, coin, retry`) `audio.js` içinde sentezdir.
- "Çağlayan sesi" iki ayrı şeydir: (a) anlatıcı **ses adı** (ElevenLabs "Çağlayan") → yalnızca macera cümleleri + intro için hazır MP3 var,
  diğer oyunlar cihaz TTS'i kullanır; (b) **şelale ortam sesi** → hiçbir zaman var olmadı; `orman-selale` sahnesi tasarım olarak vardır
  ve yalnızca o sahnede istenir (henüz çağıran bölüm yok).

## 2. Öncelik ve karışım (konuşma > efekt > ortam > müzik)
| Öğe | Davranış |
|---|---|
| Sesli yönerge | Başlayınca müzik **×0,35**, ortam sesi **×0,5**; bitince yumuşakça döner. Yeni konuşma eskisini keser (üst üste konuşma yok). 15 sn watchdog (bitiş olayı gelmezse kısık kalmaz) |
| Efektler | `MIN_GAP_MS` ile sınırlı (tap 70, pick 90, place 110, correct 140, gentle 260, coin 220, retry 420, success 1500 ms…) → hızlı dokunuş/sürükleme üst üste bindirmez |
| Ortam | Sahne başına tek örnek; rota değişince durur; aynı sahne yeniden istenirse yeniden başlamaz; arka plana geçince durur, gelince aynı sahne devam eder |
| Müzik | Parça başına tek örnek; 1,2 sn çapraz geçiş; aynı parça yeniden başlamaz; tavan 0,8; varsayılan seviye 0,6; arka planda zamanlayıcı durur |
| Sessiz mod | Hepsinin üstünde; Ayarlar'daki müzik/ortam anahtarları yalnızca ek kısıtlamadır. Tercih (`mix`) kayıtta saklanır ve sahne değişimlerinde korunur |

## 3. Karanlık Ev müzik yayı
`ev-gizem` (66 bpm, seyrek celesta + yavaş pad; merak, korku yok) → `ev-heyecan` (devre kurulurken, beklentili) → `ev-basari` (lamba yanınca,
kısa ve neşeli; ortamdan belirgin ayrışır). Ortam: `ev-gece` → `ev-isik`. **Su/rüzgâr/orman/mahalle ortamı bu bölümde istenmez** (test denetler).

## 4. Diğer maceralar için tasarım (YAPILMADI — bölüm yok)
`src/core/soundscape.js`: orman (orman müziği + orman ortamı; şelale yalnızca `orman-selale`), mahalle (sokak+kuş), köy (dere `koy-dere`, pompa `pompa`), atölye
(alet/mekanizma). Hepsi `ready:false`; testler bunları "bitmiş" göstermez.

## 5. Efekt tasarımı (sentez, ceza sesi yok)
seç/taşı = `pick`; bul/doğru = `correct`; yerleştir = `place`; bağlantı tamam = `circuitOn`; yanlış = `gentle` (yumuşak, azalan değil, ürkütmez); görev = `success` (tek kez);
ödül/açılış = `levelUp`; market = `coin`; yeniden dene = `retry`.

## 6. Seslendirme durumu (dürüst)
- Hedef: sıcak, kısa Türkçe cümleler; **Karanlık Ev dahil toplam 123 satır**; bunların 106'sı V8.4 ile aynıdır (sunucuda MP3 vardır).
- **17 satır yenidir ya da yeniden yazılmıştır** → `V8.5-DEV/YENI-SESLENDIRME-SATIRLARI.txt`. Bu satırların **gerçek Çağlayan MP3'ü YOKTUR**.
  Cihazda otomatik olarak telefonun Türkçe konuşmasına (TTS) düşer; **bu, gerçek seslendirme değil, geçici yedektir.**
- Durum (R6): 123/123 gerçek MP3 pakette (kulakla dinlenmedi); ikisi (`incomplete`, `next`) kodda çağrılmıyor (bkz. GELISTIRME-DURUMU-V85.md E). API anahtarı uygulamaya konmaz.
- "Yönergeyi tekrar dinle" (🔁) her görev ekranında vardır; metin ve ses aynı kaynaktan (`speak(txt)`) gelir.
- Ses dosyası bulunamazsa/oynatılamazsa: TTS yedeği, o da yoksa yalnızca metin; oyun kilitlenmez (test S12).

## 7. Android'e özgü riskler (gerçek cihazda bakılmalı)
AudioContext'in WebView'de ilk dokunuşta açılması; arka plan/ön plan geçişinde müzik/ortamın devamı; TTS ile müzik kısma zamanlaması; telefon sessiz tuşu;
bluetooth kulaklık gecikmesi; düşük bellekli cihazda tek paylaşımlı AudioContext. Ayrıntı: `CIHAZ-KONTROL-LISTESI-V85.md`.
