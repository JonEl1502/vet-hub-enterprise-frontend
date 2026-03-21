
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Permission, RESTRICTED_ROLES } from '../types';
import {
  X, User as UserIcon, ShieldCheck, Mail, Calendar,
  Hash, BadgeCheck, GraduationCap, ArrowRight, Save,
  Trash2, Plus, RefreshCw, UserPlus, Edit, Building2, ChevronDown, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
    name: '', email: '', role: UserRole.STAFF, idNumber: '', dob: '',
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
        name: editingStaff.name,
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
      alert('Please select at least one clinic for this staff member.');
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
    <div className="fixed inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl z-[1000] flex items-start sm:items-center justify-center p-2 sm:p-6 animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-4xl w-full p-4 sm:p-6 lg:p-10 rounded-2xl sm:rounded-[3rem] shadow-2xl animate-in zoom-in-95 max-h-[98vh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar my-auto">
        <header className="flex justify-between items-center mb-5 sm:mb-10 pb-4 sm:pb-6 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
             <div className="p-2 sm:p-3 bg-seafoam text-white rounded-xl sm:rounded-2xl shadow-lg shadow-seafoam/20 shrink-0">
               {editingStaff ? <Edit size={18} className="sm:hidden" /> : <UserPlus size={18} className="sm:hidden" />}
               {editingStaff ? <Edit size={24} className="hidden sm:block" /> : <UserPlus size={24} className="hidden sm:block" />}
             </div>
             <div>
               <h2 className="text-base sm:text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">
                 {editingStaff ? 'Edit Staff Member' : 'Register New Staff'}
               </h2>
               <p className="text-seafoam dark:text-zinc-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mt-0.5 sm:mt-1">Staff Details & Permissions</p>
             </div>
          </div>
          <button onClick={onCancel} className="p-2 sm:p-3 text-slate-400 hover:text-red-500 transition-colors shrink-0"><X size={20} className="sm:hidden" /><X size={28} className="hidden sm:block" /></button>
        </header>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-10">
           <div className="lg:col-span-4 flex flex-col items-center gap-4 sm:gap-6">
              <div className="relative group">
                 <img src={avatar} className="w-28 h-28 sm:w-48 sm:h-48 rounded-2xl sm:rounded-[2.5rem] bg-slate-50 dark:bg-zinc-800 border-4 border-slate-100 dark:border-zinc-700 shadow-2xl" alt="" />
                 <button 
                  type="button"
                  onClick={() => setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`)}
                  className="absolute bottom-4 right-4 p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-xl text-seafoam border border-slate-100 dark:border-zinc-700 hover:scale-110 active:scale-95 transition-all"
                 >
                    <RefreshCw size={20}/>
                 </button>
              </div>
              <div className="w-full space-y-2" ref={clinicDropdownRef}>
                 <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">
                   Clinic Assignment
                 </label>
                 <div className="relative">
                   <button
                     type="button"
                     onClick={() => setIsClinicDropdownOpen(!isClinicDropdownOpen)}
                     className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-seafoam/10 cursor-pointer flex items-center gap-3 text-left"
                   >
                     {selectedClinic ? (
                       <>
                         {selectedClinic.logo ? (
                           <img src={selectedClinic.logo} className="w-6 h-6 rounded-lg object-cover flex-shrink-0" alt="" />
                         ) : (
                           <div className="w-6 h-6 rounded-lg bg-seafoam/20 flex items-center justify-center flex-shrink-0">
                             <Building2 size={12} className="text-seafoam" />
                           </div>
                         )}
                         <span className="flex-1 truncate text-pine dark:text-zinc-100">{selectedClinic.name}</span>
                       </>
                     ) : (
                       <>
                         <Building2 size={16} className="text-slate-300 flex-shrink-0" />
                         <span className="flex-1 text-slate-400 dark:text-zinc-500">Select Clinic...</span>
                       </>
                     )}
                     <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ${isClinicDropdownOpen ? 'rotate-180' : ''}`} />
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

           <div className="lg:col-span-8 space-y-5 sm:space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Legal Name</label>
                   <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-seafoam/10" placeholder="e.g. Dr. Jane Smith"/>
                   </div>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Email Address</label>
                   <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                      <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-seafoam/10" placeholder="jane@vethub.com"/>
                   </div>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">ID / Passport Number</label>
                   <div className="relative group">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                      <input value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-seafoam/10" placeholder="TX-990022-B"/>
                   </div>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Date of Birth</label>
                   <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                      <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-seafoam/10"/>
                   </div>
                 </div>
                 <div className="sm:col-span-2 space-y-1.5">
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Functional Access Role</label>
                   <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-sm font-black outline-none appearance-none cursor-pointer">
                      <option value={UserRole.VET}>Veterinary Surgeon (VET)</option>
                      <option value={UserRole.STAFF}>Nursing / Support (STAFF)</option>
                      <option value={UserRole.FREELANCER}>Contract Specialist (FREELANCER)</option>
                      <option value={UserRole.CLINIC_OWNER}>Administrator (OWNER)</option>
                   </select>
                 </div>
              </div>

              <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 border-t border-slate-100 dark:border-zinc-800">
                 <div className="flex items-center gap-3">
                    <GraduationCap className="text-seafoam" size={18}/>
                    <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Professional Certifications</h3>
                 </div>
                 <div className="flex gap-2">
                    <input 
                      value={newCert} 
                      onChange={e => setNewCert(e.target.value)} 
                      placeholder="Add credential (e.g. Surgical License)..." 
                      className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-sm font-bold outline-none" 
                    />
                    <button type="button" onClick={addCert} className="p-3 bg-seafoam text-white rounded-xl shadow-lg active:scale-95 transition-all"><Plus size={20}/></button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {formData.certifications.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded-lg text-[9px] font-black uppercase">
                        {c}
                        <button type="button" onClick={() => removeCert(i)} className="hover:text-red-500"><X size={10}/></button>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Custom Permissions — owner-only, only relevant for restricted roles */}
              {['SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER'].includes(user?.role || '') &&
               RESTRICTED_ROLES.includes(formData.role as UserRole) && (
                <div className="space-y-3 pt-4 sm:pt-6 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-seafoam" size={18} />
                    <div>
                      <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Module Access</h3>
                      <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5">Grant this staff member access to restricted modules.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${
                            checked
                              ? 'bg-seafoam/10 border-seafoam/30 text-seafoam dark:text-seafoam'
                              : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam/30'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${checked ? 'bg-seafoam border-seafoam' : 'border-slate-300 dark:border-zinc-600'}`}>
                            {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-5 sm:pt-10 flex gap-3 sm:gap-4">
                 <button type="button" onClick={onCancel} className="flex-1 py-3 sm:py-4 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Cancel</button>
                 <button type="submit" className="flex-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95 transition-all">
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
