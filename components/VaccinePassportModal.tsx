import React, { useRef } from 'react';
import { X, Printer, Download, ShieldCheck } from 'lucide-react';
import { Pet, Client, Clinic, Appointment, ApptStatus } from '../types';
import { formatDate } from '../services/utils/dateFormatter';

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
        style={{
          maxWidth: 960,
          margin: '0 auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 12px 48px rgba(0,0,0,0.28)',
          /* NO overflow:hidden — that was clipping content */
        }}
      >
        {/* ── HEADER ── */}
        <div style={{
          background: 'linear-gradient(135deg, #134e35 0%, #1a6b48 60%, #0ea568 100%)',
          padding: '20px 28px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          position: 'relative', overflow: 'hidden',
          borderRadius: '16px 16px 0 0',
        }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', right: 40, bottom: -50, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          {/* Left: emoji + pet name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1, minWidth: 0 }}>
            <div style={{
              width: 60, height: 60, background: 'rgba(255,255,255,0.15)',
              borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0,
            }}>{speciesEmoji}</div>
            <div style={{ color: 'white', minWidth: 0 }}>
              <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>
                Veterinary Vaccine Passport
              </p>
              <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 3 }}>{pet.name}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {pet.species} • {pet.breed}
              </p>
            </div>
          </div>

          {/* Right: shield + clinic */}
          <div style={{ zIndex: 1, textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              width: 44, height: 44, background: 'rgba(255,255,255,0.15)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: 'auto', marginBottom: 5, border: '2px solid rgba(255,255,255,0.25)',
            }}>
              <ShieldCheck size={22} color="white" />
            </div>
            {clinic && (
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {clinic.name}
              </p>
            )}
          </div>
        </div>

        {/* ── GREEN STRIP ── */}
        <div style={{ background: '#0ea568', padding: '5px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
            Official Immunization Record
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', letterSpacing: '0.12em' }}>
            #{String(pet.id).padStart(6, '0')}
          </span>
        </div>

        {/* ── WATERMARK LINE ── */}
        <div style={{ height: 6, background: 'repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(19,78,53,0.06) 60px, rgba(19,78,53,0.06) 62px)' }} />

        {/* ── BODY ── */}
        <div style={{ padding: '18px 24px 22px' }}>

          {/* Info row: owner (left) | pet fields (right) */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>

            {/* Owner card */}
            {owner && (
              <div style={{
                flex: '0 0 auto', width: 'clamp(180px, 30%, 260px)',
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <div style={{
                    width: 28, height: 28, background: '#10b981', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: 'white', fontSize: 14,
                  }}>👤</div>
                  <p style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#059669' }}>Owner / Guardian</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>{owner.name}</p>
                {owner.phone && <p style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>📞 {owner.phone}</p>}
                {owner.email && <p style={{ fontSize: 9, color: '#475569' }}>✉ {owner.email}</p>}
                {owner.address && <p style={{ fontSize: 8, color: '#64748b', lineHeight: 1.4 }}>📍 {owner.address}</p>}
              </div>
            )}

            {/* Clinic card */}
            {clinic && (
              <div style={{
                flex: '0 0 auto', width: 'clamp(150px, 26%, 210px)',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <div style={{
                    width: 28, height: 28, background: '#134e35', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: 'white', fontSize: 13,
                  }}>🏥</div>
                  <p style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#166534' }}>Issuing Clinic</p>
                </div>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>{clinic.name}</p>
                {clinic.slogan && <p style={{ fontSize: 8, color: '#475569', fontStyle: 'italic', lineHeight: 1.3 }}>{clinic.slogan}</p>}
                {clinic.subdomain && <p style={{ fontSize: 8, fontWeight: 600, color: '#059669' }}>🌐 {clinic.subdomain}</p>}
                {clinic.rating != null && (
                  <div style={{ marginTop: 'auto', paddingTop: 4, borderTop: '1px solid #bbf7d0' }}>
                    <p style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#94a3b8', marginBottom: 2 }}>Rating</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#134e35' }}>
                      {'★'.repeat(Math.round(clinic.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(clinic.rating)))} {clinic.rating}/5
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Pet info grid */}
            <div style={{
              flex: 1, minWidth: 200,
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 10, padding: 12,
            }}>
              {[
                { label: 'Species', value: pet.species },
                { label: 'Breed', value: pet.breed },
                { label: 'Age', value: pet.age != null ? `${pet.age} yr${pet.age !== 1 ? 's' : ''}` : '—' },
                { label: 'Sex', value: pet.gender || '—' },
                { label: 'Body Weight', value: pet.weight || '—' },
                { label: 'DOB', value: pet.dob ? formatDate(pet.dob) : '—' },
                { label: 'Implant No.', value: pet.rfidChipNumber || '—' },
                { label: 'Registry Tag', value: pet.tagNumber || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={S.label}>{label}</p>
                  <p style={S.value}>{value}</p>
                </div>
              ))}
            </div>
          </div>

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
            marginTop: 18, paddingTop: 14,
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
                VetHub Enterprise · Clinic-Verified Immunization Record
              </p>
            </div>
            <div style={{
              width: 56, height: 56, flexShrink: 0,
              border: '2px solid #134e35', borderRadius: '50%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: '#134e35',
            }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>🛡️</span>
              <span style={{ fontSize: 6, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaccinePassportModal;
