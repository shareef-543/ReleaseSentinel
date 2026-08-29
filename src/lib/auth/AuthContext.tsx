import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'admin' | 'lead' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  last_login_at?: string | null;
}

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLead: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const STORAGE_KEY_TOKEN = 'release_sentinel_auth_token';
const STORAGE_KEY_USER = 'release_sentinel_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SafeUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || null;
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setUser(data.data);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.data));
          } else {
            // Token invalid or expired
            setUser(null);
            setToken(null);
            localStorage.removeItem(STORAGE_KEY_TOKEN);
            localStorage.removeItem(STORAGE_KEY_USER);
          }
        })
        .catch(() => {
          // If server is unreachable, retain local session
        });
    }
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }

      const receivedUser: SafeUser = data.data.user;
      const receivedToken: string = data.data.token;

      setUser(receivedUser);
      setToken(receivedToken);
      localStorage.setItem(STORAGE_KEY_TOKEN, receivedToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(receivedUser));
      setAuthModalOpen(false);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to backend' };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      const receivedUser: SafeUser = data.data.user;
      const receivedToken: string = data.data.token;

      setUser(receivedUser);
      setToken(receivedToken);
      localStorage.setItem(STORAGE_KEY_TOKEN, receivedToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(receivedUser));
      setAuthModalOpen(false);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to backend' };
    }
  }, []);

  const logout = useCallback(() => {
    if (token) {
      fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
  }, [token]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isLead: user?.role === 'lead' || user?.role === 'admin',
    login,
    register,
    logout,
    authModalOpen,
    openAuthModal: () => setAuthModalOpen(true),
    closeAuthModal: () => setAuthModalOpen(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
