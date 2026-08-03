import React from 'react';
import { Receipt } from 'lucide-react';
import PageHeader from '../../shared/common/PageHeader';
import ReceivablesPanel from './ReceivablesPanel';

/**
 * Standalone Receivables page — AR ageing moved out of the retired Financial
 * Overview (user, 2026-08-03: Reports & Analytics IS the finance landing page
 * now; the deeper finance pages hang off it instead).
 */
const ReceivablesView: React.FC<{ currency?: string }> = ({ currency }) => (
  <div className="space-y-4 pb-10">
    <PageHeader
      title="Receivables"
      subtitle="Who owes the clinic, and for how long"
      icon={Receipt}
      onBack
    />
    <ReceivablesPanel currency={currency || 'KES'} />
  </div>
);

export default ReceivablesView;
