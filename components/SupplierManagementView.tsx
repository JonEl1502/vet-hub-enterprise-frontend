import React, { useState } from 'react';
import { Building2, Users, GitBranch, Settings, CreditCard } from 'lucide-react';
import SupplierBranchesView from './SupplierBranchesView';
import SupplierEmployeeListView from './SupplierEmployeeListView';
import SupplierBillingView from './SupplierBillingView';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'profile' | 'employees' | 'branches' | 'subscription';

interface Props {
  setView?: (view: string, params?: any) => void;
  initialTab?: Tab;
}

const SupplierManagementView: React.FC<Props> = ({ setView, initialTab = 'profile' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'profile', label: 'Profile', icon: Building2 },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'branches', label: 'Branches', icon: GitBranch },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">
          Supplier Management
        </h1>
        <p className="text-seafoam dark:text-zinc-400 font-bold mt-1 uppercase tracking-widest text-[9px]">
          {user?.supplier?.name || 'Manage your supplier account'}
        </p>
      </div>

      {/* Tab Nav */}
      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-1.5 shadow-sm self-start w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-sm'
                : 'text-slate-500 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-seafoam/10 rounded-xl">
              <Building2 size={20} className="text-seafoam" />
            </div>
            <div>
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                Supplier Profile
              </h2>
              <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">
                Business details
              </p>
            </div>
          </div>

          {user?.supplier ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'Business Name', value: user.supplier.name },
                { label: 'Category', value: user.supplier.category || '—' },
                { label: 'Contact Email', value: user.supplier.contactEmail || '—' },
                { label: 'Contact Phone', value: user.supplier.contactPhone || '—' },
                { label: 'Address', value: user.supplier.address || '—' },
                { label: 'Currency', value: user.supplier.currency || 'KES' },
                { label: 'Rating', value: `${user.supplier.rating?.toFixed(1) || '0.0'} / 5.0` },
                {
                  label: 'Status',
                  value: user.supplier.isActive ? 'Active' : 'Inactive',
                  badge: user.supplier.isActive ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
                },
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    {item.label}
                  </p>
                  {item.badge ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${item.badge}`}>
                      {item.value}
                    </span>
                  ) : (
                    <p className="text-sm font-bold text-pine dark:text-zinc-100">{item.value}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-400 dark:text-zinc-600">
              <Settings size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold">No supplier profile found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="animate-in fade-in">
          <SupplierEmployeeListView setView={setView} />
        </div>
      )}

      {activeTab === 'branches' && (
        <div className="animate-in fade-in">
          <SupplierBranchesView />
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="animate-in fade-in">
          <SupplierBillingView />
        </div>
      )}
    </div>
  );
};

export default SupplierManagementView;
