# V8.5-dev — Oyun içeriği: mevcut durum ve kalan geliştirmeler
GERÇEK ANDROID CİHAZ TESTİ YAPILMADI. Aşağıdakiler kod/test durumudur (Chromium simülasyonu), cihazda denenmedi.

## A. Mevcut durum (kodda var, testlerle doğrulandı — simülasyonda)
- Karanlık Ev macerası (bölge `ev`) oynanabilir; Macera Dünyası paneli, harita, bölge geçişleri.
- `orman` bölgesi veri olarak var (ilk aşama), market ekipmanlarında `use`/`usedIn` alanları var.
- Sentetik müzik (8 parça), ortam sesi (8 sahne), efektler, ses önceliği ve kısma (ducking) kodu.
- Görev ilerlemesi: `adv.tasks` (en iyi yıldız) ve `adv.inv`; bakiye = kazanılan − ekipman fiyatı.

## B. TAMAMLANMADI — kalan geliştirmeler (tamamlanmış sayılmaz)
1. **Aşama 2–5:** yalnızca "çok yakında" kartı; oynanabilir bölüm, sahne, görev ve ses YOK.
2. **Ekipman gereksinimleri:** ekipman verisi var ama görevlerde fiilen ZORUNLU TUTULMUYOR (yalnız veri + durum hesabı). Karanlık Ev ücretsiz başlangıçtır.
3. **Görev ödülleri:** görev ödülü olarak ekipman kazanma (`grants`) YOK; yalnız yıldız/coin hesabı var.
4. **Macera ilerlemesi:** bölgeler arası kilit açma/ilerleme akışı yalnız mevcut bölgeler için; 2–5. aşama ilerlemesi ve bitiş/ödül akışı yok.
5. **Ses:** 123/123 MP3 pakette (doğrulandı, kulakla dinlenmedi); 2'si (`hints.incomplete`, `next`) uygulamada çağrılmıyor; müzik/ambiyans kulakla dinlenmedi, ambiyans müzikten yüksek olabilir (cihazda ayar gerekir).
6. **Lisans:** Çağlayan sesi ticari kullanım lisansı doğrulanmadı — ticari kullanıma uygun diye işaretlenmedi.
7. **Sürüm/imza:** `versionName` 8.5 ("dev" yalnız VERSION.json/README/ZIP adında); V8.3/V8.4 APK ile imza aynılığı kontrol edilmedi.

## C. Talep: tüm bölgeler için ses (2026-10-24 isteği) — durum
- Karanlık Ev: kod + 17 yeni satır metni hazır; gerçek MP3 yok (aktarım/üretim sunucuda yapılacak).
- Ormanda Gece Kurtarma (`orman` bölgesi), Mahallede Elektrik Görevi, Köyde Su ve Enerji, Mucit Atölyesi: oynanabilir içerik ve sesleri YOK (yalnız "çok yakında"/veri iskeleti). Bu bölgelerin sesi yazılmadı; önce içerik gerekir. YAPILMADI.
- Ortam sesi/efekt: sentetik WebAudio (8 sahne ortamı, efektler) mevcut; ek dosya eklenmedi, lisanslı dış kaynak edinilmedi.
- Konuşurken müziği kısma, sahne değişince ortamı durdurma, efekt/ödül tekrarı sınırı: V8.5-dev kodunda VAR (testlerle, simülasyonda doğrulandı; kulakla DEĞİL).
- ElevenLabs: bağlayıcıyla 1 test üretimi başarılı, ancak indirme ağ politikasıyla (403) engelli; projeye eklenen yeni ses = 0.

## D. Yeniden denetim (r5, kod okuma + mevcut testler; cihazda DEĞİL)
- 2–5. aşamalar (`orman`, `mahalle`, `koy`, `atolye`): `adventure.json > world` içinde `status: "soon"`, `tasks` 0 → hâlâ "Çok yakında" (model `soon` durumu asla oynanabilir saymaz). Sesleri (müzik/ortam seçimi) `soundscape.js`'te tanımlı ve test edildi (S14a/S14b) ama ÇAĞIRAN oynanabilir bölüm olmadığı için uygulamada çalmaz; anlatım MP3'ü yok.
- Ekipman gereksinimi: `needs` verisi ve model hesabı (`needs` durumu, eksik ekipman maliyeti) VAR; fakat yalnızca `soon` aşamalarda dolu, Karanlık Ev ücretsiz (`needs: []`). Yani oynanabilir hiçbir görevde ekipman FİİLEN gerekmez.
- Görev ödülü `grants` sistemi: UYGULANMADI (kodda/veride `grants` yok).
- Bölgeler arası ilerleme: pil → ev → karanlık sıralı kilit açma çalışır (model + v84/v85 testleri); orman vb. kilitli/yakında.
- Tekrar girişte kalıcılık ve çift ödül: `completeAdvTask` yalnız daha yüksek yıldızı kaydeder (aynı görev tekrarında `firstTime:false`, ek coin yok); `buyItem` aynı ekipmanı iki kez almaz; kayıt `sanitize` + yazma hatasında geri alma. Testler: v84 (88/88) ve birim testleri; cihazda denenmedi.
- Bu maddeler için KAPSAMLI DEĞİŞİKLİK YAPILMADI (yalnızca rapor); çalışan market/coin'e dokunulmadı.

## E. R6 değişiklikleri ve öneriler
- Kod (2 küçük, yalnız Karanlık Ev): (1) devre aşaması başlarken `hints.start` sesli okunur (`darkhouse.js`); (2) ışık yanınca kutlama aşamasında "Başardın…" cümlesi ikinci kez SESLİ okunmaz, yalnız yazılır (devre aşaması zaten okur; art arda aynı MP3 tekrarı kalktı).
- `incomplete` ve `next` MP3'leri GEÇERLİ ama KULLANILMAYAN dosyalardır (oyun akışı için gerekli değil): `incomplete` tüm 9 devre görevinde yalnız maskot balonu (`mascot.react`) metnidir; `next` yalnız ödül ekranındaki yazılı nottur. Akış değiştirilmedi. İsteğe bağlı gelecek iş: `next` için ödül başlığından sonra sıralı okuma (paylaşılan `index.js` değişir; eski görevlerin konuşma sayılarını etkilemez ama onay gerekir).
