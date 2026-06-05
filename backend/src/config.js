import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Radice dati: configurabile via env, default ../../data rispetto a backend/src
export const DATA_DIR =
  process.env.DATA_DIR || path.resolve(__dirname, "..", "..", "data");

export const CA_DIR = path.join(DATA_DIR, "ca");
export const CERTS_DIR = path.join(DATA_DIR, "certs");
export const CONFIG_FILE = path.join(DATA_DIR, "config.json");

export const PORT = parseInt(process.env.PORT || "3001", 10);

// URL pubblico del backend (usato negli script di trust per il download del cert root)
export const PUBLIC_URL = process.env.PUBLIC_URL || "";

// --- Autenticazione / sessioni ---
// Nome del cookie di sessione.
export const SESSION_COOKIE = "cm_session";
// Durata sessione (idle, sliding) in ore.
export const SESSION_TTL_MS =
  parseInt(process.env.SESSION_TTL_HOURS || "8", 10) * 60 * 60 * 1000;
// Flag Secure del cookie: attivare dietro HTTPS (es. COOKIE_SECURE=true).
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

// Percorso del file hosts. Rileva automaticamente in base all'OS del server,
// sovrascrivibile via env HOSTS_FILE (utile in Docker per montare quello dell'host).
export const HOSTS_PLATFORM = process.platform;
export const HOSTS_FILE =
  process.env.HOSTS_FILE ||
  (process.platform === "win32"
    ? "C:\\Windows\\System32\\drivers\\etc\\hosts"
    : "/etc/hosts");
