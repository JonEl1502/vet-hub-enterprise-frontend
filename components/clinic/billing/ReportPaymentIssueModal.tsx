/**
 * "Report a payment issue" — now a thin wrapper over the general
 * `ReportIssueModal` (226).
 *
 * The two forms were the same channel, the same upload scope and the same
 * admin queue; keeping two implementations meant every improvement to one
 * (searchable invoice tagging, a size cap on the attachment, the captured
 * route) had to be made twice or silently diverged.
 *
 * This keeps the call sites — Billing and Supplier Billing both open it from a
 * stuck payment with a prefilled provider and reference — and pins the type to
 * PAYMENT with the picker hidden, because a button that says "report a payment
 * issue" should not then ask what kind of issue it is.
 */
import React from 'react';
import ReportIssueModal, { type TicketTxnOption } from '../../shared/common/ReportIssueModal';

export type { TicketTxnOption };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  /** Pre-fill provider + reference (e.g. from a stuck PENDING attempt). */
  prefill?: { provider?: string; reference?: string };
  /** Recent payment attempts the user can attach so admins can reconcile on resolve. */
  transactions?: TicketTxnOption[];
}

const ReportPaymentIssueModal: React.FC<Props> = (props) => (
  <ReportIssueModal {...props} initialKind="PAYMENT" lockKind />
);

export default ReportPaymentIssueModal;
