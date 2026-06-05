import { Router } from "express";
import {
  issueCertificate,
  listCertificates,
  getCertificateFiles,
  deleteCertificate,
} from "../lib/ca.js";
import { uploadCustomCertificate } from "../lib/npm.js";

const router = Router();

// Lista dei certificati emessi localmente.
router.get("/", async (req, res, next) => {
  try {
    res.json({ certificates: await listCertificates() });
  } catch (err) {
    next(err);
  }
});

// Emette (firma) un nuovo certificato X.509 con la CA root.
router.post("/", async (req, res, next) => {
  try {
    const info = await issueCertificate(req.body || {});
    res.status(201).json({ certificate: info });
  } catch (err) {
    next(err);
  }
});

// Scarica i file di un certificato: ?file=cert|key|fullchain
router.get("/:id/download", async (req, res, next) => {
  try {
    const files = await getCertificateFiles(req.params.id);
    const which = req.query.file || "fullchain";
    const map = {
      cert: { content: files.cert, name: "cert.crt" },
      key: { content: files.key, name: "private.key" },
      fullchain: { content: files.fullchain, name: "fullchain.crt" },
    };
    const f = map[which];
    if (!f) return res.status(400).json({ error: "file non valido" });
    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader("Content-Disposition", `attachment; filename="${f.name}"`);
    res.send(f.content);
  } catch (err) {
    next(err);
  }
});

// Invia un certificato emesso a Nginx Proxy Manager.
router.post("/:id/push-to-npm", async (req, res, next) => {
  try {
    const files = await getCertificateFiles(req.params.id);
    const niceName = req.body?.niceName || `cert-manager-${req.params.id.slice(0, 8)}`;
    const created = await uploadCustomCertificate({
      niceName,
      certificate: files.fullchain,
      certificateKey: files.key,
    });
    res.status(201).json({ certificate: created });
  } catch (err) {
    next(err);
  }
});

// Elimina un certificato emesso localmente.
router.delete("/:id", async (req, res, next) => {
  try {
    await deleteCertificate(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
