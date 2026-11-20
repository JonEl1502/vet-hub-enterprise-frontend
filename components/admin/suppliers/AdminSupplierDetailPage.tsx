import React, { useEffect, useState } from 'react';
import { ArrowLeft, Store, Power, ExternalLink, Loader2, Receipt } from 'lucide-react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { toast } from '../../../services';
import { suppliersAPI } from '../../../services/modules/suppliers.api';
import { adminOrgAPI, SupplierSummary } from '../../../services/modules/adminOrg.api';
import { useAuth } from '../../../contexts/AuthContext';
import RecordPaidSubscriptionDialog from '../subscriptions/RecordPaidSubscriptionDialog';
import { Card, OrgSwitcher, FigureTiles, WarningsPanel, TabBar, RecordsTable, Pill, money, day, ago, statusTone, statusLabel } from '../orgs/OrgParts';

/**
 * 326 — the admin's page for ONE supplier (nav key 'admin-supplier-detail',
 * param supplierId). Same shape as the clinic page, after SaloPlus's
 * organisation page: switcher, figures, what needs attention, and a tab per
 * kind of record. Before this an admin clicking a supplier landed on the
 * clinic-facing catalogue page, which shows what a buyer sees, not the account.
 */

interface Props {
  supplierId: string;
  onBack: () => void;
  onNavigate?: (view: string, params?: any) => void;
}

type Tab = 'overview' | 'products' | 'sales' | 'orders' | 'users' | 'branches' | 'billing';
const RECORD_TABS: string[] = ['products', 'sales', 'orders'];
const SHOP_BASE = 'https://vethubcore.com/shop/';

const AdminSupplierDetailPage: React.FC<Props> = ({ supplierId, onBack, onNavigate }) => {
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [data, setData] = useState<SupplierSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [all, setAll] = useState<Array<{ id: string; name: string; hint?: string; isActive?: boolean }>>([]);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);

  const reload = () => adminOrgAPI.supplierSummary(supplierId)
    .then((r) => { if (r.success && r.data) setData(r.data); else setError('Could not load this supplier.'); })
    .catch((e) => setError(e?.message || 'Could not load this supplier.'));

  useEffect(() => {
    setData(null); setError(null); setTab('overview'); setConfirmStatus(false);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);
  useEffect(() => {
    adminOrgAPI.suppliers()
      .then((r) => setAll((r.data?.suppliers ?? []).map((x) => ({ id: x.id, name: x.name, isActive: x.isActive, hint: x.category ?? undefined }))))
      .catch(() => {});
  }, []);

  const back = (
    <div className="flex items-center justify-between gap-3">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={14} /> Suppliers
      </button>
      {all.length > 1 && (
        <OrgSwitcher label="supplier" current={supplierId} options={all}
          onPick={(id) => onNavigate?.('admin-supplier-detail', { supplierId: id })} />
      )}
    </div>
  );

  if (!data) {
    return (
      <div className="space-y-4">
        {back}
        {error ? <p className="py-16 text-center text-[13px] text-red-500">{error}</p>
          : <div className="py-20 flex justify-center"><LoadingSpinner contentArea message="Loading supplier…" /></div>}
      </div>
    );
  }

  const s = data.supplier;
  const f = data.figures;
  const cur = (v: number) => money(s.currency, v);

  const applyStatus = async () => {
    setStatusBusy(true);
    try {
      await suppliersAPI.update(Number(s.id), { isActive: !s.isActive } as any);
      toast.success(`Supplier ${s.isActive ? 'deactivated' : 'activated'}`);
      setConfirmStatus(false);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  const rows: Array<[string, React.ReactNode]> = [
    ['Email', s.email || '—'],
    ['Phone', s.phone || '—'],
    ['Address', s.address || '—'],
    ['Website', s.website ? <a href={s.website} target="_blank" rel="noreferrer" className="text-seafoam hover:underline">{s.website}</a> : '—'],
    ['Category', s.category || '—'],
    ['Partner type', s.partnerType || '—'],
    ['Currency', s.currency],
    ['Verification', statusLabel(s.verificationStatus)],
    ['Owed to clinics', cur(s.outstandingBalance)],
    ['Shop page', s.shopSlug
      ? <a href={`${SHOP_BASE}${s.shopSlug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-seafoam hover:underline">/shop/{s.shopSlug} <ExternalLink size={12} /></a>
      : '—'],
    ['Shop template', `${s.shopTemplate}${s.shopEnabled ? '' : ' (off)'}`],
    ['Joined', day(s.createdAt)],
  ];

  const loadRecords = (kind: string) => (q: { page: number; search: string }) =>
    adminOrgAPI.supplierRecords(s.id, kind, q).then((r) => {
      if (!r.success || !r.data) throw new Error('Could not load.');
      return r.data;
    });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {back}

      <div className="bg-gradient-to-br from-pine to-pine/90 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-white overflow-hidden flex items-center justify-center shrink-0">
          {s.logoUrl ? <img src={s.logoUrl} alt="" className="w-full h-full object-contain" /> : <Store size={26} className="text-pine" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.05em]">Supplier</p>
          <h1 className="text-[20px] font-semibold tracking-tight truncate">{s.name}</h1>
          {s.slogan && <p className="text-[12px] text-white/70 italic truncate">“{s.slogan}”</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-[0.05em] flex items-center gap-1.5 ${s.isActive ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'}`}>
            <Power size={12} /> {s.isActive ? 'Active' : 'Inactive'}
          </span>
          <span className="text-[12px] font-semibold text-white/80">
            {data.plan ? `${data.plan.name} to ${day(data.plan.expiresAt)}` : s.trialEndsAt && new Date(s.trialEndsAt) > new Date() ? `Trial to ${day(s.trialEndsAt)}` : 'Free tier'}
          </span>
        </div>
      </div>

      <FigureTiles figures={[
        { label: 'Products', value: f.products.toLocaleString(), hint: f.outOfStock ? `${f.outOfStock} out of stock` : undefined, onClick: () => setTab('products') },
        { label: 'Till sales this month', value: cur(f.salesTotalThisMonth), hint: `${f.salesThisMonth} sale${f.salesThisMonth === 1 ? '' : 's'}`, onClick: () => setTab('sales') },
        { label: 'Clinic orders this month', value: cur(f.ordersTotalThisMonth), hint: `${f.ordersThisMonth} order${f.ordersThisMonth === 1 ? '' : 's'}`, onClick: () => setTab('orders') },
        { label: 'Team', value: f.staff.toLocaleString(), onClick: () => setTab('users') },
        { label: 'Branches', value: f.branches.toLocaleString(), onClick: () => setTab('branches') },
        { label: 'Last sign-in', value: ago(f.lastLoginAt) },
      ]} />

      <WarningsPanel warnings={data.warnings} onAction={(a) => {
        if (a.kind === 'open-billing') setTab('billing');
        else if (a.kind === 'open-users') setTab('users');
        else if (a.kind === 'open-products') setTab('products');
      }} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <Card className="lg:col-span-9 overflow-hidden">
          <TabBar value={tab} onChange={(id) => setTab(id as Tab)} tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'products', label: 'Products', count: f.products },
            { id: 'sales', label: 'Till sales' },
            { id: 'orders', label: 'Clinic orders' },
            { id: 'users', label: 'Team', count: data.users.length },
            { id: 'branches', label: 'Branches', count: data.branches.length },
            { id: 'billing', label: 'Billing' },
          ]} />

          {tab === 'products' && (
            <RecordsTable scopeKey={`${s.id}:products`} load={loadRecords('products')} searchPlaceholder="Search name, SKU, category or maker" empty="No products listed yet."
              columns={[
                { key: 'name', label: 'Product', primary: true, render: (r) => (
                  <span className="inline-flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-100 dark:border-zinc-800 overflow-hidden shrink-0 hidden md:inline-flex items-center justify-center">
                      {r.imageUrl ? <img src={r.imageUrl} alt="" className="w-full h-full object-contain" loading="lazy" /> : null}
                    </span>
                    {r.name}
                  </span>) },
                { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono text-[12px]">{r.sku}</span> },
                { key: 'cat', label: 'Category', render: (r) => r.category || '—' },
                { key: 'price', label: 'Price', align: 'right', render: (r) => `${money(r.currency || s.currency, r.unitPrice)} / ${r.unit}` },
                { key: 'stock', label: 'Stock', align: 'right', render: (r) => <span className={r.stockQty <= 0 ? 'text-red-500 font-semibold' : ''}>{r.stockQty}</span> },
                { key: 'shop', label: 'Status', render: (r) => (
                  <span className="inline-flex gap-1">
                    {r.isAvailable ? <Pill tone="green">Available</Pill> : <Pill tone="slate">Hidden</Pill>}
                    {r.websiteVisible && <Pill tone="violet">Shop</Pill>}
                  </span>) },
              ]} />
          )}
          {tab === 'sales' && (
            <RecordsTable scopeKey={`${s.id}:sales`} load={loadRecords('sales')} searchPlaceholder="Search sale number or customer" empty="No till sales yet."
              columns={[
                { key: 'no', label: 'Sale', primary: true, render: (r) => <span className="font-mono">{r.number}</span> },
                { key: 'when', label: 'Date', render: (r) => day(r.at) },
                { key: 'cust', label: 'Customer', render: (r) => r.customer },
                { key: 'branch', label: 'Branch', render: (r) => r.branch || '—' },
                { key: 'items', label: 'Items', align: 'right', render: (r) => r.items ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <Pill tone={statusTone(r.status)}>{statusLabel(r.status)}</Pill> },
                { key: 'total', label: 'Total', align: 'right', render: (r) => money(r.currency || s.currency, r.total) },
              ]} />
          )}
          {tab === 'orders' && (
            <RecordsTable scopeKey={`${s.id}:orders`} load={loadRecords('orders')} searchPlaceholder="Search order number or clinic" empty="No clinic orders yet."
              onRowClick={undefined}
              columns={[
                { key: 'no', label: 'Order', primary: true, render: (r) => <span className="font-mono">{r.number}</span> },
                { key: 'clinic', label: 'Clinic', render: (r) => (r.clinicId
                  ? <button onClick={() => onNavigate?.('admin-clinic-detail', { clinicId: r.clinicId })} className="text-seafoam font-semibold hover:underline text-left">{r.clinic}</button>
                  : r.clinic) },
                { key: 'when', label: 'Placed', render: (r) => day(r.createdAt) },
                { key: 'items', label: 'Lines', align: 'right', render: (r) => r.items ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <Pill tone={statusTone(r.status)}>{statusLabel(r.status)}</Pill> },
                { key: 'total', label: 'Total', align: 'right', render: (r) => cur(r.total) },
              ]} />
          )}

          {!RECORD_TABS.includes(tab) && (
            <div className="p-5">
              {tab === 'overview' && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">{k}</dt>
                      <dd className="text-[14px] font-semibold text-pine dark:text-zinc-100 break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {tab === 'users' && (data.users.length === 0
                ? <p className="text-[13px] text-slate-400 text-center py-8">Nobody is attached to this supplier.</p>
                : <SimpleTable head={['Name', 'Email', 'Role', 'Branch', 'Status', 'Last sign-in']}
                    rows={data.users.map((u) => [
                      <span className="font-semibold text-slate-800 dark:text-zinc-100">{u.name}</span>,
                      u.email,
                      <Pill tone={u.role === 'OWNER' ? 'violet' : u.role === 'MANAGER' ? 'blue' : 'slate'}>{statusLabel(u.role)}</Pill>,
                      u.branch || '—',
                      u.isActive ? <Pill tone="green">Active</Pill> : <Pill tone="red">Inactive</Pill>,
                      ago(u.lastLoginAt),
                    ])} />)}

              {tab === 'branches' && (data.branches.length === 0
                ? <p className="text-[13px] text-slate-400 text-center py-8">No branches.</p>
                : <SimpleTable head={['Branch', 'Location', 'Status', 'Opened']}
                    rows={data.branches.map((b) => [
                      <span className="font-semibold text-slate-800 dark:text-zinc-100">{b.name}</span>,
                      b.city || '—',
                      b.isActive ? <Pill tone="green">Active</Pill> : <Pill tone="red">Inactive</Pill>,
                      day(b.createdAt),
                    ])} />)}

              {tab === 'billing' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 flex-1 min-w-[240px]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">Current plan</p>
                      {data.plan
                        ? <><p className="text-[16px] font-semibold text-pine dark:text-zinc-100 mt-1">{data.plan.name}</p>
                            <p className="text-[12px] text-slate-500">Started {day(data.plan.startedAt)} · ends {day(data.plan.expiresAt)}</p></>
                        : <p className="text-[14px] font-semibold text-slate-400 mt-1">
                            {s.trialEndsAt && new Date(s.trialEndsAt) > new Date() ? `On trial to ${day(s.trialEndsAt)}` : 'Free tier, nothing paid'}
                          </p>}
                    </div>
                    {isSuper && (
                      <button onClick={() => setGrantOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[13px] font-semibold text-slate-600 dark:text-zinc-300 hover:border-pine/40 active:scale-[0.98] transition">
                        <Receipt size={14} /> Record a paid subscription
                      </button>
                    )}
                  </div>
                  {data.subscriptions.length === 0
                    ? <p className="text-[13px] text-slate-400 py-4">No subscriptions recorded.</p>
                    : <SimpleTable head={['Package', 'Started', 'Ends', 'Paid', 'State']}
                        rows={data.subscriptions.map((x) => [
                          <span className="font-semibold text-slate-800 dark:text-zinc-100">{x.name}{x.isAddon && <span className="ml-1.5 text-[11px] text-slate-400">add-on</span>}</span>,
                          day(x.startedAt), day(x.expiresAt), cur(x.amountPaid),
                          x.isActive ? <Pill tone="green">Active</Pill> : <Pill tone="slate">Ended</Pill>,
                        ])} />}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-3 p-4 space-y-2.5 lg:sticky lg:top-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">Actions</p>
          {s.shopSlug && (
            <a href={`${SHOP_BASE}${s.shopSlug}`} target="_blank" rel="noreferrer"
              className="w-full px-4 py-2.5 rounded-xl bg-seafoam/10 hover:bg-seafoam/20 text-seafoam text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition">
              <ExternalLink size={14} /> Open shop page
            </a>
          )}
          <button onClick={() => onNavigate?.('supplier-detail', { supplierId: s.id })}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <Store size={14} /> See as a clinic sees it
          </button>
          {!confirmStatus ? (
            <button onClick={() => setConfirmStatus(true)}
              className={`w-full px-4 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition ${s.isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600' : 'bg-green-500/10 hover:bg-green-500/20 text-green-600'}`}>
              <Power size={14} /> {s.isActive ? 'Deactivate' : 'Activate'}
            </button>
          ) : (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
              <p className="text-[13px] font-semibold text-pine dark:text-zinc-100">{s.isActive ? 'Deactivate' : 'Activate'} “{s.name}”?</p>
              {s.isActive && <p className="text-[12px] text-slate-500">Its team will be signed out and clinics will stop seeing it.</p>}
              <div className="flex gap-2">
                <button onClick={() => setConfirmStatus(false)} disabled={statusBusy} className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[12px] font-semibold">Cancel</button>
                <button onClick={applyStatus} disabled={statusBusy} className={`flex-1 px-3 py-2 rounded-lg text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 ${s.isActive ? 'bg-amber-500' : 'bg-green-600'}`}>
                  {statusBusy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />} Confirm
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {grantOpen && (
        <RecordPaidSubscriptionDialog ownerKind="SUPPLIER" ownerId={s.id} ownerName={s.name}
          onClose={() => setGrantOpen(false)} onGranted={() => { reload(); }} />
      )}
    </div>
  );
};

const SimpleTable: React.FC<{ head: string[]; rows: React.ReactNode[][] }> = ({ head, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left border-b border-slate-100 dark:border-zinc-800">
          {head.map((h) => <th key={h} className="py-2 pr-4 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400 whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-50 dark:border-zinc-800/60">
            {r.map((c, j) => <td key={j} className="py-2.5 pr-4 text-slate-600 dark:text-zinc-300">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default AdminSupplierDetailPage;
