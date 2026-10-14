import React from 'react';
import { Printer, ClipboardList } from 'lucide-react';
import AdminPageHeader, { AdminPage } from '../shared/AdminPageHeader';

/**
 * The demo call script, on one page, for a platform admin to keep open (or
 * print) while on a call with a clinic owner.
 *
 * Wording is from the vault: `11 - Marketing/Scripts/Demo and sales call
 * script`. Keep the two in step. The prices below are the plan prices set on
 * 2026-09-18 — confirm them against Plans before a call; they are a reference,
 * not read from the plan catalogue.
 *
 * Print: while this page is mounted, a print rule hides the rest of the app and
 * fits the sheet on one A4 page.
 */

const STEPS: Array<{ n: number; title: string; time: string; lines: string[] }> = [
  {
    n: 1, title: 'Open', time: '1 min',
    lines: ['“Thank you for the time. I’ll ask a few questions first so I only show what matters to you, then a quick demo, then we decide if a trial makes sense. Fair?”'],
  },
  {
    n: 2, title: 'Discovery', time: '5 min',
    lines: [
      'How do bookings come in today?',
      'Where are patient records kept?',
      'How do you invoice, and how are you paid (M-Pesa, cash, cards)?',
      'What stock do you hold, and how do you know it is low?',
      'What takes most of your time each day? Who else uses the system?',
      'What did you try before, and why did it not stick?',
    ],
  },
  {
    n: 3, title: 'Demo (only what they raised)', time: '10 min',
    lines: [
      'Booking, then the visit record, then the bill, then an M-Pesa payment, then stock. One screen per pain they named.',
      'Show the client portal: pet owners and farmers search for clinics and book (only verified clinics appear).',
      'Use demo data, never a real client’s.',
    ],
  },
  {
    n: 4, title: 'Plan and price', time: '3 min',
    lines: [
      'First month full-access and free, no card. Then Basic KES 2,500, Pro KES 5,000 or Enterprise KES 12,000 a month.',
      '“From what you told me, [plan] covers it.”',
    ],
  },
  {
    n: 5, title: 'Close', time: '1 min',
    lines: ['Ask for the small next step: “Shall I set up your trial today with your clinic details and import your client list?” Agree a date and who joins.'],
  },
];

const OBJECTIONS: Array<[string, string]> = [
  ['“Too expensive.”', 'What does a missed booking or an unbilled treatment cost you in a week? Start with Basic and the free month, and judge it on your own numbers.'],
  ['“We manage on WhatsApp and paper.”', 'That works until the person who remembers everything is off sick. Records, reminders and bills in one place mean the clinic does not depend on one person’s memory.'],
  ['“My staff won’t learn it.”', 'We set up with you and train the team on your own clinic’s data in the trial month, so nobody learns on a live day.'],
  ['“What about our existing records?”', 'We import your client and patient list before you switch over.'],
  ['“Our internet is unreliable.”', 'Do not promise offline use unless it is confirmed. Say you will check and come back.'],
  ['“I’ll think about it.”', 'Of course. What would you need to see to be sure? I’ll send that, and follow up on the date we agree.'],
  ['“We’re locked in with another vendor.”', 'When your contract ends I can show you a comparison. Until then, no need to change anything.'],
];

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 9mm; }
  body * { visibility: hidden !important; }
  .demo-sheet, .demo-sheet * { visibility: visible !important; }
  .demo-sheet { position: absolute !important; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
  .demo-sheet .sheet-cols { display: grid !important; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .demo-sheet { font-size: 10.2pt !important; line-height: 1.32 !important; }
  .demo-sheet h1 { font-size: 15pt !important; margin: 0 0 2mm !important; }
  .demo-sheet h2 { font-size: 10pt !important; margin: 0 0 .8mm !important; }
  .demo-sheet li, .demo-sheet p { margin: 0 !important; }
  .demo-sheet .step { margin-bottom: 3mm !important; break-inside: avoid; }
  .no-print { display: none !important; }
}`;

const DemoCallScriptPage: React.FC = () => {
  React.useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-demo-sheet-print', '');
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  return (
    <AdminPage>
      <div className="no-print">
        <AdminPageHeader
          title="Demo Call Script"
          subtitle="One page to keep open on a call with a clinic owner"
          icon={ClipboardList}
          actions={
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-pine text-white hover:opacity-90"
            >
              <Printer size={12} /> Print
            </button>
          }
        />
      </div>

      <div className="demo-sheet bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 text-[12px] text-slate-700 dark:text-zinc-200 leading-relaxed max-w-5xl" data-testid="demo-sheet">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h1 className="font-display text-xl font-black text-pine dark:text-zinc-100">Demo call: 20 minutes</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Open, ask, show only what they raised, price, close</p>
        </div>

        <div className="sheet-cols grid lg:grid-cols-2 gap-x-8 gap-y-3 mt-3">
          <div>
            {STEPS.map(s => (
              <div key={s.n} className="step mb-3">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-seafoam">
                  {s.n}. {s.title} <span className="text-slate-400 font-bold">· {s.time}</span>
                </h2>
                <ul className="list-disc pl-4 space-y-0.5 mt-0.5">
                  {s.lines.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            ))}
            <div className="step">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-seafoam">After the call</h2>
              <ul className="list-disc pl-4 space-y-0.5 mt-0.5">
                <li>Send the summary within 2 hours: what they said, what you showed, the trial date, one link.</li>
                <li>Follow up in 48 hours if there is no reply.</li>
                <li>Log it in the lead’s notes.</li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-seafoam">If they say…</h2>
            <dl className="mt-0.5 space-y-1.5">
              {OBJECTIONS.map(([said, reply]) => (
                <div key={said} className="step">
                  <dt className="font-bold text-slate-800 dark:text-zinc-100">{said}</dt>
                  <dd className="pl-3">{reply}</dd>
                </div>
              ))}
            </dl>

            <div className="step mt-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 text-amber-900 dark:text-amber-200">
              <p className="font-black uppercase tracking-widest text-[9px]">Rules</p>
              <p>Only show and promise what exists on the plan being discussed. Never invent a testimonial. Note anything asked that VetHubCore cannot do, and tell John. Check the prices against Plans before the call (set 2026-09-18).</p>
            </div>
          </div>
        </div>
      </div>
    </AdminPage>
  );
};

export default DemoCallScriptPage;
