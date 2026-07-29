import React from 'react';
import toast from 'react-hot-toast';
import { BadgeCheck, ShieldQuestion, Loader2, Send, X } from 'lucide-react';
import { clinicsAPI } from '../../../services';

/**
 * Is this clinic's contact address real? (backend 145)
 *
 * ⚠️ **Informational, not a gate.** Nothing about access depends on it — an
 * unverified clinic works exactly as before. It exists because a self-registered
 * clinic could put any address on file and nothing ever checked: "vethub erp"
 * signed up with verificacao@vethub.com and sat there unchallenged.
 *
 * Two ways to settle it: send a code to the address and have whoever runs that
 * inbox enter it, or — when support has phoned the practice — vouch for it
 * directly, mirroring the admin bypass that already exists for user accounts.
 */

interface Props {
  clinicId: string;
  email: string;
  verified: boolean;
  verifiedAt?: string | null;
  onChanged: (verified: boolean) => void;
}

const ClinicEmailVerify: React.FC<Props> = ({ clinicId, email, verified, verifiedAt, onChanged }) => {
  const [busy, setBusy] = React.useState(false);
  const [entering, setEntering] = React.useState(false);
  const [otp, setOtp] = React.useState('');

  const send = async () => {
    setBusy(true);
    try {
      const res = await clinicsAPI.sendEmailOtp(clinicId);
      if (res.success && res.data?.sent) {
        toast.success(`Code sent to ${res.data.email}`);
        setEntering(true);
      } else {
        // Already verified / no address / on cooldown — the server says which.
        toast(res.data?.reason || res.message || 'Could not send a code');
      }
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp.trim())) { toast.error('Enter the 6-digit code'); return; }
    setBusy(true);
    try {
      const res = await clinicsAPI.verifyEmailOtp(clinicId, otp.trim());
      if (res.success) {
        toast.success('Clinic email verified');
        setEntering(false); setOtp('');
        onChanged(true);
      }
    } finally { setBusy(false); }
  };

  const vouch = async (next: boolean) => {
    setBusy(true);
    try {
      const res = await clinicsAPI.adminSetEmailVerified(clinicId, next);
      if (res.success) {
        toast.success(next ? 'Marked as verified' : 'Verification cleared');
        onChanged(next);
      }
    } finally { setBusy(false); }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{email}</span>

      {verified ? (
        <span
          title={verifiedAt ? `Verified ${new Date(verifiedAt).toLocaleString('en-GB')}` : 'Verified'}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        >
          <BadgeCheck size={11} /> Verified
        </span>
      ) : (
        <span
          title="Nobody has proven this address is reachable. This does not restrict the clinic in any way."
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
        >
          <ShieldQuestion size={11} /> Unverified
        </span>
      )}

      {busy && <Loader2 size={12} className="animate-spin text-slate-400" />}

      {!verified && !entering && !busy && (
        <>
          <button
            onClick={send}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-seafoam hover:bg-seafoam/10 transition-all"
          >
            <Send size={10} /> Send code
          </button>
          <button
            onClick={() => vouch(true)}
            title="Support has confirmed this address out of band — same bypass as user accounts"
            className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-all"
          >
            Vouch
          </button>
        </>
      )}

      {entering && (
        <span className="inline-flex items-center gap-1">
          <input
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => { if (e.key === 'Enter') verify(); }}
            placeholder="000000"
            autoFocus
            className="w-20 px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-mono font-bold tracking-widest text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
          />
          <button
            onClick={verify}
            disabled={busy}
            className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-pine transition-all disabled:opacity-40"
          >
            Verify
          </button>
          <button onClick={() => { setEntering(false); setOtp(''); }} className="text-slate-400 hover:text-pine">
            <X size={12} />
          </button>
        </span>
      )}

      {verified && !busy && (
        <button
          onClick={() => vouch(false)}
          title="Clear the verification — the address changed, or it was vouched for in error"
          className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all"
        >
          Clear
        </button>
      )}
    </span>
  );
};

export default ClinicEmailVerify;
