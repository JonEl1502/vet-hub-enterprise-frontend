import React, { useRef } from 'react';
import { X, Printer, Download, ShieldCheck, CheckCircle2, Clock, XCircle } from 'lucide-react';
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

  const getStatusLabel = (appt: Appointment) => {
    if (appt.status === ApptStatus.COMPLETED) return { label: 'Administered', color: '#10b981' };
    if (appt.status === ApptStatus.SCHEDULED) return { label: 'Scheduled', color: '#6366f1' };
    if (appt.status === ApptStatus.CANCELLED) return { label: 'Cancelled', color: '#ef4444' };
    return { label: appt.status.replace('_', ' '), color: '#94a3b8' };
  };

  const handlePrint = () => {
    const el = passportRef.current;
    if (!el) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vaccine Passport — ${pet.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
    }

    .passport {
      max-width: 100%;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    /* ── HEADER ── */
    .header {
      background: linear-gradient(135deg, #134e35 0%, #1a6b48 60%, #0ea568 100%);
      padding: 28px 32px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      right: -40px;
      top: -40px;
      width: 180px;
      height: 180px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
    }
    .header::after {
      content: '';
      position: absolute;
      right: 40px;
      bottom: -60px;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
    }
    .header-left { display: flex; align-items: center; gap: 18px; z-index: 1; }
    .pet-avatar {
      width: 72px;
      height: 72px;
      background: rgba(255,255,255,0.15);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      border: 2px solid rgba(255,255,255,0.25);
      flex-shrink: 0;
    }
    .header-title { color: white; }
    .passport-label {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.6);
      margin-bottom: 4px;
    }
    .pet-name {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 4px;
    }
    .pet-sub {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.75);
      letter-spacing: 0.06em;
    }
    .header-right { z-index: 1; text-align: right; }
    .shield-badge {
      width: 52px;
      height: 52px;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      margin-bottom: 6px;
      border: 2px solid rgba(255,255,255,0.25);
    }
    .clinic-name-badge {
      font-size: 10px;
      font-weight: 700;
      color: rgba(255,255,255,0.85);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    /* ── STRIP ── */
    .strip {
      background: #0ea568;
      padding: 6px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .strip-text {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.9);
    }
    .passport-no {
      font-size: 10px;
      font-weight: 700;
      color: rgba(255,255,255,0.8);
      font-family: monospace;
      letter-spacing: 0.12em;
    }

    /* ── BODY ── */
    .body { padding: 24px 32px 28px; }

    /* ── PET INFO GRID ── */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .info-cell {}
    .info-label {
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 3px;
    }
    .info-value {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
    }

    /* ── OWNER ROW ── */
    .owner-row {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 14px 16px;
      align-items: center;
    }
    .owner-icon {
      width: 36px;
      height: 36px;
      background: #10b981;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: white;
      font-size: 16px;
    }
    .owner-info {}
    .owner-sub { font-size: 9px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; color: #059669; margin-bottom: 2px; }
    .owner-name { font-size: 13px; font-weight: 700; color: #0f172a; }
    .owner-contact { font-size: 10px; color: #475569; margin-top: 1px; }

    /* ── SECTION HEADER ── */
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .section-line { flex: 1; height: 1px; background: #e2e8f0; }
    .section-title {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #94a3b8;
      white-space: nowrap;
    }

    /* ── OWNER / PET TWO-COL ── */
    .info-columns { display: flex; gap: 14px; margin-bottom: 18px; align-items: stretch; }
    .owner-card {
      width: 34%; flex-shrink: 0;
      background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 12px; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .owner-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
    .owner-icon-box {
      width: 32px; height: 32px; background: #10b981; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: white; font-size: 16px;
    }

    /* ── VACCINE CARDS ── */
    .vax-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .vax-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
    }
    .vax-name { display: flex; align-items: flex-start; gap: 6px; }
    .vax-name-text { font-size: 11px; font-weight: 800; color: #0f172a; line-height: 1.3; }
    .vax-divider { height: 1px; background: #f1f5f9; }
    .vax-label { font-size: 7px; font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px; }
    .vax-date { font-size: 10px; font-weight: 700; color: #334155; }
    .vax-time { font-size: 8px; color: #94a3b8; }
    .vax-clinic { font-size: 9px; font-weight: 600; color: #475569; }
    .vax-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
    .vax-visit { font-size: 9px; font-weight: 700; color: #134e35; }
    .status-pill {
      padding: 2px 7px; border-radius: 20px;
      font-size: 8px; font-weight: 800; text-transform: uppercase;
    }
    .status-done { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .status-scheduled { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .status-cancelled { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .status-other { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    /* ── FOOTER ── */
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 2px dashed #e2e8f0;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    .footer-left {}
    .footer-issued {
      font-size: 9px;
      color: #94a3b8;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .footer-verify {
      font-size: 10px;
      color: #475569;
      font-weight: 600;
    }
    .footer-seal {
      width: 60px;
      height: 60px;
      border: 2px solid #134e35;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #134e35;
      flex-shrink: 0;
    }
    .seal-text { font-size: 7px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
    .seal-icon { font-size: 20px; line-height: 1; }

    /* ── WATERMARK PATTERN ── */
    .watermark-row {
      background: repeating-linear-gradient(
        90deg,
        transparent, transparent 60px,
        rgba(19,78,53,0.04) 60px, rgba(19,78,53,0.04) 62px
      );
      height: 8px;
    }

    /* ── PRINT BTN ── */
    .print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: #134e35;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      margin: 20px auto;
      display: flex;
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center; padding: 16px 0;">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  ${el.innerHTML}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[900] flex items-start justify-center p-4 overflow-y-auto animate-in fade-in">
      {/* Controls bar */}
      <div className="sticky top-4 z-10 mb-4 flex items-center justify-between w-full max-w-5xl">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-pine text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pine/90 transition-all active:scale-95 shadow-lg"
          >
            <Download size={14} /> Download / Print PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all active:scale-95 shadow-lg"
          >
            <Printer size={14} /> Print
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-500 hover:text-red-500 transition-colors shadow-lg"
        >
          <X size={16} />
        </button>
      </div>

      {/* Passport document */}
      <div ref={passportRef} className="w-full max-w-5xl">
        <div
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: 'white',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #134e35 0%, #1a6b48 60%, #0ea568 100%)',
            padding: '28px 32px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* bg circles */}
            <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', right: 40, bottom: -60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 18, zIndex: 1 }}>
              <div style={{
                width: 72, height: 72,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36,
                border: '2px solid rgba(255,255,255,0.25)',
                flexShrink: 0,
              }}>
                {speciesEmoji}
              </div>
              <div style={{ color: 'white' }}>
                <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                  Veterinary Vaccine Passport
                </p>
                <p style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>
                  {pet.name}
                </p>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {pet.species} • {pet.breed}
                </p>
              </div>
            </div>

            <div style={{ zIndex: 1, textAlign: 'right' }}>
              <div style={{
                width: 52, height: 52,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: 'auto', marginBottom: 6,
                border: '2px solid rgba(255,255,255,0.25)',
              }}>
                <ShieldCheck size={26} color="white" />
              </div>
              {clinic && (
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {clinic.name}
                </p>
              )}
            </div>
          </div>

          {/* Green strip */}
          <div style={{ background: '#0ea568', padding: '6px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
              Official Immunization Record
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', letterSpacing: '0.12em' }}>
              #{String(pet.id).padStart(6, '0')}
            </span>
          </div>

          {/* Watermark row */}
          <div style={{ height: 8, background: 'repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(19,78,53,0.06) 60px, rgba(19,78,53,0.06) 62px)' }} />

          {/* Body */}
          <div style={{ padding: '20px 28px 24px' }}>

            {/* Two-column: Owner LEFT | Pet info RIGHT */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'stretch' }}>

              {/* Owner card (left, ~34%) */}
              {owner && (
                <div style={{
                  width: '34%', flexShrink: 0,
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <div style={{
                      width: 32, height: 32, background: '#10b981', borderRadius: 9,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: 'white', fontSize: 16,
                    }}>👤</div>
                    <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#059669' }}>Owner / Guardian</p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{owner.name}</p>
                  {owner.phone && <p style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>📞 {owner.phone}</p>}
                  {owner.email && <p style={{ fontSize: 10, color: '#475569' }}>✉ {owner.email}</p>}
                  {owner.address && <p style={{ fontSize: 9, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>📍 {owner.address}</p>}
                </div>
              )}

              {/* Pet info grid (right, remaining width) */}
              <div style={{
                flex: 1,
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 12, padding: 14,
              }}>
                {[
                  { label: 'Species', value: pet.species },
                  { label: 'Breed', value: pet.breed },
                  { label: 'Age', value: `${pet.age} yr${pet.age !== 1 ? 's' : ''}` },
                  { label: 'Gender', value: pet.gender },
                  { label: 'Weight', value: pet.weight || '—' },
                  { label: 'DOB', value: pet.dob ? formatDate(pet.dob) : '—' },
                  { label: 'Chip / RFID', value: pet.rfidChipNumber || '—' },
                  { label: 'Tag No.', value: pet.tagNumber || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 3 }}>{label}</p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                Vaccination Records
              </p>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            {/* Vaccine cards — one card per vaccine task */}
            {vaccinationAppointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
                No vaccination appointments on record.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {vaccinationAppointments.flatMap((appt) => {
                  const vacTasks = getVaccineTasks(appt);
                  const { label } = getStatusLabel(appt);
                  const statusClass = appt.status === ApptStatus.COMPLETED ? 'done'
                    : appt.status === ApptStatus.SCHEDULED ? 'scheduled'
                    : appt.status === ApptStatus.CANCELLED ? 'cancelled' : 'other';
                  const bgMap: Record<string, string> = {
                    done: '#d1fae5', scheduled: '#e0e7ff', cancelled: '#fee2e2', other: '#f1f5f9',
                  };
                  const fgMap: Record<string, string> = {
                    done: '#065f46', scheduled: '#3730a3', cancelled: '#991b1b', other: '#475569',
                  };
                  const bdMap: Record<string, string> = {
                    done: '#a7f3d0', scheduled: '#c7d2fe', cancelled: '#fecaca', other: '#e2e8f0',
                  };
                  return vacTasks.map((task) => (
                    <div key={`${appt.id}-${task.id}`} style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '12px 14px',
                      borderTop: `3px solid ${fgMap[statusClass]}`,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      {/* Vaccine name */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>💉</span>
                        <p style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{task.name}</p>
                      </div>

                      {/* Divider */}
                      <div style={{ height: 1, background: '#f1f5f9' }} />

                      {/* Date */}
                      <div>
                        <p style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 2 }}>Date</p>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>{formatDate(appt.date)}</p>
                        {appt.time && <p style={{ fontSize: 8, color: '#94a3b8' }}>{appt.time}</p>}
                      </div>

                      {/* Clinic */}
                      <div>
                        <p style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 2 }}>Clinic</p>
                        <p style={{ fontSize: 9, fontWeight: 600, color: '#475569' }}>{getClinicName(appt.clinicId)}</p>
                      </div>

                      {/* Footer row: visit # + status */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#134e35' }}>Visit #{getVisitNumber(appt)}</span>
                        <span style={{
                          padding: '2px 7px', borderRadius: 20,
                          fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
                          background: bgMap[statusClass], color: fgMap[statusClass],
                          border: `1px solid ${bdMap[statusClass]}`,
                        }}>
                          {appt.status === ApptStatus.COMPLETED ? '✓ ' : ''}{label}
                        </span>
                      </div>
                    </div>
                  ));
                })}
              </div>
            )}

            {/* Footer */}
            <div style={{
              marginTop: 24, paddingTop: 16,
              borderTop: '2px dashed #e2e8f0',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16,
            }}>
              <div>
                <p style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Issued: {issuedDate}
                </p>
                <p style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>
                  This document is generated from verified clinic records.
                </p>
                <p style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                  VetHub Enterprise · Clinic-Verified Immunization Record
                </p>
              </div>
              {/* Seal */}
              <div style={{
                width: 64, height: 64,
                border: '2.5px solid #134e35', borderRadius: '50%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#134e35', flexShrink: 0,
              }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>🛡️</span>
                <span style={{ fontSize: 6, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaccinePassportModal;
