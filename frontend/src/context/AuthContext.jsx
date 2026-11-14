import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  const refresh = useCallback(async () => {
    const me = await api("/auth/me");
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    refresh()
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("agendai:logout", onLogout);
    return () => window.removeEventListener("agendai:logout", onLogout);
  }, []);

  const value = useMemo(() => {
    const startSession = (data) => {
      tokenStore.set(data.access_token);
      setUser(data.user);
      return data.user;
    };
    return {
      user,
      business: user?.business ?? null,
      loading,
      refresh,
      login: async (email, password) =>
        startSession(await api("/auth/login", { method: "POST", body: { email, password }, auth: false })),
      register: async (payload) =>
        startSession(await api("/auth/register", { method: "POST", body: payload, auth: false })),
      logout: () => {
        tokenStore.clear();
        setUser(null);
      },
      setBusiness: (business) => setUser((current) => (current ? { ...current, business } : current)),
    };
  }, [user, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return context;
}
