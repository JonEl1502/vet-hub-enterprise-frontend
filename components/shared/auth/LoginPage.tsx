import React from 'react';
import AuthPages from './AuthPages';
import AuthShell from './AuthShell';

interface LoginPageProps {
  onLogin: (data: any) => void;
  onForgotPassword: () => void;
  onSignup: () => void;
  onSupplierSignup?: () => void;
  onBackToLanding?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = (props) => (
  <AuthShell>
    <AuthPages {...props} />
  </AuthShell>
);

export default LoginPage;
