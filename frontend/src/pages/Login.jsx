import { useState } from "react";
import { useAuth } from "../components/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Icon from "../components/Icon.jsx";

// Schermata di login (credenziali NPM) e setup iniziale (URL NPM).
export default function Login() {
  const auth = useAuth();
  const toast = useToast();
  const isSetup = auth.phase === "setup";

  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSetup) {
        await auth.setup(url.trim());
        toast.success("URL salvato, ora accedi");
      } else {
        await auth.login(email.trim(), password);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon name="lock" className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Cert Manager</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSetup
              ? "Configura l'URL di Nginx Proxy Manager per iniziare."
              : "Accedi con le tue credenziali di Nginx Proxy Manager."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {isSetup ? (
            <div>
              <label className="label">URL Nginx Proxy Manager</label>
              <input
                className="input"
                placeholder="http://npm.local:81"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                required
              />
              <p className="mt-1 text-xs text-slate-400">
                Includi la porta admin (di solito 81). Verrà verificata la
                raggiungibilità.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Attendere…" : isSetup ? "Salva e continua" : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}
