import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PORT, SESSION_COOKIE } from "./config.js";
import { ensureDirs } from "./lib/store.js";
import { getSession } from "./lib/auth.js";

import authRoutes from "./routes/auth.routes.js";
import caRoutes from "./routes/ca.routes.js";
import certsRoutes from "./routes/certs.routes.js";
import npmRoutes from "./routes/npm.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import scriptsRoutes from "./routes/scripts.routes.js";
import hostsRoutes from "./routes/hosts.routes.js";

const app = express();
app.use(cors({ credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Rotte di autenticazione (pubbliche: gestiscono internamente i permessi).
app.use("/api/auth", authRoutes);

// Gate di autenticazione per tutte le altre rotte /api.
// Eccezioni pubbliche: health, auth e il download del cert root (certificato
// pubblico scaricato dai client via gli script di trust, senza sessione).
function isPublic(req) {
  const p = req.path;
  if (p === "/api/health") return true;
  if (p.startsWith("/api/auth/")) return true;
  if (req.method === "GET" && p === "/api/ca/download") return true;
  return false;
}

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/") || isPublic(req)) return next();
  const session = getSession(req.cookies?.[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ error: "Non autenticato" });
  req.user = { email: session.email };
  next();
});

app.use("/api/ca", caRoutes);
app.use("/api/certs", certsRoutes);
app.use("/api/npm", npmRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/scripts", scriptsRoutes);
app.use("/api/hosts", hostsRoutes);

// Error handler centralizzato.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Errore interno" });
});

await ensureDirs();
app.listen(PORT, () => {
  console.log(`Cert Manager backend in ascolto su :${PORT}`);
});
