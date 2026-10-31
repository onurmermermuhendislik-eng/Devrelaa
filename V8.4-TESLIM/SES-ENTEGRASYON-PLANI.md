# ALTEZ MiniLab V8.4 — Çağlayan ses entegrasyonu: envanter ve plan

## 1. Mevcut sistem (incelendi; V8.3 bayt bayt aynı, `v84-baseline/` SHA-256 manifestiyle)
Ses altyapısı zaten merkezi ve iki katmanlı:
- `src/core/audio.js` — EFEKT katmanı. 10 olay: tap(31 çağrı), gentle(17), place(7), correct(7), circuitOn(5), success(4), levelUp(4), jingle(1), + V8.3 `playFile('introVoice')`. Manifestte `null` ise uygulamanın kendi sentezi; yol varsa MP3. Tek dosya: `minilab-jingle.mp3`.
- `src/core/voice.js` — ANLATIM/YÖNERGE katmanı. `voice.say(anahtar, onEnd, metin)`: manifestte `voice.<anahtar>` MP3 yolu VARSA o kaydı çalar, YOKSA Android TextToSpeech (tr-TR); yeni konuşma eskisini keser (üst üste binme yok); ses kapalıysa susar; hata → TTS. 17 sabit yönerge metni (`strings.tr.json > voice`) + oyunların dinamik metinleri (görev/ders/Mucit). Manifestte 40+ `voice.*` anahtarı şimdi `null` (TTS).
- Açılış: `intro.js` → `audio.playFile('introVoice')` (`assets/sounds/intro-caglayan.mp3`, SHA-256 `5660c82a…fc53`, 195.822 bayt, 11,15 sn, mono MP3). Üretim kaydı: ElevenLabs, ses CAGLAYAN (`sJ0xHHPzz1LOio4QNlB0`), dosya adı `..._pvc_sp100_s50_sb75_v4`.
Sonuç: Çağlayan'ı "ortak sisteme" bağlamak yeni sistem kurmak değil, MEVCUT `voice.<anahtar>` → MP3 mekanizmasını kullanmaktır.

## 2. Kategoriler (ayrı yönetilir, birbirini değiştirmez)
| Kategori | Katman | Çağlayan? | Not |
|---|---|---|---|
| A. Açılış anlatımı | `audio.playFile('introVoice')` | EVET (mevcut MP3) | tek sefer, ses kapalıyken yok, TTS yedeği |
| B. Oyun yönergesi | `voice.say(<anahtar>)` | Evet, MP3 geldikçe anahtar anahtar | MP3 yoksa TTS; "Tekrar dinle" aynı kaydı çalar |
| C. Geri bildirim (doğru/yanlış/seviye) | efekt biter bitmez, tek ses | Evet, 5 hazır cümle | EFEKTİN YERİNE GEÇMEZ, ardından gelir |
| D. Efektler (tap, place, correct, jingle…) | `audio.play` | HAYIR | aynen korunur |
| E. Görev/ders anlatımı (dinamik metin) | `voice.say(…, metin)` | HAYIR (TTS) | metin dinamik; kayıt sonradan, öncelik düşük |

## 3. Bağlama haritası (5 üretilmiş cümle)
- "Hadi, doğru parçayı bulalım!" → B: Şekli Tamamla `complete` yönergesi (şu an "Eksik parçayı bul")
- "Harika yaptın!" / "Aferin minik kaşif!" → C: doğru cevap (dönüşümlü, art arda aynı cümle yok)
- "Bir daha deneyelim, başarabilirsin!" → C: yanlış cevap (mevcut `again` "Tekrar deneyelim" yerine geçer)
- "Tebrikler! Bu seviyeyi tamamladın!" → C: seviye tamamlama (`levelUp`)
Sıralama kuralı: efekt → (≈450 ms) tek geri bildirim cümlesi → sonraki soru yönergesi. Geri bildirim yönergeyi kesmez; sonraki yönerge geri bildirimi geri bildirim bitince çalar (`sayThen`/`onEnd`). Aynı anda tek anlatıcı sesi.

## 4. ElevenLabs durumu (doğrulandı)
- Bağlayıcı ETKİN. CAGLAYAN, çalışma alanında "professional" kütüphane sesi (genç, kadın, Türkçe, neşeli). Aynı ses kimliği tüm yeni üretimlerde kullanıldı. SES KLONLAMA GEREKMEDİ ve yapılmadı.
- 5 cümle üretildi (eleven_v3, tek varyasyon, toplam 130 kredi) — akış `gfk5fMsjB23Z7qg6p1Vz`. Açılış MP3 yeniden üretilmedi/değiştirilmedi.
- ENGEL: üretilen MP3'ler bu çalışma ortamına İNDİRİLEMİYOR (ağ izin listesi `storage.googleapis.com` → 403). Bu yüzden uygulama paketine konamadılar. Gerekli adım: ElevenLabs akışından 5 MP3'ü indirip sohbete eklemek.
- LİSANS/İZİN: Ticari dağıtım hakkı ElevenLabs aboneliğinize ve CAGLAYAN kütüphane sesinin koşullarına bağlıdır; bu ortamdan DOĞRULANAMADI. Kullanıcı kendi ElevenLabs hesabında "ticari kullanım" ve ses sahibi koşullarını onaylamalıdır. Kayıt: ses `sJ0xHHPzz1LOio4QNlB0`, model `eleven_v3` / mevcut açılış MP3 `pvc` (v4).
- API anahtarı/gizli bilgi uygulamaya konmaz (test: `tests/v83.test.js`, `tests/v84.test.js`).

## 5. Uygulama sırası
1. (YAPILDI, test geçti) Açılış sesi sağlamlaştırma: bir kez, ses kapalıyken yok, otomatik oynatma engeline karşı ilk-dokunuş yeniden denemesi (4 sn), arka planda durma, çıkışta temizlik.
2. (MP3'ler eklenince) `assets/sounds/voice/…` + manifest `voice.<anahtar>`; geri bildirim kategorisi için küçük `feedback` yardımcı (efekt sonrası tek cümle, tekrar önleme, ses kapalıysa yok). Mevcut oyun mekaniklerine dokunmadan yalnızca `audio.play('correct')` yanına çağrı.
3. Gerçek cihazda dinleme kontrolü (Z7–Z9).
