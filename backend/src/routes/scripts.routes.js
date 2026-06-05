import { Router } from "express";
import { caExists } from "../lib/ca.js";
import { PUBLIC_URL } from "../config.js";

const router = Router();

// Determina l'URL base da cui scaricare il cert root.
function baseUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// ---------- Generatori di script ----------

function linuxScript(certUrl) {
  return `#!/usr/bin/env bash
# Installa e rende affidabile la CA root di Cert Manager su Linux.
# Supporta Debian/Ubuntu, RHEL/Fedora, Arch e derivate.
set -euo pipefail

CERT_URL="${certUrl}"
CERT_NAME="cert-manager-root-ca"
TMP_CERT="$(mktemp /tmp/\${CERT_NAME}.XXXXXX.crt)"

echo "==> Download del certificato root da \${CERT_URL}"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "\${CERT_URL}" -o "\${TMP_CERT}"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "\${TMP_CERT}" "\${CERT_URL}"
else
  echo "Errore: serve curl o wget." >&2
  exit 1
fi

SUDO=""
if [ "\$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

if [ -d /usr/local/share/ca-certificates ]; then
  echo "==> Rilevato sistema Debian/Ubuntu"
  \$SUDO cp "\${TMP_CERT}" "/usr/local/share/ca-certificates/\${CERT_NAME}.crt"
  \$SUDO update-ca-certificates
elif [ -d /etc/pki/ca-trust/source/anchors ]; then
  echo "==> Rilevato sistema RHEL/Fedora"
  \$SUDO cp "\${TMP_CERT}" "/etc/pki/ca-trust/source/anchors/\${CERT_NAME}.crt"
  \$SUDO update-ca-trust extract
elif [ -d /etc/ca-certificates/trust-source/anchors ]; then
  echo "==> Rilevato sistema Arch"
  \$SUDO cp "\${TMP_CERT}" "/etc/ca-certificates/trust-source/anchors/\${CERT_NAME}.crt"
  \$SUDO trust extract-compat
else
  echo "Errore: store CA di sistema non riconosciuto." >&2
  exit 1
fi

rm -f "\${TMP_CERT}"
echo "==> Certificato root installato e affidabile."
echo "Nota: riavvia i browser (Firefox usa un proprio store NSS)."
`;
}

function macosScript(certUrl) {
  return `#!/usr/bin/env bash
# Installa e rende affidabile la CA root di Cert Manager su macOS.
set -euo pipefail

CERT_URL="${certUrl}"
TMP_CERT="$(mktemp /tmp/cert-manager-root-ca.XXXXXX.crt)"

echo "==> Download del certificato root da \${CERT_URL}"
curl -fsSL "\${CERT_URL}" -o "\${TMP_CERT}"

echo "==> Aggiunta al System Keychain come affidabile (richiede password admin)"
sudo security add-trusted-cert -d -r trustRoot \\
  -k /Library/Keychains/System.keychain "\${TMP_CERT}"

rm -f "\${TMP_CERT}"
echo "==> Certificato root installato e affidabile."
`;
}

function windowsScript(certUrl) {
  return `# Installa e rende affidabile la CA root di Cert Manager su Windows.
# Esegui PowerShell come Amministratore.
$ErrorActionPreference = "Stop"

$CertUrl = "${certUrl}"
$TmpCert = Join-Path $env:TEMP "cert-manager-root-ca.crt"

Write-Host "==> Download del certificato root da $CertUrl"
Invoke-WebRequest -Uri $CertUrl -OutFile $TmpCert -UseBasicParsing

Write-Host "==> Importazione nel Trusted Root Certification Authorities (LocalMachine)"
Import-Certificate -FilePath $TmpCert -CertStoreLocation "Cert:\\LocalMachine\\Root" | Out-Null

Remove-Item $TmpCert -Force
Write-Host "==> Certificato root installato e affidabile."
`;
}

const GENERATORS = {
  linux: { fn: linuxScript, filename: "trust-linux.sh", type: "text/x-shellscript" },
  macos: { fn: macosScript, filename: "trust-macos.sh", type: "text/x-shellscript" },
  windows: { fn: windowsScript, filename: "trust-windows.ps1", type: "text/plain" },
};

// Restituisce lo script come testo (per visualizzazione nella UI).
router.get("/:os", async (req, res, next) => {
  try {
    const gen = GENERATORS[req.params.os];
    if (!gen) return res.status(404).json({ error: "OS non supportato" });
    if (!(await caExists())) {
      return res.status(404).json({ error: "CA root non configurata" });
    }
    const certUrl = `${baseUrl(req)}/api/ca/download`;
    const content = gen.fn(certUrl);
    if (req.query.download === "1") {
      res.setHeader("Content-Type", gen.type);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${gen.filename}"`,
      );
      return res.send(content);
    }
    res.json({ os: req.params.os, filename: gen.filename, content });
  } catch (err) {
    next(err);
  }
});

export default router;
