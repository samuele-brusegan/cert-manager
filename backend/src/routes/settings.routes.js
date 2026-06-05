import { Router } from "express";
import { readConfig, updateNpmConfig } from "../lib/store.js";
import { testConnection } from "../lib/npm.js";

const router = Router();

// Restituisce le impostazioni NPM senza esporre la password.
router.get("/", async (req, res, next) => {
  try {
    const config = await readConfig();
    const npm = config.npm || {};
    res.json({
      npm: {
        url: npm.url || "",
        email: npm.email || "",
        passwordSet: Boolean(npm.password),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Salva/aggiorna le credenziali NPM. Se password assente, mantiene quella esistente.
router.put("/npm", async (req, res, next) => {
  try {
    const { url, email, password } = req.body || {};
    const patch = {};
    if (url !== undefined) patch.url = url.replace(/\/+$/, "");
    if (email !== undefined) patch.email = email;
    if (password) patch.password = password; // non sovrascrive con vuoto
    const npm = await updateNpmConfig(patch);
    res.json({
      npm: { url: npm.url, email: npm.email, passwordSet: Boolean(npm.password) },
    });
  } catch (err) {
    next(err);
  }
});

// Testa la connessione: usa credenziali fornite o quelle salvate.
router.post("/npm/test", async (req, res, next) => {
  try {
    const { url, email, password } = req.body || {};
    if (url && email && password) {
      await testConnection({ url, email, password });
    } else {
      await testConnection();
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
