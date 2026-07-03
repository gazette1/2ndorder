import { useState, type FormEvent } from 'react';

interface Props {
  onSignIn: (email: string) => Promise<unknown>;
}

export function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="login-kicker">Adoption Chain</div>
        <h1 className="login-title">Sign in to search.</h1>
        <label className="login-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="login-input mono"
          type="email"
          autoComplete="email"
          placeholder="you@firm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="login-btn" disabled={busy || !email.trim()}>
          {busy ? 'Signing in.' : 'Sign in'}
        </button>
        {error && <p className="login-error">{error}</p>}
        <p className="login-note">
          Session is mocked for this scaffold. Production uses Supabase Auth.
        </p>
      </form>
    </div>
  );
}
