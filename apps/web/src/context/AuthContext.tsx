import React, { createContext, useContext, useState, useEffect } from "react";
import { type User, type Organization, apiRequest } from "../lib/api";

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User, orgId: string) => void;
  logout: () => void;
  switchOrganization: (orgId: string) => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUser = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: User; organizations: Organization[] }>("/auth/me");
      setUser(data.user);
      setOrganizations(data.organizations);

      const savedOrgId = localStorage.getItem("current_org_id");
      const matched = data.organizations.find((o) => o.id === savedOrgId) || data.organizations[0];
      if (matched) {
        setCurrentOrg(matched);
        localStorage.setItem("current_org_id", matched.id);
      }
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [token]);

  const login = (newToken: string, newUser: User, orgId: string) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("current_org_id", orgId);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("current_org_id");
    setToken(null);
    setUser(null);
    setOrganizations([]);
    setCurrentOrg(null);
  };

  const switchOrganization = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem("current_org_id", org.id);
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrg,
        token,
        loading,
        login,
        logout,
        switchOrganization,
        refreshUserData: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
