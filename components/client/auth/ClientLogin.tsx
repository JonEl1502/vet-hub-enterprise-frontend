import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import ClientAuthShell from './ClientAuthShell';

const ClientLogin: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/client', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not sign in. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClientAuthShell
      title="Welcome back"
      subtitle="Sign in to manage your pets, appointments and invoices."
      footer={<>New here? <Link to="/client/signup" className="cp-accent-text font-bold">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="cp-label">Email</label>
          <input className="cp-input" type="email" autoComplete="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="cp-label">Password</label>
          <div className="relative">
            <input className="cp-input" style={{ paddingRight: '2.5rem' }} type={showPw ? 'text' : 'password'}
                   autoComplete="current-password" value={password}
                   onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cp-muted">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {error && <p className="text-sm font-semibold" style={{ color: '#c0392b' }}>{error}</p>}
        <button type="submit" className="cp-btn w-full" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
        </button>
      </form>
    </ClientAuthShell>
  );
};

export default ClientLogin;
