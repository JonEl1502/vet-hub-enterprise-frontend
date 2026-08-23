import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Package, FileText, LifeBuoy, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useDisplayCurrency } from '../../../contexts/DisplayCurrencyContext';
import { subscriptionPaymentHistoryAPI, type PaymentHistoryRow } from '../../../services/modules/subscriptionPaymentHistory.api';
import PlanFeaturesPanel, { SUPPLIER_GROUPS } from '../../clinic/billing/PlanFeaturesPanel';
import SupportTicketsPanel from '../../clinic/billing/SupportTicketsPanel';
import BillingDocumentsPanel from '../../clinic/billing/BillingDocumentsPanel';
import ReportPaymentIssueModal from '../../clinic/billing/ReportPaymentIssueModal';
import SupplierBillingView from './SupplierBillingView';
import { formatDate } from '../../../services/utils/dateFormatter';

/**
 * Supplier billing — the CLINIC billing page, sourced from supplier data.
 *
 * The user's requirement was explicit (2026-08-23): *"match billing page ui
 * from clinic including statements and view pages, they must match exactly,
 * only thing different src of data"*, and *"as page first not just tab"* —
 * supplier billing used to be a tab inside Supplier Management, so it had none
 * of the clinic page's chrome.
 *
 * ⚠️ This DELIBERATELY REUSES the clinic components rather than copying them:
 * `PlanFeaturesPanel`, `SupportTicketsPanel` and `BillingDocumentsPanel` are
 * the same modules the clinic page renders. A clone would have matched on the
 * day it was written and drifted by the next change — which is exactly what
 * "must match exactly" rules out. What differs is confined to props: the rows,
 * the feature-key vocabulary, and one noun in a sentence.
 *
 * Tab 1 stays `SupplierBillingView` because plan CARDS already share `PlanCard`
 * with the clinic page; only the surrounding page chrome was missing.
 */

type Tab = 'plan' | 'features' | 'documents' | 'tickets';

const docNo = (prefix: 'INV' | 'RCP', row: PaymentHistoryRow) =>
  `${prefix}-${row.channel.slice(0, 3)}-${String(row.id).padStart(6, '0')}`;

const SupplierBillingPage: React.FC = () => {
  const { user } = useAuth();
  const supplierId = (user as any)?.supplier?.id ? String((user as any).supplier.id) : null;
  const { formatPrice } = useDisplayCurrency();

  const [activeTab, setActiveTab] = useState<Tab>('plan');
  const [docTab, setDocTab] = useState<'invoices' | 'receipts'>('invoices');
  const [history, setHistory] = useState<PaymentHistoryRow[]>([]);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [ticketsRefresh, setTicketsRefresh] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadHistory = useCallback(async () => {
    if (!supplierId) return;
    try {
      const res = await subscriptionPaymentHistoryAPI.listForSupplier(supplierId, { limit: 50 });
      if (res.success) setHistory(res.data?.rows ?? []);
    } catch {
      // Best-effort: the statement failing must not take the plan tab with it.
    }
  }, [supplierId]);

  useEffect(() => { loadHistory(); }, [loadHistory, refreshKey]);

  /**
   * Same split the clinic page uses: an INVOICE is every charge raised, a
   * RECEIPT is only the ones that settled. Deriving both from one list keeps
   * the two counts honest — a receipt can never exist without its invoice.
   */
  const invoices = useMemo(() => history, [history]);
  const receipts = useMemo(() => history.filter(r => r.status === 'SUCCESS'), [history]);

  const TABS = [
    { id: 'plan' as const, label: 'Current Billing', icon: CreditCard, count: null as number | null },
    { id: 'features' as const, label: 'Plan Features', icon: Package, count: null as number | null },
    { id: 'documents' as const, label: 'Invoices & Receipts', icon: FileText, count: history.length || null },
    { id: 'tickets' as const, label: 'Tickets', icon: LifeBuoy, count: null as number | null },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header — same shape and copy as the clinic page. */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Billing &amp; Subscription</h1>
          <p className="page-subheader mt-1">Manage your plan and payment details</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowReportIssue(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-pine dark:hover:text-zinc-100 transition-all flex items-center gap-1.5"
            title="Paid but not reflected? Let us know."
          >
            <LifeBuoy size={14} /> Report an issue
          </button>
        </div>
      </header>

      <ReportPaymentIssueModal
        isOpen={showReportIssue}
        onClose={() => setShowReportIssue(false)}
        onSubmitted={() => {
          setShowReportIssue(false);
          // Land on Tickets so the thing just raised is visible, exactly as the
          // clinic page does — a submit that appears to do nothing reads as a
          // failure.
          setTicketsRefresh(n => n + 1);
          setActiveTab('tickets');
        }}
        transactions={history}
      />

      {/* Tabs */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl inline-flex min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  active
                    ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg'
                    : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
                }`}
              >
                <Icon size={12} /> {t.label}
                {t.count != null && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] ${
                    active ? 'bg-white/20 dark:bg-pine/10' : 'bg-slate-200 dark:bg-zinc-800'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'plan' && <SupplierBillingView key={refreshKey} />}

      {activeTab === 'features' && (
        /* SUPPLIER vocabulary — a supplier plan has no `view:laboratory`, and
           listing clinic keys under "Not in your plan" would advertise an
           upgrade that does not exist for them. */
        <PlanFeaturesPanel groups={SUPPLIER_GROUPS} onGoToPlans={() => setActiveTab('plan')} />
      )}

      {activeTab === 'documents' && (
        <BillingDocumentsPanel
          invoices={invoices}
          receipts={receipts}
          docTab={docTab}
          setDocTab={setDocTab}
          docNo={docNo}
          formatDate={formatDate}
          formatPrice={formatPrice}
          onView={() => setShowReportIssue(false)}
          ownerNoun="this supplier account"
        />
      )}

      {activeTab === 'tickets' && (
        <SupportTicketsPanel refreshKey={ticketsRefresh} onRaiseTicket={() => setShowReportIssue(true)} />
      )}
    </div>
  );
};

export default SupplierBillingPage;
