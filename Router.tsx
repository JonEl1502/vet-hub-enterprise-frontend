import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { useAuth } from './contexts/AuthContext';

/**
 * Router component that handles URL-based routing
 * This wraps the main App component and provides route-based navigation
 */
const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* All routes point to the main App component */}
        {/* The App component handles internal navigation based on authentication state */}
        <Route path="/" element={<App />} />
        <Route path="/login" element={<App initialAuthView="login" />} />
        <Route path="/signup" element={<App initialAuthView="signup" />} />
        <Route path="/supplier-signup" element={<App initialAuthView="supplier-signup" />} />
        <Route path="/forgot-password" element={<App />} />
        <Route path="/reset-password" element={<App />} />

        {/* Catch all other routes and redirect to root */}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;

