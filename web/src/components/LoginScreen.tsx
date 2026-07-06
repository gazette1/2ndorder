import { useEffect, useRef, useState, type FormEvent } from 'react';
import { googleClientId, loginWithGoogle } from '../auth';

interface Props {
  onSignIn: (email: string) => Promise<unknown>;
  onSession?: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function LoginScreen({ onSignIn, onSession }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleRef = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);

  // Google sign-in renders only when the server has a client id configured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clientId = await googleClientId();
      if (!clientId || cancelled) return;
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => {
        if (cancelled || !window.google || !googleRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (r) => {
            setError(null);
            try {
              await loginWithGoogle(r.credential);
              onSession?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          },
        });
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
        setGoogleReady(true);
      };
      document.head.appendChild(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [onSession]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSignIn(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="wordmark login-wordmark">Corollary</div>
        <h1 className="login-title">Sign in to search.</h1>
        <label className="login-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="login-input mono"
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="you@firm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="login-btn" disabled={busy || !email.trim()}>
          {busy ? 'Signing in.' : 'Sign in'}
        </button>
        <div className="login-google" ref={googleRef} style={googleReady ? undefined : { display: 'none' }} />
        {error && <p className="login-error">{error}</p>}
        <p className="login-note">
          Research preview. Access is limited to invited emails.
        </p>
      </form>
    </div>
  );
}
