import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Icon from "../components/Icon.jsx";

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800 break-all">{value}</span>
    </div>
  );
}

export default function CA() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, exists: false, ca: null });
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);

  const [createForm, setCreateForm] = useState({
    commonName: "My Root CA",
    organization: "",
    country: "",
    state: "",
    locality: "",
    validityDays: 3650,
    keySize: 4096,
  });
  const [importForm, setImportForm] = useState({ certPem: "", keyPem: "" });

  async function load() {
    try {
      const data = await api.getCA();
      setState({ loading: false, ...data });
    } catch (err) {
      toast.error(err.message);
      setState({ loading: false, exists: false, ca: null });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy(true);
    try {
      await api.createCA({
        ...createForm,
        validityDays: Number(createForm.validityDays),
        keySize: Number(createForm.keySize),
      });
      toast.success("CA root creata");
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    setBusy(true);
    try {
      await api.importCA(importForm);
      toast.success("CA root importata");
      setShowImport(false);
      setImportForm({ certPem: "", keyPem: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Eliminare la CA root? I certificati emessi non saranno più verificabili.")) return;
    try {
      await api.deleteCA();
      toast.success("CA root eliminata");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (state.loading) return <p className="text-slate-400">Caricamento…</p>;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">CA Root</h1>
      <p className="mb-6 text-sm text-slate-500">
        Crea o importa l'autorità di certificazione che firma i tuoi certificati X.509.
      </p>

      {!state.exists ? (
        <div className="card max-w-xl p-8 text-center">
          <div className="mb-3 flex justify-center text-brand-600">
            <Icon name="shield" className="h-12 w-12" strokeWidth={1.5} />
          </div>
          <h2 className="mb-1 text-lg font-semibold">Nessuna CA root configurata</h2>
          <p className="mb-6 text-sm text-slate-500">
            Crea una nuova CA root oppure importane una esistente.
          </p>
          <div className="flex justify-center gap-2">
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              Crea CA root
            </button>
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              Importa CA esistente
            </button>
          </div>
        </div>
      ) : (
        <div className="card max-w-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{state.ca.commonName}</h2>
            <span className="badge bg-emerald-100 text-emerald-700">Attiva</span>
          </div>
          <InfoRow label="Subject CN" value={state.ca.commonName} />
          {state.ca.subject.O && <InfoRow label="Organizzazione" value={state.ca.subject.O} />}
          <InfoRow label="Serial Number" value={state.ca.serialNumber} />
          <InfoRow label="Valido dal" value={new Date(state.ca.validFrom).toLocaleString()} />
          <InfoRow label="Valido fino al" value={new Date(state.ca.validTo).toLocaleString()} />
          <InfoRow label="SHA-256" value={state.ca.fingerprintSha256} />

          <div className="mt-6 flex flex-wrap gap-2">
            <a className="btn-primary" href={api.caDownloadUrl} download>
              <Icon name="download" className="h-4 w-4" /> Scarica cert root (.crt)
            </a>
            <button className="btn-danger" onClick={remove}>
              Elimina
            </button>
          </div>
        </div>
      )}

      {/* Modale creazione */}
      <Modal
        open={showCreate}
        title="Crea CA root"
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>
              Annulla
            </button>
            <button className="btn-primary" onClick={create} disabled={busy}>
              {busy ? "Creazione…" : "Crea"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Common Name *">
            <input
              className="input"
              value={createForm.commonName}
              onChange={(e) => setCreateForm({ ...createForm, commonName: e.target.value })}
            />
          </Field>
          <Field label="Organizzazione">
            <input
              className="input"
              value={createForm.organization}
              onChange={(e) => setCreateForm({ ...createForm, organization: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Paese (C)">
              <input
                className="input"
                maxLength={2}
                placeholder="IT"
                value={createForm.country}
                onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
              />
            </Field>
            <Field label="Regione (ST)">
              <input
                className="input"
                value={createForm.state}
                onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
              />
            </Field>
            <Field label="Città (L)">
              <input
                className="input"
                value={createForm.locality}
                onChange={(e) => setCreateForm({ ...createForm, locality: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Validità (giorni)">
              <input
                type="number"
                className="input"
                value={createForm.validityDays}
                onChange={(e) => setCreateForm({ ...createForm, validityDays: e.target.value })}
              />
            </Field>
            <Field label="Dimensione chiave">
              <select
                className="input"
                value={createForm.keySize}
                onChange={(e) => setCreateForm({ ...createForm, keySize: e.target.value })}
              >
                <option value={2048}>2048 bit</option>
                <option value={4096}>4096 bit</option>
              </select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* Modale import */}
      <Modal
        open={showImport}
        title="Importa CA esistente"
        wide
        onClose={() => setShowImport(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowImport(false)}>
              Annulla
            </button>
            <button className="btn-primary" onClick={doImport} disabled={busy}>
              {busy ? "Importazione…" : "Importa"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Certificato (PEM)">
            <textarea
              className="input font-mono text-xs"
              rows={6}
              placeholder="-----BEGIN CERTIFICATE-----"
              value={importForm.certPem}
              onChange={(e) => setImportForm({ ...importForm, certPem: e.target.value })}
            />
          </Field>
          <Field label="Chiave privata (PEM)">
            <textarea
              className="input font-mono text-xs"
              rows={6}
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={importForm.keyPem}
              onChange={(e) => setImportForm({ ...importForm, keyPem: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
