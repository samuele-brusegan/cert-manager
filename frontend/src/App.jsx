import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import CA from "./pages/CA.jsx";
import ProxyHosts from "./pages/ProxyHosts.jsx";
import Certificates from "./pages/Certificates.jsx";
import Scripts from "./pages/Scripts.jsx";
import Settings from "./pages/Settings.jsx";
import Hosts from "./pages/Hosts.jsx";
import Login from "./pages/Login.jsx";
import Icon from "./components/Icon.jsx";
import { useAuth } from "./components/AuthContext.jsx";

const nav = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/ca", label: "CA Root", icon: "shield" },
  { to: "/proxy-hosts", label: "Proxy Hosts", icon: "globe" },
  { to: "/hosts", label: "File Hosts", icon: "list" },
  { to: "/scripts", label: "Script di Trust", icon: "download" },
  { to: "/settings", label: "Impostazioni", icon: "settings" },
];

export default function App() {
  const auth = useAuth();

  if (auth.phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Caricamento…
      </div>
    );
  }
  if (auth.phase === "setup" || auth.phase === "login") {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Icon name="lock" className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Cert Manager</div>
            <div className="text-xs text-slate-400">X.509 &amp; NPM</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon name={n.icon} className="h-5 w-5" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        {/* Link "mezzo nascosto" ai certificati */}
        <div className="border-t border-slate-100 px-3 py-3">
          <NavLink
            to="/certificates"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                isActive ? "text-brand-700" : "text-slate-400 hover:text-slate-600"
              }`
            }
          >
            <Icon name="chevronRight" className="h-3.5 w-3.5" /> Certificati SSL
          </NavLink>
        </div>

        {/* Utente loggato + logout */}
        <div className="border-t border-slate-200 px-3 py-3">
          <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
            <span className="truncate text-xs text-slate-500" title={auth.user?.email}>
              {auth.user?.email}
            </span>
            <button
              onClick={auth.logout}
              className="btn-ghost flex-shrink-0 p-1.5 text-slate-500 hover:text-red-600"
              title="Esci"
              aria-label="Esci"
            >
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ca" element={<CA />} />
            <Route path="/proxy-hosts" element={<ProxyHosts />} />
            <Route path="/hosts" element={<Hosts />} />
            <Route path="/certificates" element={<Certificates />} />
            <Route path="/scripts" element={<Scripts />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
