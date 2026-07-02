import React from 'react';
import { FileText, Utensils, Droplets, Globe2 } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg } from '../fields';

const DURATIONS = ['< 1 day', '1–3 days', '3–7 days', '1–2 weeks', '> 2 weeks', 'Chronic'];
const ONSETS = ['Sudden', 'Gradual', 'Intermittent', 'Unknown'];
const DIETS = ['Commercial dry', 'Commercial wet', 'Mixed', 'Raw', 'Home-cooked', 'Other'];
const APPETITE = ['Normal', 'Increased', 'Decreased', 'Absent'];
const WATER = ['Normal', 'Increased', 'Decreased'];
const URINATION = ['Normal', 'Increased', 'Decreased', 'Straining', 'Blood present'];
const DEFECATION = ['Normal', 'Diarrhoea', 'Constipation', 'Blood', 'Mucus'];
const ENVIRONMENT = ['Apartment', 'House + yard', 'Farm', 'Multi-pet household', 'Kennel/cattery'];

const HistoryStep: React.FC<StepProps> = ({ data, setData }) => {
  const d = data || {};
  return (
    <div className="space-y-4">
      <Section icon={FileText} title="Presenting Complaint">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <L label="Chief complaint / reason for visit" required className="md:col-span-1">
            <input className="field-input" placeholder="e.g. Vomiting, limping, not eating" value={d.chiefComplaint ?? ''} onChange={e => setData({ chiefComplaint: e.target.value })} />
          </L>
          <L label="Duration" required>
            <select className="field-select" value={d.duration ?? ''} onChange={e => setData({ duration: e.target.value })}>
              <option value="">Select duration</option>{DURATIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>
          <L label="Onset">
            <select className="field-select" value={d.onset ?? ''} onChange={e => setData({ onset: e.target.value })}>
              <option value="">Select onset</option>{ONSETS.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>
        </div>
        <L label="History of present illness" required>
          <textarea className="field-textarea" rows={3} placeholder="Describe the current problem in detail…" value={d.presentIllness ?? ''} onChange={e => setData({ presentIllness: e.target.value })} />
        </L>
        <L label="Current medication">
          <input className="field-input" placeholder="List any current medications" value={d.currentMedication ?? ''} onChange={e => setData({ currentMedication: e.target.value })} />
        </L>
      </Section>

      <Section icon={Utensils} title="Diet & Intake">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <L label="Diet">
            <select className="field-select" value={d.diet ?? ''} onChange={e => setData({ diet: e.target.value })}>
              <option value="">Select diet</option>{DIETS.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>
          <L label="Appetite"><Seg options={APPETITE} value={d.appetite} onChange={v => setData({ appetite: v })} /></L>
          <L label="Water intake"><Seg options={WATER} value={d.waterIntake} onChange={v => setData({ waterIntake: v })} /></L>
        </div>
      </Section>

      <Section icon={Droplets} title="Elimination">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <L label="Urination"><Seg options={URINATION} value={d.urination} onChange={v => setData({ urination: v })} /></L>
          <L label="Defecation"><Seg options={DEFECATION} value={d.defecation} onChange={v => setData({ defecation: v })} /></L>
        </div>
      </Section>

      <Section icon={Globe2} title="Environment & Background">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <L label="Environment">
            <select className="field-select" value={d.environment ?? ''} onChange={e => setData({ environment: e.target.value })}>
              <option value="">Select environment</option>{ENVIRONMENT.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>
          <L label="Indoor / outdoor"><Seg options={['Indoor', 'Outdoor', 'Both']} value={d.indoorOutdoor} onChange={v => setData({ indoorOutdoor: v })} /></L>
          <L label="Travel history">
            <input className="field-input" placeholder="Recent travel, if any" value={d.travelHistory ?? ''} onChange={e => setData({ travelHistory: e.target.value })} />
          </L>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <L label="Vaccination status"><Seg options={['Up to date', 'Overdue', 'Unknown', 'None']} value={d.vaccinationStatus} onChange={v => setData({ vaccinationStatus: v })} /></L>
          <L label="Parasite control"><Seg options={['Up to date', 'Overdue', 'Unknown', 'None']} value={d.parasiteControl} onChange={v => setData({ parasiteControl: v })} /></L>
          <L label="Previous illness / conditions">
            <input className="field-input" placeholder="Known prior conditions" value={d.previousIllness ?? ''} onChange={e => setData({ previousIllness: e.target.value })} />
          </L>
        </div>
      </Section>
    </div>
  );
};

export default HistoryStep;
