#!/usr/bin/env bash
# Installa e rende affidabile una CA root su macOS.
# Uso:
#   ./trust-macos.sh <URL_CERT_ROOT>     # scarica da URL
#   ./trust-macos.sh ./root-ca.crt       # usa file locale
set -euo pipefail

SRC="${1:-}"
if [ -z "$SRC" ]; then
  echo "Uso: $0 <URL_CERT_ROOT | percorso_file.crt>" >&2
  exit 1
fi

TMP_CERT="$(mktemp /tmp/cert-manager-root-ca.XXXXXX.crt)"

if [[ "$SRC" =~ ^https?:// ]]; then
  echo "==> Download del certificato root da $SRC"
  curl -fsSL "$SRC" -o "$TMP_CERT"
else
  cp "$SRC" "$TMP_CERT"
fi

echo "==> Aggiunta al System Keychain come affidabile (richiede password admin)"
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain "$TMP_CERT"

rm -f "$TMP_CERT"
echo "==> Certificato root installato e affidabile."
