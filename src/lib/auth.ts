import { supabase } from './supabase';
import { User } from './types';

export async function signUp(email: string, phone: string, name: string, password: string, role: 'admin' | 'operator' = 'operator') {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, role }
      }
    });

    if (authError) throw authError;

    if (authData.user) {
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          phone,
          name,
          role
        });

      if (userError) throw userError;
    }

    return { success: true, user: authData.user };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Signup failed' };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }

    if (data.user) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (userError) {
        return {
          success: false,
          error: userError.message || 'Failed to load user profile'
        };
      }

      return { success: true, user: userData };
    }

    return { success: false, error: 'User not found' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { success: false, error: message };
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Logout failed' };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function onAuthStateChange(callback: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    (async () => {
      if (session?.user) {
        const user = await getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    })();
  });

  return data;
}
