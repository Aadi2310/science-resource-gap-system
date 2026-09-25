import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { apiMode } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FormField, Notice } from '../components/Shared';
import type { Role } from '../types';

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(apiMode === 'mock' ? 'district.office@gov.example' : '');
  const [password, setPassword] = useState(apiMode === 'mock' ? 'Demonstration2026' : '');
  const [role, setRole] = useState<Role>('ADMIN');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const session = await signIn(email, password, role);
      const from = (location.state as { from?: string } | null)?.from;
      const landing = session.role === 'NGO' ? '/priorities' : session.role === 'SCHOOL' ? '/schools' : session.role === 'FIELD_COORDINATOR' ? '/assessments' : '/dashboard';
      navigate(from || landing, { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in could not be completed.'); }
    finally { setBusy(false); }
  }

  return <main className="login-page">
    <a className="skip-link" href="#login-form">Skip to sign-in form</a>
    <header className="login-header"><div className="department-mark" aria-label="Department identity placeholder">DEPT</div><div><p className="department-name">Department of School Education</p><p className="system-name">Science Resource Gap System</p></div></header>
    <section className="login-panel" aria-labelledby="login-heading">
      <h1 id="login-heading">Sign in</h1>
      <p className="muted">Use your authorised government or organisation account.</p>
      {apiMode === 'mock' && <Notice>Demonstration mode is active. Enter any email and password, then select a role to view the portal.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <form id="login-form" onSubmit={submit} className="form-stack">
        <FormField label="Email address" htmlFor="email"><input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
        <FormField label="Password" htmlFor="password"><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>
        {apiMode === 'mock' && <FormField label="Demonstration role" htmlFor="role"><select id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="ADMIN">Administrator</option><option value="FIELD_COORDINATOR">Field Coordinator</option><option value="SCHOOL">School Official</option><option value="NGO">Organisation User</option></select></FormField>}
        <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="login-help">Access is restricted to authorised users. For account assistance, contact your system administrator.</p>
    </section>
    <footer className="login-footer">Science Resource Gap System · Government education administration portal</footer>
  </main>;
}
