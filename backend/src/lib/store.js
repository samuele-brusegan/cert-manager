import fs from "node:fs/promises";
import { DATA_DIR, CA_DIR, CERTS_DIR, CONFIG_FILE } from "../config.js";

const DEFAULT_CONFIG = {
  npm: {
    url: "",
    email: "",
    password: "",
  },
};

// Crea le cartelle dati necessarie (idempotente).
export async function ensureDirs() {
  for (const dir of [DATA_DIR, CA_DIR, CERTS_DIR]) {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  }
}

export async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === "ENOENT") return { ...DEFAULT_CONFIG };
    throw err;
  }
}

export async function writeConfig(config) {
  await ensureDirs();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
  return config;
}

// Aggiorna parzialmente la sezione NPM della config.
export async function updateNpmConfig(patch) {
  const config = await readConfig();
  config.npm = { ...config.npm, ...patch };
  await writeConfig(config);
  return config.npm;
}
