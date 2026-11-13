import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  username: string;
  email: string;
  avatarColor: string;
  storageUsedBytes: number;
  storageQuotaBytes: number;
}

export interface SavedAccount {
  user: User;
  token: string;
  lastActive: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  savedAccounts: SavedAccount[];
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  removeSavedAccount: (userId: string) => void;
  logout: (all?: boolean) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = "http://localhost:8000";
const TOKEN_KEY = "uvs_auth_token";
const SAVED_ACCOUNTS_KEY = "uvs_saved_accounts_vault";

function loadSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistSavedAccounts(accounts: SavedAccount[]) {
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error("Failed to save accounts list:", e);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(loadSavedAccounts);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to sync account to saved list
  const upsertAccount = useCallback((newUser: User, newToken: string) => {
    setSavedAccounts((prev) => {
      const filtered = prev.filter((acc) => acc.user.id !== newUser.id);
      const updated: SavedAccount[] = [
        { user: newUser, token: newToken, lastActive: Date.now() },
        ...filtered,
      ];
      persistSavedAccounts(updated);
      return updated;
    });
  }, []);

  // Fetch current user details from API using active token
  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        upsertAccount(data.user, currentToken);
      } else {
        // Token expired or invalid: remove current from active
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.warn("[Auth] Failed to verify user session:", err);
    } finally {
      setIsLoading(false);
    }
  }, [upsertAccount]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "فشل تسجيل الدخول");
      }

      const activeToken = data.user.token;
      localStorage.setItem(TOKEN_KEY, activeToken);
      setToken(activeToken);
      setUser(data.user);
      upsertAccount(data.user, activeToken);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "فشل إنشاء الحساب");
      }

      const activeToken = data.user.token;
      localStorage.setItem(TOKEN_KEY, activeToken);
      setToken(activeToken);
      setUser(data.user);
      upsertAccount(data.user, activeToken);
    } finally {
      setIsLoading(false);
    }
  };

  const switchAccount = async (targetUserId: string) => {
    const target = savedAccounts.find((a) => a.user.id === targetUserId);
    if (!target) return;

    setIsLoading(true);
    try {
      localStorage.setItem(TOKEN_KEY, target.token);
      setToken(target.token);
      setUser(target.user);

      // Update lastActive in savedAccounts
      setSavedAccounts((prev) => {
        const reordered = prev.map((a) =>
          a.user.id === targetUserId ? { ...a, lastActive: Date.now() } : a
        );
        reordered.sort((a, b) => b.lastActive - a.lastActive);
        persistSavedAccounts(reordered);
        return reordered;
      });

      // Fetch fresh data from backend
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${target.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        upsertAccount(data.user, target.token);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const removeSavedAccount = (targetUserId: string) => {
    setSavedAccounts((prev) => {
      const remaining = prev.filter((a) => a.user.id !== targetUserId);
      persistSavedAccounts(remaining);

      // If active account was removed
      if (user?.id === targetUserId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          localStorage.setItem(TOKEN_KEY, next.token);
          setToken(next.token);
          setUser(next.user);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      }
      return remaining;
    });
  };

  const logout = (all: boolean = false) => {
    if (all) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SAVED_ACCOUNTS_KEY);
      setToken(null);
      setUser(null);
      setSavedAccounts([]);
    } else {
      // Logout current account only
      const currentId = user?.id;
      if (currentId) {
        setSavedAccounts((prev) => {
          const remaining = prev.filter((a) => a.user.id !== currentId);
          persistSavedAccounts(remaining);
          if (remaining.length > 0) {
            const next = remaining[0];
            localStorage.setItem(TOKEN_KEY, next.token);
            setToken(next.token);
            setUser(next.user);
          } else {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setUser(null);
          }
          return remaining;
        });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        savedAccounts,
        isLoading,
        login,
        register,
        switchAccount,
        removeSavedAccount,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
