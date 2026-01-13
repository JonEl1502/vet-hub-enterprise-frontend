import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Router from './Router';
import { AuthProvider } from './contexts/AuthContext';
import { ClinicProvider } from './contexts/ClinicContext';
import { DataProvider } from './contexts/DataContext';
import { StaffProvider } from './contexts/StaffContext';
import { ReferenceDataProvider } from './contexts/ReferenceDataContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // React.StrictMode disabled to prevent duplicate API calls in development
  // Re-enable before production deployment for better error detection
  // <React.StrictMode>
    <AuthProvider>
      <ClinicProvider>
        <ReferenceDataProvider>
          <DataProvider>
            <StaffProvider>
              <Router />
            </StaffProvider>
          </DataProvider>
        </ReferenceDataProvider>
      </ClinicProvider>
    </AuthProvider>
  // </React.StrictMode>
);
