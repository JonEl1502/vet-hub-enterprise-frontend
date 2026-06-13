import React from 'react';
import BrandMark from './BrandMark';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  /** Cover the whole viewport — for app boot / auth, before the chrome exists. */
  fullScreen?: boolean;
  /**
   * Cover only the page content area (not the sidebar / top nav). Must sit
   * inside a `relative` parent — e.g. the <main> region — so `absolute inset-0`
   * resolves to that region.
   */
  contentArea?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  fullScreen = false,
  contentArea = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  const content = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div
        className={`${sizeClasses[size]} bg-[#144E35] rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-[#144E35]/20 p-2.5`}
      >
        <BrandMark animate color="#FFFFFF" className="w-full h-full" />
      </div>
      {message && (
        <p className="text-[#1C7A5B] dark:text-zinc-400 font-bold text-sm">{message}</p>
      )}
    </div>
  );

  const overlay =
    'flex items-center justify-center bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-sm';

  // Scoped to the content region — sits below the sidebar (z-100) and navbar
  // (z-60), and is clipped to its `relative` parent so it never covers them.
  if (contentArea) {
    return <div className={`absolute inset-0 z-40 ${overlay}`}>{content}</div>;
  }

  if (fullScreen) {
    return <div className={`fixed inset-0 z-50 ${overlay}`}>{content}</div>;
  }

  return content;
};

export default LoadingSpinner;
