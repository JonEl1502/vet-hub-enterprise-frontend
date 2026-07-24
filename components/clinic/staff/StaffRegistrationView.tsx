
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Permission, RESTRICTED_ROLES } from '../../../types';
import {
  X, User as UserIcon, ShieldCheck, Mail, Calendar,
  Hash, BadgeCheck, GraduationCap, ArrowRight, Save, ArrowLeft,
  Trash2, Plus, RefreshCw, UserPlus, Edit, Building2, ChevronDown, Check, ChevronsUpDown,
  Lock, Eye, EyeOff, LayoutGrid, KeyRound
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '../../../services';
import { ROLE_META, roleLabel, ASSIGNABLE_ROLE_GROUPS, ROLE_DEFAULT_PAGES, PAGE_ACCESS_ITEMS } from '../../../constants/roles';
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../../../constants/permissions';

// Use a flexible Clinic interface that works with both API and mock data
interface ClinicOption {
  id: string | number;
  name: string;
  logo?: string;
  parentClinicId?: string | number | null;
}

interface Props {
  onSave: (data: Partial<User>) => void;
  onCancel: () => void;
  clinics: ClinicOption[];
  editingStaff?: User | null;
}

const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Eng', 'Hon', 'Sir', 'Maj', 'Capt', 'Col'];

const StaffRegistrationView: React.FC<Props> = ({ onSave, onCancel, clinics, editingStaff }) => {
  const { user } = useAuth();

  // Filter clinics based on user role. SUPER_ADMIN sees everything;
  // CLINIC_OWNER sees direct memberships AND every child branch underneath
  // (subscriptions cascade — userClinics only records the parent), so child
  // branches show up too. Other roles see only direct memberships.
  const availableClinics = React.useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') return clinics;
    const memberIds = new Set((user?.userClinics || []).map((uc: any) => uc.clinicId?.toString()));
    return clinics.filter(c => {
      const strId = c.id.toString();
      if (memberIds.has(strId)) return true;
      const parentId = c.parentClinicId?.toString();
      return !!parentId && memberIds.has(parentId);
    });
  }, [clinics, user]);

  // Get default clinic ID (first clinic owned by current user)
  const getDefaultClinicId = () => {
    if (editingStaff && editingStaff.clinicIds && editingStaff.clinicIds.length > 0) {
      return editingStaff.clinicIds[0];
    }
    // For new staff, default to the first available clinic
    if (availableClinics.length > 0) {
      const firstClinicId = availableClinics[0].id;
      return typeof firstClinicId === 'string' ? parseInt(firstClinicId) : firstClinicId;
    }
    return 0;
  };

  const [formData, setFormData] = useState({
    title: '', firstName: '', secondName: '', surname: '',
    email: '', role: UserRole.STAFF, idNumber: '', dob: '',
    certifications: [] as string[], clinicIds: [getDefaultClinicId()],
    customPermissions: [] as string[],
    // Admin-set login password (create only). Blank = backend generates one.
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [newCert, setNewCert] = useState('');
  const [avatar, setAvatar] = useState(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`);
  const [isClinicDropdownOpen, setIsClinicDropdownOpen] = useState(false);
  const clinicDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clinicDropdownRef.current && !clinicDropdownRef.current.contains(e.target as Node)) {
        setIsClinicDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (editingStaff) {
      // Preserve every clinic this user is currently assigned to — the
      // owner may have spread a manager across several branches and we
      // shouldn't silently drop the extras.
      const assigned = editingStaff.clinicIds && editingStaff.clinicIds.length > 0
        ? editingStaff.clinicIds
        : [getDefaultClinicId()];

      setFormData({
        title: editingStaff.title || '',
        firstName: editingStaff.firstName || '',
        secondName: editingStaff.secondName || '',
        surname: editingStaff.surname || '',
        email: editingStaff.email,
        role: editingStaff.role,
        idNumber: editingStaff.idNumber || '',
        dob: editingStaff.dob || '',
        certifications: editingStaff.certifications || [],
        clinicIds: assigned,
        customPermissions: editingStaff.customPermissions || [],
        password: '',
      });
      setAvatar(editingStaff.avatar);
    } else {
      // For new staff, ensure first clinic is selected
      setFormData(prev => ({
        ...prev,
        clinicIds: [getDefaultClinicId()]
      }));
    }
  }, [editingStaff]);

  // Who can edit access? Owners/admins can grant custom permissions; the
  // backend enforces customPermissions as owner-only, so managers only pick
  // a role (and its preset applies server-side via role defaults).
  const isPrivileged = ['SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER'].includes(user?.role || '');
  const canEditAccess = isPrivileged && RESTRICTED_ROLES.includes(formData.role as UserRole);

  // Picking a role reseeds the page-access preset for that role. Existing
  // granular extras (lowercase ids) are preserved; only the coarse VIEW_*
  // page tokens are replaced so the checkboxes reflect the new role.
  const changeRole = (role: UserRole) => {
    setFormData(prev => {
      const granularExtras = prev.customPermissions.filter(p => !p.startsWith('VIEW_'));
      const pagePreset = (ROLE_DEFAULT_PAGES[role] || []) as string[];
      return { ...prev, role, customPermissions: [...pagePreset, ...granularExtras] };
    });
  };

  const togglePermission = (value: string) => {
    setFormData(prev => ({
      ...prev,
      customPermissions: prev.customPermissions.includes(value)
        ? prev.customPermissions.filter(p => p !== value)
        : [...prev.customPermissions, value],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least one clinic is selected
    if (formData.clinicIds.length === 0) {
      toast.warning('Please select at least one clinic for this staff member.');
      return;
    }

    const age = formData.dob ? new Date().getFullYear() - new Date(formData.dob).getFullYear() : undefined;
    // Only send a password on CREATE and only if the admin typed one — blank
    // lets the backend auto-generate; never send it on edit.
    const { password, ...rest } = formData;
    const payload: any = { ...rest, age, avatar };
    if (!editingStaff && password.trim()) payload.password = password.trim();
    // customPermissions is owner-only on the backend — don't send it as a
    // manager (would 403 on edit); the role's server-side defaults still apply.
    if (!isPrivileged) delete payload.customPermissions;
    onSave(payload);
  };

  const addCert = () => {
    if (newCert.trim()) {
      setFormData({ ...formData, certifications: [...formData.certifications, newCert.trim()] });
      setNewCert('');
    }
  };

  const removeCert = (idx: number) => {
    setFormData({ ...formData, certifications: formData.certifications.filter((_, i) => i !== idx) });
  };

  // Single-clinic assignment. A staff member belongs to exactly one clinic
  // (or branch) at a time; switching here moves them, it doesn't add.
  const handleClinicSelect = (clinicId: number) => {
    setFormData(prev => ({ ...prev, clinicIds: [clinicId] }));
    setIsClinicDropdownOpen(false);
  };

  const selectedClinic = React.useMemo(() =>
    availableClinics.find(c => {
      const numId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
      return formData.clinicIds[0] === numId;
    }),
  [availableClinics, formData.clinicIds]);

  const triggerLabel = selectedClinic?.name ?? 'Select a clinic…';

  // Section heading — compact, used to divide the single card into zones.
  const Section: React.FC<{ icon: React.ElementType; title: string; hint?: string; right?: React.ReactNode }> = ({ icon: Icon, title, hint, right }) => (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="text-seafoam shrink-0" size={13} />
        <div className="min-w-0">
          <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest leading-none">{title}</h3>
          {hint && <p className="text-[8px] text-slate-400 dark:text-zinc-500 leading-tight mt-0.5">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );

  const divider = <div className="border-t border-slate-100 dark:border-zinc-800" />;
  const showOwner = ['SUPER_ADMIN', 'MERCHANT_ADMIN'].includes(user?.role || '');
  const roleDefaultGranular = ROLE_DEFAULT_PERMISSIONS[formData.role as UserRole] || [];
  const permsByCategory = ALL_PERMISSIONS.reduce((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {} as Record<string, typeof ALL_PERMISSIONS>);

  return (
    <div className="space-y-4 pb-24 animate-in fade-in">
      {/* Page header — square back button + title */}
      <header className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={onCancel}
          className="w-10 h-10 sm:w-11 sm:h-11 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-sm active:scale-95 shrink-0"
          title="Back to staff"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">
              {editingStaff ? 'Edit Staff' : 'New Staff Member'}
            </h1>
            <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest truncate">
              Identity · Role · Access — one form
            </p>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
            editingStaff
              ? 'bg-amber-400/20 text-amber-600 dark:text-amber-300'
              : 'bg-emerald-400/20 text-emerald-600 dark:text-emerald-300'
          }`}>
            {editingStaff ? 'Editing' : 'New'}
          </span>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        {/* ── ONE consolidated card ─────────────────────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">

          {/* Identity */}
          <section>
            <Section icon={UserIcon} title="Identity" />
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative group">
                  <img src={avatar} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 shadow-md" alt="" />
                  <button
                    type="button"
                    onClick={() => setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`)}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-white dark:bg-zinc-800 rounded-lg shadow-md text-seafoam border border-slate-200 dark:border-zinc-700 hover:scale-110 active:scale-95 transition-all"
                    title="Generate new avatar"
                  >
                    <RefreshCw size={11}/>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 w-full">
                <div>
                  <label className="field-label">Title</label>
                  <select value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="field-select">
                    {TITLES.map(t => <option key={t} value={t}>{t || '—'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">First Name *</label>
                  <input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="field-input" placeholder="Jane"/>
                </div>
                <div>
                  <label className="field-label">Second Name</label>
                  <input value={formData.secondName} onChange={e => setFormData({...formData, secondName: e.target.value})} className="field-input" placeholder="Mary"/>
                </div>
                <div>
                  <label className="field-label">Surname *</label>
                  <input required value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} className="field-input" placeholder="Smith"/>
                </div>
              </div>
            </div>
          </section>

          {divider}

          {/* Contact & Identification */}
          <section>
            <Section icon={Mail} title="Contact & Identification" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="field-label">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13}/>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="field-input pl-9" placeholder="name@example.com"/>
                </div>
              </div>
              {!editingStaff && (
                <div>
                  <label className="field-label">Login Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13}/>
                    <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="field-input pl-9 pr-9" placeholder="Blank = auto-generate" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine">
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="field-label">ID / Passport Number</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13}/>
                  <input value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} className="field-input pl-9" placeholder="TX-990022-B"/>
                </div>
              </div>
              <div>
                <label className="field-label">Date of Birth</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13}/>
                  <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="field-input pl-9"/>
                </div>
              </div>
            </div>
          </section>

          {divider}

          {/* Assignment + Role picker */}
          <section>
            <Section icon={Building2} title="Assignment & Role" hint="Where they work and what they do." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
              <div ref={clinicDropdownRef}>
                <label className="field-label">Clinic Assignment *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsClinicDropdownOpen(!isClinicDropdownOpen)}
                    className="field-input cursor-pointer flex items-center gap-2 text-left pr-8 w-full"
                  >
                    <Building2 size={12} className={`${selectedClinic ? 'text-seafoam' : 'text-slate-300'} flex-shrink-0`} />
                    <span className={`flex-1 truncate ${selectedClinic ? 'text-pine dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'}`}>{triggerLabel}</span>
                    <ChevronDown size={12} className={`text-slate-400 transition-transform flex-shrink-0 absolute right-2.5 top-1/2 -translate-y-1/2 ${isClinicDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isClinicDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                      {availableClinics.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 dark:text-zinc-500 text-center">No clinics available</div>
                      ) : (
                        availableClinics.map(c => {
                          const numId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
                          const isSelected = formData.clinicIds[0] === numId;
                          const isBranch = !!c.parentClinicId;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleClinicSelect(numId)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-slate-50 dark:border-zinc-800/40 first:border-t-0 ${isSelected ? 'bg-seafoam/5 dark:bg-seafoam/10' : ''}`}
                            >
                              {c.logo ? (
                                <img src={c.logo} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" alt="" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-seafoam/20 flex items-center justify-center flex-shrink-0">
                                  <Building2 size={13} className="text-seafoam" />
                                </div>
                              )}
                              <span className="flex-1 truncate text-pine dark:text-zinc-100">{c.name}</span>
                              {isBranch && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">Branch</span>
                              )}
                              {isSelected && <Check size={13} className="text-seafoam flex-shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-end">
                <p className="text-[9px] text-slate-400 dark:text-zinc-500 leading-tight">
                  Ownership is admin-only, via a documented clinic transfer. Picking a role below reseeds a sensible page-access preset you can fine-tune.
                </p>
              </div>
            </div>

            {/* Grouped role chips — OR a locked state when the person is the
                clinic owner (ownership is only transferable via the documented
                admin process, never re-picked here). */}
            {editingStaff?.role === UserRole.CLINIC_OWNER ? (
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
                <Lock size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Clinic Owner — role locked</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-snug mt-0.5">
                    The owner's role can't be changed here. Ownership moves only through a documented clinic transfer (signed transfer + advocate affidavit) handled by VetHub admin.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {ASSIGNABLE_ROLE_GROUPS.map(({ group, roles }) => {
                  // CLINIC_OWNER is never a pickable chip — assigning ownership is
                  // an admin-only transfer, not a role toggle.
                  const roleList = roles;
                  return (
                    <div key={group}>
                      <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">{group}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {roleList.map(role => {
                          const meta = ROLE_META[role];
                          const selected = formData.role === role;
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => changeRole(role)}
                              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-all ${
                                selected
                                  ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-pine dark:border-zinc-100 shadow-sm'
                                  : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam/50'
                              }`}
                            >
                              {meta?.label || roleLabel(role)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Access editor — owner/admin only, and only for restricted roles */}
          {canEditAccess && (
            <>
              {divider}
              <section>
                <Section icon={LayoutGrid} title="Page Access" hint="Which gated sections show in this person's sidebar. Inventory, visits, patients, petshop & clinical modules are open to all staff." />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                  {PAGE_ACCESS_ITEMS.map(({ token: value, label }) => {
                    const checked = formData.customPermissions.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => togglePermission(value)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all ${
                          checked
                            ? 'bg-seafoam/10 border-seafoam/40 text-seafoam'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam/30'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded flex items-center justify-center shrink-0 border ${checked ? 'bg-seafoam border-seafoam' : 'border-slate-300 dark:border-zinc-600'}`}>
                          {checked && <Check size={8} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wide truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {divider}
              <section>
                <Section
                  icon={KeyRound}
                  title="Permissions"
                  hint="Role defaults are locked on. Toggle extras to grant more."
                  right={<span className="text-[8px] font-black text-slate-400 uppercase tracking-widest shrink-0">{roleLabel(formData.role)}</span>}
                />
                <div className="space-y-3">
                  {Object.entries(permsByCategory).map(([category, perms]) => (
                    <div key={category}>
                      <p className="text-[8px] font-black text-seafoam uppercase tracking-widest mb-1.5">{category}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                        {perms.map(perm => {
                          const isRoleDefault = roleDefaultGranular.includes(perm.id);
                          const isExtra = formData.customPermissions.includes(perm.id);
                          const checked = isRoleDefault || isExtra;
                          return (
                            <button
                              key={perm.id}
                              type="button"
                              disabled={isRoleDefault}
                              onClick={() => togglePermission(perm.id)}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all ${
                                isRoleDefault
                                  ? 'bg-seafoam/10 border-seafoam/30 text-seafoam cursor-not-allowed opacity-90'
                                  : isExtra
                                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300'
                                    : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam/30'
                              }`}
                            >
                              <span className={`w-3 h-3 rounded flex items-center justify-center shrink-0 border ${checked ? 'bg-current border-current' : 'border-slate-300 dark:border-zinc-600'}`}>
                                {checked && <Check size={8} className="text-white dark:text-zinc-900" strokeWidth={3} />}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-wide truncate">{perm.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {divider}

          {/* Certifications */}
          <section>
            <Section icon={GraduationCap} title="Professional Certifications" />
            <div className="flex gap-2">
              <input
                value={newCert}
                onChange={e => setNewCert(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCert(); } }}
                placeholder="Add credential (e.g. Surgical License)..."
                className="field-input flex-1"
              />
              <button type="button" onClick={addCert} className="h-9 px-3 bg-seafoam text-white rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center"><Plus size={14}/></button>
            </div>
            {formData.certifications.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {formData.certifications.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded text-[9px] font-black uppercase tracking-wider">
                    {c}
                    <button type="button" onClick={() => removeCert(i)} className="hover:text-red-500"><X size={9}/></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Action bar */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end sm:items-center pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button type="button" onClick={onCancel} className="px-4 py-2.5 text-slate-500 dark:text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-pine transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg font-black uppercase text-[10px] tracking-widest shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5">
              <Save size={12} />
              {editingStaff ? 'Save Changes' : 'Save Staff Member'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StaffRegistrationView;
