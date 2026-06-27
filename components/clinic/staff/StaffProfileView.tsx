
import React, { useState, useMemo } from 'react';
import { User, UserRole, Clinic, Visit, ApptTask, TaskStatus, ActivityLog } from '../../../types';
import { ShieldCheck, Mail, Calendar, Hash, BadgeCheck, GraduationCap, ArrowLeft, History, BarChart3, ClipboardList, Clock, CheckCircle2, Activity, User as UserIcon, Save, Stethoscope, CalendarCheck, PackageCheck, AlertCircle, CreditCard } from 'lucide-react';
import { usersAPI } from '../../../services/modules/users.api';
import { toast } from '../../../services';

interface Props {
  staff: User;
  clinics: Clinic[];
  appointments: Visit[];
  onBack: () => void;
  onUpdate?: () => void;
}

// Comprehensive permissions list for the system
const ALL_PERMISSIONS = [
  // Visits
  { id: 'view_appointments', label: 'View Visits', category: 'Visits' },
  { id: 'create_appointments', label: 'Create Visits', category: 'Visits' },
  { id: 'edit_appointments', label: 'Edit Visits', category: 'Visits' },
  { id: 'delete_appointments', label: 'Delete Visits', category: 'Visits' },
  { id: 'finalize_appointments', label: 'Finalize Visits', category: 'Visits' },

  // Clients & Pets
  { id: 'view_clients', label: 'View Clients', category: 'Clients & Pets' },
  { id: 'create_clients', label: 'Create Clients', category: 'Clients & Pets' },
  { id: 'edit_clients', label: 'Edit Clients', category: 'Clients & Pets' },
  { id: 'delete_clients', label: 'Delete Clients', category: 'Clients & Pets' },
  { id: 'view_pets', label: 'View Pets', category: 'Clients & Pets' },
  { id: 'create_pets', label: 'Create Pets', category: 'Clients & Pets' },
  { id: 'edit_pets', label: 'Edit Pets', category: 'Clients & Pets' },

  // Medical Records
  { id: 'view_medical_records', label: 'View Medical Records', category: 'Medical' },
  { id: 'create_medical_records', label: 'Create Medical Records', category: 'Medical' },
  { id: 'edit_medical_records', label: 'Edit Medical Records', category: 'Medical' },
  { id: 'view_vaccinations', label: 'View Vaccinations', category: 'Medical' },
  { id: 'manage_vaccinations', label: 'Manage Vaccinations', category: 'Medical' },

  // Inventory
  { id: 'view_inventory', label: 'View Inventory', category: 'Inventory' },
  { id: 'create_inventory', label: 'Create Inventory Items', category: 'Inventory' },
  { id: 'edit_inventory', label: 'Edit Inventory', category: 'Inventory' },
  { id: 'delete_inventory', label: 'Delete Inventory', category: 'Inventory' },
  { id: 'manage_purchase_orders', label: 'Manage Purchase Orders', category: 'Inventory' },

  // Payments & Billing
  { id: 'view_payments', label: 'View Payments', category: 'Payments' },
  { id: 'process_payments', label: 'Process Payments', category: 'Payments' },
  { id: 'view_receipts', label: 'View Receipts', category: 'Payments' },
  { id: 'apply_discounts', label: 'Apply Discounts', category: 'Payments' },

  // Staff & Settings
  { id: 'view_staff', label: 'View Staff', category: 'Staff & Settings' },
  { id: 'manage_staff', label: 'Manage Staff', category: 'Staff & Settings' },
  { id: 'manage_roles', label: 'Manage Roles & Permissions', category: 'Staff & Settings' },
  { id: 'manage_clinic_settings', label: 'Manage Clinic Settings', category: 'Staff & Settings' },
  { id: 'manage_categories', label: 'Manage Categories & Services', category: 'Staff & Settings' },

  // Reports & Analytics
  { id: 'view_reports', label: 'View Reports', category: 'Reports' },
  { id: 'export_data', label: 'Export Data', category: 'Reports' },
];

// Default permissions for each role
const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: ALL_PERMISSIONS.map(p => p.id),
  [UserRole.MERCHANT_ADMIN]: ALL_PERMISSIONS.map(p => p.id),
  [UserRole.CLINIC_OWNER]: ALL_PERMISSIONS.map(p => p.id),
  // Manager mirrors owner ops by default; owner-only powers (subscription,
  // ownership transfer, role promotion to owner/manager, financial reports
  // unless granted) are gated by role string elsewhere — not by permission flags.
  [UserRole.CLINIC_MANAGER]: ALL_PERMISSIONS.map(p => p.id),
  [UserRole.VET]: [
    'view_appointments', 'create_appointments', 'edit_appointments', 'finalize_appointments',
    'view_clients', 'create_clients', 'edit_clients',
    'view_pets', 'create_pets', 'edit_pets',
    'view_medical_records', 'create_medical_records', 'edit_medical_records',
    'view_vaccinations', 'manage_vaccinations',
    'view_inventory',
    'view_payments', 'process_payments', 'view_receipts',
    'view_staff',
  ],
  [UserRole.STAFF]: [
    'view_appointments', 'create_appointments', 'edit_appointments',
    'view_clients', 'create_clients', 'edit_clients',
    'view_pets', 'create_pets', 'edit_pets',
    'view_medical_records',
    'view_inventory',
    'view_payments', 'process_payments', 'view_receipts',
  ],
  [UserRole.FREELANCER]: [
    'view_appointments', 'edit_appointments', 'finalize_appointments',
    'view_clients', 'view_pets',
    'view_medical_records', 'create_medical_records', 'edit_medical_records',
    'view_vaccinations', 'manage_vaccinations',
    'view_inventory',
  ],
  // Viewer is read-only: every "view_*" permission, no write actions.
  [UserRole.CLINIC_VIEWER]: ALL_PERMISSIONS
    .filter(p => p.id.startsWith('view_'))
    .map(p => p.id),
  [UserRole.CLIENT]: [],
  [UserRole.SUPPLIER]: [],
};

const StaffProfileView: React.FC<Props> = ({ staff, clinics, appointments, onBack, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'activity' | 'permissions'>('profile');
  const [selectedRole, setSelectedRole] = useState<UserRole>(staff.role);
  const [customPermissions, setCustomPermissions] = useState<string[]>(staff.customPermissions || []);
  const [isSaving, setIsSaving] = useState(false);
  const [salary, setSalary] = useState<string>('');
  const [jobTitle, setJobTitle] = useState<string>('');

  // Derive activity feed from appointment/task data
  const derivedActivities = useMemo(() => {
    const events: Array<ActivityLog & { icon: React.ElementType; color: string }> = [];
    appointments.forEach(appt => {
      appt.tasks.forEach(task => {
        if (task.assignedStaffId === staff.id) {
          const isComplete = task.status === TaskStatus.COMPLETED;
          events.push({
            id: task.id,
            timestamp: appt.date || (appt as any).createdAt || '',
            action: isComplete ? 'SERVICE_COMPLETED' : task.status === 'IN_PROGRESS' ? 'SERVICE_IN_PROGRESS' : 'SERVICE_ASSIGNED',
            description: `${task.category} — ${task.name || 'Task'} (Appt #${appt.id})`,
            icon: isComplete ? CheckCircle2 : task.category?.toLowerCase().includes('vacc') ? Stethoscope : task.category?.toLowerCase().includes('pay') ? CreditCard : ClipboardList,
            color: isComplete ? 'bg-emerald-500' : task.status === 'IN_PROGRESS' ? 'bg-amber-500' : 'bg-seafoam',
          });
        }
      });
    });
    const manual = (staff.activityLogs || []).map(l => ({ ...l, icon: History, color: 'bg-slate-400' }));
    return [...events, ...manual].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
  }, [appointments, staff.id, staff.activityLogs]);

  const staffWork = useMemo(() => {
    const tasks: ApptTask[] = [];
    const apptsHandled = new Set<number>();

    appointments.forEach(a => {
      a.tasks.forEach(t => {
        if (t.assignedStaffId === staff.id) {
          tasks.push(t);
          apptsHandled.add(a.id);
        }
      });
    });

    const categoryStats: Record<string, number> = {};
    tasks.forEach(t => {
      categoryStats[t.category] = (categoryStats[t.category] || 0) + 1;
    });

    return {
      totalVisits: apptsHandled.size,
      totalServices: tasks.length,
      completedServices: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      categoryStats: Object.entries(categoryStats).sort((a, b) => b[1] - a[1])
    };
  }, [appointments, staff.id]);

  // Get effective permissions (role defaults + custom overrides)
  const effectivePermissions = useMemo(() => {
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[selectedRole] || [];
    return Array.from(new Set([...roleDefaults, ...customPermissions]));
  }, [selectedRole, customPermissions]);

  // Check if a permission is enabled
  const isPermissionEnabled = (permissionId: string) => {
    return effectivePermissions.includes(permissionId);
  };

  // Check if a permission is from role defaults
  const isFromRoleDefaults = (permissionId: string) => {
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[selectedRole] || [];
    return roleDefaults.includes(permissionId);
  };

  // Toggle custom permission
  const togglePermission = (permissionId: string) => {
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[selectedRole] || [];
    const isRoleDefault = roleDefaults.includes(permissionId);

    if (isRoleDefault) {
      // If it's a role default, add to custom permissions to "remove" it
      if (customPermissions.includes(permissionId)) {
        setCustomPermissions(customPermissions.filter(p => p !== permissionId));
      } else {
        // Actually, we need to track "removed" permissions differently
        // For now, we'll just allow adding extra permissions
        return;
      }
    } else {
      // Toggle custom permission
      if (customPermissions.includes(permissionId)) {
        setCustomPermissions(customPermissions.filter(p => p !== permissionId));
      } else {
        setCustomPermissions([...customPermissions, permissionId]);
      }
    }
  };

  // Save changes
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await usersAPI.update(staff.id, {
        role: selectedRole,
        customPermissions: customPermissions,
      });
      toast.success('Staff profile updated successfully');
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update staff profile:', error);
      toast.error('Failed to update staff profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return selectedRole !== staff.role ||
           JSON.stringify(customPermissions.sort()) !== JSON.stringify((staff.customPermissions || []).sort());
  }, [selectedRole, customPermissions, staff.role, staff.customPermissions]);

  const renderPermissions = () => {
    // Group permissions by category
    const permissionsByCategory = ALL_PERMISSIONS.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, typeof ALL_PERMISSIONS>);

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Role Selection */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">
            <ShieldCheck className="text-seafoam shrink-0" size={18}/>
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Role Selection</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[UserRole.CLINIC_MANAGER, UserRole.VET, UserRole.STAFF, UserRole.CLINIC_VIEWER, UserRole.CLINIC_OWNER].map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`p-3 rounded-xl border-2 transition-all text-center ${
                  selectedRole === role
                    ? 'bg-seafoam border-seafoam text-white shadow-md scale-105'
                    : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-300 hover:border-seafoam/50'
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-widest">{role.replace('_', ' ')}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Grid */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <BadgeCheck className="text-seafoam shrink-0" size={18}/>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Permissions</h3>
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              {effectivePermissions.length} / {ALL_PERMISSIONS.length}
            </p>
          </div>

          <div className="space-y-5">
            {Object.entries(permissionsByCategory).map(([category, perms]) => (
              <div key={category}>
                <h4 className="text-[9px] font-black text-seafoam uppercase tracking-widest mb-2">{category}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {perms.map(perm => {
                    const isEnabled = isPermissionEnabled(perm.id);
                    const isRoleDefault = isFromRoleDefaults(perm.id);
                    const isCustom = customPermissions.includes(perm.id);

                    return (
                      <button
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        disabled={isRoleDefault && isEnabled}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          isEnabled
                            ? isRoleDefault
                              ? 'bg-seafoam/10 border-seafoam/30 text-seafoam cursor-not-allowed'
                              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                          isEnabled
                            ? 'bg-current border-current'
                            : 'border-slate-300 dark:border-zinc-600'
                        }`}>
                          {isEnabled && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-wide truncate">{perm.label}</p>
                          {isRoleDefault && isEnabled && (
                            <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Role Default</p>
                          )}
                          {isCustom && (
                            <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Custom</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-6 right-4 sm:right-8 z-50 animate-in slide-in-from-bottom-4">
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderProfile = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
             <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">
                <ShieldCheck className="text-seafoam shrink-0" size={18}/>
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Identity Profile</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Legal Identity', val: staff.name, icon: UserIcon },
                  { label: 'Role', val: staff.role.replace('_', ' '), icon: ShieldCheck },
                  { label: 'ID Number', val: staff.idNumber || 'NOT_PROVIDED', icon: Hash },
                  { label: 'Email', val: staff.email, icon: Mail },
                  { label: 'Date of Birth', val: staff.dob || 'Unknown', icon: Calendar },
                  { label: 'Age', val: staff.age ? `${staff.age} Years` : 'Unknown', icon: Clock },
                ].map(i => (
                  <div key={i.label} className="flex items-center gap-3">
                     <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-xl text-slate-400 shrink-0"><i.icon size={14}/></div>
                     <div className="min-w-0">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                        <p className="text-pine dark:text-zinc-100 font-bold text-xs leading-tight truncate uppercase">{i.val}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="text-seafoam shrink-0" size={16}/>
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Certifications</h3>
             </div>
             <div className="flex flex-wrap gap-2">
                {staff.certifications?.length ? staff.certifications.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-widest">
                     <BadgeCheck size={12}/>
                     {c}
                  </div>
                )) : (
                  <div className="w-full py-8 text-center border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-xl opacity-30 font-black uppercase text-[10px] tracking-widest">No certifications on file.</div>
                )}
             </div>
          </div>
       </div>

       <div className="space-y-4">
          <div className="bg-pine rounded-2xl p-5 text-white shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:scale-125 transition-transform duration-1000"><Activity size={72} /></div>
             <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] mb-3">Operational Status</p>
             <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
                <span className="text-lg font-black uppercase tracking-tighter">Active</span>
             </div>
             <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest">Currently Active</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
             <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Clinic Authorization</h4>
             <div className="flex flex-col gap-2">
                {staff.clinicIds.map(cid => {
                  const c = clinics.find(cl => cl.id === cid);
                  return c ? (
                    <div key={cid} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-xl">
                       <span className="text-base shrink-0">{c.logo}</span>
                       <span className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{c.name}</span>
                    </div>
                  ) : null;
                })}
             </div>
          </div>
       </div>
    </div>
  );

  const renderStats = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Visits Handled', val: staffWork.totalVisits, icon: History, color: 'text-seafoam', bg: 'bg-seafoam/10' },
            { label: 'Services', val: staffWork.totalServices, icon: ClipboardList, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { label: 'Completed', val: staffWork.completedServices, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Efficiency', val: staffWork.totalServices > 0 ? `${Math.round((staffWork.completedServices / staffWork.totalServices) * 100)}%` : '—', icon: BarChart3, color: 'text-cyan', bg: 'bg-cyan/10' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-sm">
               <div className={`w-8 h-8 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-3`}><s.icon size={16}/></div>
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{s.label}</p>
               <h3 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter">{s.val}</h3>
            </div>
          ))}
       </div>

       <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
             <BarChart3 className="text-seafoam shrink-0" size={16}/>
             <div>
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Specialization</h3>
                <p className="text-seafoam text-[8px] font-black uppercase tracking-widest">Service category distribution</p>
             </div>
          </div>
          {staffWork.categoryStats.length === 0 ? (
            <p className="text-center py-8 text-[10px] font-black text-slate-300 dark:text-zinc-600 uppercase tracking-widest">No services recorded yet</p>
          ) : (
            <div className="space-y-3">
               {staffWork.categoryStats.map(([cat, count]) => {
                  const percentage = Math.round((count / staffWork.totalServices) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                       <div className="flex justify-between items-center text-[9px] font-black uppercase">
                          <span className="text-slate-500 dark:text-zinc-400 truncate mr-2">{cat}</span>
                          <span className="text-pine dark:text-zinc-100 shrink-0">{count} • {percentage}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-seafoam transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                       </div>
                    </div>
                  );
               })}
            </div>
          )}
       </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
       <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
           <button onClick={onBack} className="w-9 h-9 shrink-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam hover:text-pine transition-all shadow-sm active:scale-95">
             <ArrowLeft size={16}/>
           </button>
           <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 shrink-0 overflow-hidden shadow-md">
                <img src={staff.avatar} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-0.5 uppercase truncate">{staff.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 truncate">
                   Staff Profile
                   <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0"></span>
                   ID: STF-{staff.id}
                </p>
              </div>
           </div>
        </div>

        <div className="flex bg-slate-50 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
           {[
             { id: 'profile', label: 'Profile', icon: UserIcon },
             { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
             { id: 'stats', label: 'Stats', icon: BarChart3 },
             { id: 'activity', label: 'Activity', icon: History },
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                 activeTab === tab.id
                   ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-md'
                   : 'text-slate-400 dark:text-zinc-500 hover:text-pine'
               }`}
             >
               <tab.icon size={11} />
               {tab.label}
             </button>
           ))}
        </div>
      </header>

      <div>
         {activeTab === 'profile' && renderProfile()}
         {activeTab === 'permissions' && renderPermissions()}
         {activeTab === 'stats' && renderStats()}
         {activeTab === 'activity' && (
            <div className="animate-in slide-in-from-bottom-4">
              {derivedActivities.length === 0 ? (
                <div className="py-24 text-center opacity-20 font-black uppercase tracking-[0.3em] text-xs">No activity recorded yet.</div>
              ) : (
                <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-2 sm:before:left-3 before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800 before:rounded-full">
                  {derivedActivities.map((log, idx) => {
                    const Icon = log.icon;
                    const actionLabel = log.action.replace(/_/g, ' ');
                    const ts = log.timestamp ? new Date(log.timestamp) : null;
                    const timeStr = ts && !isNaN(ts.getTime())
                      ? ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                      : log.timestamp;
                    return (
                      <div key={`${log.id}-${idx}`} className="relative group">
                         <div className={`absolute -left-4 sm:-left-5 top-3 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-950 ${log.color} shadow-md transition-transform group-hover:scale-125 z-10 flex items-center justify-center`}>
                           <Icon size={8} className="text-white" />
                         </div>
                         <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-sm transition-all group-hover:shadow-md group-hover:border-seafoam/20">
                            <div className="flex items-start justify-between gap-2">
                               <div className="min-w-0">
                                  <span className="inline-block bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-300 px-2 py-0.5 rounded-md text-[7px] font-black uppercase border border-slate-200 dark:border-zinc-700 tracking-widest mb-1">{actionLabel}</span>
                                  <p className="text-[11px] font-bold text-pine dark:text-zinc-100 leading-snug">{log.description}</p>
                               </div>
                               <p className="text-[8px] font-bold text-slate-400 uppercase font-mono shrink-0 text-right leading-relaxed">{timeStr}</p>
                            </div>
                         </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
         )}
      </div>
    </div>
  );
};

export default StaffProfileView;
