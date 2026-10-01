'use client';
import { useState } from 'react';
import { authRequest } from '../../lib/api/auth';

function consumeLinkToken() {
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  history.replaceState(null, '', location.pathname);
  return token;
}

type Mode =
  'register' | 'login' | 'forgot' | 'reset' | 'verify' | 'mfa' | 'logout';
export function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'register')
        setMessage(
          (await authRequest('register', { email, password })).message,
        );
      if (mode === 'forgot')
        setMessage((await authRequest('password/forgot', { email })).message);
      if (mode === 'reset')
        setMessage(
          (
            await authRequest('password/reset', {
              token: consumeLinkToken(),
              password,
            })
          ).message,
        );
      if (mode === 'verify')
        setMessage(
          (
            await authRequest('email/verify', {
              token: consumeLinkToken(),
            })
          ).message,
        );
      if (mode === 'login') {
        const result = await authRequest('login', { email, password });
        if (result.mfaRequired) {
          sessionStorage.setItem('mfa_challenge', result.challenge);
          sessionStorage.setItem('mfa_setup', String(result.setupRequired));
          location.assign('/mfa');
        } else {
          const session = await authRequest('session', undefined, 'GET');
          location.assign(session.route);
        }
      }
      if (mode === 'mfa') {
        const challenge = sessionStorage.getItem('mfa_challenge');
        if (!challenge) throw new Error('Sign in again');
        await authRequest('mfa/verify', { challenge, code });
        sessionStorage.removeItem('mfa_challenge');
        sessionStorage.removeItem('mfa_setup');
        const session = await authRequest('session', undefined, 'GET');
        location.assign(session.route);
      }
      if (mode === 'logout') {
        await authRequest('logout');
        location.assign('/login');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  async function setup() {
    setBusy(true);
    setMessage('');
    try {
      const challenge = sessionStorage.getItem('mfa_challenge');
      if (!challenge) throw new Error('Sign in again');
      const result = await authRequest('mfa/setup', { challenge });
      setSecret(result.secret);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  const title: Record<Mode, string> = {
    register: 'Create an account',
    login: 'Sign in',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
    verify: 'Verify your email',
    mfa: 'Authenticator code',
    logout: 'Sign out',
  };
  return (
    <main>
      <h1>{title[mode]}</h1>
      {mode === 'mfa' && (
        <>
          <p>Enter a code from your authenticator app.</p>
          <button type="button" disabled={busy} onClick={setup}>
            Set up authenticator
          </button>
          {secret && (
            <p>
              Enter this setup secret in your authenticator:{' '}
              <code>{secret}</code>
            </p>
          )}
        </>
      )}
      <form onSubmit={submit}>
        {['register', 'login', 'forgot'].includes(mode) && (
          <label>
            Email{' '}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
        )}
        {['register', 'login', 'reset'].includes(mode) && (
          <label>
            Password{' '}
            <input
              type="password"
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
        )}
        {mode === 'mfa' && (
          <label>
            Six-digit code{' '}
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </label>
        )}
        <button disabled={busy} type="submit">
          {title[mode]}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <p>
        <a href="/login">Sign in</a> · <a href="/register">Register</a> ·{' '}
        <a href="/forgot-password">Forgot password?</a>
      </p>
    </main>
  );
}
