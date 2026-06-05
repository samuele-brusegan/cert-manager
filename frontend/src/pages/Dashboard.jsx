import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";

function StatCard({ title, value, sub, to, accent }) {
  const body = (
    <div className="card p-5 transition-shadow hover:shadow-md">
      <div className="text-sm text-slate-500">{title}</div>
      <div className={`mt-1 text-3xl font-bold ${accent || "text-slate-800"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const [ca, setCa] = useState(null);
  const [certs, setCerts] = useState(null);
  const [hosts, setHosts] = useState(null);
  const [npmError, setNpmError] = useState(false);

  useEffect(() => {
    api.getCA().then((d) => setCa(d)).catch(() => setCa({ exists: false }));
    api.listCerts().then((d) => setCerts(d.certificates)).catch(() => setCerts([]));
    api
      .listProxyHosts()
      .then((d) => setHosts(d))
      .catch(() => {
        setHosts([]);
        setNpmError(true);
      });
  }, []);

  const activeHosts = hosts?.filter((h) => h.enabled).length ?? 0;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">
        Panoramica della tua infrastruttura di certificati e proxy.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="CA Root"
          value={ca === null ? "…" : ca.exists ? "Attiva" : "Assente"}
          sub={ca?.exists ? ca.ca.commonName : "Crea o importa una CA"}
          accent={ca?.exists ? "text-emerald-600" : "text-amber-600"}
          to="/ca"
        />
        <StatCard
          title="Certificati emessi"
          value={certs === null ? "…" : certs.length}
          sub="Certificati X.509 locali"
          to="/certificates"
        />
        <StatCard
          title="Proxy Hosts attivi"
          value={hosts === null ? "…" : `${activeHosts}/${hosts.length}`}
          sub={npmError ? "NPM non configurato" : "Su Nginx Proxy Manager"}
          accent={npmError ? "text-amber-600" : "text-slate-800"}
          to="/proxy-hosts"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-semibold">Per iniziare</h2>
          <ol className="space-y-2 text-sm text-slate-600">
            <li>
              <b>1.</b> Configura le credenziali NPM in{" "}
              <Link className="text-brand-600 hover:underline" to="/settings">
                Impostazioni
              </Link>
              .
            </li>
            <li>
              <b>2.</b> Crea o importa una{" "}
              <Link className="text-brand-600 hover:underline" to="/ca">
                CA Root
              </Link>
              .
            </li>
            <li>
              <b>3.</b> Emetti{" "}
              <Link className="text-brand-600 hover:underline" to="/certificates">
                certificati
              </Link>{" "}
              e inviali a NPM.
            </li>
            <li>
              <b>4.</b> Crea i tuoi{" "}
              <Link className="text-brand-600 hover:underline" to="/proxy-hosts">
                proxy host
              </Link>{" "}
              con SSL.
            </li>
            <li>
              <b>5.</b> Distribuisci la CA root con gli{" "}
              <Link className="text-brand-600 hover:underline" to="/scripts">
                script di trust
              </Link>
              .
            </li>
          </ol>
        </div>

        <div className="card p-6">
          <h2 className="mb-3 text-lg font-semibold">Distribuisci la CA root</h2>
          <p className="mb-4 text-sm text-slate-500">
            Affinché i client si fidino dei certificati emessi, devono avere la CA
            root installata come affidabile.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              className="btn-secondary"
              href={api.caDownloadUrl}
              download
              aria-disabled={!ca?.exists}
            >
              <Icon name="download" className="h-4 w-4" /> Scarica cert root
            </a>
            <Link className="btn-primary" to="/scripts">
              Script di trust
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
