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
    @page { size: A4 portrait; margin: 12mm; }
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
    }

    .passport {
      max-width: 750px;
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

    /* ── TABLE ── */
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #134e35;
      color: white;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 8px 12px;
      text-align: left;
    }
    thead th:first-child { border-radius: 8px 0 0 0; }
    thead th:last-child { border-radius: 0 8px 0 0; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    tbody td {
      padding: 10px 12px;
      font-size: 11px;
      color: #334155;
      vertical-align: top;
    }
    .vaccine-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .vaccine-pill {
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 2px 7px;
      border-radius: 20px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .status-done { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .status-scheduled { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .status-cancelled { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .status-other { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .visit-badge {
      font-size: 10px;
      font-weight: 700;
      color: #134e35;
    }
    .date-cell { font-size: 11px; font-weight: 600; color: #334155; white-space: nowrap; }
    .clinic-cell { font-size: 10px; color: #64748b; }

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
      <div className="sticky top-4 z-10 mb-4 flex items-center justify-between w-full max-w-3xl">
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
      <div ref={passportRef} className="w-full max-w-3xl">
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
          <div style={{ padding: '24px 32px 28px' }}>

            {/* Pet info grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: 16, marginBottom: 20,
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
                  <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Owner row */}
            {owner && (
              <div style={{
                display: 'flex', gap: 12, marginBottom: 22,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 12, padding: '12px 16px', alignItems: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, background: '#10b981', borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: 'white', fontSize: 18,
                }}>👤</div>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#059669', marginBottom: 2 }}>Owner / Guardian</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{owner.name}</p>
                  <p style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{owner.phone}{owner.email ? ` • ${owner.email}` : ''}</p>
                </div>
              </div>
            )}

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                Vaccination Appointments
              </p>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            {/* Table */}
            {vaccinationAppointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
                No vaccination appointments on record.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: 10, overflow: 'hidden' }}>
                <thead>
                  <tr>
                    {['Visit', 'Date', 'Vaccines Administered', 'Clinic', 'Status'].map((h, i) => (
                      <th key={h} style={{
                        background: '#134e35', color: 'white',
                        fontSize: 8, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase',
                        padding: '9px 12px', textAlign: 'left',
                        borderRadius: i === 0 ? '8px 0 0 0' : i === 4 ? '0 8px 0 0' : 0,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vaccinationAppointments.map((appt, rowIdx) => {
                    const vacTasks = getVaccineTasks(appt);
                    const { label, color } = getStatusLabel(appt);
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
                    return (
                      <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9', background: rowIdx % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#134e35' }}>
                          #{getVisitNumber(appt)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                          {formatDate(appt.date)}
                          {appt.time && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{appt.time}</div>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {vacTasks.map(t => (
                              <span key={t.id} style={{
                                background: '#d1fae5', color: '#065f46',
                                border: '1px solid #a7f3d0',
                                padding: '2px 8px', borderRadius: 20,
                                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                              }}>
                                💉 {t.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 10, color: '#64748b' }}>
                          {getClinicName(appt.clinicId)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 20,
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            background: bgMap[statusClass], color: fgMap[statusClass],
                            border: `1px solid ${bdMap[statusClass]}`,
                          }}>
                            {appt.status === ApptStatus.COMPLETED ? '✓ ' : ''}
                            {label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
