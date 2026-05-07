import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  fullScreen = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
    xl: 'w-20 h-20 text-4xl',
  };

  const content = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className={`${sizeClasses[size]} bg-[#163C39] rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-[#163C39]/20 animate-pulse`}>
        🐾
      </div>
      {message && (
        <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;

