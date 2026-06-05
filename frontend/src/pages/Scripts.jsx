import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import Icon from "../components/Icon.jsx";

const OSES = [
  { key: "linux", label: "Linux", icon: "terminal", run: "bash trust-linux.sh" },
  { key: "macos", label: "macOS", icon: "apple", run: "bash trust-macos.sh" },
  {
    key: "windows",
    label: "Windows",
    icon: "windows",
    run: "powershell -ExecutionPolicy Bypass -File trust-windows.ps1",
  },
];

export default function Scripts() {
  const toast = useToast();
  const [os, setOs] = useState("linux");
  const [content, setContent] = useState("");
  const [caExists, setCaExists] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load(selected) {
    setLoading(true);
    try {
      const ca = await api.getCA();
      setCaExists(ca.exists);
      if (!ca.exists) {
        setContent("");
        return;
      }
      const { content } = await api.getScript(selected);
      setContent(content);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(os);
  }, [os]);

  const current = OSES.find((o) => o.key === os);

  function copy() {
    navigator.clipboard.writeText(content);
    toast.success("Script copiato negli appunti");
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Script di Trust</h1>
      <p className="mb-6 text-sm text-slate-500">
        Installa la CA root come affidabile sui dispositivi client per evitare gli
        avvisi di certificato non attendibile.
      </p>

      {!caExists ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Nessuna CA root configurata. Creane una nella sezione <b>CA Root</b>.
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            {OSES.map((o) => (
              <button
                key={o.key}
                onClick={() => setOs(o.key)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                  os === o.key
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon name={o.icon} className="h-4 w-4" /> {o.label}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
              <code className="text-xs text-slate-500">{current.run}</code>
              <div className="flex gap-2">
                <button className="btn-ghost px-3 py-1 text-xs" onClick={copy}>
                  Copia
                </button>
                <a
                  className="btn-secondary px-3 py-1 text-xs"
                  href={api.scriptDownloadUrl(os)}
                  download
                >
                  Scarica
                </a>
              </div>
            </div>
            <pre className="max-h-[55vh] overflow-auto bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
              {loading ? "Caricamento…" : content}
            </pre>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="mb-1 font-medium">Come si usa</p>
            <ol className="list-inside list-decimal space-y-1 text-slate-500">
              <li>Scarica o copia lo script per il sistema operativo del client.</li>
              <li>Eseguilo con privilegi di amministratore.</li>
              <li>Lo script scarica la CA root da questo server e la installa come affidabile.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
