import React from 'react';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';
import demoRequestsAPI, { DemoRequest } from '../../../services/modules/demoRequests.api';

/**
 * Turn a lead into a real account — the org AND its owner.
 *
 * Shared by the queue and the lead detail page. It lives in one place because
 * of the second half: the temporary password is returned ONCE and the server
 * keeps no readable copy, so a second implementation that forgot to show it,
 * or showed it somewhere easy to dismiss, would cost a password reset every
 * time it was used.
 */

interface Props {
  lead: DemoRequest;
  onClose: () => void;
  /** Fired after the account exists, so the caller can reload its view. */
  onConverted: () => void;
}

const LeadConvertDialog: React.FC<Props> = ({ lead, onClose, onConverted }) => {
  const [type, setType] = React.useState<'CLINIC' | 'FARM'>('CLINIC');
  const [orgName, setOrgName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<{ ownerEmail: string; temporaryPassword: string; orgName: string } | null>(null);

  React.useEffect(() => {
    setOrgName(lead.clinicName || lead.name || '');
    setEmail(lead.email || '');
    // A mobile/farm practice is a FARM account, and the research usually says
    // which — guessing from it saves the commonest correction.
    const seg = `${lead.segment || ''} ${lead.message || ''}`.toLowerCase();
    setType(/farm|livestock|mobile|ambulatory/.test(seg) ? 'FARM' : 'CLINIC');
  }, [lead]);

  const submit = async () => {
    if (!orgName.trim() || !email.trim()) return;
    setBusy(true);
    try {
      const res = await demoRequestsAPI.convert(lead.id, {
        accountType: type,
        orgName: orgName.trim(),
        ownerEmail: email.trim(),
      });
      if (res.success && res.data) {
        setCreated({
          ownerEmail: res.data.ownerEmail,
          temporaryPassword: res.data.temporaryPassword,
          orgName: res.data.orgName,
        });
        onConverted();
      }
    } catch { /* the API layer surfaces its own error (e.g. email already has an account) */ }
    finally { setBusy(false); }
  };

  // CREDENTIALS — shown ONCE. No backdrop click-to-close here, deliberately:
  // dismissing this by accident costs the owner a password reset.
  if (created) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Account created
          </p>
          <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100">{created.orgName}</h2>
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">Copy this now — it is shown once</p>
            <p className="text-xs font-mono text-pine dark:text-zinc-100 break-all">{created.ownerEmail}</p>
            <p className="text-sm font-mono font-black text-pine dark:text-zinc-100 break-all">{created.temporaryPassword}</p>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            There is no readable copy on the server. If this is lost the owner has to reset their password.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard?.writeText(`${created.ownerEmail} / ${created.temporaryPassword}`); toast.success('Copied'); }}
              className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300"
            >
              Copy
            </button>
            <button onClick={onClose} className="flex-1 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[10px] font-black uppercase tracking-widest">Done</button>
          </div>
        </div>
      </div>
    );
  }

  // CONVERT — asks only what the lead cannot tell us: the org's real name,
  // clinic or farm, and the email that becomes the login.
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Create account</p>
        <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100">{lead.clinicName || lead.name}</h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Creates the organisation <strong>and its owner</strong>. The owner logs in with the email below —
          that is why the account is created with theirs, not yours.
        </p>
        <div>
          <label className="field-label">Organisation name</label>
          <input className="field-input" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Mombasani Vets Clinic" />
        </div>
        <div>
          <label className="field-label">Owner email{lead.email ? '' : ' — not on this lead yet'}</label>
          <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@practice.co.ke" />
          {!lead.email && (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">
              This lead was researched without an email. Whatever you enter is saved back onto the lead too.
            </p>
          )}
        </div>
        <div>
          <label className="field-label">Account type</label>
          <div className="flex gap-2">
            {(['CLINIC', 'FARM'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                  type === t ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'
                }`}
              >
                {t === 'CLINIC' ? 'Vet clinic' : 'Farm / livestock'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || !orgName.trim() || !email.trim()}
            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy ? <><Loader2 size={12} className="animate-spin" /> Creating…</> : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadConvertDialog;
