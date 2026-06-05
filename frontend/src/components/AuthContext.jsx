import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setUnauthorizedHandler } from "../api.js";

const AuthContext = createContext(null);

// Fasi: loading | setup (URL NPM mancante) | login | authed
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    phase: "loading",
    user: null,
    configured: false,
    cookieSecure: false,
  });

  const refresh = useCallback(async () => {
    try {
      const s = await api.getAuthStatus();
      setState({
        phase: !s.configured ? "setup" : s.authenticated ? "authed" : "login",
        user: s.user,
        configured: s.configured,
        cookieSecure: s.cookieSecure,
      });
    } catch {
      // Backend irraggiungibile: mostra comunque il login.
      setState((st) => ({ ...st, phase: "login" }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Quando una chiamata protetta riceve 401, torna al login.
  useEffect(() => {
    setUnauthorizedHandler(() =>
      setState((st) =>
        st.phase === "authed" ? { ...st, phase: "login", user: null } : st,
      ),
    );
    return () => setUnauthorizedHandler(null);
  }, []);

  const setup = async (url) => {
    await api.setup({ url });
    await refresh();
  };
  const login = async (email, password) => {
    await api.login({ email, password });
    await refresh();
  };
  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setState((st) => ({ ...st, phase: "login", user: null }));
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, refresh, setup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
