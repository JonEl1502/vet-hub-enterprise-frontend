import React, { useRef } from 'react';
import { X, Printer, Download, ShieldCheck } from 'lucide-react';
import { Pet, Client, Clinic, Appointment, ApptStatus } from '../../../types';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  pet: Pet;
  owner?: Client;
  clinic?: Clinic;
  vaccinationAppointments: Appointment[];
  getVaccineTasks: (appt: Appointment) => Appointment['tasks'];
  getClinicName: (clinicId: number) => string;
  getVisitNumber: (appt: Appointment) => number;
  onClose: () => void;
}

// Official VetHub Core mark — a paw print inside a big "C". Inline SVG so it
// renders crisply in print / PDF export (no external asset).
const OfficialMark: React.FC<{ size?: number; color?: string }> = ({ size = 30, color = '#134e35' }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    {/* big "C" — drawn via two arcs through the top + bottom, leaving the right open */}
    <path d="M 28.6 7.7 A 15 15 0 0 0 5 20 A 15 15 0 0 0 28.6 32.3" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
    {/* paw inside the C */}
    <g fill={color}>
      <ellipse cx="19" cy="24" rx="4.2" ry="3.4" />
      <circle cx="13.8" cy="19.5" r="1.9" />
      <circle cx="17" cy="16.3" r="1.9" />
      <circle cx="21" cy="16.3" r="1.9" />
      <circle cx="24.2" cy="19.5" r="1.9" />
    </g>
  </svg>
);

const VaccinePassportModal: React.FC<Props> = ({
  pet,
  owner,
  clinic,
  vaccinationAppointments,
  getVaccineTasks,
  getClinicName,
  getVisitNumber,
  onClose,
}) => {
  const passportRef = useRef<HTMLDivElement>(null);

  const issuedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const speciesEmoji = pet.species === 'Dog' ? '🐶' : pet.species === 'Cat' ? '🐱' : '🐾';

  // Clinic logo: render the uploaded image when it's a real URL/data-URI,
  // otherwise fall back to an emoji logo string or the verified-shield icon.
  const clinicLogoIsImg = !!clinic?.logo && (clinic.logo.startsWith('http') || clinic.logo.startsWith('data:'));

  const getStatusMeta = (appt: Appointment) => {
    if (appt.status === ApptStatus.COMPLETED)
      return { label: 'Administered', bg: '#d1fae5', fg: '#065f46', bd: '#a7f3d0', top: '#10b981' };
    if (appt.status === ApptStatus.SCHEDULED)
      return { label: 'Scheduled', bg: '#e0e7ff', fg: '#3730a3', bd: '#c7d2fe', top: '#6366f1' };
    if (appt.status === ApptStatus.CANCELLED)
      return { label: 'Cancelled', bg: '#fee2e2', fg: '#991b1b', bd: '#fecaca', top: '#ef4444' };
    return { label: appt.status.replace('_', ' '), bg: '#f1f5f9', fg: '#475569', bd: '#e2e8f0', top: '#94a3b8' };
  };

  const handlePrint = () => {
    const el = passportRef.current;
    if (!el) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Vaccine Passport — ${pet.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: white;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4 landscape; margin: 8mm; }
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      * { overflow: visible !important; }
      .vax-card { page-break-inside: avoid; break-inside: avoid; }
      .passport-doc { min-height: 190mm; display: flex; flex-direction: column; }
      .passport-body { flex: 1; }
    }
    .no-print {
      text-align: center; padding: 14px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px;
    }
    .print-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 22px; background: #134e35; color: white;
      border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  ${el.innerHTML}
</body>
</html>`);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  // ── shared inline style tokens ───────────────────────────────────────
  const S = {
    label: { fontSize: 7, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#94a3b8', marginBottom: 3 },
    value: { fontSize: 11, fontWeight: 700, color: '#0f172a' },
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[900] overflow-auto animate-in fade-in"
      style={{ padding: '16px 12px 32px' }}
    >
      {/* Controls bar — sticky inside the scroll container */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 960, margin: '0 auto 12px',
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
        borderRadius: 14, padding: '8px 10px',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-pine text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pine/90 transition-all active:scale-95 shadow-lg"
          >
            <Download size={13} /> Download / Print PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 text-white border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95"
          >
            <Printer size={13} /> Print
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-white/10 border border-white/20 rounded-xl text-white hover:bg-red-500/80 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Passport document ── */}
      <div
        ref={passportRef}
        className="passport-doc"
        style={{
          maxWidth: 960,
          margin: '0 auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 12px 48px rgba(0,0,0,0.28)',
          display: 'flex',
          flexDirection: 'column',
          /* NO overflow:hidden — that was clipping content */
        }}
      >
        {/* ── HEADER (green) — pet + owner + clinic + pet fields all here ── */}
        <div style={{
          background: 'linear-gradient(135deg, #134e35 0%, #1a6b48 60%, #0ea568 100%)',
          padding: '10px 16px 10px',
          position: 'relative', overflow: 'hidden',
          borderRadius: '16px 16px 0 0',
        }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', right: 40, bottom: -50, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          {/* Single card — all info */}
          <div style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 12px' }}>

            {/* ── PET section (top) ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.15)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, border: '1.5px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>{speciesEmoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 6, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>Veterinary Vaccine Passport</p>
                <p style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, color: 'white', marginBottom: 1 }}>{pet.name}</p>
                <p style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{pet.species} • {pet.breed}</p>
              </div>
            </div>
            {/* Pet fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '4px 14px', marginBottom: 7 }}>
              {[
                { label: 'Age',          value: pet.age != null ? `${pet.age} yr${pet.age !== 1 ? 's' : ''}` : '—' },
                { label: 'Sex',          value: pet.gender || '—' },
                { label: 'Body Weight',  value: pet.weight || '—' },
                { label: 'DOB',          value: pet.dob ? formatDate(pet.dob) : '—' },
                { label: 'Implant No.',  value: pet.rfidChipNumber || '—' },
                { label: 'Registry Tag', value: pet.tagNumber || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: 6, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>{label}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', marginBottom: 7 }} />

            {/* ── CLIENT + CLINIC row (below divider) ── */}
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {/* Client fields */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '4px 14px' }}>
                {[
                  { label: '👤 Owner', value: owner?.name || '—' },
                  { label: 'Phone',    value: owner?.phone || '—' },
                  { label: 'Email',    value: owner?.email || '—' },
                  { label: 'Address',  value: owner?.address || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: 6, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, color: 'white', lineHeight: 1.2, wordBreak: 'break-word' }}>{value}</p>
                  </div>
                ))}
              </div>
              {/* Clinic */}
              <div style={{ flexShrink: 0, textAlign: 'right', maxWidth: '38%', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 3 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {clinicLogoIsImg
                      ? <img src={clinic!.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (clinic?.logo
                          ? <span style={{ fontSize: 14, lineHeight: 1 }}>{clinic.logo}</span>
                          : <ShieldCheck size={15} color="rgba(255,255,255,0.85)" />)}
                  </div>
                  {clinic && <p style={{ fontSize: 10, fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.06em', wordBreak: 'break-word' }}>{clinic.name}</p>}
                </div>
                {clinic?.slogan && <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', wordBreak: 'break-word' }}>{clinic.slogan}</p>}
                {clinic?.subdomain && <p style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>🌐 {clinic.subdomain}</p>}
              </div>
            </div>

          </div>
        </div>

        {/* ── GREEN STRIP ── */}
        <div style={{ background: '#0ea568', padding: '5px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>Official Immunization Record</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', letterSpacing: '0.12em' }}>#{String(pet.id).padStart(6, '0')}</span>
        </div>

        {/* ── WATERMARK LINE ── */}
        <div style={{ height: 6, background: 'repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(19,78,53,0.06) 60px, rgba(19,78,53,0.06) 62px)' }} />

        {/* ── BODY — vaccinations only ── */}
        <div className="passport-body" style={{ padding: '18px 24px 22px', flex: 1, minHeight: 420, display: 'flex', flexDirection: 'column' }}>

          {/* Section divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8', whiteSpace: 'nowrap' }}>
              Vaccination Records
            </p>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* Vaccine cards — responsive auto-fill grid */}
          {vaccinationAppointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8', fontSize: 12 }}>
              No vaccination appointments on record.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 8 }}>
              {vaccinationAppointments.flatMap((appt) => {
                const vacTasks = getVaccineTasks(appt);
                const meta = getStatusMeta(appt);
                return vacTasks.map((task) => (
                  <div
                    key={`${appt.id}-${task.id}`}
                    className="vax-card"
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9,
                      borderTop: `3px solid ${meta.top}`,
                      padding: '10px 12px',
                      display: 'flex', flexDirection: 'column', gap: 5,
                    }}
                  >
                    {/* Vaccine name */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>💉</span>
                      <p style={{ fontSize: 10, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{task.name}</p>
                    </div>

                    <div style={{ height: 1, background: '#f1f5f9' }} />

                    {/* Date */}
                    <div>
                      <p style={S.label}>Date</p>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#334155' }}>{formatDate(appt.date)}</p>
                      {appt.time && <p style={{ fontSize: 7, color: '#94a3b8' }}>{appt.time}</p>}
                    </div>


                    {/* Footer: visit # + status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 2, gap: 4 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#134e35', whiteSpace: 'nowrap' }}>Visit #{getVisitNumber(appt)}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 20,
                        fontSize: 7, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap',
                        background: meta.bg, color: meta.fg, border: `1px solid ${meta.bd}`,
                      }}>
                        {appt.status === ApptStatus.COMPLETED ? '✓ ' : ''}{meta.label}
                      </span>
                    </div>
                  </div>
                ));
              })}
            </div>
          )}

          {/* Footer */}
          <div style={{
            marginTop: 'auto', paddingTop: 14,
            borderTop: '2px dashed #e2e8f0',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <p style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
                Issued: {issuedDate}
              </p>
              <p style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>
                This document is generated from verified clinic records.
              </p>
              <p style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
                VetHubCore Enterprise · Clinic-Verified Immunization Record
              </p>
            </div>
            <div style={{
              width: 56, height: 56, flexShrink: 0,
              border: '2px solid #134e35', borderRadius: '50%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: '#134e35',
            }}>
              <OfficialMark size={30} />
              <span style={{ fontSize: 6, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaccinePassportModal;
