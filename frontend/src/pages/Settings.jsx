import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { useAuth } from "../components/AuthContext.jsx";

export default function Settings() {
  const toast = useToast();
  const auth = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function load() {
    try {
      const { npm } = await api.getSettings();
      setUrl(npm.url || "");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.saveNpm({ url });
      toast.success("URL salvato");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      await api.testNpm({}); // usa le credenziali della sessione corrente
      toast.success("Connessione a NPM riuscita");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <p className="text-slate-400">Caricamento…</p>;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Impostazioni</h1>
      <p className="mb-6 text-sm text-slate-500">
        Connessione a Nginx Proxy Manager e account.
      </p>

      <div className="card max-w-xl p-6">
        <h2 className="mb-4 text-lg font-semibold">Nginx Proxy Manager</h2>
        <div className="space-y-4">
          <div>
            <label className="label">URL</label>
            <input
              className="input"
              placeholder="http://npm.local:81"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              URL completo dell'istanza NPM (inclusa porta admin, es. 81).
            </p>
          </div>
          <div>
            <label className="label">Account</label>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">{auth.user?.email}</span>
              <button
                className="text-xs text-brand-600 hover:underline"
                onClick={auth.logout}
              >
                Cambia account (logout)
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Le credenziali NPM sono quelle usate per accedere. Per cambiarle, esci e
              accedi con un altro account.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvataggio…" : "Salva URL"}
          </button>
          <button className="btn-secondary" onClick={test} disabled={testing}>
            {testing ? "Test in corso…" : "Testa connessione"}
          </button>
        </div>
      </div>
    </div>
  );
}
