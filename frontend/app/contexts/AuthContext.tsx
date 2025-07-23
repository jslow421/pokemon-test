'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ApiClient from '../lib/api-client';

interface AuthContextType {
  token: string | null;
  user: { username: string } | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  apiClient: ApiClient;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const handleAuthError = useCallback(() => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.push('/login');
  }, [router]);

  const apiClient = new ApiClient({
    baseURL: 'http://localhost:8181',
    getAuthToken: () => token,
    onAuthError: handleAuthError,
  });

  useEffect(() => {
    // Check for existing token in sessionStorage on mount
    const storedToken = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const data = await apiClient.post('/login', { username, password }) as { token?: string; error?: string };

      if (data.token) {
        setToken(data.token);
        setUser({ username });
        
        // Store in sessionStorage (browser memory)
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('user', JSON.stringify({ username }));
        
        router.push('/');
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (username: string, password: string, email: string) => {
    try {
      const data = await apiClient.post('/register', { username, password, email }) as { success?: boolean; message?: string; error?: string };

      if (data.success) {
        // Registration successful, but user may need to confirm email
        // Don't automatically log in - let them know to check email if needed
        return;
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, isLoading, apiClient }}>
      {children}
    </AuthContext.Provider>
  );
};