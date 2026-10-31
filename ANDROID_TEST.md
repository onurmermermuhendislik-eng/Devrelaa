# Android – debug APK ve gerçek cihaz testi

Bu adımlar bu repoyu hazırlayan ortamda **çalıştırılamadı** (ağ politikası npm/Google/Maven adreslerini engelliyor, Android SDK yok).
Aşağıdaki komutlar kendi makinenizde (Node 20+, JDK 17, Android Studio/SDK) çalıştırılır.

```bash
npm install -D @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor-community/text-to-speech   # yerel Turkce TTS (cevrimdisi; Android'de en guvenilir yol)
node scripts/build.mjs                 # www/ üretir (harici adres kontrolü dahil)
npx cap add android
npx cap sync android
node scripts/android-prep.mjs          # marka ikonlarını kopyalar (+ isteğe bağlı: --no-internet)
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Gerçek cihaz kontrol listesi (sonucu yanına yazın)
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| 1 | Splash | Logo → ışık → slogan, ≤ ~2,7 sn (ilk açılış), sonra ≤ ~1,9 sn; dokununca atlanır | |
| 2 | Jingle | Ses açıkken kendiliğinden başlar (başlamazsa not edin: WebView otomatik oynatma), rahatsız etmeyen seviye | |
| 3 | Sessiz mod | Ses kapalıyken jingle/yönerge/müzik yok | |
| 4 | Logo & ikon | Launcher ikonu (adaptive + yuvarlak) net, ana ekranda logo tam | |
| 5 | Ana ekran / Oyna | Tek bakışta anlaşılır, Oyna büyük | |
| 6 | Dokunmatik alanlar | Parça/seçenek/slot dokunuşları isabetli | |
| 7 | Sesli yönerge | "LED'i al ve boş yere koy.", "Eksik kabloyu bul.", "Harika! Devre tamamlandı." Türkçe duyulur (cihazda tr-TR TTS yoksa sessiz kalır, oyun bozulmaz) | |
| 8 | Başarı müziği | Devre tamamlanınca jingle varyasyonu, ardından sesli "Harika!" | |
| 9 | LED animasyonu | Enerji akışı + LED parlaması akıcı | |
| 10 | Devre tamamlama / bölüm geçişi | 7 devre bölümü, seviye atlama ekranı | |
| 11 | İlerleme kaydı | Uygulama kapatılıp açılınca seviye/yaş/ses korunur | |
| 12 | Yaş grubu | 4–5 / 6–8 geçişi ve farklı zorluk | |
| 13 | Ses aç/kapat | Anında etki eder | |
| 14 | Küçük ekran | 320 dp genişlikte taşma yok | |
| 15a | Yeni görevler | Döndürülmüş şekli bul / Diğer tarafı tamamla (6–8 yaş Usta, 4–5 yaş Çırak+): dokunma, ipuçları, kısa animasyonlar akıcı | |
| 15b | Bozuk kablo | Bozuk parçaya dokununca açılır, sesli "Bozuk parçayı bul." duyulur | |
| 15 | Performans | Animasyonlar takılmıyor; geri tuşu oyundan ana ekrana döner | |

## Aşama 4 ek kontroller (Sayı Avı + oyun seçimi) — gerçek cihazda doldurun
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| 12 | Ana ekran | İki büyük kart (Şekli Tamamla, Sayı Avı), alt kısımda yaş + ses; taşma yok | |
| 13 | Gezinme | Her oyundan 🏠 ve Android Geri tuşu ana menüye döner; ana ekranda Geri uygulamayı kapatır | |
| 14 | Sayı Avı 4–5 | 1–5 aralığı, 2–3 seçenek, nesneye dokununca sayma, Türkçe yönerge | |
| 15 | Sayı Avı 6–8 | Sayıyı bul, eksik sayı, toplama, çıkarma, örüntü (1–10) | |
| 16 | Yanlış cevap | Ceza yok; seçenek soluklaşır, ipucu soru nesnelerini vurgular | |
| 17 | İlerleme | Uygulama kapatılıp açılınca iki oyunun seviyesi ayrı ayrı korunur | |
| 18 | V3'ten güncelleme | V3 kurulu cihaza üzerine kurulunca eski ilerleme/ayarlar korunur | |

## Sesli yönerge (TTS) — cihazda doğrulama
Düzeltme: `src/core/voice.js` (yerel Capacitor TTS → WebView `speechSynthesis` yedeği, Türkçe ses seçimi, cancel→speak gecikmesi, watchdog), `scripts/android-prep.mjs` (AndroidManifest'e `TTS_SERVICE` `<queries>`; Android 11+ için şart).
1. `npm install @capacitor-community/text-to-speech`, `node scripts/build.mjs`, `npx cap sync android`, `node scripts/android-prep.mjs` (prep, cap sync'ten SONRA ve her `cap add` sonrası çalıştırılmalı), `./gradlew assembleDebug`.
2. Telefonda Ayarlar → Sistem → Dil → Metin okuma çıkışı: bir motor (Google Konuşma Servisi) ve **Türkçe** ses verisi kurulu olmalı (çevrimdışı için indirilmiş olmalı).
3. Uygulamada ses 🔊 açıkken Şekli Tamamla ve Sayı Avı'nı açın: tur başında yönerge duyulmalı; 🔊 düğmesi tekrar okutmalı; ses 🔇 iken sessiz olmalı.
4. Duyulmazsa tarayıcıdan değil uygulamadan: WebView'e `#/voice-test` adresiyle gidilemiyorsa `adb logcat | grep "\[voice\]"` çıktısını gönderin (her yönerge ve hata satırı yazılır). Web/masaüstünde `…/#/voice-test` sayfası motor, Türkçe ses listesi ve olay günlüğünü gösterir.
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| 19 | Şekli Tamamla yönergesi | Türkçe duyulur (ör. "Aynı rengi bul") | |
| 20 | Sayı Avı yönergesi | "Kaç tane … var?", "Doğru sayıyı bul." duyulur | |
| 21 | 🔊 tekrar dinle | Yeniden okur | |
| 22 | Ses kapalı | Hiç konuşma yok | |
| 23 | Ses motoru yok/Türkçe yok | Sessiz ama oyun akar | |

## V5.1 gerçek telefon kontrol listesi (Mucit Atölyesi)
Paket kimliği değişmedi (`com.altez.minilab.v4`), V5 üzerine güncelleme olarak kurulur; kayıtlar ve keşifler korunmalıdır.
1. Açılış: tanı sayfası değil ana ekran; üç kart; Mucit `n/6`.
2. İlk ışık: kablo+LED+kablo → yanar, ⭐ 💡 yanar. Boşluk bırak → yanmaz.
3. Anahtar: aç/kapa → LED söner/yanar; tekrar kapat → yanar.
4. Direnç: LED'in yoluna direnç koy → LED belirgin sönükleşir; ikinci direnç daha da sönük (asla parlak değil).
5. Pil yetmezliği: çok LED/direnç seri → "Pil yetmedi", LED yanmaz.
6. Seri: aynı yolda 2 LED → yanar, seri keşfi. Paralel: iki tahta (🪜) ayrı kollarda 2 LED → paralel keşfi.
7. Kısa devre: LED'siz kapalı yol → LED yanmaz, sakin mesaj, uygulama donmaz; devam edilebilir.
8. Kayıt: 6 farklı buluş kaydet; 7.'de "dolu" mesajı ve eskilerin durması; 🗑 ile sil, yenisini kaydet; yükle-değiştir-kaydet = güncellendi.
9. Geri tuşu: 📂 açıkken Geri → yalnız 📂 kapanır; ikinci Geri → ana ekran.
10. Uygulamayı tamamen kapat/aç: keşifler, kayıtlar, `Mucit n/6` duruyor.
11. Küçük ekran: butonlar kesilmiyor, 44px+ dokunma alanı, 📂 içinde 6 buluş + 🗑 sığıyor.
12. Ses: 🔊 ve yönergeler duyuluyor (V5'te çalışan TTS bozulmamalı); ses kapalıyken sessiz.
13. Şekli Tamamla ve Sayı Avı eskisi gibi çalışıyor.

## V5.2 gerçek telefon: Geri tuşu
1. Ana ekran → Mucit Atölyesi → telefonun Geri tuşu → ana menü (oyun ekranı arkada kalmamalı).
2. Mucit → 📂 aç → Geri: yalnız çekmece kapanır; ikinci Geri ana menü.
3. Mucit'te devre kur → Geri → ana menü → tekrar Mucit: tahta temiz, kayıtlı buluşlar duruyor.
4. Mucit açıkken uygulamayı arka plana al, geri aç, Geri tuşu → ana menü; ana menüde Geri → uygulama kapanır/arka plana gider (oyun ekranıyla değil).
5. Ekrandaki 🏠 hâlâ ana menüye döner. Şekli Tamamla ve Sayı Avı'nda da Geri → ana menü.
6. Ses (TTS) V5.1'deki gibi çalışıyor.

## V6 gerçek telefon: fiziksel Geri tuşu (ÖNCELİKLİ)
Ön koşul: `@capacitor/app` kurulu olmalı (`prepare-android.sh` denetler). Eklenti yoksa Geri tuşu uygulamayı arka plana atar.
1. Mucit Atölyesi'nde fiziksel Geri → ana ekran (oyun ekranı arkada kalmamalı; uygulama arka plana gitmemeli).
2. Ana ekranda Geri → uygulama arka plana gider; tekrar açınca ANA EKRAN görünür (oyun ekranı değil).
3. 📂 açıkken Geri → yalnız çekmece kapanır; ikinci Geri → ana ekran. Çekmecedeki ✖ hâlâ çekmeceyi kapatıp atölyede bırakır.
4. Kaydedilmiş devreler tüm bu akışlardan sonra duruyor. Hızlı iki kez Geri → ana ekranda biter, takılma yok.
5. Şekli Tamamla / Sayı Avı'nda Geri → ana ekran. Ses (TTS) çalışıyor. Uygulama normal açılıyor (tanı ekranı yok).

## V7 gerçek telefon: Eğitim Bölümü (kurulum: `ALTEZ-MiniLab-V7.apk`, V6 üzerine güncelleme)
Ön koşul: V6 kayıtları (buluşlar, ilerleme) güncellemeden sonra duruyor olmalı.
1. Ana ekranda 🎓 Eğitim düğmesi görünüyor; kartlar ve ana ekran düzeni V6 gibi. Dokununca ders listesi açılıyor.
2. Liste: Başlangıç açık (Elektrik devresi nedir? açık, Anahtar kilitli 🔒), Çırak kilitli, diğer seviyeler "Yakında". Kilitli derse dokununca ders AÇILMIYOR, nazik uyarı çıkıyor.
3. "Elektrik devresi nedir?": anlatım adımları (pil, kablo, LED, kopuk yol), sonra görev: boşluklara kablo + LED koy → LED yanıyor, "Devam" çıkıyor; soru: yanlış cevapta ceza yok, tekrar deneniyor; doğru cevapta ders tamamlanıyor.
4. Ders içinde fiziksel Geri → yalnız ders kapanıp liste açılıyor (ilerleme yazılmıyor); listede Geri → ana ekran; ✖ da aynı şekilde dersi kapatıyor; 🏠 ana ekrana dönüyor.
5. Dersi bitir → uygulamayı tamamen kapat/aç → Eğitim'de ders ✔, sonraki ders açık; ana ekrandaki düğmede `1/3`.
6. Ses AÇIKKEN: yönergeler Türkçe okunuyor, 🔊 tekrar okuyor. Ses KAPALIYKEN: ders yine tamamlanıyor (altyazı yazısı var).
7. Anahtar dersi: anahtara dokununca LED yanıyor; kendi anahtarlı devreni kurup anahtarı kapat. Direnç dersi (Çırak, Anahtar bitince açılır): direnç LED'i kısıyor.
8. V6'dan kalanlar bozulmadı: Mucit Atölyesi (kayıtlı buluşlar, 📂, ✖, Geri), Şekli Tamamla, Sayı Avı, TTS, LED/devre simülasyonu, uygulamayı yeniden açma.

## V7.2 gerçek telefon: Kalfa seviyesi — Seri ve Paralel devre dersleri (kurulum: `ALTEZ-MiniLab-V7.2.apk`, V7 / V7-FIX1 üzerine güncelleme)
Bu liste henüz bir telefonda UYGULANMADI; sonuçları sen işaretle.
1. Güncellemeden sonra önceki ilerleme (tamamlanan dersler, kayıtlı buluşlar) duruyor; ana ekran düğmesi `x/5` gösteriyor.
2. Eğitim listesinde Kalfa artık "Yakında" değil: "Seri devre" ve "Paralel devre" dersleri görünüyor. Çırak bitmeden Kalfa kilitli 🔒; Direnç dersi bitince Seri devre açılıyor, o bitince Paralel.
3. Seri devre: anlatım adımları → görev: tek bir yola iki LED koy → ikisi de yanıyor, "Devam" çıkıyor. Tek LED koyunca "iki LED" ipucu görünüyor (kırmızı/ceza yok).
4. Paralel devre: merdiven tahtasında iki kolun birine LED koy → ipucu; ikinci koldaki boşluğa da LED koy → ikisi yanıyor, "Devam" çıkıyor. Sorular doğru/yanlış tepkisi veriyor.
5. Ders içinde fiziksel Geri → ders kapanır, liste açılır; listede Geri → ana ekran. Dersi bitir → uygulamayı kapat/aç → ✔ duruyor, sonraki ders açık.
6. Ses AÇIKKEN yönergeler okunuyor; KAPALIYKEN dersler yazıyla tamamlanabiliyor. Mucit Atölyesi, Şekli Tamamla, Sayı Avı eskisi gibi çalışıyor.

## V7.3 gerçek cihaz kontrolleri (sonucu yanına yazın) — bu ortamda cihazda ÇALIŞTIRILMADI
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| V1 | Ana ekran Eğitim düğmesi | Üstte mezuniyet/eğitim simgesi, altında tam "Eğitim" yazısı, büyük dokunma alanı; dokununca Eğitim açılır | |
| V2 | Yaş düğmesi | Üstte yaş simgesi, altında "4–5 yaş" / "6–8 yaş"; dokununca grup değişir, seçili grup anlaşılır | |
| V3 | Şekli Tamamla seçenek okuma | Seçeneğe dokununca adı Türkçe okunur, o kart parlar; yeni dokunuşta parlama + ses yeni karta geçer, eski ses kesilir | |
| V4 | Devre seçeneği | Parça adı okunur + yazı olarak görünür; doğru parçada LED yanar, seviye ilerler; yanlışta başarı sesi yok | |
| V5 | Ses kapalı | Seçim/parlama çalışır, konuşma yok | |
| V6 | Türkçe ses yok | Oyun çökmez; seçilen ad yazı olarak görünür | |
| V7 | Ekrandan çıkış | Ana ekrana/başka oyuna geçince konuşma durur | |
| V8 | Geri tuşu, kayıtlı ilerleme, V7.2 oyunları | Önceki gibi çalışır | |

## V7.4 gerçek cihaz kontrolleri (sonucu yanına yazın) — bu ortamda cihazda ÇALIŞTIRILMADI
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| W1 | Ana ekran Eğitim yazısı | Mezuniyet simgesinin altında mor zemin üstünde BEYAZ, okunaklı "Eğitim 0/8" yazısı; dar ekranda kesilmez | |
| W2 | Eğitim Merkezi | Dokununca açılır; 6 aşama (Başlangıç→Çırak→Kalfa→Usta→Kaşif→Mucit), şimdiki aşama işaretli, ileri aşamalar soluk/kilitli | |
| W3 | Dersler | Her aşamada en az bir ders; Başla/Devam, görev, soru; tamamlanınca ✔ ve rozet | |
| W4 | Görevler | Pil-kablo-LED, direnç, anahtar (açık/kapalı), Usta (LED+direnç+anahtar), Kaşif (boşluğu kapat), Mucit (iki LED+anahtar): LED gerçekten yanar, başarı sesi tek kez | |
| W5 | Yanlış cevap/yerleştirme | Cevap verilmez; kısa Türkçe ipucu (yazı + ses açıksa okunur) | |
| W6 | Uygulamayı kapat-aç | Biten dersler ve rozetler korunur | |
| W7 | Geri tuşu | Derste: listeye; listede: ana ekrana | |
| W8 | Ses kapalı | Eğitimde konuşma/ses yok, görevler yine tamamlanır | |
| W9 | Mevcut oyunlar | Şekli Tamamla, Sayı Avı, Mucit Atölyesi önceki gibi | |

## V7.5 gerçek cihaz kontrolleri (kullanıcı: V7.5 cihazda test edildi, tümü başarılı bildirildi — bu dosyada kaydı yoktur) — V7.6 geliştirme ortamında cihazda ÇALIŞTIRILMADI
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| X1 | Parça kartları | Pil, kablo, LED (Başlangıç), anahtar, direnç derslerinde sarı kart: "ne yapar" + benzetme; görevde "Dene:" satırı; karta dokununca parça adı ve anlatım okunur | |
| X2 | Yanlış bağlantı ipucu | Pil-kablo-LED görevinde yalnız LED koyup kablo koymayınca "kablo da koy" gibi kısa ipucu (yazı + ses açıksa okunur); anahtar açıkken "Anahtar açık… dokun"; boşlukta "boşluk var" | |
| X3 | Yanlış cevap ipucu | Soruda yanlış seçeneğe dokununca cevap söylenmez, kısa benzetmeli ipucu çıkar; aynı yanlışa art arda dokununca ek ses/konuşma olmaz | |
| X4 | Başarı sesi | Görev tamamlanınca başarı sesi TEK kez; hızlı tekrar dokunuşlarda ikinci ses yok | |
| X5 | Ders bitiş ekranı | "Harika! Ders tamamlandı." + YENİ rozet + "Öğrendin: …" + "n / 8 rozet"; Başlangıç'ın 2. dersi bitince "Başlangıç aşamasını bitirdin!" | |
| X6 | Aynı dersi tekrar bitirme | "Bu rozet zaten sende."; aşama duyurusu ve sayaç tekrar artmaz | |
| X7 | Rozet/ilerleme tutarlılığı | Ders listesindeki rozetler, aşama yolu ve sayaçlar bitiş ekranıyla aynı; uygulamayı kapat-aç sonrası korunur | |
| X8 | Ses kapalı | Hiç ses/konuşma yok; ipucu, rozet ve "Öğrendin" yazıyla görünür; görevler yine tamamlanır | |
| X9 | Yatay ekran | Telefonu yan çevir: Eğitim listesi kaydırılır; ders ekranında devre tahtası, kart ve parçalar görünür; bitiş ekranı iki sütun | |
| X10 | Önceki davranışlar | Ana ekran, "Eğitim" yazısı, 6 aşamalı yol, mevcut oyunlar, fiziksel Geri tuşu, kayıt sistemi V7.4'teki gibi | |


## V7.6 gerçek cihaz kontrolleri (sonucu yanına yazın) — bu ortamda cihazda ÇALIŞTIRILMADI
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| Y1 | Sıradaki ders kartı | Eğitim listesinin en üstünde "Sıradaki ders" + ders adı + büyük "Başla" düğmesi; dokununca o ders açılır; yeni kurulumda ilk ders (Elektrik devresi nedir?) | |
| Y2 | Genel ilerleme | Kartın altında "n / 8 ders" ve çubuk; biten derslerle birlikte artar; uygulamayı kapat-aç sonrası aynı | |
| Y3 | Tekrar oyna etiketi | Biten derslerde "↻ Tekrar oyna" yazısı; kilitli derslerde yok; biten derse dokununca ders açılır | |
| Y4 | Tekrar bitiş ekranı | Biten bir dersi baştan sona oynayınca: "Bu rozet zaten sende." + "Bu dersi tekrar oynadın…" notu; YENİ rozet, aşama/“hepsi tamam” kutlaması YOK; sayaç aynı | |
| Y5 | Hepsi bitince | 8/8 iken kart "Hepsini bitirdin!…" + "Tekrar oyna"; tekrar oynayınca rozet sayısı 8 kalır | |
| Y6 | Ses kapalı | Tekrar dahil hiç ses/konuşma yok; not yazıyla görünür | |
| Y7 | Yatay ekran + Geri tuşu | Yatay: kart ve liste görünür/kaydırılır; Geri: derste listeye, listede ana ekrana | |
| Y8 | Önceki davranışlar | V7.5 maddeleri (X1-X10), ana ekran, "Eğitim" yazısı, 6 aşamalı yol, mevcut oyunlar, kayıtlar önceki gibi | |


## V7.7 gerçek cihaz kontrolleri (sonucu yanına yazın) — bu ortamda cihazda ÇALIŞTIRILMADI
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| Z1 | Açılış ekranı | Lacivert zemin, ortada logo, altında "Keşfet · Öğren · Üret"; en altta "Uygulama sürümü V7.8" ve "ALTEZ Enerji"; ~2–3 sn sonra ana ekran; dokununca atlanır; yazılar kesilmez | |
| Z2 | Sürüm eşleşmesi | Açılış ekranındaki V7.8 = Ayarlar > Uygulamalar'daki sürüm adı 7.8 | |
| Z3 | Ana ekran | 3 oyun kartı aynı; altında "Çok yakında" şeridi (Enerji Macerası, Kullanıcı Girişi ve Profil, Ebeveyn Kontrolü); şerit yana kaydırılır; "Eğitim" ve "Görevler" düğmeleri (gerekirse aşağı kaydırınca) çalışır | |
| Z4 | Çok yakında kartları | Her kartta "GELİŞTİRME AŞAMASINDA" yazısı; dokununca oyun AÇILMAZ, bilgi paneli açılır; Tamam / dışına dokunma / Geri tuşu paneli kapatır; ses kapalıyken ses yok | |
| Z5 | Dürüstlük | Profil/Ebeveyn panelinde giriş, PIN veya süre sınırı çalışıyormuş gibi bir şey YOK ("şu anda süre sınırı veya PIN koruması yoktur" yazar) | |
| Z6 | Görevler merkezi | "Görevler" → Elektrik Dedektifi / Mantık ve Bilim kartları; 4–5 yaşta 8 vaka + 8 görev, 6–8 yaşta 15 vaka + 16 görev (V7.8) | |
| Z7 | Elektrik Dedektifi | Eksik parça / bağlantıyı tamamla / arıza yeri vakaları; yanlışta özel ipucu, 2. yanlışta güçlü ipucu, 3. yanlışta boşluk vurgusu; doğruda lamba yanar | |
| Z8 | Mantık ve Bilim | Sıralama, örüntü, neden-sonuç, bilim görevleri; 4–5 yaşta en çok 3 seçenek; bilim/neden-sonuçta "Gözlem:" metni | |
| Z9 | Ödül güvenliği | Aynı görevi tekrar çözünce yeni rozet/ödül YOK ("Bu rozet zaten sende."); hızlı çift dokunuş ve uygulamayı kapat-aç sonrası da ödül artmaz; Eğitim ilerlemesi (edu) aynı | |
| Z10 | Ses kapalı | Görevlerde ve panellerde hiç ses/konuşma yok; ipucu yazıyla görünür | |
| Z11 | Geri tuşu ve yatay ekran | Görev→liste→Görevler→ana ekran; yatay çevirince hub, liste, görev ve bitiş ekranı taşmadan kullanılır | |
| Z12 | Önceki davranışlar | 3 oyun, Eğitim, kayıtlar ve ilerleme V7.6'daki gibi | |

## V7.8 gerçek cihaz kontrolleri (sonucu yanına yazın) — bu ortamda cihazda ÇALIŞTIRILMADI
Görevler (Elektrik Dedektifi, Mantık ve Bilim) V7.7'de de gerçek cihazda hiç denenmedi; aşağıdaki liste hem yeni hem ilk kez denenen akışları kapsar.
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| W1 | Yeni vakalar (4–5) | Listede 8 vaka; "Seri lambalar" (iki LED + kablo ile yanar), "Kumanda parçası" (yalnız anahtar çözer; kablo/direnç ipucu verir) | |
| W2 | Yeni vakalar (6–8) | 15 vaka; "Kısa yol" (kısa devre), "Sessiz kol" (açık anahtar), "Yorgun pil" (çok LED/direnç) — doğru konuma dokununca lamba yanar | |
| W3 | Tekrar yanlış | Aynı yanlış yere/seçeneğe tekrar dokununca ipucu yazısı kaybolmaz/yeniden görünür; 3 FARKLI yanlıştan sonra doğru konum parlar (dolu konum dahil) | |
| W4 | Küçük ekran | Mantık ve Bilim "Yıldız dizisi": ⭐ satırları kesilmez; "Civciv büyüyor": etiketler ("Çıkan civciv", "Küçük civciv") kesilmez | |
| W5 | Yatay ekran | Mantık ve Bilim'de 3–4 seçenek ilk görünen alanda, kaydırmadan dokunulur | |
| W6 | Sesler | Doğru cevap → kısa ses; ardından başarı sesi ÜST ÜSTE BİNMEDEN; "Devam"a hemen basınca da kutlama sesi başarı sesinin bitmesini bekler; ses kapalıyken sessiz | |
| W7 | Başarı animasyonu | Mantık ve Bilim doğru cevapta panel hafifçe büyüyüp küçülür; cihazda "animasyonları kaldır" açıksa hareket yok | |
| W8 | Kayıt hatası | (Telefon belleğini tamamen doldurmak güvenli değilse bu madde atlanabilir) Kayıt yazılamazsa "Kayıt yazılamadı — rozet henüz kazanılmadı" görünür, sahte rozet/sayaç yok; yer açıp aynı görevi çözünce gerçek rozet gelir | |
| W9 | Eski kayıt | V7.7'den güncelleme: Şekli Tamamla, Sayı Avı, Eğitim ilerlemesi ve eski görev rozetleri korunur (uygulama aynı paket kimliğiyle V7.7 üstüne kurulur) | |
| W10 | Önceki davranışlar | Ana ekran, "Çok yakında" kartları (GELİŞTİRME AŞAMASINDA), Eğitim, Geri tuşu önceki gibi | |

## V7.8 Ana Menü + maskot + animasyon gerçek cihaz kontrolleri (sonucu yanına yazın) — bu ortamda cihazda ÇALIŞTIRILMADI
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| M1 | Ana menü | 4 kart: Oyunlar (mavi), Eğitim (yeşil), Profil (mor), Ebeveyn (turuncu); üstte logo, sağ üstte "V7.8"; kırpılma yok (küçük ekran ve yatay dahil) | |
| M2 | Oyunlar | 5 oyun kartı açılır; 🏠 ile ana menüye dönülür; Geri tuşu: oyun→Oyunlar→ana menü→uygulamayı küçültür | |
| M3 | Eğitim | Eğitim akışı önceki gibi; ilerleme korunur | |
| M4 | Profil/Ebeveyn | "Geliştirme Aşamasında"; giriş/PIN/süre sınırı çalışıyormuş gibi bir şey YOK | |
| M5 | Maskot | Ana menüde selam; oyunda doğruda sevinç, yanlışta nazik cesaret, ipucunda yardımcı, bitişte kutlama; mesajlar kısa ve art arda aynı değil | |
| M6 | Ses | Maskot yeni ses çıkarmaz; sesler üst üste binmez; ses kapalıyken tamamen sessiz | |
| M7 | Animasyon | Kartlar yavaş ve hafif salınır; dokunma anında çalışır, kaydırma engellenmez; "animasyonları kaldır" açıkken hareket yok; pil/ısınma belirgin değil | |
| M8 | Kayıtlar | V7.7/V7.8 üstüne kurulumda rozet, ilerleme, Eğitim kaydı korunur | |

## V7.9 Maskot V2 + Enerji Macerası gerçek cihaz kontrolleri (sonucu yanına yazın) — bu ortamda cihazda ÇALIŞTIRILMADI
| # | Kontrol | Beklenen | Sonuç |
|---|---|---|---|
| E1 | Maskot | Ana menüde büyük, canlı; karşılama/başarı/cesaretlendirme/ipucu halleri; ses gelmez (yeni ses yok) | |
| E2 | Oyun içi maskot | Küçük ekranda cevap düğmelerini ve oyun alanını örtmez; yer yoksa yalnız resim olarak küçülür | |
| E3 | Hareket azaltma | Android "animasyonları kaldır" açıkken maskot sabit/yumuşak | |
| E4 | Enerji Macerası | Oyunlar'da 6. kart; Pil ve Enerji açık, diğer 4 bölge "Yakında" | |
| E5 | Coin | İlk tamamlamada coin artar; tekrarda ödül yok; coin azalmaz | |
| E6 | Kayıtlar | V7.7/V7.8 üstüne kurulumda ilerleme ve rozetler korunur | |
| E7 | Yatay + 320×568 | Kırpılma/yatay taşma yok | |
| E8 | Yatay bitis ekrani (fix1) | Telefonu yatay çevir, bir görevi bitir: maskot "Görev listesi", "Sonraki görev", ✖/🔊 düğmelerine ve bitiş yazılarına binmez; düğmeler dokunulabilir | |

## V7.9.1 gerçek cihaz kontrolleri — bu ortamda cihazda ÇALIŞTIRILMADI (GERÇEK ANDROID CİHAZ TESTİ YAPILMADI)
| # | Kontrol | Beklenen | Sonuç |
|---|---|---|---|
| U1 | V7.9 üstüne güncelleme | Veri silmeden kurulur (aynı imza), açılışta sürüm V7.9.1, Ayarlar'da 7.9.1 | |
| U2 | Kayıtlı ilerleme | Coin, rozet, görev ilerlemesi korunur | |
| U3 | 4–5 ve 6–8 yaş | İkisinde Pil ve Enerji görevleri çalışır | |
| U4 | Yatay görev bitişi (640×360 benzeri) | Maskot "Görev listesi"/"Sonraki görev"/✖/🔊 ve bitiş yazılarına binmez | |
| U5 | Dikey 320×568 ve 360×640 | Çakışma/taşma yok | |
| U6 | Dokunma | Maskot düğmeleri engellemez | |
| U7 | Coin | Yalnız ilk tamamlamada artar, tekrarda yok | |
| U8 | Geri tuşu, ses, hareket azaltma | Doğru çalışır | |


## V8.0-proto1 gerçek cihaz kontrolleri — bu ortamda cihazda ÇALIŞTIRILMADI (GERÇEK ANDROID CİHAZ TESTİ YAPILMADI)
| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| V1 | Güncelleme | V7.9.1 üstüne veri silmeden kurulur (aynı imza); sürüm 8.0.0-proto1 / 20 | |
| V2 | Yatay kilit | Uygulama yatay açılır; telefonu dikey tutunca dönmez (sensorLandscape); sol/sağ yatay çevrilince çalışır | |
| V3 | Tanıtım | İlk açılışta ~12 sn tanıtım akıcı; Atla çalışır; "Haydi başlayalım!" haritaya götürür; sonraki açılışta tekrar çıkmaz; menüden tekrar izlenir | |
| V4 | Harita | 5 düğüm + kapı görünür, düzen taşmaz/kesilmez (farklı oran/çentikli ekran), düğümlere parmakla rahat dokunulur | |
| V5 | Kilitler | Kilitli düğüme dokununca açılmaz, maskot uyarır; tamamlanan altın + yıldızlı | |
| V6 | Devre görevi | Pil/lamba parça seçip yuvaya koyma VE sürükle-bırak parmakla çalışır; taş/yaprak yanmaz; lamba yanınca animasyon | |
| V7 | Ödül | Yıldız ve +coin gösterilir; tekrar oynayınca coin yok; Haritaya dön → sıradaki görev açık | |
| V8 | Final | 5. görevde anahtara dokunma; kutlama; "Yeni bölge açıldı" ve kapı açık | |
| V9 | Kalıcılık | Uygulamayı kapatıp (son uygulamalardan at) aç: coin/yıldız/açık görevler korunur | |
| V10 | Geri tuşu | Görevde Geri → harita; menü açıkken Geri → menü kapanır; haritada Geri → arka plana | |
| V11 | Ses | Haritadaki/görevdeki 🔊 düğmesi sesi kapatır ve hatırlar | |
| V12 | Maskot | Harita/görev/ödülde maskot düğmelere/HUD'a binmez (WebView'da) | |
| V13 | Eski oyunlar | ☰ → Mini oyunlar ile eski ana ekran açılır, eski oyunlar çalışır; yatay kilit altında kullanılabilir mi not edin | |
| V14 | Performans | Tanıtım ve harita animasyonları düşük donanımda takılmıyor | |


## V8.1 gerçek cihaz kontrolleri — bu ortamda cihazda ÇALIŞTIRILMADI (GERÇEK ANDROID CİHAZ TESTİ YAPILMADI)
| # | Kontrol | Beklenen | Sonuç |
|---|---|---|---|
| W1 | V7.9.1/V8.0 üstüne güncelleme | Veri silinmeden kurulur (aynı imza); sürüm 8.1 / 21 | |
| W2 | Açılış | Doğrudan Enerji Macerası DEĞİL, yatay ana menü; tanıtım yalnız ilk açılışta | |
| W3 | Ses (EN ÖNEMLİSİ) | Görev açılınca Türkçe yönerge GERÇEKTEN duyulur; "Tekrar dinle" tekrar okur; Ayarlar > Ses testi duyulur | |
| W4 | Ses kapalı / motor yok | Menü ve Ayarlar'da kapatınca konuşma durur; Türkçe ses yoksa uyarı çıkar | |
| W5 | Ses geçişleri | Görevden göreve geçerken sesler üst üste binmez | |
| W6 | 8 görev | Sırayla açılır; sürükle-bırak ve dokunma çalışır; ödül yalnız ilk kez | |
| W7 | Oyna / Eğitim | Eski mini oyunlar ve Eğitim ana menüden açılır; Geri düğmesi menüye döner | |
| W8 | Kayıt | Uygulamayı kapat-aç: ilerleme korunur | |


## V8.2 gerçek cihaz kontrolleri — bu ortamda cihazda ÇALIŞTIRILMADI (GERÇEK ANDROID CİHAZ TESTİ YAPILMADI)
| # | Kontrol | Beklenen | Sonuç |
|---|---|---|---|
| X1 | Güncelleme | V8.1 üstüne veri silinmeden kurulur (aynı imza); sürüm 8.2 / 23 | |
| X2 | Tanıtım SESİ (EN ÖNEMLİSİ) | İlk açılışta her sahnenin cümlesi Türkçe sesle duyulur; lamba yanınca "açıl" sesi; Atla sesi keser; çıkış/yeniden girişte tek sefer çalar; cihaz sessizse/uygulama sesi kapalıysa susar | |
| X3 | Dikey/yatay menü + tanıtım | Telefon ve tablette iki yönde taşma/kesilme yok; döndürünce başa dönmez | |
| X4 | Yön kilidi | Menü/tanıtım/oyun listesi serbest; oyuna/maceraya girince yatay kilitlenir; menüye dönünce serbest (Android köprüsü) | |
| X5 | Oyun kartları | Başlık/açıklama kartın içinde, çok kart kaydırılır, dönmede yeniden dizilir | |
| X6 | Profil düğmesi | Girişsiz 👤; ad+soyad kaydedince baş harfler (ör. OA); çıkış ilerlemeyi silmez | |
| X7 | Ebeveyn düğmesi | Kalkan; Açık/Kapalı ayrımı; PIN/soru doğrulaması; kilitli kartlar açılmaz; Geri tuşu uygulamayı beklenmedik kapatmaz | |
| X8 | Ebeveyn paneli | Çocuk adı, yaş bandı, tamamlanan oyun/seviye, ses talimatı açık/kapalı | |
| X9 | Kayıt | Kapat-aç: ilerleme, profil ve ebeveyn ayarı korunur | |
| X10 | İmza | `apksigner verify --print-certs` sertifika SHA-256'sı V8.1 APK'sı ile aynı | |


## V8.3 gerçek cihaz kontrolleri — bu ortamda cihazda ÇALIŞTIRILMADI (GERÇEK ANDROID CİHAZ TESTİ YAPILMADI)
| # | Kontrol | Beklenen | Sonuç |
|---|---|---|---|
| Y1 | Güncelleme | V8.2 üstüne veri silinmeden kurulur (aynı imza); sürüm 8.3 / 24 | |
| Y2 | Giriş sesi (EN ÖNEMLİSİ) | Tanıtım açılınca CAGLAYAN kaydı (~11 sn) duyulur; TTS ayrıca OKUMAZ; tek kez çalar | |
| Y3 | Ses kapalı | Ana menüde ses kapalıyken tanıtım sessiz | |
| Y4 | Atla / çıkış | Atla sesi hemen keser; menüden "Tanıtımı izle" tekrar çalar, üst üste binmez | |
| Y5 | Otomatik oynatma engeli | Kayıt çalmazsa Türkçe TTS yedeği okur, tanıtım akar | |
| Y6 | Uçak modu | İnternetsiz aynı şekilde çalışır | |


## V8.3 gerçek cihaz kontrolleri — bu ortamda cihazda ÇALIŞTIRILMADI (GERÇEK ANDROID CİHAZ TESTİ YAPILMADI)
| # | Kontrol | Beklenen | Sonuç |
|---|---|---|---|
| Y1 | Güncelleme | V8.2 üstüne veri silinmeden kurulur (aynı imza); sürüm 8.3 / 24 | |
| Y2 | Giriş sesi (EN ÖNEMLİSİ) | İlk açılışta CAGLAYAN sesiyle "Merhaba minik kaşif!…" duyulur; TEK sefer; Türkçe TTS ile üst üste binmez | |
| Y3 | Otomatik oynatma | Ses ilk açılışta hiç gelmezse (WebView engeli) sahne yazıları Türkçe TTS ile okunur; akış bozulmaz | |
| Y4 | Ses kapalı | Ana menü/Ayarlar'da ses kapalıyken tanıtımda hiçbir ses çalmaz | |
| Y5 | Atla / Haydi başlayalım | Ses anında durur; menüde devam etmez | |
| Y6 | Tekrar izle | Ayarlar > Tanıtımı izle: ses yine bir kez çalar | |
| Y7 | Uçak modu | İnternet kapalıyken de ses çalar (yerel varlık) | |
| Y8 | Cihaz sessiz modu | Cihaz sessizdeyse ses duyulmaz (uygulama geçersiz kılmaz) | |


## V8.4 (Aşama A–C) gerçek cihaz kontrolleri — bu ortamda cihazda ÇALIŞTIRILMADI (GERÇEK ANDROID CİHAZ TESTİ YAPILMADI)
| # | Kontrol | Beklenen | Sonuç |
|---|---|---|---|
| Z1 | Güncelleme | V8.3 üstüne veri silinmeden kurulur (aynı imza); sürüm 8.4 / 25 | |
| Z2 | Enerji Macerası yatay | Menüden Enerji Macerası'na girince ekran yataya kilitlenir; harita/görev/HUD kesilmez, birbirine binmez (farklı telefon/tablet, çentikli ekran) | |
| Z3 | Oyunlar listesindeki Enerji Macerası | Aynı şekilde yatay | |
| Z4 | Diğer oyunlar | Şekli Tamamla, Sayı Avı, Mucit, Eğitim, Görevler: telefon DİKEY ve YATAY tutulunca açılır ve oynanır; yön kilidi YOK | |
| Z5 | Geçişler | Enerji Macerası → menü → başka oyun: yön serbest kalır; oyunlar arası geçişte yön/yerleşim doğru | |
| Z6 | Eğitim (dikey) | Ders kartları ve "Başla" düğmesi ekranın dışına taşmaz (özellikle geniş/uzun telefon) | |
| Z7 | Çağlayan sesi | İlk açılışta duyulur; TEK sefer; Atla/Haydi başlayalım sesi keser; ses kapalıyken çalmaz | |
| Z8 | Arka plan | Tanıtım sürerken uygulamayı arka plana al, geri dön: ses yeniden başlamaz | |
| Z9 | Otomatik oynatma | Ses ilk anda hiç gelmezse tanıtımın ilk saniyelerinde ekrana dokun: kayıt başlar; gelmezse Türkçe okuma yedeği devrede | |
| Z10 | Uçak modu | İnternet kapalıyken de çalışır | |

## V8.4 (Aşama D–F: görevler, coin, Enerji Marketi, Çağlayan satır sesleri) gerçek cihaz kontrolleri — bu ortamda cihazda ÇALIŞTIRILMADI (GERÇEK ANDROID CİHAZ TESTİ YAPILMADI)
| # | Kontrol | Beklenen | Sonuç |
|---|---|---|---|
| Z11 | Evde Enerji bölgesi | Pil ve Enerji bitince kapı açılır; "Evde Enerji" haritası 7 görev gösterir, ilki açık, diğerleri kilitli; geri düğmesi Pil haritasına döner | |
| Z12 | Seçmeli görevler | Fener, Oda Lambası, Kablonun Kılıfı, Güvenli Deney: yanlış cevap cezasız; doğru cevapta öğretici cümle; Güvenli Deney'de priz doğru cevap OLMAZ | |
| Z13 | LED + direnç devresi | Kabloyla direnç atlanınca LED yanar ama "direnç lazım" uyarısı çıkar, görev bitmez; direnç koyunca biter; Gece Lambası ve Mucit Evi Finali anahtarla yanıp söner | |
| Z14 | Coin | Görev bitince +coin (yalnız ilk kez); aynı görev tekrar oynanınca coin yok; uygulamayı tamamen kapatıp açınca coin aynı | |
| Z15 | Enerji Marketi | Harita sağ üstteki 🛒: 6 ekipman, bakiye doğru; yetmeyen ürün "N coin eksik"; satın alma onay sorar; Vazgeç coin harcamaz; alınca coin düşer, "Sende var" olur; aynı ürün tekrar alınamaz; çift dokunuşta tek harcama | |
| Z16 | Kalıcılık | Market alışverişinden sonra uygulamayı kapat/aç: bakiye ve çanta aynı | |
| Z17 | Yön ve yerleşim | Market, harita ve görevler YATAYDA kesilmeden/binmeden; liste kaydırılınca son ürüne ulaşılır; dikeyde "telefonu yatay çevir" | |
| Z18 | Ses (cihaz TTS) | Görev yönergesi, öğretici cümle, ödül cümlesi, market karşılama cümlesi okunur; Ses kapalıyken HİÇ konuşma yok; yeni konuşma eskisini keser (üst üste binme yok) | |
| Z19 | Çağlayan MP3 satırları | (Yalnız MP3'ler eklenip `node scripts/voice-sync.mjs` çalıştırıldıysa) Aynı cümleler Çağlayan sesiyle çalınır, TTS ile ÜST ÜSTE binmez; dosya yoksa TTS'e döner | |
| Z20 | Önceki davranışlar | Açılış sesi (tek sefer), Atla, diğer oyunlar dikey/yatay, ilerleme ve ebeveyn kilidi V8.3'teki gibi | |
