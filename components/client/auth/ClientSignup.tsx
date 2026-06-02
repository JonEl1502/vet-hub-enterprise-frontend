import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { clientPortalAPI, toast, PortalClinic } from '../../../services';
import ClientAuthShell from './ClientAuthShell';
import ClinicFinder from '../ClinicFinder';

// Two-step self-signup: (1) create the account, (2) find & join a clinic so
// the owner's records are tied to a clinic from the start. The account is
// created in step 1 (we get a session), so the join in step 2 is authenticated.
const ClientSignup: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ firstName: '', surname: '', email: '', phone: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      const res = await clientPortalAPI.signup({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        surname: form.surname.trim(),
        phone: form.phone.trim() || undefined,
      });
      await signup(res.data); // sets session
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickClinic = async (clinic: PortalClinic) => {
    setJoiningId(clinic.id);
    try {
      await clientPortalAPI.joinClinic(clinic.id);
      toast.success(`You're connected to ${clinic.name}`);
      navigate('/client', { replace: true });
    } catch {
      setJoiningId(null);
    }
  };

  if (step === 2) {
    return (
      <ClientAuthShell
        title="Find your clinic"
        subtitle="Connect to the clinic that cares for your pets. You can add more later."
        footer={<button className="cp-accent-text font-bold" onClick={() => navigate('/client', { replace: true })}>Skip for now</button>}
      >
        <ClinicFinder onPick={pickClinic} ctaLabel="Connect" busyClinicId={joiningId} />
      </ClientAuthShell>
    );
  }

  return (
    <ClientAuthShell
      title="Create your account"
      subtitle="Manage your pets, appointments and invoices in one place."
      footer={<>Already have an account? <Link to="/client/login" className="cp-accent-text font-bold">Sign in</Link></>}
    >
      <form onSubmit={createAccount} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cp-label">First name</label>
            <input className="cp-input" value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div>
            <label className="cp-label">Surname</label>
            <input className="cp-input" value={form.surname} onChange={set('surname')} required />
          </div>
        </div>
        <div>
          <label className="cp-label">Email</label>
          <input className="cp-input" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className="cp-label">Phone <span className="font-normal lowercase">(optional)</span></label>
          <input className="cp-input" type="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <label className="cp-label">Password</label>
          <div className="relative">
            <input className="cp-input" style={{ paddingRight: '2.5rem' }} type={showPw ? 'text' : 'password'}
                   autoComplete="new-password" value={form.password} onChange={set('password')} required minLength={8} />
            <button type="button" onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cp-muted">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs cp-muted mt-1">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm font-semibold" style={{ color: '#c0392b' }}>{error}</p>}
        <button type="submit" className="cp-btn w-full" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
    </ClientAuthShell>
  );
};

export default ClientSignup;
