#!/usr/bin/env bash
# Installa e rende affidabile una CA root su Linux.
# Uso:
#   ./trust-linux.sh <URL_CERT_ROOT>      # scarica da URL
#   ./trust-linux.sh ./root-ca.crt        # usa file locale
# Supporta Debian/Ubuntu, RHEL/Fedora, Arch e derivate.
set -euo pipefail

SRC="${1:-}"
if [ -z "$SRC" ]; then
  echo "Uso: $0 <URL_CERT_ROOT | percorso_file.crt>" >&2
  exit 1
fi

CERT_NAME="cert-manager-root-ca"
TMP_CERT="$(mktemp /tmp/${CERT_NAME}.XXXXXX.crt)"

if [[ "$SRC" =~ ^https?:// ]]; then
  echo "==> Download del certificato root da $SRC"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$SRC" -o "$TMP_CERT"
  else
    wget -qO "$TMP_CERT" "$SRC"
  fi
else
  cp "$SRC" "$TMP_CERT"
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

if [ -d /usr/local/share/ca-certificates ]; then
  echo "==> Debian/Ubuntu"
  $SUDO cp "$TMP_CERT" "/usr/local/share/ca-certificates/${CERT_NAME}.crt"
  $SUDO update-ca-certificates
elif [ -d /etc/pki/ca-trust/source/anchors ]; then
  echo "==> RHEL/Fedora"
  $SUDO cp "$TMP_CERT" "/etc/pki/ca-trust/source/anchors/${CERT_NAME}.crt"
  $SUDO update-ca-trust extract
elif [ -d /etc/ca-certificates/trust-source/anchors ]; then
  echo "==> Arch"
  $SUDO cp "$TMP_CERT" "/etc/ca-certificates/trust-source/anchors/${CERT_NAME}.crt"
  $SUDO trust extract-compat
else
  echo "Errore: store CA di sistema non riconosciuto." >&2
  exit 1
fi

rm -f "$TMP_CERT"
echo "==> Certificato root installato e affidabile."
echo "Nota: riavvia i browser (Firefox usa un proprio store NSS)."
