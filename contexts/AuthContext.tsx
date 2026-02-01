
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { AuthService } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('g360_user');
    if (saved) {
      try {
        const parsedUser = JSON.parse(saved);
        if (parsedUser.status === 'ACTIVE') {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('g360_user');
        }
      } catch (e) {
        localStorage.removeItem('g360_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string) => {
    setLoading(true);
    try {
      const userData = await AuthService.login(email);
      if (userData.status !== 'ACTIVE') {
        throw new Error('Esta conta está inativa. Entre em contato com o administrador do gabinete.');
      }
      setUser(userData);
      localStorage.setItem('g360_user', JSON.stringify(userData));
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('g360_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
