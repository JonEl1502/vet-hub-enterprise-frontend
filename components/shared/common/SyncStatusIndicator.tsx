/**
 * Sync Status Indicator Component
 * 
 * Shows a subtle indicator for optimistic update sync status
 */

import React from 'react';
import { Loader2, Check, AlertCircle, Cloud } from 'lucide-react';
import { SyncStatus } from '../../../hooks/useOptimisticUpdate';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  status,
  className = '',
  showLabel = false,
  size = 'sm',
}) => {
  if (status === 'idle') {
    return null;
  }

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSize = sizeClasses[size];

  const renderIcon = () => {
    switch (status) {
      case 'syncing':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className={`${iconSize} animate-spin`} />
            {showLabel && <span className="text-sm">Syncing...</span>}
          </div>
        );
      case 'synced':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <Check className={iconSize} />
            {showLabel && <span className="text-sm">Synced</span>}
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className={iconSize} />
            {showLabel && <span className="text-sm">Sync failed</span>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`inline-flex items-center ${className}`}>
      {renderIcon()}
    </div>
  );
};

/**
 * Inline Sync Badge
 * Shows as a small badge next to content
 */
export const SyncBadge: React.FC<{ status: SyncStatus }> = ({ status }) => {
  if (status === 'idle') {
    return null;
  }

  const colors = {
    syncing: 'bg-blue-100 text-blue-700 border-blue-200',
    synced: 'bg-green-100 text-green-700 border-green-200',
    error: 'bg-red-100 text-red-700 border-red-200',
  };

  const labels = {
    syncing: 'Syncing',
    synced: 'Synced',
    error: 'Failed',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status]}`}
    >
      {status === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === 'synced' && <Check className="w-3 h-3" />}
      {status === 'error' && <AlertCircle className="w-3 h-3" />}
      {labels[status]}
    </span>
  );
};

/**
 * Floating Sync Indicator
 * Shows in bottom-right corner for global sync status
 */
export const FloatingSyncIndicator: React.FC<{ status: SyncStatus }> = ({ status }) => {
  if (status === 'idle' || status === 'synced') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3">
        <SyncStatusIndicator status={status} showLabel size="md" />
      </div>
    </div>
  );
};

