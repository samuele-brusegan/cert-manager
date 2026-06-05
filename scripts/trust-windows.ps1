# Installa e rende affidabile una CA root su Windows.
# Esegui PowerShell come Amministratore.
# Uso:
#   .\trust-windows.ps1 -Source "https://certs.example.com/api/ca/download"
#   .\trust-windows.ps1 -Source ".\root-ca.crt"
param(
    [Parameter(Mandatory = $true)]
    [string]$Source
)

$ErrorActionPreference = "Stop"

if ($Source -match '^https?://') {
    $TmpCert = Join-Path $env:TEMP "cert-manager-root-ca.crt"
    Write-Host "==> Download del certificato root da $Source"
    Invoke-WebRequest -Uri $Source -OutFile $TmpCert -UseBasicParsing
} else {
    $TmpCert = $Source
}

Write-Host "==> Importazione nel Trusted Root Certification Authorities (LocalMachine)"
Import-Certificate -FilePath $TmpCert -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null

if ($Source -match '^https?://') { Remove-Item $TmpCert -Force }
Write-Host "==> Certificato root installato e affidabile."
