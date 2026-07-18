import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Syringe, FileText, Slice, Scissors, Home, Printer, Loader2, Plus,
  Image as ImageIcon, Trash2, CalendarDays, ArrowRightLeft,
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { clientPortalAPI, toast, PortalMemory, PortalMemoriesResult, PortalPetTransfer, PortalClinic } from '../../../services';
import CpModal from '../CpModal';
import ClinicFinder from '../ClinicFinder';
import { useAuth } from '../../../contexts/AuthContext';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { speciesEmoji, petAge } from '../cpUtils';

// Render free text as bullets (one per line) or a paragraph, matching the
// clinic's chosen note format so the owner sees it the same way.
const renderFormatted = (text?: string | null, fmt?: string) => {
  const val = (text || '').trim();
  if (!val) return null;
  if (fmt === 'BULLET') {
    const lines = val.split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    return <ul className="list-disc list-inside space-y-0.5 text-sm cp-muted mt-1">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
  }
  return <p className="text-sm cp-muted mt-1 whitespace-pre-wrap">{val}</p>;
};

type TabKey = 'overview' | 'vaccinations' | 'medical' | 'surgeries' | 'care' | 'memories';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'vaccinations', label: 'Vaccinations' },
  { key: 'medical', label: 'Medical' },
  { key: 'surgeries', label: 'Surgeries' },
  { key: 'care', label: 'Grooming & Boarding' },
  { key: 'memories', label: 'Memories' },
];

const ENCOUNTER_META: Record<string, { label: string; emoji: string }> = {
  VET_VISIT: { label: 'Vet visit', emoji: '🩺' },
  GROOMING: { label: 'Grooming', emoji: '✂️' },
  BOARDING: { label: 'Boarding', emoji: '🏠' },
  VACCINATION: { label: 'Vaccination', emoji: '💉' },
  RETAIL: { label: 'Purchase', emoji: '🛍️' },
};

const ClientPetProfile: React.FC = () => {
  const { petId } = useParams<{ petId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pets, clinics } = useClientPortal();

  const pet = pets.find((p) => p.id === petId);
  const [tab, setTab] = useState<TabKey>('overview');
  const [transfer, setTransfer] = useState<PortalPetTransfer | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<{ medical: any[]; vaccinations: any[]; surgeries: any[]; grooming: any[]; boarding: any[]; visits: any[] }>({
    medical: [], vaccinations: [], surgeries: [], grooming: [], boarding: [], visits: [],
  });

  useEffect(() => {
    if (!petId) return;
    clientPortalAPI.petTransferStatus(petId).then((res) => setTransfer(res.data?.transfer ?? null)).catch(() => {});
  }, [petId]);

  useEffect(() => {
    if (!petId) return;
    let alive = true;
    setLoading(true);
    clientPortalAPI.petRecords(petId)
      .then((res) => {
        if (!alive) return;
        const d: any = res.data ?? {};
        setRecords({
          medical: d.medical ?? [], vaccinations: d.vaccinations ?? [], surgeries: d.surgeries ?? [],
          grooming: d.grooming ?? [], boarding: d.boarding ?? [], visits: d.visits ?? [],
        });
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [petId]);

  const vaccineDue = useMemo(() => records.vaccinations.filter((v) => {
    if (!v.expiryDate) return false;
    const days = differenceInCalendarDays(new Date(v.expiryDate), new Date());
    return days <= 30;
  }).length, [records.vaccinations]);

  if (!pet) {
    return (
      <div className="cp-card p-8 text-center fade-in">
        <div className="text-4xl mb-2">🐾</div>
        <p className="text-sm cp-muted">Pet not found.</p>
        <button className="cp-btn mx-auto mt-4" onClick={() => navigate('/client/pets')}>Back to my pets</button>
      </div>
    );
  }

  const clinicOfPet = clinics.find((c) => c.clinic.id === pet.clinicId)?.clinic || pet.clinic;

  const printCertificate = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast.error('Allow pop-ups to print the certificate'); return; }
    const rows = records.vaccinations.map((v) => `
      <tr>
        <td>${v.vaccineName}</td>
        <td>${v.batchNumber || '—'}</td>
        <td>${v.administeredAt ? format(new Date(v.administeredAt), 'd MMM yyyy') : 'Scheduled'}</td>
        <td>${v.expiryDate ? format(new Date(v.expiryDate), 'd MMM yyyy') : '—'}</td>
        <td>${v.administeredBy || '—'}</td>
        <td class="st st-${String(v.status).toLowerCase()}">${v.status}</td>
      </tr>`).join('');
    win.document.write(`<!doctype html><html><head><title>${pet.name} — Vaccination Certificate</title>
      <style>
        @page { size: A4 portrait; margin: 16mm; }
        body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #1f3d39; }
        .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1C7A5B; padding-bottom: 12px; }
        .brand { font-size: 22px; font-weight: 800; }
        .brand small { display:block; font-size: 11px; letter-spacing: .18em; color: #8a8077; font-weight: 700; }
        h1 { font-size: 17px; margin: 18px 0 4px; }
        .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 18px; margin: 14px 0 20px; font-size: 12.5px; }
        .meta b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #8a8077; }
        table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        th { text-align: left; background: #f7f2ea; padding: 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #6d6459; }
        td { padding: 8px; border-bottom: 1px solid #ece3d6; }
        .st { font-weight: 800; font-size: 10.5px; }
        .st-administered { color: #1C7A5B; } .st-scheduled { color: #d98c2b; } .st-expired { color: #c0392b; }
        .foot { margin-top: 26px; font-size: 11px; color: #8a8077; display: flex; justify-content: space-between; }
        .seal { margin-top: 34px; display: flex; justify-content: flex-end; }
        .seal .box { text-align: center; font-size: 11px; color: #8a8077; }
        .seal .line { width: 200px; border-top: 1.5px solid #1f3d39; margin-bottom: 4px; }
      </style></head><body>
      <div class="head">
        <div class="brand">${clinicOfPet?.name || 'VetHub Clinic'}<small>VACCINATION CERTIFICATE</small></div>
        <div style="font-size:11.5px;color:#8a8077">Issued ${format(new Date(), 'd MMM yyyy')}</div>
      </div>
      <div class="meta">
        <div><b>Pet</b>${pet.name}</div>
        <div><b>Species / breed</b>${[pet.species, pet.breed].filter(Boolean).join(' / ')}</div>
        <div><b>Age</b>${petAge(pet.dob) || '—'}</div>
        <div><b>Sex</b>${pet.gender || '—'}</div>
        <div><b>Microchip</b>${pet.rfidChipNumber || '—'}</div>
        <div><b>Owner</b>${user?.name || ''}</div>
      </div>
      <table>
        <thead><tr><th>Vaccine</th><th>Batch</th><th>Administered</th><th>Valid until</th><th>Veterinarian</th><th>Status</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">No vaccination records.</td></tr>'}</tbody>
      </table>
      <div class="seal"><div class="box"><div class="line"></div>Authorised signature & stamp</div></div>
      <div class="foot"><span>Generated from the VetHub pet-owner portal.</span><span>${clinicOfPet?.name || ''}</span></div>
      <script>window.onload = () => setTimeout(() => window.print(), 150);</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-5 fade-in">
      <button className="text-xs font-bold cp-accent-text flex items-center gap-1" onClick={() => navigate('/client/pets')}>
        <ArrowLeft className="w-3.5 h-3.5" /> My pets
      </button>

      {/* Hero */}
      <div className="cp-hero p-5 sm:p-6 flex flex-wrap items-center gap-4">
        <span className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl overflow-hidden bg-white/15 ring-2 ring-white/30 shrink-0">
          {pet.avatarUrl ? <img src={pet.avatarUrl} alt={pet.name} className="w-full h-full object-cover" /> : speciesEmoji(pet.species)}
        </span>
        {/* min-w keeps the meta line readable — the actions row wraps below
            on narrow screens instead of crushing the text to a word a line. */}
        <div className="flex-1 min-w-[11rem]">
          <h1 className="text-2xl font-black text-white">{pet.name}</h1>
          <p className="text-sm text-white/70">
            {[pet.breed || pet.species, pet.gender, petAge(pet.dob), pet.weightValue ? `${pet.weightValue} ${pet.weightUnit}` : null].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-white/55 mt-0.5">{clinicOfPet?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {vaccineDue > 0 && (
            <span className="text-[11px] font-black px-2.5 py-1.5 rounded-lg" style={{ background: '#fdeee6', color: '#df6f44' }}>
              💉 {vaccineDue} vaccine{vaccineDue > 1 ? 's' : ''} due soon
            </span>
          )}
          {transfer?.status === 'PENDING' && (
            <span className="text-[11px] font-black px-2.5 py-1.5 rounded-lg bg-white/15 text-white flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer pending
            </span>
          )}
          <button className="cp-hero-btn" onClick={printCertificate}><Printer className="w-4 h-4" /> Vaccination certificate</button>
          {transfer?.status !== 'PENDING' && (
            <button className="cp-hero-btn" onClick={() => setTransferOpen(true)} title="Move this pet to a different clinic">
              <ArrowRightLeft className="w-4 h-4" /> Transfer clinic
            </button>
          )}
        </div>
      </div>

      {transferOpen && petId && (
        <TransferClinicModal
          petId={petId}
          petName={pet.name}
          currentClinicName={clinicOfPet?.name || ''}
          onClose={() => setTransferOpen(false)}
          onDone={(t) => { setTransfer(t); setTransferOpen(false); }}
        />
      )}
      {transfer?.status === 'PENDING' && (
        <div className="cp-card p-4 flex flex-wrap items-center gap-3">
          <ArrowRightLeft className="w-4 h-4 cp-accent-text shrink-0" />
          <p className="text-sm flex-1 min-w-[14rem]" style={{ color: 'var(--cp-ink)' }}>
            <b>Transfer requested</b> to {transfer.toClinic?.name}. They'll confirm — records stay with {transfer.fromClinic?.name} until it approves sharing.
          </p>
          <button
            className="cp-btn-ghost"
            onClick={async () => {
              const res = await clientPortalAPI.cancelPetTransfer(transfer.id);
              if (res.data?.cancelled) { toast.success('Transfer cancelled'); setTransfer({ ...transfer, status: 'CANCELLED' }); }
            }}
          >
            Cancel transfer
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="cp-pill-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`cp-pill-tab ${tab === t.key ? 'cp-pill-active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12"><LoadingSpinner message="Loading records..." /></div>
      ) : (
        <>
          {tab === 'overview' && <OverviewTab records={records} />}
          {tab === 'vaccinations' && <VaccinationsTab vaccinations={records.vaccinations} onPrint={printCertificate} />}
          {tab === 'medical' && <MedicalTab medical={records.medical} />}
          {tab === 'surgeries' && <SurgeriesTab surgeries={records.surgeries} />}
          {tab === 'care' && <CareTab grooming={records.grooming} boarding={records.boarding} />}
          {tab === 'memories' && petId && <MemoriesTab petId={petId} petName={pet.name} />}
        </>
      )}
    </div>
  );
};

// ---- Overview: health timeline -------------------------------------------

const OverviewTab: React.FC<{ records: { visits: any[]; vaccinations: any[]; surgeries: any[] } }> = ({ records }) => {
  const navigate = useNavigate();
  const events = useMemo(() => {
    const items: Array<{ at: string; title: string; sub: string; emoji: string; visitId?: string }> = [];
    records.visits.forEach((v) => {
      const meta = ENCOUNTER_META[v.encounterType] || ENCOUNTER_META.VET_VISIT;
      items.push({
        at: v.scheduledAt,
        title: meta.label + (v.visitType ? ` · ${String(v.visitType).replace('_', ' ').toLowerCase()}` : ''),
        sub: (v.services || []).slice(0, 3).join(', '),
        emoji: meta.emoji,
        visitId: v.id,
      });
    });
    records.vaccinations.filter((v: any) => v.administeredAt).forEach((v: any) => {
      items.push({ at: v.administeredAt, title: `Vaccinated — ${v.vaccineName}`, sub: v.expiryDate ? `valid until ${format(new Date(v.expiryDate), 'd MMM yyyy')}` : '', emoji: '💉' });
    });
    records.surgeries.forEach((s: any) => {
      items.push({ at: s.recordedAt, title: `Surgery — ${s.serviceName}`, sub: '', emoji: '🔪' });
    });
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 40);
  }, [records]);

  if (events.length === 0) {
    return <div className="cp-card p-8 text-center"><p className="text-sm cp-muted">No history yet — {`${''}`}your pet's health timeline will build up here with every visit.</p></div>;
  }

  return (
    <div className="cp-card p-5">
      <h3 className="font-black mb-4" style={{ color: 'var(--cp-ink)' }}>Health timeline</h3>
      <div className="space-y-4">
        {events.map((e, i) => (
          <div key={i} className="cp-timeline relative">
            <span className="cp-timeline-dot" />
            <button
              className={`text-left w-full ${e.visitId ? 'hover:opacity-80' : 'cursor-default'}`}
              onClick={() => e.visitId && navigate(`/client/appointments/${e.visitId}`)}
            >
              <div className="text-xs cp-muted font-bold">{format(new Date(e.at), 'd MMM yyyy')}</div>
              <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{e.emoji} {e.title}</div>
              {e.sub && <div className="text-xs cp-muted">{e.sub}</div>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Vaccinations ----------------------------------------------------------

const VaccinationsTab: React.FC<{ vaccinations: any[]; onPrint: () => void }> = ({ vaccinations, onPrint }) => {
  const dueBadge = (v: any) => {
    if (!v.expiryDate) return null;
    const days = differenceInCalendarDays(new Date(v.expiryDate), new Date());
    if (days < 0) return <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#fdecea', color: '#c0392b' }}>expired</span>;
    if (days <= 30) return <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#fdeee6', color: '#df6f44' }}>due in {days}d</span>;
    return null;
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="cp-btn-ghost" onClick={onPrint}><Printer className="w-4 h-4" /> Print certificate</button>
      </div>
      {vaccinations.length === 0 ? (
        <div className="cp-card p-8 text-center"><Syringe className="w-8 h-8 cp-accent-text mx-auto mb-2" /><p className="text-sm cp-muted">No vaccination records yet.</p></div>
      ) : vaccinations.map((v) => (
        <div key={v.id} className="cp-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--cp-accent-soft)' }}>💉</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{v.vaccineName}</div>
            <div className="text-xs cp-muted">
              {v.administeredAt ? `given ${format(new Date(v.administeredAt), 'd MMM yyyy')}` : 'Scheduled'}
              {v.expiryDate && ` · valid until ${format(new Date(v.expiryDate), 'd MMM yyyy')}`}
              {v.administeredBy && ` · ${v.administeredBy}`}
            </div>
          </div>
          {dueBadge(v)}
          <span className="cp-chip">{String(v.status).toLowerCase()}</span>
        </div>
      ))}
    </div>
  );
};

// ---- Medical ----------------------------------------------------------------

const MedicalTab: React.FC<{ medical: any[] }> = ({ medical }) => (
  medical.length === 0 ? (
    <div className="cp-card p-8 text-center"><FileText className="w-8 h-8 cp-accent-text mx-auto mb-2" /><p className="text-sm cp-muted">No medical records yet.</p></div>
  ) : (
    <div className="space-y-3">
      {medical.map((m) => (
        <div key={m.id} className="cp-card p-4">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{m.diagnosis}</div>
            <div className="text-xs cp-muted">{format(new Date(m.recordedAt), 'd MMM yyyy')}</div>
          </div>
          {m.treatment && <p className="text-sm cp-muted mt-1">{m.treatment}</p>}
        </div>
      ))}
    </div>
  )
);

// ---- Surgeries ----------------------------------------------------------------

const SurgeriesTab: React.FC<{ surgeries: any[] }> = ({ surgeries }) => (
  surgeries.length === 0 ? (
    <div className="cp-card p-8 text-center"><Slice className="w-8 h-8 cp-accent-text mx-auto mb-2" /><p className="text-sm cp-muted">No surgery records.</p></div>
  ) : (
    <div className="space-y-3">
      {surgeries.map((s) => (
        <div key={s.id} className="cp-card p-4">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{s.serviceName}{s.complexity ? ` · complexity ${s.complexity}` : ''}</div>
            <div className="text-xs cp-muted">{format(new Date(s.recordedAt), 'd MMM yyyy')}</div>
          </div>
          {s.findings && (<div className="mt-2"><span className="text-[11px] font-black uppercase tracking-wider cp-muted">Findings</span>{renderFormatted(s.findings, s.displayFormat)}</div>)}
          {s.complications && (<div className="mt-2"><span className="text-[11px] font-black uppercase tracking-wider cp-muted">Complications</span>{renderFormatted(s.complications, s.displayFormat)}</div>)}
          {s.postOpInstructions && (<div className="mt-2"><span className="text-[11px] font-black uppercase tracking-wider cp-muted">Post-op instructions</span>{renderFormatted(s.postOpInstructions, s.displayFormat)}</div>)}
        </div>
      ))}
    </div>
  )
);

// ---- Grooming & Boarding -------------------------------------------------------

const CareTab: React.FC<{ grooming: any[]; boarding: any[] }> = ({ grooming, boarding }) => (
  <div className="space-y-5">
    <section>
      <h3 className="cp-label flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5" /> Grooming</h3>
      {grooming.length === 0 ? <p className="text-sm cp-muted">No grooming history.</p> : (
        <div className="space-y-3">
          {grooming.map((g) => (
            <div key={g.id} className="cp-card p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{g.serviceName}</div>
                <div className="text-xs cp-muted">{format(new Date(g.recordedAt), 'd MMM yyyy')}</div>
              </div>
              {g.notes && renderFormatted(g.notes, g.displayFormat)}
              {Array.isArray(g.afterPhotos) && g.afterPhotos.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {g.afterPhotos.map((p: any, i: number) => (
                    <img key={i} src={typeof p === 'string' ? p : p?.url} alt="after grooming"
                         className="w-20 h-20 rounded-xl object-cover shrink-0" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
    <section>
      <h3 className="cp-label flex items-center gap-1.5"><Home className="w-3.5 h-3.5" /> Boarding stays</h3>
      {boarding.length === 0 ? <p className="text-sm cp-muted">No boarding history.</p> : (
        <div className="space-y-3">
          {boarding.map((b) => (
            <div key={b.id} className="cp-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--cp-accent-soft)' }}>🏠</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>
                  {format(new Date(b.dropOffAt), 'd MMM yyyy')}
                  {' → '}
                  {b.actualPickupAt ? format(new Date(b.actualPickupAt), 'd MMM yyyy') : (b.expectedPickupAt ? `${format(new Date(b.expectedPickupAt), 'd MMM yyyy')} (expected)` : 'ongoing')}
                </div>
                {b.kennel && <div className="text-xs cp-muted">Kennel {b.kennel}</div>}
              </div>
              <span className="cp-chip">{String(b.status).toLowerCase().replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  </div>
);

// ---- Memories -------------------------------------------------------------------

const MemoriesTab: React.FC<{ petId: string; petName: string }> = ({ petId, petName }) => {
  const [data, setData] = useState<PortalMemoriesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(() => {
    clientPortalAPI.petMemories(petId)
      .then((res) => setData(res.data ?? null))
      .finally(() => setLoading(false));
  }, [petId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const urlRes = await clientPortalAPI.memoryUploadUrl(petId, {
        contentType: file.type, filename: file.name, sizeBytes: file.size,
      });
      const info = urlRes.data;
      if (!info?.uploadUrl) throw new Error('no upload url');
      const put = await fetch(info.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      const caption = window.prompt(`Add a caption for this memory of ${petName}? (optional)`) || undefined;
      await clientPortalAPI.addMemory(petId, { url: info.publicUrl, key: info.key, kind: info.kind, caption });
      toast.success('Memory saved 💛');
      load();
    } catch {
      /* error toasts come from the API layer; fetch errors land here */
      toast.error('Could not upload that file — please try again');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (m: PortalMemory) => {
    if (!window.confirm('Delete this memory?')) return;
    await clientPortalAPI.deleteMemory(m.id);
    load();
  };

  if (loading) return <div className="py-10"><LoadingSpinner message="Loading memories..." /></div>;

  return (
    <div className="space-y-4">
      <div className="cp-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-black text-sm" style={{ color: 'var(--cp-ink)' }}>Memories</h3>
          <p className="text-xs cp-muted">
            Photos and videos of {petName} — {data ? `${data.used}/${data.limit} used` : ''}.
            {data && data.used >= data.limit && ' Limit reached — memory upgrades are coming soon.'}
            {data && !data.storageReady && ' Media storage is being set up — uploads will open soon.'}
          </p>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={onPick} />
        <button className="cp-btn" disabled={uploading || !data?.canAdd} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add memory
        </button>
      </div>

      {(!data || data.memories.length === 0) ? (
        <div className="cp-card p-8 text-center">
          <ImageIcon className="w-8 h-8 cp-accent-text mx-auto mb-2" />
          <p className="text-sm cp-muted">No memories yet — start {petName}'s album with a favourite photo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.memories.map((m) => (
            <div key={m.id} className="cp-card overflow-hidden group relative">
              {m.kind === 'VIDEO'
                ? <video src={m.url} controls className="w-full h-40 object-cover bg-black" />
                : <img src={m.url} alt={m.caption || 'memory'} className="w-full h-40 object-cover" />}
              {(m.caption || m.takenAt) && (
                <div className="p-2">
                  {m.caption && <div className="text-xs font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{m.caption}</div>}
                  <div className="text-[10px] cp-muted">{format(new Date(m.takenAt || m.createdAt), 'd MMM yyyy')}</div>
                </div>
              )}
              <button
                className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/45 text-white items-center justify-center hidden group-hover:flex"
                onClick={() => remove(m)} title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Transfer to another clinic ------------------------------------------

const TransferClinicModal: React.FC<{
  petId: string;
  petName: string;
  currentClinicName: string;
  onClose: () => void;
  onDone: (t: PortalPetTransfer) => void;
}> = ({ petId, petName, currentClinicName, onClose, onDone }) => {
  const [picked, setPicked] = useState<PortalClinic | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const res = await clientPortalAPI.requestPetTransfer(petId, { clinicId: picked.id, note: note.trim() || undefined });
      if (res.data?.transfer) {
        toast.success(`Transfer requested — ${picked.name} will confirm`);
        onDone(res.data.transfer);
      }
    } finally { setBusy(false); }
  };

  return (
    <CpModal title={`Transfer ${petName} to another clinic`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm cp-muted">
          {petName} currently lives at <b>{currentClinicName}</b>. Pick the new clinic — they confirm the transfer.
          Your history stays with the current clinic until it approves sharing, and both clinics can care for {petName} afterwards.
        </p>
        {picked ? (
          <div className="cp-card-soft p-3 flex items-center gap-3">
            <span className="text-lg">🏥</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: 'var(--cp-ink)' }}>{picked.name}</div>
              <div className="text-xs cp-muted truncate">{[picked.city, picked.phone].filter(Boolean).join(' · ')}</div>
            </div>
            <button className="text-xs font-bold cp-accent-text" onClick={() => setPicked(null)}>Change</button>
          </div>
        ) : (
          <ClinicFinder onPick={(c) => setPicked(c)} ctaLabel="Choose" busyClinicId={null} />
        )}
        <div>
          <label className="cp-label">Note for the new clinic (optional)</label>
          <textarea className="cp-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. we moved to Westlands; Fuffy is due a dental check" />
        </div>
        <button className="cp-btn w-full" disabled={!picked || busy} onClick={submit}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRightLeft className="w-4 h-4" /> Request transfer</>}
        </button>
      </div>
    </CpModal>
  );
};

export default ClientPetProfile;
