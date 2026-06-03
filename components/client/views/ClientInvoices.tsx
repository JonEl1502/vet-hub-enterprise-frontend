import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Receipt, Smartphone, CreditCard, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { clientPortalAPI, toast, PortalInvoice } from '../../../services';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import CpModal from '../CpModal';

const money = (amount: number, currency: string) => `${currency || ''} ${amount.toLocaleString()}`.trim();

const ClientInvoices: React.FC = () => {
  const { invoices, loading } = useClientPortal();
  const [paying, setPaying] = useState<PortalInvoice | null>(null);

  const unpaid = invoices.filter((i) => !i.isPaid);
  const paid = invoices.filter((i) => i.isPaid);

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Invoices</h1>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin cp-accent-text" /></div>
      ) : invoices.length === 0 ? (
        <div className="cp-card p-8 text-center">
          <Receipt className="w-8 h-8 cp-accent-text mx-auto mb-2" />
          <p className="text-sm cp-muted">No invoices yet. Bills from your visits will show up here.</p>
        </div>
      ) : (
        <>
          {unpaid.length > 0 && (
            <section>
              <h2 className="cp-label">Due now</h2>
              <div className="space-y-2">
                {unpaid.map((inv) => (
                  <div key={inv.appointmentId} className="cp-card p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{inv.clinic?.name}</div>
                      <div className="text-xs cp-muted">{inv.petName} · {format(new Date(inv.scheduledAt), 'd MMM yyyy')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black" style={{ color: 'var(--cp-ink)' }}>{money(inv.amount, inv.currency)}</div>
                    </div>
                    <button className="cp-btn" onClick={() => setPaying(inv)}>Pay</button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {paid.length > 0 && (
            <section>
              <h2 className="cp-label">Paid</h2>
              <div className="space-y-2 opacity-80">
                {paid.map((inv) => (
                  <div key={inv.appointmentId} className="cp-card p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#3a7d5d' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{inv.clinic?.name}</div>
                      <div className="text-xs cp-muted">{inv.petName} · {format(new Date(inv.scheduledAt), 'd MMM yyyy')}</div>
                    </div>
                    <div className="font-black" style={{ color: 'var(--cp-ink)' }}>{money(inv.amount, inv.currency)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {paying && <PayModal invoice={paying} onClose={() => setPaying(null)} />}
    </div>
  );
};

type PayState = 'choose' | 'mpesa-phone' | 'waiting' | 'done';

const PayModal: React.FC<{ invoice: PortalInvoice; onClose: () => void }> = ({ invoice, onClose }) => {
  const { refreshInvoices } = useClientPortal();
  const [state, setState] = useState<PayState>('choose');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPolling = () => {
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries++;
      try {
        const res = await clientPortalAPI.invoiceStatus(invoice.appointmentId);
        if (res.data?.isPaid || res.data?.transactionStatus === 'SETTLED') {
          if (pollRef.current) clearInterval(pollRef.current);
          setState('done');
          await refreshInvoices();
        }
      } catch { /* keep polling */ }
      if (tries > 40 && pollRef.current) { clearInterval(pollRef.current); } // ~2 min cap
    }, 3000);
  };

  const payStripe = async () => {
    setBusy(true);
    try {
      const res: any = await clientPortalAPI.payInvoice(invoice.appointmentId, { provider: 'STRIPE' });
      const url = res?.data?.url || res?.data?.checkoutUrl || res?.data?.redirectUrl || res?.data?.client?.url;
      if (url) { window.location.href = url; return; }
      // Otherwise a PaymentIntent client secret was returned — card entry needs
      // the clinic's Stripe Elements which the portal doesn't host yet.
      toast.info('Card payment is being set up — please complete it with your clinic, or pay via M-Pesa.');
      setState('choose');
    } catch { /* toast handled */ } finally { setBusy(false); }
  };

  // Paystack hosted checkout handles card, bank, AND mobile money in one page —
  // we just redirect to the authorization URL it returns.
  const payPaystack = async () => {
    setBusy(true);
    try {
      const res: any = await clientPortalAPI.payInvoice(invoice.appointmentId, { provider: 'PAYSTACK' });
      const url = res?.data?.client?.authorizationUrl || res?.data?.authorizationUrl;
      if (url) { window.location.href = url; return; }
      toast.error('Could not open Paystack checkout. Please try another method.');
      setState('choose');
    } catch { /* toast handled */ } finally { setBusy(false); }
  };

  const payMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await clientPortalAPI.payInvoice(invoice.appointmentId, { provider: 'MPESA', phone: phone.trim() || undefined });
      setState('waiting');
      startPolling();
    } catch { /* toast handled */ } finally { setBusy(false); }
  };

  return (
    <CpModal title={state === 'done' ? 'Payment received' : 'Pay invoice'} onClose={onClose}>
      <div className="cp-card-soft p-3 mb-4 flex items-center justify-between">
        <span className="text-sm cp-muted">{invoice.clinic?.name} · {invoice.petName}</span>
        <span className="font-black" style={{ color: 'var(--cp-ink)' }}>{money(invoice.amount, invoice.currency)}</span>
      </div>

      {state === 'choose' && (
        <div className="space-y-2">
          <button className="cp-btn-ghost w-full justify-start" onClick={() => setState('mpesa-phone')} disabled={busy}>
            <Smartphone className="w-5 h-5 cp-accent-text" /> Pay with M-Pesa
          </button>
          <button className="cp-btn-ghost w-full justify-start" onClick={payPaystack} disabled={busy}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5 cp-accent-text" />} Pay with card or mobile money
          </button>
          <button className="cp-btn-ghost w-full justify-start" onClick={payStripe} disabled={busy}>
            <CreditCard className="w-5 h-5 cp-accent-text" /> Pay with card (Stripe)
          </button>
        </div>
      )}

      {state === 'mpesa-phone' && (
        <form onSubmit={payMpesa} className="space-y-3">
          <div>
            <label className="cp-label">M-Pesa phone number</label>
            <input className="cp-input" type="tel" placeholder="2547XXXXXXXX" value={phone}
                   onChange={(e) => setPhone(e.target.value)} />
            <p className="text-xs cp-muted mt-1">Leave blank to use the number on your account.</p>
          </div>
          <button type="submit" className="cp-btn w-full" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send STK push'}
          </button>
        </form>
      )}

      {state === 'waiting' && (
        <div className="text-center py-6">
          <Loader2 className="w-8 h-8 animate-spin cp-accent-text mx-auto mb-3" />
          <p className="font-bold" style={{ color: 'var(--cp-ink)' }}>Check your phone</p>
          <p className="text-sm cp-muted">Enter your M-Pesa PIN to approve the payment. This window will update automatically.</p>
        </div>
      )}

      {state === 'done' && (
        <div className="text-center py-6">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#3a7d5d' }} />
          <p className="font-black" style={{ color: 'var(--cp-ink)' }}>Thank you!</p>
          <p className="text-sm cp-muted mb-4">Your payment has been received.</p>
          <button className="cp-btn mx-auto" onClick={onClose}>Done</button>
        </div>
      )}
    </CpModal>
  );
};

export default ClientInvoices;
