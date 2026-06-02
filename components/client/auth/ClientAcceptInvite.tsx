import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { clientPortalAPI } from '../../../services';
import ClientAuthShell from './ClientAuthShell';

// Landing page for the emailed invite link (/client/accept-invite?token=…).
// The owner sets a password (if their email isn't already registered) and is
// linked to the clinic's existing Client record, then logged straight in.
const ClientAcceptInvite: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('This invite link is missing its token. Please use the link from your email.');
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await clientPortalAPI.acceptInvite({ token, password: password || undefined });
      await signup(res.data);
      navigate('/client', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not accept this invite. The link may have expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClientAuthShell
      title="Set up your portal"
      subtitle="You've been invited by your clinic. Choose a password to finish."
      footer={<>Already set up? <Link to="/client/login" className="cp-accent-text font-bold">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="cp-label">Choose a password</label>
          <div className="relative">
            <input className="cp-input" style={{ paddingRight: '2.5rem' }} type={showPw ? 'text' : 'password'}
                   autoComplete="new-password" value={password}
                   onChange={(e) => setPassword(e.target.value)} minLength={8} required={!!token} />
            <button type="button" onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cp-muted">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs cp-muted mt-1">At least 8 characters. If you already have an account, just sign in instead.</p>
        </div>
        {error && <p className="text-sm font-semibold" style={{ color: '#c0392b' }}>{error}</p>}
        <button type="submit" className="cp-btn w-full" disabled={busy || !token}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activate my portal'}
        </button>
      </form>
    </ClientAuthShell>
  );
};

export default ClientAcceptInvite;
