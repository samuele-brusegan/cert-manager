import crypto from "node:crypto";
import { SESSION_TTL_MS } from "../config.js";

// Store delle sessioni in memoria. Le sessioni sono per-client (legate al cookie)
// e non persistono al riavvio del server: dopo un restart è necessario ri-loggarsi.
const sessions = new Map(); // id -> { email, createdAt, expiresAt }

export function createSession(email) {
  const id = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.set(id, { email, createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return id;
}

// Restituisce la sessione valida e ne estende la scadenza (sliding window).
export function getSession(id) {
  if (!id) return null;
  const s = sessions.get(id);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return s;
}

export function destroySession(id) {
  if (id) sessions.delete(id);
}

// Pulizia periodica delle sessioni scadute.
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (s.expiresAt < now) sessions.delete(id);
}, 10 * 60 * 1000).unref?.();
