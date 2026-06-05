// Wrapper minimale attorno a fetch per le chiamate all'API del backend.

async function handle(res) {
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    let message = `Errore ${res.status}`;
    if (ct.includes("application/json")) {
      const body = await res.json().catch(() => ({}));
      message = body.error || message;
    } else {
      message = (await res.text().catch(() => "")) || message;
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return ct.includes("application/json") ? res.json() : res.text();
}

function req(method, path, body) {
  return fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(handle);
}

export const api = {
  // Settings
  getSettings: () => req("GET", "/settings"),
  saveNpm: (data) => req("PUT", "/settings/npm", data),
  testNpm: (data) => req("POST", "/settings/npm/test", data),

  // CA
  getCA: () => req("GET", "/ca"),
  createCA: (data) => req("POST", "/ca", data),
  importCA: (data) => req("POST", "/ca/import", data),
  deleteCA: () => req("DELETE", "/ca"),
  caDownloadUrl: "/api/ca/download",

  // Certificati locali
  listCerts: () => req("GET", "/certs"),
  issueCert: (data) => req("POST", "/certs", data),
  deleteCert: (id) => req("DELETE", `/certs/${id}`),
  pushCertToNpm: (id, data) => req("POST", `/certs/${id}/push-to-npm`, data),
  certDownloadUrl: (id, file) => `/api/certs/${id}/download?file=${file}`,

  // NPM
  listProxyHosts: () => req("GET", "/npm/proxy-hosts"),
  createProxyHost: (data) => req("POST", "/npm/proxy-hosts", data),
  updateProxyHost: (id, data) => req("PUT", `/npm/proxy-hosts/${id}`, data),
  deleteProxyHost: (id) => req("DELETE", `/npm/proxy-hosts/${id}`),
  enableProxyHost: (id) => req("POST", `/npm/proxy-hosts/${id}/enable`),
  disableProxyHost: (id) => req("POST", `/npm/proxy-hosts/${id}/disable`),
  autoSslProxyHost: (id) => req("POST", `/npm/proxy-hosts/${id}/auto-ssl`),
  listNpmCerts: () => req("GET", "/npm/certificates"),

  // Scripts
  getScript: (os) => req("GET", `/scripts/${os}`),
  scriptDownloadUrl: (os) => `/api/scripts/${os}?download=1`,

  // Hosts file
  getHosts: () => req("GET", "/hosts"),
  addHosts: (data) => req("POST", "/hosts", data),
  removeHosts: (domains) => req("DELETE", "/hosts", { domains }),
  writeHosts: (content) => req("PUT", "/hosts", { content }),
};
