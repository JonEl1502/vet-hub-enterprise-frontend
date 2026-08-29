import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ClientPortalProvider } from '../../contexts/ClientPortalContext';
import ToastContainer from '../shared/common/ToastContainer';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import ClientLayout from './ClientLayout';
import ClientLogin from './auth/ClientLogin';
import VerifyOTPPage from '../shared/auth/VerifyOTPPage';
import ClientSignup from './auth/ClientSignup';
import ClientAcceptInvite from './auth/ClientAcceptInvite';
import ClientDashboard from './views/ClientDashboard';
import ClientPets from './views/ClientPets';
import ClientFarms from './views/ClientFarms';
import ClientFarmAnimalsPage from './views/ClientFarmAnimalsPage';
import ClientFarmMedical from './views/ClientFarmMedical';
import ClientPetProfile from './views/ClientPetProfile';
import ClientVisits from './views/ClientVisits';
import ClientVisitDetail from './views/ClientVisitDetail';
import ClientMessages from './views/ClientMessages';
import ClientInvoices from './views/ClientInvoices';
import ClientSettings from './views/ClientSettings';
import ClientPlan from './views/ClientPlan';

// The pet-owner portal — a self-contained app tree mounted at /client/*.
// Shares AuthContext with the staff app but renders an entirely separate,
// warmer UI and only ever calls the ownership-scoped /portal endpoints.
const FullScreen: React.FC = () => (
  <div className="client-portal min-h-screen flex items-center justify-center">
    <LoadingSpinner message="Loading..." />
  </div>
);

// Authenticated portal shell — data provider + layout, with child views in the Outlet.
const ProtectedShell: React.FC = () => (
  <ClientPortalProvider>
    <ClientLayout />
  </ClientPortalProvider>
);

const ClientApp: React.FC = () => {
  const { isAuthenticated, user, isLoading, markEmailVerified, logout } = useAuth();
  if (isLoading) return <FullScreen />;

  // Only true pet-owners (or an admin, for support) get the portal shell.
  const isClient = isAuthenticated && (user?.role === 'CLIENT' || user?.role === 'SUPER_ADMIN');

  // Email-verification gate, portal side. The API enforces this for every role
  // now, so without this screen a new pet owner would hold a valid session that
  // 403s on every call with no way to fix it. Legacy cached users have
  // emailVerified === undefined and pass straight through.
  if (isClient && user && user.emailVerified === false) {
    return (
      <div className="client-portal min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <VerifyOTPPage
            email={user.email}
            mode="account-verify"
            onOTPVerified={() => markEmailVerified()}
            onLogout={async () => { await logout(); }}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="login" element={isClient ? <Navigate to="/client" replace /> : <ClientLogin />} />
        <Route path="signup" element={isClient ? <Navigate to="/client" replace /> : <ClientSignup />} />
        <Route path="accept-invite" element={<ClientAcceptInvite />} />

        <Route element={isClient ? <ProtectedShell /> : <Navigate to="/client/login" replace />}>
          <Route index element={<ClientDashboard />} />
          <Route path="farm" element={<ClientFarms />} />
          {/* 264 — the named-animal register. Its own route so it can be the
              farm nav's second item, replacing the pet-shaped "Visits". */}
          <Route path="farm/animals" element={<ClientFarmAnimalsPage />} />
          {/* Medical is also where "Visits" went — a farm visit is a medical
              event and belongs beside the treatments it produces. */}
          <Route path="farm/medical" element={<ClientFarmMedical />} />
          <Route path="pets" element={<ClientPets />} />
          <Route path="pets/:petId" element={<ClientPetProfile />} />
          <Route path="appointments" element={<ClientVisits />} />
          <Route path="appointments/:appointmentId" element={<ClientVisitDetail />} />
          <Route path="messages" element={<ClientMessages />} />
          <Route path="invoices" element={<ClientInvoices />} />
          <Route path="settings" element={<ClientSettings />} />
          <Route path="plan" element={<ClientPlan />} />
          <Route path="*" element={<Navigate to="/client" replace />} />
        </Route>
      </Routes>
      <ToastContainer />
    </>
  );
};

export default ClientApp;
