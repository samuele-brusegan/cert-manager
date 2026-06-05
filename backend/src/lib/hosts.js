import fs from "node:fs/promises";
import { constants as FS } from "node:fs";
import { HOSTS_FILE, HOSTS_PLATFORM } from "../config.js";

// Gestione del file hosts di sistema. Le righe gestite da questa app sono
// marcate con un commento finale, così non tocchiamo mai le altre voci.
const MARKER = "# cert-manager";

function mapFsError(err) {
  const messages = {
    EACCES:
      "Permesso negato sul file hosts: il processo deve avere i permessi di scrittura (root/Administrator).",
    EPERM: "Operazione non permessa sul file hosts (permessi insufficienti).",
    EROFS: "Il file hosts è su un filesystem in sola lettura.",
    ENOENT: `File hosts non trovato in ${HOSTS_FILE}.`,
  };
  return Object.assign(new Error(messages[err.code] || err.message), {
    status: err.code === "ENOENT" ? 404 : 403,
    code: err.code,
  });
}

async function readRaw() {
  return fs.readFile(HOSTS_FILE, "utf8");
}

// Estrae le voci gestite (marcate) dal contenuto.
function parseManaged(content) {
  const entries = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.includes(MARKER)) continue;
    const code = line.split("#")[0].trim();
    if (!code) continue;
    const parts = code.split(/\s+/);
    const ip = parts[0];
    for (const domain of parts.slice(1)) entries.push({ ip, domain });
  }
  return entries;
}

// Estrae TUTTE le voci del file hosts (ignora commenti e righe vuote),
// marcando quelle gestite da questa app.
function parseAll(content) {
  const entries = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const code = trimmed.split("#")[0].trim();
    if (!code) continue;
    const parts = code.split(/\s+/);
    const ip = parts[0];
    const managed = line.includes(MARKER);
    for (const domain of parts.slice(1)) entries.push({ ip, domain, managed });
  }
  return entries;
}

export async function getHostsInfo() {
  let content = "";
  let exists = true;
  try {
    content = await readRaw();
  } catch (err) {
    if (err.code === "ENOENT") exists = false;
    else throw mapFsError(err);
  }
  let writable = false;
  try {
    await fs.access(HOSTS_FILE, FS.W_OK);
    writable = true;
  } catch {
    writable = false;
  }
  return {
    path: HOSTS_FILE,
    platform: HOSTS_PLATFORM,
    exists,
    writable,
    content,
    entries: parseManaged(content),
    allEntries: parseAll(content),
  };
}

// Scrive il contenuto in-place (truncate + write) per preservare l'inode
// (necessario quando il file è bind-montato in un container).
async function writeRaw(content) {
  try {
    await fs.writeFile(HOSTS_FILE, content);
  } catch (err) {
    throw mapFsError(err);
  }
}

// Aggiunge/aggiorna le voci gestite per i domini indicati verso un IP.
export async function addEntries(ip, domains) {
  const targetIp = (ip || "127.0.0.1").trim();
  const cleanDomains = (domains || []).map((d) => d.trim()).filter(Boolean);
  if (cleanDomains.length === 0) {
    throw Object.assign(new Error("Nessun dominio da aggiungere"), { status: 400 });
  }

  let content = "";
  try {
    content = await readRaw();
  } catch (err) {
    if (err.code !== "ENOENT") throw mapFsError(err);
  }

  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const targetSet = new Set(cleanDomains.map((d) => d.toLowerCase()));

  // Rimuove eventuali righe gestite preesistenti per gli stessi domini.
  const kept = content.split(/\r?\n/).filter((line) => {
    if (!line.includes(MARKER)) return true;
    const code = line.split("#")[0].trim();
    const host = code.split(/\s+/)[1];
    return !(host && targetSet.has(host.toLowerCase()));
  });

  // Una riga per dominio, per leggibilità.
  const newLines = cleanDomains.map((d) => `${targetIp}\t${d} ${MARKER}`);

  let out = kept.join(eol).replace(/(\r?\n)+$/, "");
  if (out.length) out += eol;
  out += newLines.join(eol) + eol;

  await writeRaw(out);
  return parseManaged(out);
}

// Rimuove le voci gestite per i domini indicati.
export async function removeEntries(domains) {
  const cleanDomains = (domains || []).map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (cleanDomains.length === 0) {
    throw Object.assign(new Error("Nessun dominio da rimuovere"), { status: 400 });
  }
  let content;
  try {
    content = await readRaw();
  } catch (err) {
    throw mapFsError(err);
  }
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const targetSet = new Set(cleanDomains);
  const kept = content.split(/\r?\n/).filter((line) => {
    if (!line.includes(MARKER)) return true;
    const code = line.split("#")[0].trim();
    const host = code.split(/\s+/)[1];
    return !(host && targetSet.has(host.toLowerCase()));
  });
  await writeRaw(kept.join(eol).replace(/(\r?\n)+$/, "") + eol);
  return parseManaged(kept.join(eol));
}

// Scrive l'intero contenuto del file hosts (operazione avanzata).
export async function writeRawContent(content) {
  if (typeof content !== "string") {
    throw Object.assign(new Error("Contenuto non valido"), { status: 400 });
  }
  await writeRaw(content);
  return getHostsInfo();
}
