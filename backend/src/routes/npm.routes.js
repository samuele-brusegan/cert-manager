import { Router } from "express";
import * as npm from "../lib/npm.js";
import { dockerNetworkName, listNetworkContainers } from "../lib/docker.js";
import { issueCertificate, getCertificateFiles } from "../lib/ca.js";

const router = Router();

// ---------- Proxy Hosts ----------

router.get("/proxy-hosts", async (req, res, next) => {
  try {
    res.json(await npm.listProxyHosts());
  } catch (err) {
    next(err);
  }
});

router.get("/proxy-hosts/:id", async (req, res, next) => {
  try {
    res.json(await npm.getProxyHost(req.params.id));
  } catch (err) {
    next(err);
  }
});

// Container collegati alla rete Docker del reverse proxy, per il forward host.
router.get("/docker-containers", async (req, res, next) => {
  try {
    res.json({ network: dockerNetworkName(), containers: await listNetworkContainers() });
  } catch (err) {
    next(err);
  }
});

// Crea un proxy host. Normalizza il payload con i default richiesti da NPM.
router.post("/proxy-hosts", async (req, res, next) => {
  try {
    const payload = buildProxyHostPayload(req.body || {});
    res.status(201).json(await npm.createProxyHost(payload));
  } catch (err) {
    next(err);
  }
});

router.put("/proxy-hosts/:id", async (req, res, next) => {
  try {
    const payload = buildProxyHostPayload(req.body || {});
    res.json(await npm.updateProxyHost(req.params.id, payload));
  } catch (err) {
    next(err);
  }
});

router.delete("/proxy-hosts/:id", async (req, res, next) => {
  try {
    res.json(await npm.deleteProxyHost(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post("/proxy-hosts/:id/enable", async (req, res, next) => {
  try {
    res.json(await npm.enableProxyHost(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post("/proxy-hosts/:id/disable", async (req, res, next) => {
  try {
    res.json(await npm.disableProxyHost(req.params.id));
  } catch (err) {
    next(err);
  }
});

// Flusso automatico: emette un certificato con la CA per i domini del proxy host,
// lo carica su NPM e lo assegna al proxy host attivando SSL.
router.post("/proxy-hosts/:id/auto-ssl", async (req, res, next) => {
  try {
    const host = await npm.getProxyHost(req.params.id);
    const domains = host.domain_names || [];
    if (domains.length === 0) {
      return res
        .status(400)
        .json({ error: "Il proxy host non ha domini su cui emettere il certificato." });
    }

    // 1. Emetti il certificato X.509 con la CA locale (CN = primo dominio, SAN = tutti).
    const issued = await issueCertificate({
      commonName: domains[0],
      altNames: domains,
    });

    // 2. Carica fullchain + chiave su NPM.
    const files = await getCertificateFiles(issued.id);
    const uploaded = await npm.uploadCustomCertificate({
      niceName: domains[0],
      certificate: files.fullchain,
      certificateKey: files.key,
    });

    // 3. Assegna il certificato al proxy host e attiva SSL.
    const updated = await npm.updateProxyHost(req.params.id, {
      ...mapHostToPayload(host),
      certificate_id: uploaded.id,
      ssl_forced: 1,
      http2_support: 1,
    });

    res.status(201).json({ proxyHost: updated, certificateId: uploaded.id });
  } catch (err) {
    next(err);
  }
});

// ---------- Certificati ----------

router.get("/certificates", async (req, res, next) => {
  try {
    res.json(await npm.listCertificates());
  } catch (err) {
    next(err);
  }
});

// ---------- Access Lists ----------

router.get("/access-lists", async (req, res, next) => {
  try {
    res.json(await npm.listAccessLists());
  } catch (err) {
    next(err);
  }
});

// Mappa un proxy host restituito da NPM nel payload accettato dalla PUT,
// preservando la configurazione esistente.
function mapHostToPayload(h) {
  return {
    domain_names: h.domain_names || [],
    forward_scheme: h.forward_scheme,
    forward_host: h.forward_host,
    forward_port: Number(h.forward_port),
    allow_websocket_upgrade: h.allow_websocket_upgrade ? 1 : 0,
    block_exploits: h.block_exploits ? 1 : 0,
    caching_enabled: h.caching_enabled ? 1 : 0,
    certificate_id: Number(h.certificate_id) || 0,
    ssl_forced: h.ssl_forced ? 1 : 0,
    hsts_enabled: h.hsts_enabled ? 1 : 0,
    hsts_subdomains: h.hsts_subdomains ? 1 : 0,
    http2_support: h.http2_support ? 1 : 0,
    access_list_id: Number(h.access_list_id) || 0,
    advanced_config: h.advanced_config || "",
    locations: h.locations || [],
    meta: h.meta || {},
  };
}

// Costruisce il payload per il proxy host con i campi richiesti.
function buildProxyHostPayload(body) {
  const {
    domainNames = [],
    forwardScheme = "http",
    forwardHost,
    forwardPort,
    websocketUpgrade = false,
    blockExploits = true,
    cachingEnabled = false,
    allowWebsocketUpgrade,
    certificateId = 0,
    sslForced = false,
    hstsEnabled = false,
    hstsSubdomains = false,
    http2Support = false,
    accessListId = 0,
    advancedConfig = "",
  } = body;

  return {
    domain_names: Array.isArray(domainNames) ? domainNames : [domainNames],
    forward_scheme: forwardScheme,
    forward_host: forwardHost,
    forward_port: Number(forwardPort),
    // NPM usa allow_websocket_upgrade
    allow_websocket_upgrade:
      (allowWebsocketUpgrade ?? websocketUpgrade) ? 1 : 0,
    block_exploits: blockExploits ? 1 : 0,
    caching_enabled: cachingEnabled ? 1 : 0,
    certificate_id: Number(certificateId) || 0,
    ssl_forced: sslForced ? 1 : 0,
    hsts_enabled: hstsEnabled ? 1 : 0,
    hsts_subdomains: hstsSubdomains ? 1 : 0,
    http2_support: http2Support ? 1 : 0,
    access_list_id: Number(accessListId) || 0,
    advanced_config: advancedConfig,
    locations: [],
    meta: { letsencrypt_agree: false, dns_challenge: false },
  };
}

export default router;
