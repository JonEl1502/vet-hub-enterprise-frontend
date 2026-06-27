import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animate = true,
}) => {
  const baseClasses = 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  const Component = animate ? motion.div : 'div';
  const animationProps = animate
    ? {
        animate: {
          backgroundPosition: ['0% 0%', '100% 0%'],
        },
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        },
      }
    : {};

  return (
    <Component
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{
        ...style,
        backgroundSize: '200% 100%',
      }}
      {...animationProps}
    />
  );
};

// Visit Card Skeleton
export const AppointmentCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={16} />
        </div>
        <Skeleton variant="rectangular" width={80} height={24} />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton width="30%" height={16} />
      </div>
      <div className="flex gap-2">
        <Skeleton width={60} height={20} />
        <Skeleton width={60} height={20} />
        <Skeleton width={60} height={20} />
      </div>
    </div>
  );
};

// Task Card Skeleton
export const TaskCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton variant="rectangular" width={20} height={20} />
        <div className="flex-1 space-y-2">
          <Skeleton width="70%" height={18} />
          <Skeleton width="50%" height={14} />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton width={80} height={32} />
        <Skeleton width={80} height={32} />
        <Skeleton width={80} height={32} />
      </div>
    </div>
  );
};

// List Skeleton
export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <AppointmentCardSkeleton key={index} />
      ))}
    </div>
  );
};

// Calendar Skeleton
export const CalendarSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton width={200} height={28} />
        <div className="flex gap-2">
          <Skeleton width={100} height={36} />
          <Skeleton width={100} height={36} />
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, index) => (
          <Skeleton key={index} height={80} />
        ))}
      </div>
    </div>
  );
};

// Form Skeleton
export const FormSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton width="30%" height={14} />
          <Skeleton width="100%" height={40} />
        </div>
      ))}
      <div className="flex gap-3">
        <Skeleton width={120} height={44} />
        <Skeleton width={120} height={44} />
      </div>
    </div>
  );
};

export default Skeleton;

