import { Router } from "express";
import { readConfig, updateNpmConfig } from "../lib/store.js";
import { verifyCredentials, pingNpm } from "../lib/npm.js";
import { createSession, destroySession, getSession } from "../lib/auth.js";
import { SESSION_COOKIE, COOKIE_SECURE, SESSION_TTL_MS } from "../config.js";

const router = Router();

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

function sessionFromReq(req) {
  return getSession(req.cookies?.[SESSION_COOKIE]);
}

// Stato auth: serve al frontend per decidere setup / login / app.
router.get("/status", async (req, res, next) => {
  try {
    const config = await readConfig();
    const session = sessionFromReq(req);
    res.json({
      configured: Boolean(config.npm && config.npm.url),
      authenticated: Boolean(session),
      user: session ? { email: session.email } : null,
      cookieSecure: COOKIE_SECURE,
    });
  } catch (err) {
    next(err);
  }
});

// Setup iniziale: imposta l'URL di NPM. Pubblico solo finché non è configurato;
// dopo, modificabile solo da utenti autenticati.
router.post("/setup", async (req, res, next) => {
  try {
    const config = await readConfig();
    const configured = Boolean(config.npm && config.npm.url);
    const authed = Boolean(sessionFromReq(req));
    if (configured && !authed) {
      return res
        .status(403)
        .json({ error: "Setup già completato. Accedi per modificare l'URL." });
    }
    let { url } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
      return res
        .status(400)
        .json({ error: "URL non valido: deve iniziare con http:// o https://" });
    }
    url = url.replace(/\/+$/, "");
    await pingNpm(url); // verifica raggiungibilità (lancia errore diagnostico)
    await updateNpmConfig({ url });
    res.json({ ok: true, url });
  } catch (err) {
    next(err);
  }
});

// Login con le credenziali NPM. Verifica live contro NPM, salva le credenziali
// (service account) e crea la sessione.
router.post("/login", async (req, res, next) => {
  try {
    const config = await readConfig();
    const url = config.npm?.url;
    if (!url) {
      return res
        .status(400)
        .json({ error: "NPM non configurato. Completa prima il setup." });
    }
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email e password obbligatorie" });
    }
    await verifyCredentials({ url, email, password }); // 401 se non valide
    await updateNpmConfig({ email, password });
    const id = createSession(email);
    res.cookie(SESSION_COOKIE, id, cookieOptions());
    res.json({ ok: true, user: { email } });
  } catch (err) {
    next(err);
  }
});

// Logout: invalida la sessione lato server e rimuove il cookie.
router.post("/logout", (req, res) => {
  destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
