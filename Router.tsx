import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import App from './App';
import ClientApp from './components/client/ClientApp';
import LegalPage, { type LegalKind } from './components/shared/marketing/LegalPage';
import { useAuth } from './contexts/AuthContext';
import { initAnalytics, trackPageView } from './services/analytics';

/**
 * Standalone legal page (Terms / Privacy / Security). Rendered as its own route
 * so the marketing footer links AND direct/shared URLs work whether or not the
 * visitor is signed in — a logged-in user hitting /terms sees the page, not the
 * app shell.
 */
const LegalRoute: React.FC<{ kind: LegalKind }> = ({ kind }) => {
  const navigate = useNavigate();
  return (
    <LegalPage
      kind={kind}
      onBack={() => navigate('/')}
      onNavigate={(k) => navigate(`/${k}`)}
    />
  );
};

/**
 * Loads GA4 once and fires a page_view on every client-side route change.
 * Renders nothing.
 */
const AnalyticsTracker: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    initAnalytics();
  }, []);

  React.useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
};

/**
 * Top-level router. The staff/clinic app lives at the existing routes; the
 * pet-owner portal is a separate app tree mounted at /client/*. A logged-in
 * CLIENT is redirected into the portal so they never see the staff shell.
 */
const RoutedApp: React.FC = () => {
  const { user } = useAuth();
  const isClient = user?.role === 'CLIENT';
  const staffOrPortal = (el: React.ReactNode) => (isClient ? <Navigate to="/client" replace /> : <>{el}</>);

  return (
    <Routes>
      {/* Pet-owner portal (own auth + views) */}
      <Route path="/client/*" element={<ClientApp />} />

      {/* Staff / clinic app */}
      <Route path="/" element={staffOrPortal(<App />)} />
      <Route path="/login" element={staffOrPortal(<App initialAuthView="login" />)} />
      <Route path="/signup" element={staffOrPortal(<App initialAuthView="signup" />)} />
      <Route path="/supplier-signup" element={<App initialAuthView="supplier-signup" />} />
      <Route path="/forgot-password" element={<App />} />
      <Route path="/reset-password" element={<App />} />

      {/* Public legal pages — reachable signed-in or not */}
      <Route path="/terms" element={<LegalRoute kind="terms" />} />
      <Route path="/privacy" element={<LegalRoute kind="privacy" />} />
      <Route path="/security" element={<LegalRoute kind="security" />} />

      {/* Catch all other routes */}
      <Route path="*" element={staffOrPortal(<App />)} />
    </Routes>
  );
};

const Router: React.FC = () => (
  <BrowserRouter>
    <AnalyticsTracker />
    <RoutedApp />
  </BrowserRouter>
);

export default Router;
