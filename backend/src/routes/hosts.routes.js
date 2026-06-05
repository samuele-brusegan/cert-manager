import { Router } from "express";
import {
  getHostsInfo,
  addEntries,
  removeEntries,
  writeRawContent,
} from "../lib/hosts.js";

const router = Router();

// Info + contenuto del file hosts e voci gestite.
router.get("/", async (req, res, next) => {
  try {
    res.json(await getHostsInfo());
  } catch (err) {
    next(err);
  }
});

// Aggiunge voci: { ip, domains: [...] }
router.post("/", async (req, res, next) => {
  try {
    const { ip, domains } = req.body || {};
    const entries = await addEntries(ip, domains);
    res.status(201).json({ entries });
  } catch (err) {
    next(err);
  }
});

// Rimuove voci gestite: { domains: [...] }
router.delete("/", async (req, res, next) => {
  try {
    const { domains } = req.body || {};
    const entries = await removeEntries(domains);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

// Sovrascrive l'intero file hosts: { content }
router.put("/", async (req, res, next) => {
  try {
    res.json(await writeRawContent((req.body || {}).content));
  } catch (err) {
    next(err);
  }
});

export default router;
