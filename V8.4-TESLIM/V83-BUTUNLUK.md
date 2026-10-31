# V8.3 bütünlük doğrulaması

V8.3 kaynak ağacı, ZIP'i ve APK'sı V8.4 çalışması sırasında salt-okunur tutuldu (değiştirilmedi, yeniden adlandırılmadı, silinmedi).

Doğrulama (her teslim öncesi çalıştırıldı):
1. `v8.3-worktree.sha256` manifesti ile V8.3 çalışma ağacı: 243/243 dosya aynı.
2. V8.3 ZIP SHA-256: `d4258929d2d87866e12e624a7f73ce8265b9a13e082a8f6240d13a7a5156d943` (beklenenle aynı).
3. V8.3 yedek (.bak) dosyası bayt-bayt aynı; yedek tgz SHA-256 `e760b4266804ed39b3b0570bc6b81c2e76eb01829a3d9bf3efea1c6a7df7b766` aynı.

Kendi makinenizde yeniden doğrulamak için V8.3 ZIP'inde: `sha256sum ALTEZ-MiniLab-V8.3-FULL.zip` → yukarıdaki değer.
