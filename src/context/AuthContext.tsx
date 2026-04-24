import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User } from '../lib/types';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { startSessionTimeout, resetSessionTimeout, clearSessionTimeout } from '../lib/authUtils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<User | null>(null);

  const handleSessionTimeout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    userRef.current = null;
    clearSessionTimeout();
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (mounted) {
          setUser(currentUser);
          userRef.current = currentUser;
          if (currentUser) {
            startSessionTimeout(handleSessionTimeout);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setUser(null);
          userRef.current = null;
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        if (session?.user) {
          getCurrentUser().then(currentUser => {
            if (mounted) {
              setUser(currentUser);
              userRef.current = currentUser;
              if (currentUser) {
                resetSessionTimeout(handleSessionTimeout);
              }
            }
          });
        } else {
          setUser(null);
          userRef.current = null;
          clearSessionTimeout();
        }
      }
    });

    const handleActivityListener = () => {
      if (userRef.current) {
        resetSessionTimeout(handleSessionTimeout);
      }
    };

    window.addEventListener('click', handleActivityListener);
    window.addEventListener('keydown', handleActivityListener);
    window.addEventListener('mousemove', handleActivityListener);

    return () => {
      mounted = false;
      data?.subscription.unsubscribe();
      window.removeEventListener('click', handleActivityListener);
      window.removeEventListener('keydown', handleActivityListener);
      window.removeEventListener('mousemove', handleActivityListener);
      clearSessionTimeout();
    };
  }, [handleSessionTimeout]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
