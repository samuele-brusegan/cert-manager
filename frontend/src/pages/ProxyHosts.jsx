import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Icon from "../components/Icon.jsx";
import Tooltip from "../components/Tooltip.jsx";

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

// Switch stile iOS per attivare/disattivare l'accesso al proxy host.
function Switch({ checked, onChange, disabled, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const emptyForm = {
  domainNames: "",
  forwardScheme: "http",
  forwardHost: "",
  forwardPort: 80,
  allowWebsocketUpgrade: false,
  blockExploits: true,
  certificateId: 0,
  sslForced: false,
  hstsEnabled: false,
  hstsSubdomains: false,
  http2Support: false,
  addToHosts: false,
  hostsIp: "127.0.0.1",
};

export default function ProxyHosts() {
  const toast = useToast();
  const [hosts, setHosts] = useState([]);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [hostsInfo, setHostsInfo] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [h, c] = await Promise.all([api.listProxyHosts(), api.listNpmCerts()]);
      setHosts(h);
      setCerts(c);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Info sul file hosts (percorso, scrivibilità) per la UI.
    api.getHosts().then(setHostsInfo).catch(() => setHostsInfo(null));
  }, []);

  const hostsPath = hostsInfo?.path || "/etc/hosts";

  // Insieme degli hostname già presenti nel file hosts (qualsiasi origine).
  const hostNamesSet = new Set(
    (hostsInfo?.allEntries || []).map((e) => e.domain.toLowerCase()),
  );

  // Un valore è un IP (v4 o v6) e quindi NON un dominio da risolvere.
  const isIp = (s) => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || s.includes(":");

  // Domini reali del PH non ancora presenti nel file hosts.
  const missingHostDomains = (h) =>
    (h.domain_names || []).filter((d) => !isIp(d) && !hostNamesSet.has(d.toLowerCase()));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(h) {
    setEditing(h);
    setForm({
      domainNames: (h.domain_names || []).join(", "),
      forwardScheme: h.forward_scheme,
      forwardHost: h.forward_host,
      forwardPort: h.forward_port,
      allowWebsocketUpgrade: !!h.allow_websocket_upgrade,
      blockExploits: !!h.block_exploits,
      certificateId: h.certificate_id || 0,
      sslForced: !!h.ssl_forced,
      hstsEnabled: !!h.hsts_enabled,
      hstsSubdomains: !!h.hsts_subdomains,
      http2Support: !!h.http2_support,
    });
    setShowForm(true);
  }

  function set(field) {
    return (value) => setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.forwardHost || !form.domainNames) {
      return toast.error("Domini e host di forward sono obbligatori");
    }
    setBusy(true);
    try {
      const domainList = form.domainNames
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        ...form,
        domainNames: domainList,
        forwardPort: Number(form.forwardPort),
        certificateId: Number(form.certificateId),
      };
      if (editing) {
        await api.updateProxyHost(editing.id, payload);
        toast.success("Proxy host aggiornato");
      } else {
        await api.createProxyHost(payload);
        toast.success("Proxy host creato");
      }

      // Aggiunta opzionale al file hosts (non blocca il salvataggio del PH).
      if (form.addToHosts && domainList.length) {
        try {
          await api.addHosts({ ip: form.hostsIp || "127.0.0.1", domains: domainList });
          toast.success(`Aggiunto a ${hostsPath}`);
          api.getHosts().then(setHostsInfo).catch(() => {});
        } catch (err) {
          toast.error(`Proxy salvato, ma scrittura hosts fallita: ${err.message}`);
        }
      }

      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setEnabled(h, enabled) {
    setBusyId(h.id);
    try {
      if (enabled) {
        await api.enableProxyHost(h.id);
        toast.success("Proxy attivato");
      } else {
        await api.disableProxyHost(h.id);
        toast.success("Proxy disattivato");
      }
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // Flusso automatico: emette il cert per i domini, lo invia a NPM e lo assegna.
  async function createCertificate(h) {
    const domains = (h.domain_names || []).join(", ");
    if (!confirm(`Emettere un certificato per ${domains}, caricarlo su NPM e attivare SSL?`)) {
      return;
    }
    setBusyId(h.id);
    try {
      await api.autoSslProxyHost(h.id);
      toast.success("Certificato creato e SSL attivato");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // Aggiunge rapidamente al file hosts i domini mancanti del PH (verso 127.0.0.1).
  async function addToHostsQuick(h) {
    const domains = missingHostDomains(h);
    if (domains.length === 0) return;
    if (!confirm(`Aggiungere ${domains.join(", ")} a ${hostsPath} (→ 127.0.0.1)?`)) return;
    setBusyId(h.id);
    try {
      await api.addHosts({ ip: "127.0.0.1", domains });
      toast.success(`Aggiunto a ${hostsPath}`);
      setHostsInfo(await api.getHosts());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(h) {
    if (!confirm(`Eliminare il proxy host ${(h.domain_names || []).join(", ")}?`)) return;
    try {
      await api.deleteProxyHost(h.id);
      toast.success("Proxy host eliminato");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const sslEnabled = Number(form.certificateId) > 0;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Proxy Hosts</h1>
          <p className="text-sm text-slate-500">
            Gestisci i proxy host di Nginx Proxy Manager.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Icon name="plus" className="h-4 w-4" /> Nuovo proxy host
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Caricamento…</p>
      ) : hosts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nessun proxy host. Verifica la connessione NPM nelle Impostazioni.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Dominio</th>
                <th className="px-4 py-3">Destinazione</th>
                <th className="px-4 py-3">SSL</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    {(h.domain_names || []).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {h.forward_scheme}://{h.forward_host}:{h.forward_port}
                  </td>
                  <td className="px-4 py-3">
                    {h.certificate_id ? (
                      <span className="badge bg-brand-50 text-brand-700">
                        {h.ssl_forced ? "Forzato" : "On"}
                        {h.http2_support ? " · H2" : ""}
                        {h.hsts_enabled ? " · HSTS" : ""}
                      </span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!h.enabled}
                        disabled={busyId === h.id}
                        onChange={(v) => setEnabled(h, v)}
                        title={h.enabled ? "Disattiva proxy" : "Attiva proxy"}
                      />
                      <span className="text-xs text-slate-500">
                        {h.enabled ? "Attivo" : "Disattivo"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {hostsInfo?.writable && missingHostDomains(h).length > 0 && (
                        <Tooltip
                          label={`Aggiungi a hosts: ${missingHostDomains(h).join(", ")}`}
                        >
                          <button
                            className="btn-secondary p-1.5"
                            aria-label="Aggiungi a hosts"
                            disabled={busyId === h.id}
                            onClick={() => addToHostsQuick(h)}
                          >
                            <Icon name="listPlus" className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      )}
                      {!h.certificate_id && (
                        <Tooltip label={busyId === h.id ? "Creazione…" : "Crea certificato e attiva SSL"}>
                          <button
                            className="btn-primary p-1.5"
                            aria-label="Crea certificato"
                            disabled={busyId === h.id}
                            onClick={() => createCertificate(h)}
                          >
                            <Icon name="shieldPlus" className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip label="Modifica">
                        <button
                          className="btn-secondary p-1.5"
                          aria-label="Modifica"
                          onClick={() => openEdit(h)}
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Elimina">
                        <button
                          className="btn-ghost p-1.5 text-red-600"
                          aria-label="Elimina"
                          onClick={() => remove(h)}
                        >
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        wide
        title={editing ? "Modifica proxy host" : "Nuovo proxy host"}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Annulla
            </button>
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? "Salvataggio…" : "Salva"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Domini *" hint="Uno o più nomi di dominio separati da virgola">
            <input
              className="input"
              placeholder="app.example.com"
              value={form.domainNames}
              onChange={(e) => set("domainNames")(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-4 gap-3">
            <Field label="Schema">
              <select
                className="input"
                value={form.forwardScheme}
                onChange={(e) => set("forwardScheme")(e.target.value)}
              >
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="IP / Host di forward *">
                <input
                  className="input"
                  placeholder="192.168.1.10"
                  value={form.forwardHost}
                  onChange={(e) => set("forwardHost")(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Porta *">
              <input
                type="number"
                className="input"
                value={form.forwardPort}
                onChange={(e) => set("forwardPort")(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex gap-6">
            <Toggle
              label="Supporto WebSocket"
              checked={form.allowWebsocketUpgrade}
              onChange={set("allowWebsocketUpgrade")}
            />
            <Toggle
              label="Block common exploits"
              checked={form.blockExploits}
              onChange={set("blockExploits")}
            />
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-700">SSL</h4>
            <Field label="Certificato">
              <select
                className="input"
                value={form.certificateId}
                onChange={(e) => set("certificateId")(e.target.value)}
              >
                <option value={0}>Nessuno</option>
                {certs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nice_name} ({(c.domain_names || []).join(", ") || c.provider})
                  </option>
                ))}
              </select>
            </Field>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Toggle label="Force SSL" checked={form.sslForced} onChange={set("sslForced")} disabled={!sslEnabled} />
              <Toggle label="HTTP/2 Support" checked={form.http2Support} onChange={set("http2Support")} disabled={!sslEnabled} />
              <Toggle label="HSTS Enabled" checked={form.hstsEnabled} onChange={set("hstsEnabled")} disabled={!sslEnabled} />
              <Toggle
                label="HSTS Subdomains"
                checked={form.hstsSubdomains}
                onChange={set("hstsSubdomains")}
                disabled={!sslEnabled || !form.hstsEnabled}
              />
            </div>
            {!sslEnabled && (
              <p className="mt-2 text-xs text-slate-400">
                Seleziona un certificato per abilitare le opzioni SSL.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-700">DNS locale</h4>
            <Toggle
              label={
                <span>
                  Aggiungi a <code className="text-xs">{hostsPath}</code>
                </span>
              }
              checked={form.addToHosts}
              onChange={set("addToHosts")}
              disabled={hostsInfo ? !hostsInfo.writable : false}
            />
            {form.addToHosts && (
              <div className="mt-3">
                <Field
                  label="IP di destinazione"
                  hint="I domini sopra verranno risolti a questo IP nel file hosts."
                >
                  <input
                    className="input"
                    placeholder="127.0.0.1"
                    value={form.hostsIp}
                    onChange={(e) => set("hostsIp")(e.target.value)}
                  />
                </Field>
              </div>
            )}
            {hostsInfo && !hostsInfo.writable && (
              <p className="mt-2 text-xs text-amber-600">
                Il file {hostsPath} non è scrivibile dal server (servono permessi di
                root/admin o un bind mount con scrittura).
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
