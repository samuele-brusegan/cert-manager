import express from "express";
import cors from "cors";
import { PORT } from "./config.js";
import { ensureDirs } from "./lib/store.js";

import caRoutes from "./routes/ca.routes.js";
import certsRoutes from "./routes/certs.routes.js";
import npmRoutes from "./routes/npm.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import scriptsRoutes from "./routes/scripts.routes.js";
import hostsRoutes from "./routes/hosts.routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

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
