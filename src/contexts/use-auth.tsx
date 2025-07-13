import React, { createContext, useContext, useEffect, useState } from 'react';
import { load } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user_email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  tokens: AuthTokens | null;
  userEmail: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  isTokenExpired: () => boolean;
  refreshToken: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // トークンの有効期限チェック
  const isTokenExpired = (): boolean => {
    if (!tokens) return true;
    return Date.now() >= tokens.expires_at;
  };

    // 認証状態のチェック
  const checkAuthStatus = async (): Promise<void> => {
    try {
      console.log('Checking auth status...');

      let store;
      try {
        store = await load('auth.json');
      } catch (storeError) {
        console.log('Auth store not found, treating as first-time user');
        setIsAuthenticated(false);
        setTokens(null);
        setUserEmail(null);
        setLoading(false);
        return;
      }

      const storedTokens = await store.get('tokens') as AuthTokens | null;
      console.log('Stored tokens:', storedTokens);

      if (storedTokens && storedTokens.expires_at) {
        setTokens(storedTokens);
        setUserEmail(storedTokens.user_email);

        // トークンの有効期限をチェック
        if (Date.now() < storedTokens.expires_at) {
          console.log('Token is valid, setting authenticated');
          setIsAuthenticated(true);
        } else {
          console.log('Token expired, logging out...');
          setIsAuthenticated(false);
          setTokens(null);
          setUserEmail(null);
        }
      } else {
        console.log('No valid tokens found');
        setIsAuthenticated(false);
        setTokens(null);
        setUserEmail(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setTokens(null);
      setUserEmail(null);
    } finally {
      console.log('Auth check completed, setting loading to false');
      setLoading(false);
    }
  };

  // トークンのリフレッシュ（内部用）
  const refreshTokenInternal = async (_currentTokens: AuthTokens): Promise<void> => {
    try {
      // TODO: Cognitoのrefresh tokenを使用してアクセストークンを更新
      // 現在は基本実装として期限切れの場合はログアウト
      await logout();
    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
    }
  };

  // トークンのリフレッシュ（外部用）
  const refreshToken = async (): Promise<void> => {
    if (!tokens) return;
    await refreshTokenInternal(tokens);
  };

  // ログイン
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const result = await invoke('login_user', {
        email: email,
        password: password
      }) as {
        access_token: string;
        refresh_token: string;
        id_token: string;
        token_type: string;
        expires_in: number;
      };

      const newTokens: AuthTokens = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        id_token: result.id_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        expires_at: Date.now() + (result.expires_in * 1000),
        user_email: email
      };

      // トークンを保存
      const store = await load('auth.json');
      await store.set('tokens', newTokens);
      await store.save();

      setTokens(newTokens);
      setUserEmail(email);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // ログアウト
  const logout = async (): Promise<void> => {
    try {
      // ストアからトークンを削除
      const store = await load('auth.json');
      await store.delete('tokens');
      await store.save();

      setTokens(null);
      setUserEmail(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
      // エラーが発生してもローカル状態はリセット
      setTokens(null);
      setUserEmail(null);
      setIsAuthenticated(false);
    }
  };

  // 初回マウント時に認証状態をチェック
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // 定期的にトークンの有効期限をチェック
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (isTokenExpired()) {
        console.log('Token expired, logging out...');
        logout();
      }
    }, 60000); // 1分間隔でチェック

    return () => clearInterval(interval);
  }, [isAuthenticated, tokens]);

  const value: AuthContextType = {
    isAuthenticated,
    tokens,
    userEmail,
    login,
    logout,
    checkAuthStatus,
    isTokenExpired,
    refreshToken,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};