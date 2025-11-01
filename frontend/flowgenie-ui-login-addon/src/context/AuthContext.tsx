import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  token: string;
};

type AuthContextValue = {
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const t = localStorage.getItem("flowgenie_token");
      return t ? { token: t } : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // optional: could validate token with backend here
  }, []);

  const login = (token: string) => {
    localStorage.setItem("flowgenie_token", token);
    setUser({ token });
    // redirect handled by consumer (e.g., router)
  };

  const logout = () => {
    localStorage.removeItem("flowgenie_token");
    setUser(null);
    // optional: call backend logout if needed
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
