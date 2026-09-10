import React, { useMemo, useState } from 'react';
import { X, Loader2, UserCog, Building2, AlertTriangle } from 'lucide-react';
import { usersAPI, toast } from '../../../services';
import type { AdminUserRow } from '../../../services/modules/users.api';

/**
 * Edit one account, as a platform admin.
 *
 * ⭐ ONE DIALOG, TWO MOUNTS (user, 2026-09-10: *"both, sharing one dialog"*).
 * It opens from the Admin → Users directory AND from a clinic's Users tab.
 * Those are genuinely different journeys — the directory reaches accounts with
 * no clinic at all (clients, suppliers, platform staff), the clinic tab reaches
 * them in the context of one org — but the FORM is the same, and two copies of
 * a form that writes roles and clinic membership is two places for the guards
 * to drift apart.
 *
 * ── The server already allowed this ────────────────────────────────────────
 * `PUT /users/:id` has always accepted these fields and platform admins have
 * always passed its guards. The gap was purely that the admin UI rendered no
 * edit control at all — three icon buttons (verify / set password / activate)
 * and nothing else. So this is a form over an endpoint, not a new capability.
 *
 * ⚠️ `name` IS NOT A FIELD. The API composes it from
 * `title firstName secondName surname` on UserProfile; posting `name` writes
 * nothing and silently appears to succeed. This form posts the parts.
 */

/** Roles a platform admin may assign. Mirrors ROLE_OPTIONS minus the ALL filter. */
const ASSIGNABLE_ROLES = [
  'SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER',
  'CLINIC_VIEWER', 'VET', 'STAFF', 'FREELANCER', 'SUPPLIER', 'CLIENT',
];

/** Roles whose whole point is a clinic membership. */
const CLINIC_BOUND = ['CLINIC_OWNER', 'CLINIC_MANAGER', 'CLINIC_VIEWER', 'VET', 'STAFF'];

interface Props {
  user: AdminUserRow;
  /** For the clinic picker. Omit to hide it (e.g. a supplier-only context). */
  clinics?: Array<{ id: string; name: string }>;
  /**
   * The clinic this dialog was opened FROM, when it was opened from an org page.
   * Kept selected and un-removable: detaching someone from the very clinic you
   * are looking at, on a screen that then stops listing them, is a confusing
   * way to lose a member of staff. Detach from the directory instead.
   */
  lockedClinicId?: string;
  /** The signed-in admin, so the form can refuse to lock them out of their own account. */
  currentUserId?: number;
  onClose: () => void;
  onSaved: (updated: AdminUserRow) => void;
}

const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-1.5';
const field = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

const EditUserDialog: React.FC<Props> = ({
  user, clinics = [], lockedClinicId, currentUserId, onClose, onSaved,
}) => {
  const [form, setForm] = useState({
    title: user.title ?? '',
    firstName: user.firstName ?? '',
    secondName: user.secondName ?? '',
    surname: user.surname ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    role: user.role ?? '',
  });
  /**
   * 🔴 `clinicIds` REPLACES THE WHOLE MEMBERSHIP LIST on the server
   * (`deleteMany` then `createMany`). So it may only be sent when this dialog
   * was handed the account's TRUE, COMPLETE membership — anything less and
   * saving silently detaches them from every clinic the form never showed.
   *
   * The directory passes it (its rows carry `clinicIds`); a clinic's Users tab
   * does NOT — those rows are scoped to that one org, so a user belonging to
   * three clinics would look like they belong to one, and pressing Save would
   * make that true. Hence `knowsMemberships`: no list, no picker, and the field
   * is never sent.
   */
  const knowsMemberships = Array.isArray(user.clinicIds);
  const [clinicIds, setClinicIds] = useState<string[]>(() => {
    const initial = user.clinicIds ?? [];
    return lockedClinicId && !initial.includes(lockedClinicId) ? [...initial, lockedClinicId] : initial;
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  /**
   * ⚠️ AN ADMIN MAY NOT CHANGE THEIR OWN ROLE HERE.
   *
   * Demoting yourself out of SUPER_ADMIN is irreversible from inside the app —
   * the page that could put it back is the one you just lost. The server has no
   * opinion on this (it is a legal role change), so it has to be refused here.
   */
  const isSelf = currentUserId != null && Number(user.id) === Number(currentUserId);
  const roleChanged = form.role !== user.role;
  const needsClinic = CLINIC_BOUND.includes(form.role);
  // Mirrors the server's own rule so the refusal arrives before the round trip.
  const managerWithoutClinic = form.role === 'CLINIC_MANAGER' && clinicIds.length === 0;

  const problem = useMemo(() => {
    if (!form.firstName.trim() && !form.surname.trim()) return 'Give the account at least a first name or a surname.';
    if (!form.email.trim()) return 'An email address is required — it is the login.';
    if (isSelf && roleChanged) return 'You cannot change your own role. Ask another admin to do it.';
    if (knowsMemberships && managerWithoutClinic) return 'A Clinic Manager must belong to at least one clinic.';
    return null;
  }, [form, isSelf, roleChanged, managerWithoutClinic, clinicIds.length]);

  const toggleClinic = (id: string) => {
    if (id === lockedClinicId) return;
    setClinicIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const submit = async () => {
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const res = await usersAPI.update(Number(user.id), {
        title: form.title.trim() || null,
        firstName: form.firstName.trim(),
        secondName: form.secondName.trim() || null,
        surname: form.surname.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        // Only send a role that actually MOVED. The server short-circuits an
        // unchanged role anyway (it had to, after the staff form's no-op role
        // tripped every guard), but not sending it at all is clearer.
        ...(roleChanged ? { role: form.role } : {}),
        // Clinic membership is only meaningful for clinic-bound roles, and
        // `clinicIds` REPLACES the whole list — sending it for a supplier would
        // wipe memberships this form never showed.
        ...(knowsMemberships && clinics.length > 0 && needsClinic ? { clinicIds } : {}),
      } as any);
      if (res.success) {
        const composed = [form.title, form.firstName, form.secondName, form.surname]
          .map((s) => s.trim()).filter(Boolean).join(' ');
        toast.success(`Saved ${composed || form.email}`);
        onSaved({ ...user, ...form, name: composed, ...(knowsMemberships ? { clinicIds } : {}) } as AdminUserRow);
        onClose();
      }
    } catch (e: any) {
      // The interceptor already surfaced the server's message; only speak up
      // if nothing did.
      if (!e?.response && !e?.status) toast.error('Could not save the account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pine/10 dark:bg-pine/20 flex items-center justify-center text-pine dark:text-seafoam shrink-0">
            <UserCog size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100">Edit account</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{user.name || user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-pine dark:hover:text-zinc-100"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-1">
            <label className={label}>Title</label>
            <input className={field} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Dr" />
          </div>
          <div className="col-span-3">
            <label className={label}>First name</label>
            <input className={field} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={label}>Second name</label>
            <input className={field} value={form.secondName} onChange={(e) => set('secondName', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={label}>Surname</label>
            <input className={field} value={form.surname} onChange={(e) => set('surname', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Email (the login)</label>
            <input className={field} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input className={field} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={label}>Role</label>
          <select
            className={`${field} disabled:opacity-50`}
            value={form.role}
            disabled={isSelf}
            onChange={(e) => set('role', e.target.value)}
          >
            {/* An unrecognised existing role must still be selectable, or opening
                the dialog would silently reassign it on save. */}
            {!ASSIGNABLE_ROLES.includes(form.role) && form.role && <option value={form.role}>{form.role}</option>}
            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
          {isSelf && (
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
              This is your own account — another admin has to change your role.
            </p>
          )}
        </div>

        {knowsMemberships && clinics.length > 0 && needsClinic && (
          <div>
            <label className={label}><Building2 size={11} className="inline mr-1" /> Clinics</label>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
              {clinics.map((c) => {
                const on = clinicIds.includes(c.id);
                const locked = c.id === lockedClinicId;
                return (
                  <button
                    key={c.id} type="button" onClick={() => toggleClinic(c.id)} disabled={locked}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      on ? 'bg-pine/5 dark:bg-pine/20 text-pine dark:text-seafoam font-bold' : 'hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                    } ${locked ? 'cursor-default opacity-80' : ''}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-pine border-pine text-white' : 'border-slate-300 dark:border-zinc-600'}`}>
                      {on && <span className="text-[9px] leading-none">✓</span>}
                    </span>
                    <span className="truncate">{c.name}</span>
                    {locked && <span className="ml-auto text-[9px] uppercase tracking-widest text-slate-400">this clinic</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {problem && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold">{problem}</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button
            onClick={submit} disabled={saving || !!problem}
            className="flex-1 py-2.5 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={13} className="animate-spin" />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditUserDialog;
