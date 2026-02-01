
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, XCircle, Clock, AlertCircle, FileText, Building2, 
  Mail, Phone, MapPin, Calendar, User, Eye, Download, MessageSquare
} from 'lucide-react';
import { SupplierRegistrationData, SupplierVerificationStatus } from '../types';

interface SupplierApplication extends SupplierRegistrationData {
  id: number;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

interface Props {
  applications: SupplierApplication[];
  onApprove: (applicationId: number, notes?: string) => Promise<void>;
  onReject: (applicationId: number, reason: string) => Promise<void>;
  onRefresh: () => void;
}

const SupplierVerification: React.FC<Props> = ({ applications, onApprove, onReject, onRefresh }) => {
  const [selectedApplication, setSelectedApplication] = useState<SupplierApplication | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<SupplierVerificationStatus | 'ALL'>('ALL');

  const getStatusBadge = (status: SupplierVerificationStatus) => {
    const base = "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ";
    switch (status) {
      case SupplierVerificationStatus.PENDING:
        return base + "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case SupplierVerificationStatus.VERIFIED:
        return base + "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case SupplierVerificationStatus.REJECTED:
        return base + "bg-red-500/10 text-red-500 border-red-500/20";
      case SupplierVerificationStatus.SUSPENDED:
        return base + "bg-slate-100 text-slate-500 border-slate-200";
      default:
        return base + "bg-slate-100 text-slate-500 border-slate-200";
    }
  };

  const getStatusIcon = (status: SupplierVerificationStatus) => {
    switch (status) {
      case SupplierVerificationStatus.PENDING:
        return <Clock className="text-amber-500" size={16} />;
      case SupplierVerificationStatus.VERIFIED:
        return <CheckCircle className="text-emerald-500" size={16} />;
      case SupplierVerificationStatus.REJECTED:
        return <XCircle className="text-red-500" size={16} />;
      case SupplierVerificationStatus.SUSPENDED:
        return <AlertCircle className="text-slate-500" size={16} />;
    }
  };

  const handleApprove = async () => {
    if (!selectedApplication) return;
    
    setIsSubmitting(true);
    try {
      await onApprove(selectedApplication.id, approvalNotes);
      setShowApproveModal(false);
      setSelectedApplication(null);
      setApprovalNotes('');
      onRefresh();
    } catch (error) {
      console.error('Failed to approve application:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !rejectionReason.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onReject(selectedApplication.id, rejectionReason);
      setShowRejectModal(false);
      setSelectedApplication(null);
      setRejectionReason('');
      onRefresh();
    } catch (error) {
      console.error('Failed to reject application:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredApplications = filterStatus === 'ALL' 
    ? applications 
    : applications.filter(app => app.verificationStatus === filterStatus);

  const stats = {
    pending: applications.filter(a => a.verificationStatus === SupplierVerificationStatus.PENDING).length,
    verified: applications.filter(a => a.verificationStatus === SupplierVerificationStatus.VERIFIED).length,
    rejected: applications.filter(a => a.verificationStatus === SupplierVerificationStatus.REJECTED).length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Supplier Verification</h1>
          <p className="page-subheader mt-1">Review and approve supplier applications</p>
        </div>
        <button
          onClick={onRefresh}
          className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine"
        >
          Refresh
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="compact-card bg-gradient-to-br from-amber-500 to-amber-600 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-white/80 mb-1">Pending Review</div>
              <div className="text-3xl font-black">{stats.pending}</div>
            </div>
            <Clock size={32} className="text-white/60" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="compact-card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-white/80 mb-1">Verified</div>
              <div className="text-3xl font-black">{stats.verified}</div>
            </div>
            <CheckCircle size={32} className="text-white/60" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="compact-card bg-gradient-to-br from-red-500 to-red-600 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-white/80 mb-1">Rejected</div>
              <div className="text-3xl font-black">{stats.rejected}</div>
            </div>
            <XCircle size={32} className="text-white/60" />
          </div>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['ALL', SupplierVerificationStatus.PENDING, SupplierVerificationStatus.VERIFIED, SupplierVerificationStatus.REJECTED] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              filterStatus === status
                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-pine dark:hover:text-zinc-100'
            }`}
          >
            {status === 'ALL' ? 'All Applications' : status}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredApplications.length === 0 ? (
          <div className="compact-card text-center py-12">
            <Building2 className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" size={64} />
            <p className="text-slate-400 font-bold">No applications found</p>
          </div>
        ) : (
          filteredApplications.map((application, index) => (
            <motion.div
              key={application.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="compact-card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-pine/10 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                    <Building2 className="text-pine dark:text-zinc-100" size={24} />
                  </div>
                  <div>
                    <h3 className="card-title text-lg mb-1">{application.companyName}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={getStatusBadge(application.verificationStatus || SupplierVerificationStatus.PENDING)}>
                        {application.verificationStatus || SupplierVerificationStatus.PENDING}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">
                        • {application.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-zinc-400 font-bold">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        Submitted {new Date(application.submittedAt).toLocaleDateString()}
                      </div>
                      {application.yearsInBusiness && (
                        <div className="flex items-center gap-1">
                          <Building2 size={12} />
                          {application.yearsInBusiness} years in business
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedApplication(application)}
                  className="compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 flex items-center gap-2"
                >
                  <Eye size={12} />
                  Review
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="text-slate-400" size={14} />
                  <span className="font-bold text-pine dark:text-zinc-100">{application.contactEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="text-slate-400" size={14} />
                  <span className="font-bold text-pine dark:text-zinc-100">{application.contactPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="text-slate-400" size={14} />
                  <span className="font-bold text-pine dark:text-zinc-100">{application.city}, {application.country}</span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Application Detail Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-4xl w-full my-8 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-pine dark:text-zinc-100 mb-2">{selectedApplication.companyName}</h2>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedApplication.verificationStatus || SupplierVerificationStatus.PENDING)}
                  <span className={getStatusBadge(selectedApplication.verificationStatus || SupplierVerificationStatus.PENDING)}>
                    {selectedApplication.verificationStatus || SupplierVerificationStatus.PENDING}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedApplication(null)}
                className="text-slate-400 hover:text-pine dark:hover:text-zinc-100"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {/* Company Information */}
              <div>
                <h3 className="section-header mb-3">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Category</div>
                    <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.category}</div>
                  </div>
                  {selectedApplication.registrationNumber && (
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Registration Number</div>
                      <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.registrationNumber}</div>
                    </div>
                  )}
                  {selectedApplication.taxId && (
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Tax ID</div>
                      <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.taxId}</div>
                    </div>
                  )}
                  {selectedApplication.yearsInBusiness && (
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Years in Business</div>
                      <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.yearsInBusiness} years</div>
                    </div>
                  )}
                  {selectedApplication.website && (
                    <div className="md:col-span-2">
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Website</div>
                      <a href={selectedApplication.website} target="_blank" rel="noopener noreferrer" className="font-bold text-seafoam hover:underline">
                        {selectedApplication.website}
                      </a>
                    </div>
                  )}
                  {selectedApplication.description && (
                    <div className="md:col-span-2">
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Description</div>
                      <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.description}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="section-header mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Email</div>
                    <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.contactEmail}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Phone</div>
                    <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.contactPhone}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Address</div>
                    <div className="font-bold text-pine dark:text-zinc-100">
                      {selectedApplication.address}, {selectedApplication.city}, {selectedApplication.country}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Information */}
              <div>
                <h3 className="section-header mb-3">Account Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">User Name</div>
                    <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.userName}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">User Email</div>
                    <div className="font-bold text-pine dark:text-zinc-100">{selectedApplication.userEmail}</div>
                  </div>
                </div>
              </div>

              {/* Documents */}
              {selectedApplication.documents && selectedApplication.documents.length > 0 && (
                <div>
                  <h3 className="section-header mb-3">Verification Documents</h3>
                  <div className="space-y-2">
                    {selectedApplication.documents.map((doc, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800 rounded-xl p-3"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="text-seafoam" size={20} />
                          <div>
                            <div className="text-sm font-bold text-pine dark:text-zinc-100">{doc.name}</div>
                            <div className="text-[9px] text-slate-400 font-bold">
                              {(doc.size / 1024).toFixed(2)} KB
                            </div>
                          </div>
                        </div>
                        <button className="text-pine dark:text-zinc-100 hover:bg-pine/10 dark:hover:bg-zinc-700 p-2 rounded-lg transition-all">
                          <Download size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {selectedApplication.verificationStatus === SupplierVerificationStatus.PENDING && (
              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-zinc-800">
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="flex-1 compact-button bg-red-500 text-white flex items-center justify-center gap-2"
                >
                  <XCircle size={14} />
                  Reject
                </button>
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="flex-1 compact-button bg-emerald-500 text-white flex items-center justify-center gap-2"
                >
                  <CheckCircle size={14} />
                  Approve
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="text-emerald-500" size={24} />
              </div>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100">Approve Application?</h3>
            </div>

            <p className="text-slate-600 dark:text-zinc-400 text-sm font-bold mb-4">
              Are you sure you want to approve <strong>{selectedApplication.companyName}</strong>? They will be granted access to the supplier portal.
            </p>

            <div className="mb-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Approval Notes (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold resize-none"
                placeholder="Add any notes for the supplier..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setApprovalNotes('');
                }}
                disabled={isSubmitting}
                className="flex-1 compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1 compact-button bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                    Approving...
                  </>
                ) : (
                  'Approve'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="text-red-500" size={24} />
              </div>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100">Reject Application?</h3>
            </div>

            <p className="text-slate-600 dark:text-zinc-400 text-sm font-bold mb-4">
              Please provide a reason for rejecting <strong>{selectedApplication.companyName}</strong>'s application.
            </p>

            <div className="mb-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-red-500/20 outline-none font-bold resize-none"
                placeholder="Explain why this application is being rejected..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                disabled={isSubmitting}
                className="flex-1 compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectionReason.trim()}
                className="flex-1 compact-button bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                    Rejecting...
                  </>
                ) : (
                  'Reject'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default SupplierVerification;

