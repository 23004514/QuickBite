import { supabase } from '../supabase.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

export const signUp = ({ email, password, fullName }) =>
  supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${location.origin}/login.html`,
    },
  });

export const signIn = ({ email, password }) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const sendPasswordReset = (email) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/reset-password.html`,
  });

export const updatePassword = (password) => supabase.auth.updateUser({ password });

// Only allow same-site relative paths (blocks open redirects like //evil.com).
export function safeNext(value, fallback = '/menu.html') {
  if (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
  ) {
    return value;
  }
  return fallback;
}

// UX guard only. Real protection is Row Level Security in the database.
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login.html?next=${next}`);
    return null;
  }
  return session;
}