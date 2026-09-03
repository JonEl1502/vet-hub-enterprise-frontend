
import React, { useState, useMemo } from 'react';
import { User, UserRole, Clinic, Visit, ApptTask, TaskStatus, ActivityLog, FULL_ACCESS_ROLES } from '../../../types';
import { ShieldCheck, Mail, Calendar, Hash, BadgeCheck, GraduationCap, ArrowLeft, History, BarChart3, ClipboardList, Clock, CheckCircle2, Activity, User as UserIcon, Save, Stethoscope, CalendarCheck, PackageCheck, AlertCircle, CreditCard } from 'lucide-react';
import { usersAPI } from '../../../services/modules/users.api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, dialog } from '../../../services';
import StaffCategoryAccess from './StaffCategoryAccess';
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../../../constants/permissions';
import { ASSIGNABLE_ROLE_GROUPS, ROLE_META, roleLabel } from '../../../constants/roles';
import ModulePermissionsEditor from './ModulePermissionsEditor';

interface Props {
  staff: User;
  clinics: Clinic[];
  appointments: Visit[];
  onBack: () => void;
  onUpdate?: () => void;
}


const StaffProfileView: React.FC<Props> = ({ staff, clinics, appointments, onBack, onUpdate }) => {
  const { user } = useAuth();
  // Ownership is a platform-governed transfer, not a clinic-editable role.
  const isPlatformAdmin = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.MERCHANT_ADMIN;
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
    // Ownership is platform-governed: a clinic can neither grant OWNER nor
    // change an existing owner's role. Only SUPER_ADMIN/MERCHANT_ADMIN can,
    // through the documented clinic-transfer process.
    if (!isPlatformAdmin && (selectedRole === UserRole.CLINIC_OWNER || staff.role === UserRole.CLINIC_OWNER)) {
      await dialog.alert({
        title: 'Ownership is admin-managed',
        message: 'Clinic Owner can only be set or changed by a VetHubCore admin through a clinic transfer — which requires a signed transfer and a lawyer/advocate affidavit. Contact support to initiate one.',
        variant: 'warning',
        confirmLabel: 'Got it',
      });
      return;
    }
    // A Clinic Manager must belong to a clinic — block the role otherwise.
    if (selectedRole === UserRole.CLINIC_MANAGER && (!staff.clinicIds || staff.clinicIds.length === 0)) {
      await dialog.alert({
        title: 'Clinic required',
        message: 'A Clinic Manager must be attached to a clinic. Assign this staff member to a clinic first, then set the Clinic Manager role.',
        variant: 'warning',
        confirmLabel: 'Got it',
      });
      return;
    }
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
        {/* Epic C — category access / scoped navigation */}
        <StaffCategoryAccess userId={staff.id} />
        {/* Role Selection */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">
            <ShieldCheck className="text-seafoam shrink-0" size={18}/>
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Role Selection</h3>
          </div>
          <div className="space-y-2.5">
            {ASSIGNABLE_ROLE_GROUPS.map(({ group, roles }) => {
              const roleList = group === 'Management' && isPlatformAdmin ? [UserRole.CLINIC_OWNER, ...roles] : roles;
              return (
                <div key={group}>
                  <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {roleList.map(role => (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-all ${
                          selectedRole === role
                            ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-pine dark:border-zinc-100 shadow-sm'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam/50'
                        }`}
                      >
                        {ROLE_META[role]?.label || roleLabel(role)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Ownership governance: clinics can't self-assign OWNER. */}
          {!isPlatformAdmin && (
            <p className="mt-3 text-[10px] text-slate-400 dark:text-zinc-500 leading-snug">
              🔒 <span className="font-bold">Clinic Owner</span> can't be assigned here. Ownership changes go through a
              platform-managed <span className="font-bold">clinic transfer</span> — requiring a signed transfer and an
              affidavit from a lawyer/advocate. Contact VetHubCore support to initiate one.
            </p>
          )}
          {staff.role === UserRole.CLINIC_OWNER && selectedRole !== UserRole.CLINIC_OWNER && !isPlatformAdmin && (
            <p className="mt-2 text-[10px] font-bold text-amber-600">This staff is the clinic OWNER — only an admin can change that via a clinic transfer.</p>
          )}
        </div>

        {/* TWO CATALOGS, ONE PAGE — and they are not the same thing (216).
            Page Permissions below is the live model: it can GRANT and DENY, and
            both the app and the API read it. "Other permissions" under it is the
            older flat list, which can only ADD — and most of its tokens are read
            by nothing at all. That was invisible, so `view_payments` looked
            missing while sitting right there (user, 2026-08-24). Each section
            now says which it is. */}
        <ModulePermissionsEditor
          role={selectedRole}
          value={customPermissions}
          onChange={setCustomPermissions}
          fullAccess={FULL_ACCESS_ROLES.includes(selectedRole)}
        />

        {/* Permissions Grid */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <BadgeCheck className="text-seafoam shrink-0" size={18}/>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Other permissions</h3>
                <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 leading-snug mt-0.5">
                  The older list. These can only ADD access — unticking one never takes anything
                  away, because the role decides first. Use Page Permissions above to remove access.
                </p>
              </div>
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest shrink-0">
              {effectivePermissions.length} / {ALL_PERMISSIONS.length}
            </p>
          </div>

          <div className="space-y-5">
            {Object.entries(permissionsByCategory).map(([category, perms]) => (
              <div key={category}>
                <h4 className="text-[9px] font-black text-seafoam uppercase tracking-widest mb-2">{category}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                  {perms.map(perm => {
                    const isEnabled = isPermissionEnabled(perm.id);
                    const isRoleDefault = isFromRoleDefaults(perm.id);
                    const isCustom = customPermissions.includes(perm.id);

                    return (
                      <button
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        disabled={isRoleDefault && isEnabled}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all text-left ${
                          isEnabled
                            ? isRoleDefault
                              ? 'bg-seafoam/10 border-seafoam/30 text-seafoam cursor-not-allowed'
                              : 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-slate-300'
                        }`}
                        title={
                          !perm.live
                            ? 'Nothing reads this yet — ticking it changes no access anywhere in the app'
                            : isRoleDefault ? 'Role default' : isCustom ? 'Custom grant' : undefined
                        }
                      >
                        <span className={`w-3 h-3 rounded flex items-center justify-center shrink-0 border ${
                          isEnabled ? 'bg-current border-current' : 'border-slate-300 dark:border-zinc-600'
                        }`}>
                          {isEnabled && <CheckCircle2 size={9} className="text-white dark:text-zinc-900" />}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wide truncate flex-1">{perm.label}</span>
                        {/* SAY WHEN A SWITCH IS NOT WIRED TO ANYTHING (216).
                            19 of these tokens are read by no gate on either
                            side. Presenting them identically to the ones that
                            work is how an owner comes to believe they have
                            restricted something they have not. */}
                        {!perm.live && (
                          <span className="text-[7px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600 shrink-0">
                            n/a
                          </span>
                        )}
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

  /**
   * PROFILE — reworked to the reference layout (user, 2026-09-03: "just looks
   * meh n difficult to use", with a SaloPlus user page as the target).
   *
   * What was wrong, and what each change fixes:
   *
   *  • THREE cards for one person — Identity, a full-height purple "Operational
   *    Status" panel whose entire content was the word ACTIVE, and a separate
   *    Clinic Authorization box. Status is one fact; it is a chip beside the
   *    name now, not a column.
   *  • EVERY VALUE WAS UPPERCASED, so real data read as shouting and as
   *    placeholders: "DR. CYNTHIA NOLARI", "NOT_PROVIDED", "UNKNOWN". Labels
   *    stay small caps; VALUES are now printed as written.
   *  • A 2-column grid with a 32px icon tile per row, so six fields filled the
   *    height of the screen. Three columns, no tiles — the icon is inline and
   *    quiet.
   *  • An empty state that was a 2px-dashed 8-row block announcing nothing.
   *    One quiet line instead.
   */
  const renderProfile = () => {
    const fields = [
      { label: 'Role', val: roleLabel(staff.role), icon: ShieldCheck },
      { label: 'Email', val: staff.email || '—', icon: Mail },
      { label: 'ID number', val: staff.idNumber || '—', icon: Hash },
      { label: 'Date of birth', val: staff.dob || '—', icon: Calendar },
      { label: 'Age', val: staff.age ? `${staff.age} years` : '—', icon: Clock },
      { label: 'Staff ID', val: `STF-${staff.id}`, icon: UserIcon },
    ];
    const authorised = staff.clinicIds.map(cid => clinics.find(cl => cl.id === cid)).filter(Boolean) as typeof clinics;

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          {/* Identity + status + authorisation on ONE row — the reference puts
              who this is and what you can do about them on the same line. */}
          <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800">
            <div className="min-w-0">
              <h3 className="text-base font-black text-pine dark:text-zinc-100 truncate">{staff.name}</h3>
              <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 mt-0.5">{roleLabel(staff.role)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
              </span>
              {authorised.map(c => (
                <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 max-w-[14rem]">
                  <span className="shrink-0">{c.logo}</span>
                  <span className="truncate">{c.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Dense field grid. Values print as stored — no uppercase. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 p-4 sm:p-5">
            {fields.map(f => (
              <div key={f.label} className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-zinc-500 mb-0.5">
                  <f.icon size={12} className="shrink-0" /> {f.label}
                </p>
                <p className="text-[13px] font-bold text-pine dark:text-zinc-100 truncate" title={String(f.val)}>{f.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Certifications — a plain section, not a third card competing with
            the person above it. */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-500 dark:text-zinc-400 mb-3">
            <GraduationCap size={14} className="text-seafoam shrink-0" /> Certifications
          </h3>
          {staff.certifications?.length ? (
            <div className="flex flex-wrap gap-2">
              {staff.certifications.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <BadgeCheck size={12} /> {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400 dark:text-zinc-500">None on file.</p>
          )}
        </div>
      </div>
    );
  };

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
                <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-0.5 uppercase truncate">{staff.name}</h1>
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
