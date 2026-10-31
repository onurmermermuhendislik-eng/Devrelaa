#!/usr/bin/env python3
"""ALTEZ MiniLab - DETERMINISTIK kaynak ZIP paketleyici (V8.1.1).
Kullanim: python3 scripts/pack-zip.py <asama_klasoru> <cikti.zip>
 - Zip kok klasoru = asama klasorunun adi; sabit tarih (2026-01-01); dosyalar sirali.
 - Calistirilmasi gereken dosyalar HER ZAMAN 0755 (git modu 100755) yazilir: android/gradlew, install-and-build.sh, scripts/*.sh, scripts/*.py.
 - android/gradlew yoksa veya yazilan modu 100755 degilse paketleme HATAYLA durur (cikti ZIP silinir).
"""
import os, sys, zipfile

EXEC_FILES = {'android/gradlew', 'install-and-build.sh'}

def is_exec(rel):
    return rel in EXEC_FILES or (rel.startswith('scripts/') and rel.count('/') == 1 and rel.endswith(('.sh', '.py')))

def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    stage, out = os.path.abspath(sys.argv[1]), sys.argv[2]
    top = os.path.basename(stage.rstrip('/'))
    if not os.path.isfile(os.path.join(stage, 'android/gradlew')):
        sys.exit('HATA: android/gradlew yok; paketleme durdu')
    files = []
    for d, _, fs in os.walk(stage):
        for f in fs:
            p = os.path.join(d, f)
            if os.path.islink(p):
                sys.exit('HATA: sembolik baglanti: ' + p)
            files.append(os.path.relpath(p, stage).replace(os.sep, '/'))
    files.sort()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in files:
            zi = zipfile.ZipInfo(top + '/' + rel, (2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.create_system = 3
            zi.external_attr = (0o100755 if is_exec(rel) else 0o100644) << 16
            with open(os.path.join(stage, rel), 'rb') as fh:
                z.writestr(zi, fh.read())
    with zipfile.ZipFile(out) as z:
        info = z.getinfo(top + '/android/gradlew')
        if (info.external_attr >> 16) & 0o777 != 0o755:
            os.remove(out)
            sys.exit('HATA: android/gradlew ZIP icinde 0755 degil; ZIP silindi')
    print(f'{out}: {len(files)} dosya; android/gradlew 100755')

main()
