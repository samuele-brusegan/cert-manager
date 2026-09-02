import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Icon from "../components/Icon.jsx";

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function Certificates() {
  const toast = useToast();
  const [certs, setCerts] = useState([]);
  const [npmCerts, setNpmCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caExists, setCaExists] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("local");

  const [form, setForm] = useState({
    commonName: "",
    altNames: "",
    organization: "",
    validityDays: 397,
    keySize: 2048,
    uploadToNpm: false,
    npmName: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [ca, c] = await Promise.all([api.getCA(), api.listCerts()]);
      setCaExists(ca.exists);
      setCerts(c.certificates);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadNpm() {
    try {
      setNpmCerts(await api.listNpmCerts());
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "npm") loadNpm();
  }, [tab]);

  async function issue() {
    if (!form.commonName) return toast.error("Common Name obbligatorio");
    setBusy(true);
    try {
      const altNames = form.altNames
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await api.issueCert({
        commonName: form.commonName,
        altNames,
        organization: form.organization || undefined,
        validityDays: Number(form.validityDays),
        keySize: Number(form.keySize),
      });
      let message = "Certificato firmato ed emesso localmente";
      if (form.uploadToNpm) {
        try {
          await api.pushCertToNpm(result.certificate.id, {
            niceName: form.npmName.trim() || undefined,
          });
          message += "; caricato su NPM";
        } catch (err) {
          message += ". Upload su NPM non riuscito: " + err.message;
          toast.error(message);
          setShowIssue(false);
          setForm({ commonName: "", altNames: "", organization: "", validityDays: 397, keySize: 2048, uploadToNpm: false, npmName: "" });
          load();
          return;
        }
      }
      toast.success(message);
      setShowIssue(false);
      setForm({ commonName: "", altNames: "", organization: "", validityDays: 397, keySize: 2048, uploadToNpm: false, npmName: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function push(id) {
    try {
      await api.pushCertToNpm(id, {});
      toast.success("Certificato inviato a NPM");
      if (tab === "npm") loadNpm();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Eliminare questo certificato?")) return;
    try {
      await api.deleteCert(id);
      toast.success("Certificato eliminato");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const expired = (d) => new Date(d) < new Date();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Certificati SSL</h1>
          <p className="text-sm text-slate-500">
            Firma certificati X.509 con la CA root, indipendentemente dai Proxy Host.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowIssue(true)}
          disabled={!caExists}
          title={!caExists ? "Configura prima una CA root" : ""}
        >
          <Icon name="plus" className="h-4 w-4" /> Emetti certificato
        </button>
      </div>

      {!caExists && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Nessuna CA root configurata. Vai in <b>CA Root</b> per crearne una prima di emettere certificati.
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {[
          ["local", "Locali"],
          ["npm", "Su NPM"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === k
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "local" &&
        (loading ? (
          <p className="text-slate-400">Caricamento…</p>
        ) : certs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-400">
            Nessun certificato emesso.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Common Name</th>
                  <th className="px-4 py-3">SAN</th>
                  <th className="px-4 py-3">Scadenza</th>
                  <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{c.commonName}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.altNames.join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          expired(c.validTo)
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {new Date(c.validTo).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <a className="btn-ghost px-2 py-1 text-xs" href={api.certDownloadUrl(c.id, "fullchain")} download>
                          chain
                        </a>
                        <a className="btn-ghost px-2 py-1 text-xs" href={api.certDownloadUrl(c.id, "key")} download>
                          key
                        </a>
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => push(c.id)}>
                          <Icon name="upload" className="h-3.5 w-3.5" /> NPM
                        </button>
                        <button className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => remove(c.id)}>
                          elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "npm" && (
        <div className="card overflow-hidden">
          {npmCerts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Nessun certificato su NPM (o connessione non configurata).
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Domini</th>
                  <th className="px-4 py-3">Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {npmCerts.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{c.nice_name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.provider}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {(c.domain_names || []).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.expires_on ? new Date(c.expires_on).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal
        open={showIssue}
        title="Emetti certificato X.509"
        onClose={() => setShowIssue(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowIssue(false)}>
              Annulla
            </button>
            <button className="btn-primary" onClick={issue} disabled={busy}>
              {busy ? "Emissione…" : "Emetti"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Common Name *" hint="Dominio principale, es. app.local">
            <input
              className="input"
              value={form.commonName}
              onChange={(e) => setForm({ ...form, commonName: e.target.value })}
            />
          </Field>
          <Field
            label="Subject Alternative Names"
            hint="Domini/IP aggiuntivi separati da virgola o spazio"
          >
            <textarea
              className="input"
              rows={2}
              placeholder="app.local, *.app.local, 192.168.1.10"
              value={form.altNames}
              onChange={(e) => setForm({ ...form, altNames: e.target.value })}
            />
          </Field>
          <Field label="Organizzazione">
            <input
              className="input"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Validità (giorni)">
              <input
                type="number"
                className="input"
                value={form.validityDays}
                onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
              />
            </Field>
            <Field label="Dimensione chiave">
              <select
                className="input"
                value={form.keySize}
                onChange={(e) => setForm({ ...form, keySize: e.target.value })}
              >
                <option value={2048}>2048 bit</option>
                <option value={4096}>4096 bit</option>
              </select>
            </Field>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.uploadToNpm}
                onChange={(e) => setForm({ ...form, uploadToNpm: e.target.checked })}
              />
              <span>
                <span className="font-medium">Carica anche su NPM</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Salva il certificato come certificato custom in NPM. Non crea né modifica alcun Proxy Host.
                </span>
              </span>
            </label>
            {form.uploadToNpm && (
              <input
                className="input mt-3"
                placeholder="Nome in NPM (opzionale)"
                value={form.npmName}
                onChange={(e) => setForm({ ...form, npmName: e.target.value })}
              />
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
