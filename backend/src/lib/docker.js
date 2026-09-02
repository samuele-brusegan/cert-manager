import http from "node:http";

const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "reverse-proxy";

function dockerGet(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: DOCKER_SOCKET, path: pathname, method: "GET" },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const error = new Error(`Docker Engine ha risposto HTTP ${res.statusCode}`);
            error.status = res.statusCode === 404 ? 404 : 502;
            return reject(error);
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(Object.assign(new Error("Risposta Docker non valida"), { status: 502 }));
          }
        });
      },
    );
    req.on("error", (err) => {
      reject(
        Object.assign(
          new Error(`Docker Engine non raggiungibile: ${err.message}`),
          { status: 503, cause: err },
        ),
      );
    });
    req.end();
  });
}

// Restituisce i container collegati alla rete, senza esporre dettagli extra del Docker API.
export async function listNetworkContainers() {
  const network = await dockerGet(`/networks/${encodeURIComponent(DOCKER_NETWORK)}`);
  return Object.values(network.Containers || {})
    .map((container) => String(container.Name || "").replace(/^\//, ""))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function dockerNetworkName() {
  return DOCKER_NETWORK;
}
