
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import {
  X, User as UserIcon, ShieldCheck, Mail, Calendar,
  Hash, BadgeCheck, GraduationCap, ArrowRight, Save,
  Trash2, Plus, RefreshCw, UserPlus, Edit, Building2
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

  // Filter clinics based on user role
  // SUPER_ADMIN sees all clinics, CLINIC_OWNER sees only their own clinics
  const availableClinics = user?.role === 'SUPER_ADMIN'
    ? clinics
    : clinics.filter(c => {
        const numId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
        return user?.clinicIds?.includes(numId);
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
    certifications: [] as string[], clinicIds: [getDefaultClinicId()]
  });
  const [newCert, setNewCert] = useState('');
  const [avatar, setAvatar] = useState(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`);

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
        clinicIds: [defaultClinicId]
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

  return (
    <div className="fixed inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-4xl w-full p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <header className="flex justify-between items-center mb-10 pb-6 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-seafoam text-white rounded-2xl shadow-lg shadow-seafoam/20">
               {editingStaff ? <Edit size={24}/> : <UserPlus size={24}/>}
             </div>
             <div>
               <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">
                 {editingStaff ? 'Modify Practitioner Node' : 'Register New Practitioner'}
               </h2>
               <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Registry Access & Protocol Definition</p>
             </div>
          </div>
          <button onClick={onCancel} className="p-3 text-slate-400 hover:text-red-500 transition-colors"><X size={28}/></button>
        </header>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           <div className="lg:col-span-4 flex flex-col items-center gap-6">
              <div className="relative group">
                 <img src={avatar} className="w-48 h-48 rounded-[2.5rem] bg-slate-50 dark:bg-zinc-800 border-4 border-slate-100 dark:border-zinc-700 shadow-2xl" alt="" />
                 <button 
                  type="button"
                  onClick={() => setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`)}
                  className="absolute bottom-4 right-4 p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-xl text-seafoam border border-slate-100 dark:border-zinc-700 hover:scale-110 active:scale-95 transition-all"
                 >
                    <RefreshCw size={20}/>
                 </button>
              </div>
              <div className="w-full space-y-2">
                 <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">
                   Clinic Assignment
                 </label>
                 <div className="relative">
                   <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                   <select
                     value={formData.clinicIds[0] || ''}
                     onChange={handleClinicChange}
                     required
                     className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-seafoam/10 appearance-none cursor-pointer"
                   >
                     <option value="" disabled>Select Clinic...</option>
                     {availableClinics.map(c => (
                       <option key={c.id} value={typeof c.id === 'string' ? parseInt(c.id) : c.id}>
                         {c.logo || '🏥'} {c.name}
                       </option>
                     ))}
                   </select>
                 </div>
                 {user?.role === 'CLINIC_OWNER' && (
                   <p className="text-[8px] text-seafoam dark:text-zinc-500 px-1">
                     Defaulted to your first clinic
                   </p>
                 )}
              </div>
           </div>

           <div className="lg:col-span-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Legal Name</label>
                   <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-seafoam/10" placeholder="e.g. Dr. Jane Smith"/>
                   </div>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Email Node</label>
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
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Birth Epoch</label>
                   <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                      <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-seafoam/10"/>
                   </div>
                 </div>
                 <div className="md:col-span-2 space-y-1.5">
                   <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Functional Access Role</label>
                   <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-sm font-black outline-none appearance-none cursor-pointer">
                      <option value={UserRole.VET}>Veterinary Surgeon (VET)</option>
                      <option value={UserRole.STAFF}>Nursing / Support (STAFF)</option>
                      <option value={UserRole.FREELANCER}>Contract Specialist (FREELANCER)</option>
                      <option value={UserRole.CLINIC_OWNER}>Administrator (OWNER)</option>
                   </select>
                 </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-zinc-800">
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

              <div className="pt-10 flex gap-4">
                 <button type="button" onClick={onCancel} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Abort Node</button>
                 <button type="submit" className="flex-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95 transition-all">
                    {editingStaff ? 'Commit Modifications' : 'Initialize Practitioner'}
                 </button>
              </div>
           </div>
        </form>
      </div>
    </div>
  );
};

export default StaffRegistrationView;
