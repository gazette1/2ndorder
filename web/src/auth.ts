// Session client. The server issues HMAC-signed tokens and enforces the email
// allowlist; this stores the session in localStorage under 'ac_session'.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ac_session';

export interface Session {
  token: string;
  email: string;
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (parsed && typeof parsed.token === 'string' && typeof parsed.email === 'string') {
      return { token: parsed.token, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

export function storeSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function postLogin(path: string, body: Record<string, string>): Promise<Session> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Sign in failed with status ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      // non-JSON error body; keep the status message
    }
    throw new Error(message);
  }
  const data = (await res.json()) as Session;
  const session: Session = { token: data.token, email: data.email };
  storeSession(session);
  return session;
}

// POST /api/login. The server checks the allowlist and returns a signed token.
export async function login(email: string): Promise<Session> {
  return postLogin('/api/login', { email });
}

// Google Identity Services hands the button an ID token; the server verifies
// it and issues the same session as email login.
export async function loginWithGoogle(credential: string): Promise<Session> {
  return postLogin('/api/login/google', { credential });
}

// Whether the server has Google sign-in configured (null client id = hidden).
export async function googleClientId(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth-config');
    if (!res.ok) return null;
    const data = (await res.json()) as { googleClientId?: string | null };
    return data.googleClientId ?? null;
  } catch {
    return null;
  }
}

// Small hook: current session plus sign in and sign out helpers.
export function useSession() {
  const [session, setSession] = useState<Session | null>(() => readSession());

  useEffect(() => {
    // Keep tabs in sync if the session changes elsewhere.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSession(readSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signIn = useCallback(async (email: string) => {
    const s = await login(email);
    setSession(s);
    return s;
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  // Re-read localStorage after an out-of-band login (the Google button stores
  // the session itself; a same-tab write fires no storage event).
  const refresh = useCallback(() => {
    setSession(readSession());
  }, []);

  return { session, signIn, signOut, refresh };
}
