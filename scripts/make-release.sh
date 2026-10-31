#!/usr/bin/env bash
# Geriye uyumluluk: tek ana komut scripts/release.sh
exec bash "$(dirname "$0")/release.sh" "$@"
