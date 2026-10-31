#!/usr/bin/env bash
# ALTEZ MiniLab - TESLIM DOGRULAMA (V8.1.1). Kullanim: bash scripts/verify-delivery.sh <FULL.zip>
# Zip'i TEMIZ bir klasore cikarir (ek chmod YOK) ve dogrular: test -x android/gradlew, sha256sum -c --strict MANIFEST.sha256, dosya kumesi esitligi.
# Basarisizsa cikis kodu 1: ZIP teslimi DURDURULMALI.
set -u
Z="${1:-}"; [ -f "$Z" ] || { echo "kullanim: verify-delivery.sh <zip>"; exit 2; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
python3 - "$Z" "$T" <<'PY' || { echo "FAIL: zip acilamadi"; exit 1; }
import sys, zipfile, os
z, d = sys.argv[1], os.path.realpath(sys.argv[2])
with zipfile.ZipFile(z) as zf:
    for zi in zf.infolist():
        t = os.path.realpath(os.path.join(d, zi.filename))
        if not (t == d or t.startswith(d + os.sep)): sys.exit('dizin disina cikis: ' + zi.filename)
        if zi.is_dir(): os.makedirs(t, exist_ok=True); continue
        os.makedirs(os.path.dirname(t), exist_ok=True)
        open(t, 'wb').write(zf.read(zi))
        os.chmod(t, (zi.external_attr >> 16) & 0o777 or 0o644)  # ZIP'teki modu AYNEN uygula (maskeleme yok)
PY
R=$(ls -d "$T"/*/ 2>/dev/null | head -1); [ -n "$R" ] || { echo "FAIL: ust klasor yok"; exit 1; }
cd "$R" || exit 1
fail=0
if test -x android/gradlew; then echo "OK   test -x android/gradlew"; else echo "FAIL test -x android/gradlew (ZIP 100644 paketlenmis)"; fail=1; fi
if test -x install-and-build.sh; then echo "OK   test -x install-and-build.sh"; else echo "FAIL test -x install-and-build.sh"; fail=1; fi
if [ -f MANIFEST.sha256 ]; then
  sha256sum -c --strict MANIFEST.sha256 >/tmp/vd-manifest.$$ 2>&1 && echo "OK   sha256sum -c --strict MANIFEST.sha256" || { echo "FAIL manifest"; tail -3 /tmp/vd-manifest.$$; fail=1; }
  rm -f /tmp/vd-manifest.$$
  A=$(find . -type f | sed 's#^\./##' | LC_ALL=C sort); E=$( (awk '{print $2}' MANIFEST.sha256; echo MANIFEST.sha256) | sed 's#^\./##' | LC_ALL=C sort)
  [ "$A" = "$E" ] && echo "OK   dosya kumesi manifestle ayni" || { echo "FAIL dosya kumesi farkli"; fail=1; }
else echo "FAIL MANIFEST.sha256 yok"; fail=1; fi
[ $fail = 0 ] && echo "TESLIM DOGRULAMA: GECTI" || echo "TESLIM DOGRULAMA: BASARISIZ - ZIP TESLIM EDILMEZ"
exit $fail
