import { Router } from "express";
import {
  getCAInfo,
  createCA,
  importCA,
  deleteCA,
  caExists,
  getCACertPem,
} from "../lib/ca.js";

const router = Router();

// Info sulla CA root attuale (null se non configurata).
router.get("/", async (req, res, next) => {
  try {
    const info = await getCAInfo();
    res.json({ exists: Boolean(info), ca: info });
  } catch (err) {
    next(err);
  }
});

// Crea una nuova CA root.
router.post("/", async (req, res, next) => {
  try {
    if (await caExists()) {
      return res
        .status(409)
        .json({ error: "Una CA root esiste già. Eliminala prima di crearne una nuova." });
    }
    const info = await createCA(req.body || {});
    res.status(201).json({ ca: info });
  } catch (err) {
    next(err);
  }
});

// Importa una CA root esistente.
router.post("/import", async (req, res, next) => {
  try {
    const { certPem, keyPem } = req.body || {};
    const info = await importCA({ certPem, keyPem });
    res.status(201).json({ ca: info });
  } catch (err) {
    next(err);
  }
});

// Scarica il certificato CA root in formato PEM/CRT.
router.get("/download", async (req, res, next) => {
  try {
    const pem = await getCACertPem();
    res.setHeader("Content-Type", "application/x-x509-ca-cert");
    res.setHeader("Content-Disposition", 'attachment; filename="root-ca.crt"');
    res.send(pem);
  } catch (err) {
    next(err);
  }
});

// Elimina la CA root.
router.delete("/", async (req, res, next) => {
  try {
    await deleteCA();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
