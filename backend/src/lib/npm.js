import { readConfig } from "./store.js";

// Client per l'API di Nginx Proxy Manager.
// Gestisce autenticazione (token) con cache in memoria e refresh automatico.

let tokenCache = {
  token: null,
  expires: 0,
  key: null, // identifica url+email per invalidare la cache se cambiano
};

function cfgKey(npm) {
  return `${npm.url}|${npm.email}`;
}

// Timeout di default per le richieste verso NPM (ms).
const NPM_TIMEOUT = parseInt(process.env.NPM_TIMEOUT || "15000", 10);

// Traduce i codici di errore di rete Node in messaggi comprensibili.
function explainNetworkError(err, url) {
  const cause = err?.cause || err;
  const code = cause?.code;
  const hints = {
    ECONNREFUSED:
      "Connessione rifiutata: il server NPM non è in ascolto su quella porta. Verifica host e porta (admin di solito :81).",
    ENOTFOUND:
      "Host non risolto (DNS): l'hostname non esiste o non è raggiungibile da QUESTO container. " +
      "Se gira in Docker NON usare 'localhost' (punta al container stesso): usa l'IP dell'host, " +
      "'host.docker.internal:81', oppure collega il container alla rete di NPM e usa il nome del container.",
    EAI_AGAIN: "Risoluzione DNS temporaneamente fallita. Riprova o verifica la rete/DNS.",
    ETIMEDOUT: "Timeout di connessione: NPM non raggiungibile (firewall o rete?).",
    ECONNRESET: "Connessione azzerata dal server remoto.",
    EHOSTUNREACH: "Host non raggiungibile dalla rete.",
    ENETUNREACH: "Rete non raggiungibile.",
    DEPTH_ZERO_SELF_SIGNED_CERT:
      "NPM usa HTTPS con un certificato self-signed non attendibile. Usa http:// per la porta admin oppure rendi affidabile il certificato.",
    SELF_SIGNED_CERT_IN_CHAIN:
      "Catena con certificato self-signed non attendibile sul server NPM.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE:
      "Impossibile verificare il certificato TLS del server NPM.",
    ERR_SSL_WRONG_VERSION_NUMBER:
      "Risposta non TLS su una porta HTTPS (probabilmente stai usando https:// su una porta http). Prova http://.",
  };

  let detail = "";
  if (cause?.name === "TimeoutError" || code === "ABORT_ERR" || err?.name === "TimeoutError") {
    detail = `Timeout dopo ${NPM_TIMEOUT}ms: NPM non ha risposto.`;
  } else if (code && hints[code]) {
    detail = `${hints[code]} (codice: ${code})`;
  } else if (code) {
    detail = `Errore di rete (codice: ${code}).`;
  } else {
    detail = cause?.message || err?.message || "Errore di rete sconosciuto.";
  }

  return Object.assign(
    new Error(`Impossibile contattare NPM su ${url}. ${detail}`),
    { status: 502, code, cause },
  );
}

// fetch con timeout + gestione errori di rete diagnostica.
async function npmFetch(url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(NPM_TIMEOUT),
    });
    console.log(
      `[npm] ${options.method || "GET"} ${url} -> ${res.status} (${Date.now() - started}ms)`,
    );
    return res;
  } catch (err) {
    const explained = explainNetworkError(err, url);
    console.error(
      `[npm] ${options.method || "GET"} ${url} FALLITA dopo ${Date.now() - started}ms:`,
      explained.code || err?.name || "",
      "-",
      (err?.cause && err.cause.message) || err?.message,
    );
    throw explained;
  }
}

async function getConfig() {
  const config = await readConfig();
  const npm = config.npm || {};
  if (!npm.url || !npm.email || !npm.password) {
    throw Object.assign(
      new Error("Credenziali NPM non configurate. Vai in Impostazioni."),
      { status: 400 },
    );
  }
  // normalizza url senza slash finale
  npm.url = npm.url.replace(/\/+$/, "");
  return npm;
}

async function authenticate(npm) {
  const url = `${npm.url}/api/tokens`;
  const res = await npmFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: npm.email, secret: npm.password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 401
        ? " Credenziali errate (email o password non valide)."
        : res.status === 404
          ? " Endpoint /api/tokens non trovato: l'URL punta davvero a NPM e alla porta admin?"
          : "";
    throw Object.assign(
      new Error(
        `Autenticazione NPM fallita (HTTP ${res.status}).${hint} Risposta: ${body || "(vuota)"}`,
      ),
      { status: res.status === 401 ? 401 : 502 },
    );
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw Object.assign(
      new Error(
        `Risposta di NPM non in formato JSON da ${url}. L'URL potrebbe puntare a un servizio diverso da NPM.`,
      ),
      { status: 502 },
    );
  }
  if (!data.token) {
    throw Object.assign(
      new Error(`NPM non ha restituito un token. Risposta: ${JSON.stringify(data)}`),
      { status: 502 },
    );
  }
  // expires è una data ISO; teniamo un margine di sicurezza
  const expires = data.expires ? new Date(data.expires).getTime() : Date.now() + 60 * 60 * 1000;
  tokenCache = { token: data.token, expires, key: cfgKey(npm) };
  return data.token;
}

async function getToken(npm) {
  const key = cfgKey(npm);
  if (
    tokenCache.token &&
    tokenCache.key === key &&
    tokenCache.expires - 30_000 > Date.now()
  ) {
    return tokenCache.token;
  }
  return authenticate(npm);
}

// Richiesta autenticata generica verso l'API NPM.
async function request(method, endpoint, body) {
  const npm = await getConfig();
  let token = await getToken(npm);

  const doFetch = (tok) =>
    npmFetch(`${npm.url}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(token);
  // Se il token è scaduto/invalido, riautentica una volta.
  if (res.status === 401 || res.status === 403) {
    token = await authenticate(npm);
    res = await doFetch(token);
  }

  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(
      new Error(`Errore API NPM ${method} ${endpoint} (${res.status}): ${text}`),
      { status: 502 },
    );
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// ---------- Autenticazione (login app) ----------

// Verifica credenziali contro NPM (usato dal login). Lancia un errore
// diagnostico se non valide / NPM non raggiungibile.
export async function verifyCredentials({ url, email, password }) {
  const npm = {
    url: (url || "").replace(/\/+$/, ""),
    email,
    password,
  };
  await authenticate(npm);
  return { ok: true, email };
}

// Verifica che l'URL risponda come un'istanza NPM (usato dal setup).
export async function pingNpm(url) {
  const base = (url || "").replace(/\/+$/, "");
  // L'endpoint /api/ di NPM risponde con uno stato; qualsiasi risposta HTTP
  // (anche 401/404) indica che il server è raggiungibile.
  const res = await npmFetch(`${base}/api/`, { method: "GET" });
  return { ok: true, status: res.status };
}

// ---------- Test connessione ----------

export async function testConnection(npmOverride) {
  // Permette di testare credenziali passate direttamente (prima del salvataggio).
  if (npmOverride) {
    const npm = {
      url: (npmOverride.url || "").replace(/\/+$/, ""),
      email: npmOverride.email,
      password: npmOverride.password,
    };
    if (!/^https?:\/\//i.test(npm.url)) {
      throw Object.assign(
        new Error(
          `URL NPM non valido: "${npm.url}". Deve iniziare con http:// o https:// (es. http://npm.local:81).`,
        ),
        { status: 400 },
      );
    }
    // Riusa authenticate per ottenere la stessa diagnostica dettagliata.
    await authenticate(npm);
    return { ok: true };
  }
  await request("GET", "/api/nginx/proxy-hosts");
  return { ok: true };
}

// ---------- Proxy Hosts ----------

export function listProxyHosts() {
  return request("GET", "/api/nginx/proxy-hosts");
}

export function getProxyHost(id) {
  return request("GET", `/api/nginx/proxy-hosts/${id}`);
}

export function createProxyHost(payload) {
  return request("POST", "/api/nginx/proxy-hosts", payload);
}

export function updateProxyHost(id, payload) {
  return request("PUT", `/api/nginx/proxy-hosts/${id}`, payload);
}

export function deleteProxyHost(id) {
  return request("DELETE", `/api/nginx/proxy-hosts/${id}`);
}

export function enableProxyHost(id) {
  return request("POST", `/api/nginx/proxy-hosts/${id}/enable`);
}

export function disableProxyHost(id) {
  return request("POST", `/api/nginx/proxy-hosts/${id}/disable`);
}

// ---------- Certificati ----------

export function listCertificates() {
  return request("GET", "/api/nginx/certificates");
}

// Carica un certificato custom su NPM (cert + chiave) e restituisce l'id.
export async function uploadCustomCertificate({ niceName, certificate, certificateKey, meta }) {
  // 1. crea il record del certificato (provider custom)
  const created = await request("POST", "/api/nginx/certificates", {
    nice_name: niceName,
    provider: "other",
    meta: meta || {},
  });

  // 2. carica i file cert + chiave (multipart)
  const npm = await getConfig();
  const token = await getToken(npm);
  const form = new FormData();
  form.append(
    "certificate",
    new Blob([certificate], { type: "application/x-pem-file" }),
    "certificate.pem",
  );
  form.append(
    "certificate_key",
    new Blob([certificateKey], { type: "application/x-pem-file" }),
    "private.key",
  );

  const res = await npmFetch(
    `${npm.url}/api/nginx/certificates/${created.id}/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(
      new Error(`Upload certificato NPM fallito (${res.status}): ${text}`),
      { status: 502 },
    );
  }
  return created;
}

// ---------- Access Lists ----------

export function listAccessLists() {
  return request("GET", "/api/nginx/access-lists");
}

export function createAccessList(payload) {
  return request("POST", "/api/nginx/access-lists", payload);
}

export function updateAccessList(id, payload) {
  return request("PUT", `/api/nginx/access-lists/${id}`, payload);
}
