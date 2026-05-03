
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Permission, RESTRICTED_ROLES } from '../types';
import {
  X, User as UserIcon, ShieldCheck, Mail, Calendar,
  Hash, BadgeCheck, GraduationCap, ArrowRight, Save, ArrowLeft,
  Trash2, Plus, RefreshCw, UserPlus, Edit, Building2, ChevronDown, Check, ChevronsUpDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../services';

// Use a flexible Clinic interface that works with both API and mock data
interface ClinicOption {
  id: string | number;
  name: string;
  logo?: string;
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

  // Filter clinics based on user role.
  // SUPER_ADMIN sees all clinics; others see only clinics they belong to (via userClinics).
  const availableClinics = user?.role === 'SUPER_ADMIN'
    ? clinics
    : clinics.filter(c => {
        const strId = c.id.toString();
        return user?.userClinics?.some((uc: any) => uc.clinicId?.toString() === strId);
      });

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
  });
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
      const defaultClinicId = editingStaff.clinicIds && editingStaff.clinicIds.length > 0
        ? editingStaff.clinicIds[0]
        : getDefaultClinicId();

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
        clinicIds: [defaultClinicId],
        customPermissions: editingStaff.customPermissions || [],
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least one clinic is selected
    if (formData.clinicIds.length === 0) {
      toast.warning('Please select at least one clinic for this staff member.');
      return;
    }

    const age = formData.dob ? new Date().getFullYear() - new Date(formData.dob).getFullYear() : undefined;
    onSave({ ...formData, age, avatar });
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

  const handleClinicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clinicId = parseInt(e.target.value);
    setFormData({ ...formData, clinicIds: [clinicId] });
  };

  const handleClinicSelect = (clinicId: number) => {
    setFormData({ ...formData, clinicIds: [clinicId] });
    setIsClinicDropdownOpen(false);
  };

  const selectedClinic = availableClinics.find(c => {
    const numId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
    return numId === formData.clinicIds[0];
  });

  return (
    <div className="max-w-4xl mx-auto pb-12 px-1 sm:px-2 animate-in fade-in space-y-4">
      {/* Page header — back button + title row, no modal chrome */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:text-seafoam transition-colors"
        >
          <ArrowLeft size={12} /> Staff
        </button>
        <div className="text-right min-w-0">
          <h1 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">
            {editingStaff ? 'Edit Staff Member' : 'Register New Staff'}
          </h1>
          <p className="text-seafoam/70 dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-0.5">
            Staff Details & Permissions
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full p-4 sm:p-5 rounded-xl shadow-sm">

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
           <div className="lg:col-span-4 flex flex-col items-center gap-3">
              <div className="relative group">
                 <img src={avatar} className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 shadow-md" alt="" />
                 <button
                  type="button"
                  onClick={() => setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`)}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-white dark:bg-zinc-800 rounded-lg shadow-md text-seafoam border border-slate-200 dark:border-zinc-700 hover:scale-110 active:scale-95 transition-all"
                  title="Generate new avatar"
                 >
                    <RefreshCw size={11}/>
                 </button>
              </div>
              <div className="w-full space-y-1" ref={clinicDropdownRef}>
                 <label className="field-label">Clinic Assignment</label>
                 <div className="relative">
                   <button
                     type="button"
                     onClick={() => setIsClinicDropdownOpen(!isClinicDropdownOpen)}
                     className="field-input cursor-pointer flex items-center gap-2 text-left pr-8"
                   >
                     {selectedClinic ? (
                       <>
                         {selectedClinic.logo ? (
                           <img src={selectedClinic.logo} className="w-5 h-5 rounded object-cover flex-shrink-0" alt="" />
                         ) : (
                           <div className="w-5 h-5 rounded bg-seafoam/20 flex items-center justify-center flex-shrink-0">
                             <Building2 size={10} className="text-seafoam" />
                           </div>
                         )}
                         <span className="flex-1 truncate text-pine dark:text-zinc-100">{selectedClinic.name}</span>
                       </>
                     ) : (
                       <>
                         <Building2 size={12} className="text-slate-300 flex-shrink-0" />
                         <span className="flex-1 text-slate-400 dark:text-zinc-500">Select Clinic...</span>
                       </>
                     )}
                     <ChevronDown size={12} className={`text-slate-400 transition-transform flex-shrink-0 absolute right-2.5 top-1/2 -translate-y-1/2 ${isClinicDropdownOpen ? 'rotate-180' : ''}`} />
                   </button>

                   {isClinicDropdownOpen && (
                     <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                       {availableClinics.length === 0 ? (
                         <div className="px-4 py-3 text-xs text-slate-400 dark:text-zinc-500 text-center">No clinics available</div>
                       ) : (
                         availableClinics.map(c => {
                           const numId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
                           const isSelected = numId === formData.clinicIds[0];
                           return (
                             <button
                               key={c.id}
                               type="button"
                               onClick={() => handleClinicSelect(numId)}
                               className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors ${isSelected ? 'bg-seafoam/5 dark:bg-seafoam/10' : ''}`}
                             >
                               {c.logo ? (
                                 <img src={c.logo} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" alt="" />
                               ) : (
                                 <div className="w-7 h-7 rounded-lg bg-seafoam/20 flex items-center justify-center flex-shrink-0">
                                   <Building2 size={13} className="text-seafoam" />
                                 </div>
                               )}
                               <span className="flex-1 truncate text-pine dark:text-zinc-100">{c.name}</span>
                               {isSelected && <Check size={13} className="text-seafoam flex-shrink-0" />}
                             </button>
                           );
                         })
                       )}
                     </div>
                   )}
                 </div>
                 {user?.role === 'CLINIC_OWNER' && (
                   <p className="text-[8px] text-seafoam dark:text-zinc-500 px-1">
                     Defaulted to your first clinic
                   </p>
                 )}
              </div>
           </div>

           <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {/* Name fields — full row */}
                 <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                   <div>
                     <label className="field-label">Title</label>
                     <select
                       value={formData.title}
                       onChange={e => setFormData({...formData, title: e.target.value})}
                       className="field-select"
                     >
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
                 <div>
                   <label className="field-label">Email Address</label>
                   <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13}/>
                      <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="field-input pl-9" placeholder="jane@vethub.com"/>
                   </div>
                 </div>
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
                 <div className="sm:col-span-2">
                   <label className="field-label">Functional Access Role</label>
                   <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="field-select">
                      <option value={UserRole.VET}>Veterinary Surgeon (VET)</option>
                      <option value={UserRole.STAFF}>Nursing / Support (STAFF)</option>
                      <option value={UserRole.FREELANCER}>Contract Specialist (FREELANCER)</option>
                      <option value={UserRole.CLINIC_OWNER}>Administrator (OWNER)</option>
                   </select>
                 </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                 <div className="flex items-center gap-2">
                    <GraduationCap className="text-seafoam" size={13}/>
                    <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Professional Certifications</h3>
                 </div>
                 <div className="flex gap-2">
                    <input
                      value={newCert}
                      onChange={e => setNewCert(e.target.value)}
                      placeholder="Add credential (e.g. Surgical License)..."
                      className="field-input flex-1"
                    />
                    <button type="button" onClick={addCert} className="h-9 px-3 bg-seafoam text-white rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center"><Plus size={14}/></button>
                 </div>
                 {formData.certifications.length > 0 && (
                   <div className="flex flex-wrap gap-1.5 pt-1">
                      {formData.certifications.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded text-[9px] font-black uppercase tracking-wider">
                          {c}
                          <button type="button" onClick={() => removeCert(i)} className="hover:text-red-500"><X size={9}/></button>
                        </div>
                      ))}
                   </div>
                 )}
              </div>

              {/* Custom Permissions — owner-only, only relevant for restricted roles */}
              {['SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER'].includes(user?.role || '') &&
               RESTRICTED_ROLES.includes(formData.role as UserRole) && (
                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-seafoam" size={13} />
                    <div>
                      <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Module Access</h3>
                      <p className="text-[9px] text-slate-400 dark:text-zinc-500">Grant this staff member access to restricted modules.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {Object.entries(Permission).map(([key, value]) => {
                      const checked = formData.customPermissions.includes(value);
                      const label = key.replace('VIEW_', '').replace(/_/g, ' ');
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            const next = checked
                              ? formData.customPermissions.filter(p => p !== value)
                              : [...formData.customPermissions, value];
                            setFormData({ ...formData, customPermissions: next });
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                            checked
                              ? 'bg-seafoam/10 border-seafoam/30 text-seafoam dark:text-seafoam'
                              : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam/30'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-all ${checked ? 'bg-seafoam border-seafoam' : 'border-slate-300 dark:border-zinc-600'}`}>
                            {checked && <Check size={9} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compact action bar */}
              <div className="pt-4 flex gap-2 justify-end border-t border-slate-100 dark:border-zinc-800">
                 <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-500 dark:text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-pine transition-colors">Cancel</button>
                 <button type="submit" className="px-5 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg font-black uppercase text-[10px] tracking-widest shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5">
                    <Save size={12} />
                    {editingStaff ? 'Save Changes' : 'Register Staff'}
                 </button>
              </div>
           </div>
        </form>
      </div>
    </div>
  );
};

export default StaffRegistrationView;
