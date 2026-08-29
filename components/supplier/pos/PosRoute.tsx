import React, { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * `/pos` — the till's own route.
 *
 * Lazily loaded so none of the POS bundle reaches a clinic user, who will never
 * open it. The gate is by ROLE only: which branch this person may sell from,
 * and whether they may void, is decided by the server from their
 * `SupplierEmployee` record — the client cannot be trusted with that and does
 * not try.
 */
const SupplierPosApp = React.lazy(() => import('./SupplierPosApp'));

const Loading: React.FC = () => (
  <div className="supplier-pos sp-root flex items-center justify-center" style={{ height: '100dvh' }}>
    <p className="text-sm font-bold sp-muted">Opening the till…</p>
  </div>
);

const PosRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  // Not signed in: send them to the normal login. They land back here after,
  // because the app restores the URL it was asked for.
  if (!user) return <Navigate to="/login" replace />;
  // The till is a supplier surface. An admin may open it to support a shop;
  // anyone else is sent to their own home rather than shown an empty screen.
  if (!['SUPPLIER', 'SUPER_ADMIN', 'MERCHANT_ADMIN'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<Loading />}>
      <SupplierPosApp />
    </Suspense>
  );
};

export default PosRoute;
