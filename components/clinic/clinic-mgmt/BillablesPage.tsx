/**
 * Billables — a page in its own right, under Billable Items.
 *
 * It used to open Clinic Settings pre-selected on its Billables tab, which
 * meant arriving at a screen wrapped in eleven other tabs you didn't ask for.
 * The content is the same component; only the chrome around it changed.
 *
 * The tab inside Clinic Settings is left in place — someone working through
 * clinic setup still expects to find it there.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { CircleDollarSign } from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';
import { useManagementScope } from '../../../contexts/ManagementScopeContext';
import ManagingSwitcher from '../../shared/common/ManagingSwitcher';
import PageHeader from '../../shared/common/PageHeader';
import EmergencyBillablesTab from './EmergencyBillablesTab';

const BillablesPage: React.FC = () => {
  const { clinics, selectedClinicIds } = useClinic();
  const { managedClinicId } = useManagementScope();
  // Follows the Managing switcher like the other clinic-scoped pages, falling
  // back to the first selected clinic.
  const clinicId = managedClinicId || selectedClinicIds[0] || null;
  const clinic = clinics.find((c: any) => String(c.id) === String(clinicId)) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5 pb-20"
    >
      <ManagingSwitcher kind="clinic" />
      <PageHeader
        title="Billables"
        subtitle="Daily rates, working hours and the fees that attach automatically"
        icon={CircleDollarSign}
      />
      <EmergencyBillablesTab currency={(clinic as any)?.currency ?? 'KES'} clinicId={clinicId} />
    </motion.div>
  );
};

export default BillablesPage;
