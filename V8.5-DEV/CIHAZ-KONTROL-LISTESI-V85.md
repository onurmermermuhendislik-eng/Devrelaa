# V8.5-dev — GERÇEK ANDROID CİHAZINDA yapılması gereken kontroller
**GERÇEK ANDROID CİHAZ TESTİ YAPILMADI.** Aşağıdakilerin hiçbiri otomatik testlerle kanıtlanmış sayılmaz (Chromium'da yalnız durum/çağrı/sayısal render denetlendi).

## Ses (kulakla)
1. Açılış: splash → menü → ana macera teması başlıyor mu; ses seviyesi makul/ani değil mi?
2. Karanlık Ev: sinematik başlarken gece ortamı + gizemli müzik; **korkutucu mu, rahatsız edici mi?** (4–8 yaş çocuğa dinletin)
3. Sesli yönerge sırasında müzik ve ortam sesi kısılıyor, konuşma bitince yumuşakça dönüyor mu? Telefon TTS'i ile müzik **birbirini bastırıyor mu?**
4. Efektler: seç (pick), bul, yerleştir, bağlantı, yanlış (nazik), başarı, ödül, market (coin), yeniden dene — hepsi ayırt edilebilir, ürkütücü değil mi? Hızlı dokunuşta üst üste binme var mı?
5. Lamba yanınca başarı müziği (`ev-basari`) ortamdan ayrışıyor ve **tek kez** çalıyor mu?
6. Aynı göreve tekrar tekrar girince sesler çoğalıyor mu?
7. Market açıkken macera ortam sesi sürüyor mu (sürmemeli); oyunlara geçince müzik susuyor mu?
8. Ayarlar: müzik aç/kapat, seviye (düşük/orta/yüksek), ortam aç/kapat; uygulamayı kapatıp açınca tercih korunuyor mu? Telefonun sessiz/titreşim modu?
9. Uygulama arka plana alınıp geri getirilince: müzik/ortam aynı yerden devam, çift başlama yok; arama gelince/kulaklık takılıp çıkarılınca?
10. Bluetooth kulaklıkta gecikme; ilk dokunuşta ses başlıyor mu (WebView autoplay)?
11. **Seslendirme:** 17 yeni satır gerçek MP3 olana kadar telefonun TTS'iyle okunur: anlaşılır mı, çocuk için uygun mu? (Gerçek Çağlayan MP3'leri üretilince yeniden dinleyin.)
12. Düşük bellekli / eski cihazda müzik+ortam+efekt birlikte takılma, ısınma, pil tüketimi.

## Görsel/işlev
13. Karanlık Ev baştan sona (4–5 ve 6–8 yaş bandı); sürükle-bırak ve dokunarak yerleştirme; yatay kilit (yalnız macera yatay).
14. Macera Dünyası paneli (menü ☰ → 🌍): 5 aşama, yalnız Karanlık Ev oynanabilir; küçük ekranda kaydırma ve "Markete git" düğmesi örtmüyor mu?
15. Coin yalnızca ilk tamamlamada; market satın alma bakiyeyi doğru düşürüyor; uygulama kapanıp açılınca coin/envanter/ilerleme aynı.
16. Gerçek APK'da paket kimliği `com.altez.minilab.v4`, imza düzeni değişmedi.
