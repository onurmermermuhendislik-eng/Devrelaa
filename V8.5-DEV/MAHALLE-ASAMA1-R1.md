# ALTEZ MiniLab — Mahalle Macerası, AŞAMA 1 (R1): Oynanabilir Dünya Prototipi

**GERÇEK ANDROID CİHAZ TESTİ YAPILMADI.** Tüm doğrulama Chromium (Playwright) + saf mantık birim testleriyle yapılmıştır; dokunmatik = sentetik PointerEvent.

## Kapsam
Mini oyunlar menüsünden bağımsız, çocuğun sırtında okul çantalı karakteriyle dolaştığı küçük bir mahalle. Dört mekân (Okul, Ev, Market, Atölye): girişe gelince "İçeri Gir" aktifleşir, içeri girilir, "Dışarı Çık" ile kapının önüne dönülür. Görev/eğitim/ekonomi YOK (sonraki aşamalar).

## Nasıl açılır
- Ana menü → alt sağdaki küçük **"🏘️ Mahalle (prototip)"** düğmesi, ya da rota `#/mahalle`.
- Mevcut oyun/kayıt/ses akışına dokunulmadı: yeni kayıt anahtarı yok (dünya durumu oturum boyunca bellekte), yeni ses yok, yeni kütüphane yok, ekran yönü serbest.

## Değişen mevcut dosyalar (gerekçe: yalnız giriş noktası; çalışan akışlar değişmedi)
| Dosya | Değişiklik |
|---|---|
| `src/core/app.js` | `#/mahalle` rotası (import + 8 satırlık blok, `#/progress` bloğundan önce) |
| `src/ui/mainmenu.js` | `.mm-hood` düğmesi (kartların DIŞINDA) + tıklama dalı |
| `src/ui/styles.css` | `.mh*` / `.mm-hood` CSS bloğu (`/* V7.5: Egitim DERS` yorumundan önce) |

## Eklenen dosyalar
| Dosya | Görev |
|---|---|
| `src/games/mahalle/world.js` | Dünya verisi (1800×1160 birim: 3 yol, kaldırımlar, 4 mekân + 5 komşu ev, ağaç/lamba/bank/gölet), çarpışma (`blocked`), giriş bölgeleri |
| `src/games/mahalle/engine.js` | 8 yön nicemleme, adım (eksen ayrımlı kayma, tünelleme yok), kamera (yumuşak takip, sınır kenetleme, cihaz pikseline yuvarlama = titreme yok), gir/çık, ölçek |
| `src/games/mahalle/art.js` | Canvas çizimi: statik nesneler sprite önbelleği + y-sıralama; zemin; çocuk (ön/arka/yan, yürüyüş döngüsü) |
| `src/games/mahalle/interiors.js` | 4 iç mekân SVG (sınıf, oturma odası, market, atölye) |
| `src/games/mahalle/index.js` | Ekran: tuval, yüzen sanal joystick, "İçeri Gir/Dışarı Çık", geçiş kararması, klavye, Geri tuşu, yaşam döngüsü |
| `tests/mahalle.test.js` | 11 birim testi (çarpışma, erişilebilirlik BFS, kamera, giriş/çıkış) |
| `scripts/ui-mahalle.mjs` | 32 tarayıcı kontrolü (M1–M18) |
| `scripts/ui-mahalle-shots.mjs` | Görsel kontrol ekran görüntüleri |

## Tasarım özeti
- **Hareket:** joystick/klavye → 8 yöne nicemlenir (ölü bölge %22), çapraz hız normalize, 175 birim/sn. Yürüme: bacak/kol salınımı + gövde sekmesi.
- **Çarpışma:** çocuk = daire (r=13); bina cepheleri (AABB), ağaç/lamba/çöp kutusu (daire), bank, gölet (elips). Eksenler ayrı denenir → duvar boyunca kayar.
- **Kamera:** hedef = oyuncu; üstel yumuşatma; dünya sınırına kenetlenir; çizimde `round(cam*ölçek*dpr)/…` → alt-piksel titreme yok.
- **Mekân girişi:** kapı önündeki kaldırım bölgesi (148×78 birim) sarı parlar, çocuğun üstünde ok, düğme "Okula Gir/Eve Gir/Markete Gir/Atölyeye Gir" aktifleşir. Dışarı çıkışta çocuk kapının önüne (geçerli, engelsiz nokta) konur.
- **Sahne durumu:** `{x,y,dir,place,near,flags}` — ileride görev/envanter/ilerleme `flags` ve `place` üzerinden bağlanır.

## Sonraki aşamalar için bırakılanlar
Görev/eğitim, market ekonomisi, iç mekânda yürüme, mekân ambiyans sesleri/müzik, kalıcı konum kaydı, ebeveyn kilidi kartı, Karanlık Ev'in "Ev" mekânına bağlanması.
