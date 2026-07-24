import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Router from './Router';
import { AuthProvider } from './contexts/AuthContext';
import { ClinicProvider } from './contexts/ClinicContext';
import { SupplierProvider } from './contexts/SupplierContext';
import { DataProvider } from './contexts/DataContext';
import { StaffProvider } from './contexts/StaffContext';
import { ReferenceDataProvider } from './contexts/ReferenceDataContext';
import { FxProvider } from './contexts/FxContext';
import { ManagementScopeProvider } from './contexts/ManagementScopeContext';
import { PublicConfigProvider } from './contexts/PublicConfigContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // React.StrictMode disabled to prevent duplicate API calls in development
  // Re-enable before production deployment for better error detection
  // <React.StrictMode>
    <PublicConfigProvider>
    <AuthProvider>
      <ClinicProvider>
        <SupplierProvider>
          <FxProvider>
            <ReferenceDataProvider>
              <DataProvider>
                <StaffProvider>
                  <ManagementScopeProvider>
                    <Router />
                  </ManagementScopeProvider>
                </StaffProvider>
              </DataProvider>
            </ReferenceDataProvider>
          </FxProvider>
        </SupplierProvider>
      </ClinicProvider>
    </AuthProvider>
    </PublicConfigProvider>
  // </React.StrictMode>
);
