import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import Icon from "../components/Icon.jsx";
import Tooltip from "../components/Tooltip.jsx";

export default function Hosts() {
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setInfo(await api.getHosts());
    } catch (err) {
      toast.error(err.message);
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function removeEntry(domain) {
    if (!confirm(`Rimuovere "${domain}" dal file hosts?`)) return;
    try {
      await api.removeHosts([domain]);
      toast.success("Voce rimossa");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const entries = info?.allEntries || [];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">File Hosts</h1>
          <p className="text-sm text-slate-500">
            Voci del file hosts del server. Quelle gestite da Cert Manager sono
            evidenziate.
          </p>
        </div>
        <button className="btn-secondary" onClick={load}>
          Aggiorna
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Caricamento…</p>
      ) : !info ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Impossibile leggere il file hosts.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="badge bg-slate-100 text-slate-600">
              <code className="text-xs">{info.path}</code>
            </span>
            <span className="badge bg-slate-100 text-slate-600">{info.platform}</span>
            <span
              className={`badge ${
                info.writable
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {info.writable ? "scrivibile" : "sola lettura"}
            </span>
            <span className="text-slate-400">
              {entries.length} voci · {entries.filter((e) => e.managed).length} gestite
            </span>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Hostname</th>
                  <th className="px-4 py-3">Origine</th>
                  <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      Nessuna voce.
                    </td>
                  </tr>
                ) : (
                  entries.map((e, i) => (
                    <tr key={`${e.domain}-${i}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.ip}</td>
                      <td className="px-4 py-3 font-medium">{e.domain}</td>
                      <td className="px-4 py-3">
                        {e.managed ? (
                          <span className="badge bg-brand-50 text-brand-700">Cert Manager</span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-500">manuale</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {e.managed && (
                            <Tooltip label="Rimuovi dal file hosts">
                              <button
                                className="btn-ghost p-1.5 text-red-600"
                                aria-label="Rimuovi"
                                disabled={!info.writable}
                                onClick={() => removeEntry(e.domain)}
                              >
                                <Icon name="trash" className="h-4 w-4" />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <button
              className="text-sm text-brand-600 hover:underline"
              onClick={() => setShowRaw((v) => !v)}
            >
              {showRaw ? "Nascondi" : "Mostra"} file grezzo
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-[40vh] overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                {info.content || "(vuoto)"}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
