import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import forge from "node-forge";
import { CA_DIR, CERTS_DIR } from "../config.js";
import { ensureDirs } from "./store.js";

const CA_CERT_FILE = path.join(CA_DIR, "ca.crt");
const CA_KEY_FILE = path.join(CA_DIR, "ca.key");

const pki = forge.pki;

// ---------- Utility ----------

function randomSerial() {
  // Serial number positivo a 16 byte (esadecimale).
  return "00" + crypto.randomBytes(16).toString("hex");
}

function buildSubject(fields) {
  const attrs = [];
  if (fields.commonName) attrs.push({ name: "commonName", value: fields.commonName });
  if (fields.organization)
    attrs.push({ name: "organizationName", value: fields.organization });
  if (fields.organizationalUnit)
    attrs.push({ shortName: "OU", value: fields.organizationalUnit });
  if (fields.country) attrs.push({ name: "countryName", value: fields.country });
  if (fields.state)
    attrs.push({ shortName: "ST", value: fields.state });
  if (fields.locality) attrs.push({ name: "localityName", value: fields.locality });
  return attrs;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function certToInfo(cert, pem) {
  const subject = {};
  cert.subject.attributes.forEach((a) => {
    subject[a.shortName || a.name] = a.value;
  });
  const issuer = {};
  cert.issuer.attributes.forEach((a) => {
    issuer[a.shortName || a.name] = a.value;
  });

  // Estrai SAN se presenti.
  const sanExt = cert.getExtension("subjectAltName");
  const altNames = sanExt
    ? sanExt.altNames.map((a) => (a.type === 7 ? a.ip : a.value))
    : [];

  const md = forge.md.sha256.create();
  md.update(forge.asn1.toDer(pki.certificateToAsn1(cert)).getBytes());
  const fingerprint = md
    .digest()
    .toHex()
    .match(/.{2}/g)
    .join(":")
    .toUpperCase();

  return {
    subject,
    issuer,
    commonName: subject.CN || "",
    altNames,
    serialNumber: cert.serialNumber,
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
    isCA:
      cert.getExtension("basicConstraints")?.cA === true ? true : false,
    fingerprintSha256: fingerprint,
    pem,
  };
}

// ---------- CA Root ----------

export async function caExists() {
  return (await exists(CA_CERT_FILE)) && (await exists(CA_KEY_FILE));
}

export async function getCA() {
  if (!(await caExists())) {
    throw Object.assign(new Error("CA root non configurata"), { status: 404 });
  }
  const certPem = await fs.readFile(CA_CERT_FILE, "utf8");
  const keyPem = await fs.readFile(CA_KEY_FILE, "utf8");
  return {
    cert: pki.certificateFromPem(certPem),
    key: pki.privateKeyFromPem(keyPem),
    certPem,
    keyPem,
  };
}

export async function getCAInfo() {
  if (!(await caExists())) return null;
  const certPem = await fs.readFile(CA_CERT_FILE, "utf8");
  const cert = pki.certificateFromPem(certPem);
  return certToInfo(cert, certPem);
}

// Genera una nuova CA root self-signed.
export async function createCA(opts = {}) {
  await ensureDirs();
  const {
    commonName = "Cert Manager Root CA",
    organization,
    organizationalUnit,
    country,
    state,
    locality,
    validityDays = 3650,
    keySize = 4096,
  } = opts;

  const keys = pki.rsa.generateKeyPair(keySize);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();

  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(
    now.getTime() + validityDays * 24 * 60 * 60 * 1000,
  );

  const subject = buildSubject({
    commonName,
    organization,
    organizationalUnit,
    country,
    state,
    locality,
  });
  cert.setSubject(subject);
  cert.setIssuer(subject); // self-signed

  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    {
      name: "keyUsage",
      critical: true,
      keyCertSign: true,
      cRLSign: true,
      digitalSignature: true,
    },
    { name: "subjectKeyIdentifier" },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certPem = pki.certificateToPem(cert);
  const keyPem = pki.privateKeyToPem(keys.privateKey);

  await fs.writeFile(CA_CERT_FILE, certPem, { mode: 0o644 });
  await fs.writeFile(CA_KEY_FILE, keyPem, { mode: 0o600 });

  return certToInfo(cert, certPem);
}

// Importa una CA root esistente (cert PEM + chiave privata PEM).
export async function importCA({ certPem, keyPem }) {
  await ensureDirs();
  if (!certPem || !keyPem) {
    throw Object.assign(new Error("certPem e keyPem sono obbligatori"), {
      status: 400,
    });
  }
  // Validazione: parse e verifica corrispondenza chiave/cert.
  let cert, key;
  try {
    cert = pki.certificateFromPem(certPem);
    key = pki.privateKeyFromPem(keyPem);
  } catch {
    throw Object.assign(new Error("Certificato o chiave PEM non validi"), {
      status: 400,
    });
  }

  // Verifica che la chiave corrisponda al certificato firmando un nonce.
  const publicKey = cert.publicKey;
  if (publicKey.n.toString(16) !== key.n.toString(16)) {
    throw Object.assign(
      new Error("La chiave privata non corrisponde al certificato"),
      { status: 400 },
    );
  }

  await fs.writeFile(CA_CERT_FILE, certPem, { mode: 0o644 });
  await fs.writeFile(CA_KEY_FILE, keyPem, { mode: 0o600 });

  return certToInfo(cert, certPem);
}

export async function deleteCA() {
  await fs.rm(CA_CERT_FILE, { force: true });
  await fs.rm(CA_KEY_FILE, { force: true });
}

// ---------- Certificati emessi ----------

function classifyAltName(value) {
  // Distingue IP da DNS per il campo SAN.
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(":");
  return isIp ? { type: 7, ip: value } : { type: 2, value };
}

// Firma un nuovo certificato leaf con la CA root.
export async function issueCertificate(opts = {}) {
  const {
    commonName,
    altNames = [],
    organization,
    organizationalUnit,
    country,
    state,
    locality,
    validityDays = 397,
    keySize = 2048,
  } = opts;

  if (!commonName) {
    throw Object.assign(new Error("commonName è obbligatorio"), {
      status: 400,
    });
  }

  const ca = await getCA();

  const keys = pki.rsa.generateKeyPair(keySize);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();

  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(
    now.getTime() + validityDays * 24 * 60 * 60 * 1000,
  );

  cert.setSubject(
    buildSubject({
      commonName,
      organization,
      organizationalUnit,
      country,
      state,
      locality,
    }),
  );
  cert.setIssuer(ca.cert.subject.attributes);

  // Costruisci SAN: includi sempre il CN se è un dominio/ip.
  const allNames = [...new Set([commonName, ...altNames])].filter(Boolean);
  const altNameEntries = allNames.map(classifyAltName);

  cert.setExtensions([
    { name: "basicConstraints", cA: false, critical: true },
    {
      name: "keyUsage",
      critical: true,
      digitalSignature: true,
      keyEncipherment: true,
    },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    { name: "subjectAltName", altNames: altNameEntries },
    { name: "subjectKeyIdentifier" },
  ]);

  cert.sign(ca.key, forge.md.sha256.create());

  const certPem = pki.certificateToPem(cert);
  const keyPem = pki.privateKeyToPem(keys.privateKey);
  // Fullchain: cert leaf + CA root.
  const fullchainPem = certPem + ca.certPem;

  const id = crypto.randomUUID();
  const dir = path.join(CERTS_DIR, id);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(dir, "cert.crt"), certPem, { mode: 0o644 });
  await fs.writeFile(path.join(dir, "cert.key"), keyPem, { mode: 0o600 });
  await fs.writeFile(path.join(dir, "fullchain.crt"), fullchainPem, {
    mode: 0o644,
  });

  const meta = {
    id,
    commonName,
    altNames: allNames,
    createdAt: now.toISOString(),
  };
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));

  return { ...meta, ...certToInfo(cert, certPem) };
}

export async function listCertificates() {
  await ensureDirs();
  const entries = await fs.readdir(CERTS_DIR, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const dir = path.join(CERTS_DIR, entry.name);
      const certPem = await fs.readFile(path.join(dir, "cert.crt"), "utf8");
      const cert = pki.certificateFromPem(certPem);
      const meta = JSON.parse(
        await fs.readFile(path.join(dir, "meta.json"), "utf8"),
      );
      result.push({ ...meta, ...certToInfo(cert, certPem) });
    } catch {
      // ignora cartelle malformate
    }
  }
  return result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getCertificateFiles(id) {
  const dir = path.join(CERTS_DIR, id);
  if (!(await exists(dir))) {
    throw Object.assign(new Error("Certificato non trovato"), { status: 404 });
  }
  return {
    cert: await fs.readFile(path.join(dir, "cert.crt"), "utf8"),
    key: await fs.readFile(path.join(dir, "cert.key"), "utf8"),
    fullchain: await fs.readFile(path.join(dir, "fullchain.crt"), "utf8"),
  };
}

export async function deleteCertificate(id) {
  const dir = path.join(CERTS_DIR, id);
  if (!(await exists(dir))) {
    throw Object.assign(new Error("Certificato non trovato"), { status: 404 });
  }
  await fs.rm(dir, { recursive: true, force: true });
}

export async function getCACertPem() {
  if (!(await caExists())) {
    throw Object.assign(new Error("CA root non configurata"), { status: 404 });
  }
  return fs.readFile(CA_CERT_FILE, "utf8");
}
