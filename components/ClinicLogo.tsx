import React, { useState } from 'react';

interface ClinicLogoProps {
  logo?: string | null;
  className?: string;
  fallback?: string;
}

const ClinicLogo: React.FC<ClinicLogoProps> = ({ logo, className = '', fallback = '🐾' }) => {
  const [failed, setFailed] = useState(false);

  const isImage = logo && (logo.startsWith('data:') || logo.startsWith('http'));

  if (isImage && !failed) {
    return (
      <img
        src={logo}
        alt="Clinic logo"
        className={`object-cover w-full h-full ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return <span>{(!isImage && logo) ? logo : fallback}</span>;
};

export default ClinicLogo;
