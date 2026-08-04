import React from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useData } from '../../../../contexts/DataContext';
import { useClinic } from '../../../../contexts/ClinicContext';
import { UserRole } from '../../../../types';
import StaffDashboard from '../StaffDashboard';
import WorkInProgressStrip from './WorkInProgressStrip';
import { useDayRange, DayRangeControl } from './roleShared';
import FrontOfficeDashboard from './FrontOfficeDashboard';
import GroomerDashboard from './GroomerDashboard';
import VetDashboard from './VetDashboard';

/**
 * Role-based dashboards (user, 2026-08-02) — the landing page a staff member
 * gets is chosen by their JOB, so a groomer opens to their queue and the front
 * desk opens to money owed.
 *
 * ⚠️ THIS IS AN AFFORDANCE, NOT A SECURITY BOUNDARY.
 * Per `reference_role_gating_model` the API authorises on the GLOBAL
 * `User.role` only — `clinicRole` and per-user permission grants are NOT
 * enforced server-side. Routing a groomer to the grooming view does not stop
 * their token reaching clinical endpoints. Do not let this page become the
 * justification for skipping real server-side enforcement.
 *
 * Any role without a bespoke view keeps the generic `StaffDashboard`, so
 * adding a role here is additive and never removes someone's dashboard.
 */

interface Props {
  onNavigate?: (view: string, params?: any) => void;
}

/**
 * Roles with a bespoke dashboard. These reach the 'dashboard' view WITHOUT a
 * VIEW_DASHBOARD grant — it is their own operational workspace, not the
 * owner's clinic-wide stats page (which is what that grant protects). Without
 * this, the dashboards shipped unreachable: the roles they were built for
 * landed on Visits and had no Dashboard menu item at all (found live on prod
 * with the kabivets.test accounts, 2026-08-03).
 */
export const ROLE_DASHBOARD_ROLES: ReadonlySet<string> = new Set([
  UserRole.FRONT_OFFICE, UserRole.RECEPTIONIST, UserRole.CASHIER,
  UserRole.GROOMER, UserRole.VET, UserRole.VET_NURSE,
]);

const RoleDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { appointments, clients } = useData() as any;
  const clinicCtx = useClinic() as any;

  const role = String(user?.role || '');
  const currency = clinicCtx?.activeClinic?.currency
    || clinicCtx?.clinics?.[0]?.currency
    || 'KES';

  const visits = appointments || [];
  // Every dashboard has a day picker (user, 2026-08-04) — defaults to today,
  // clearing snaps back. The shell owns it so all four role views agree.
  const { range, onChange: onRangeChange } = useDayRange();
  const generic = <StaffDashboard onNavigate={onNavigate} range={range} />;

  const view = (() => {
    switch (role) {
      case UserRole.FRONT_OFFICE:
      case UserRole.RECEPTIONIST:
      case UserRole.CASHIER:
        return <FrontOfficeDashboard visits={visits} clients={clients || []} currency={currency} onNavigate={onNavigate} range={range} />;
      case UserRole.GROOMER:
        return <GroomerDashboard visits={visits} currency={currency} onNavigate={onNavigate} range={range} />;
      case UserRole.VET:
      case UserRole.VET_NURSE:
        return <VetDashboard visits={visits} currency={currency} vetUserId={user?.id} onNavigate={onNavigate} range={range} />;
      default:
        return null;
    }
  })();

  // No bespoke view for this role — behave exactly as before.
  if (!view) return generic;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();
  const firstName = (user as any)?.firstName || (user as any)?.profile?.firstName || '';
  const roleLabel = role.replace(/_/g, ' ').toLowerCase();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div>
        <h2 className="page-header">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="page-subheader">
          Your {roleLabel} view — {range.isToday ? "here's today" : `showing ${range.label.toLowerCase()}`}.
        </p>
      </div>

      {/* Day picker — same control as the owner dashboard and the Visits list. */}
      <DayRangeControl range={range} onChange={onRangeChange} />

      {/* Shared across every role: what the clinic is doing right now. */}
      <WorkInProgressStrip visits={visits} range={range} onOpen={() => onNavigate?.('appointments')} />

      {view}
    </div>
  );
};

export default RoleDashboard;
