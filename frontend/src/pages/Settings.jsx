import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";

export default function Settings() {
  const toast = useToast();
  const [form, setForm] = useState({ url: "", email: "", password: "" });
  const [passwordSet, setPasswordSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function load() {
    try {
      const { npm } = await api.getSettings();
      setForm({ url: npm.url, email: npm.email, password: "" });
      setPasswordSet(npm.passwordSet);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.saveNpm(form);
      toast.success("Impostazioni salvate");
      setForm((f) => ({ ...f, password: "" }));
      setPasswordSet(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      // Se la password è stata digitata, testa con i valori del form,
      // altrimenti usa quelli salvati lato server.
      const payload = form.password ? form : {};
      await api.testNpm(payload);
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
        Configura la connessione a Nginx Proxy Manager.
      </p>

      <div className="card max-w-xl p-6">
        <h2 className="mb-4 text-lg font-semibold">Nginx Proxy Manager</h2>
        <div className="space-y-4">
          <div>
            <label className="label">URL</label>
            <input
              className="input"
              placeholder="http://npm.local:81"
              value={form.url}
              onChange={update("url")}
            />
            <p className="mt-1 text-xs text-slate-400">
              URL completo dell'istanza NPM (incluso porta admin, es. 81).
            </p>
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              placeholder="admin@example.com"
              value={form.email}
              onChange={update("email")}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder={passwordSet ? "•••••••• (invariata)" : "password"}
              value={form.password}
              onChange={update("password")}
            />
            {passwordSet && (
              <p className="mt-1 text-xs text-slate-400">
                Lascia vuoto per mantenere la password attuale.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvataggio…" : "Salva"}
          </button>
          <button className="btn-secondary" onClick={test} disabled={testing}>
            {testing ? "Test in corso…" : "Testa connessione"}
          </button>
        </div>
      </div>
    </div>
  );
}
