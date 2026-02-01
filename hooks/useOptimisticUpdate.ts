/**
 * Optimistic Update Hook
 * 
 * Provides a reusable pattern for optimistic UI updates with automatic rollback on error.
 * 
 * @example
 * const { execute, isUpdating, error } = useOptimisticUpdate({
 *   onOptimisticUpdate: (data) => updateLocalState(data),
 *   onApiCall: (data) => api.create(data),
 *   onSuccess: () => toast.success('Created!'),
 *   onError: () => refreshFromServer(),
 * });
 */

import { useState, useCallback } from 'react';
import { toast } from '../services';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface OptimisticUpdateOptions<TData, TResult> {
  /**
   * Function to update local state optimistically
   * Called immediately before API request
   */
  onOptimisticUpdate: (data: TData) => void;

  /**
   * API call function that returns a promise
   */
  onApiCall: (data: TData) => Promise<TResult>;

  /**
   * Optional: Called when API call succeeds
   * Use this to update state with server response if needed
   */
  onSuccess?: (result: TResult, originalData: TData) => void;

  /**
   * Optional: Called when API call fails
   * Use this to revert optimistic update (e.g., refresh from server)
   */
  onError?: (error: any, originalData: TData) => void;

  /**
   * Optional: Custom error message
   */
  errorMessage?: string;

  /**
   * Optional: Show success toast
   * @default false
   */
  showSuccessToast?: boolean;

  /**
   * Optional: Success message for toast
   */
  successMessage?: string;

  /**
   * Optional: Retry failed requests automatically
   * @default false
   */
  autoRetry?: boolean;

  /**
   * Optional: Number of retry attempts
   * @default 1
   */
  retryAttempts?: number;

  /**
   * Optional: Delay between retries in ms
   * @default 1000
   */
  retryDelay?: number;
}

export interface OptimisticUpdateResult<TData, TResult> {
  /**
   * Execute the optimistic update
   */
  execute: (data: TData) => Promise<TResult | null>;

  /**
   * Current sync status
   */
  status: SyncStatus;

  /**
   * Whether an update is in progress
   */
  isUpdating: boolean;

  /**
   * Error from last failed update
   */
  error: Error | null;

  /**
   * Manually retry the last failed update
   */
  retry: () => Promise<void>;

  /**
   * Clear error state
   */
  clearError: () => void;
}

export function useOptimisticUpdate<TData = any, TResult = any>(
  options: OptimisticUpdateOptions<TData, TResult>
): OptimisticUpdateResult<TData, TResult> {
  const {
    onOptimisticUpdate,
    onApiCall,
    onSuccess,
    onError,
    errorMessage = 'Operation failed',
    showSuccessToast = false,
    successMessage = 'Success!',
    autoRetry = false,
    retryAttempts = 1,
    retryDelay = 1000,
  } = options;

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [lastData, setLastData] = useState<TData | null>(null);

  const executeWithRetry = useCallback(
    async (data: TData, attempt: number = 0): Promise<TResult | null> => {
      try {
        // Call API
        const result = await onApiCall(data);

        // Success
        setStatus('synced');
        setError(null);

        // Call success callback
        if (onSuccess) {
          onSuccess(result, data);
        }

        // Show success toast if enabled
        if (showSuccessToast) {
          toast.success(successMessage);
        }

        // Reset to idle after a short delay
        setTimeout(() => setStatus('idle'), 2000);

        return result;
      } catch (err: any) {
        // Check if we should retry
        if (autoRetry && attempt < retryAttempts) {
          console.log(`[OptimisticUpdate] Retrying (${attempt + 1}/${retryAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return executeWithRetry(data, attempt + 1);
        }

        // All retries failed or no retry
        setStatus('error');
        setError(err);

        // Call error callback to revert optimistic update
        if (onError) {
          onError(err, data);
        }

        // Show error toast
        toast.error(errorMessage);

        return null;
      }
    },
    [onApiCall, onSuccess, onError, errorMessage, showSuccessToast, successMessage, autoRetry, retryAttempts, retryDelay]
  );

  const execute = useCallback(
    async (data: TData): Promise<TResult | null> => {
      // Store data for retry
      setLastData(data);
      setStatus('syncing');
      setError(null);

      // Apply optimistic update immediately
      onOptimisticUpdate(data);

      // Execute API call with retry logic
      return executeWithRetry(data);
    },
    [onOptimisticUpdate, executeWithRetry]
  );

  const retry = useCallback(async () => {
    if (lastData) {
      await execute(lastData);
    }
  }, [lastData, execute]);

  const clearError = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  return {
    execute,
    status,
    isUpdating: status === 'syncing',
    error,
    retry,
    clearError,
  };
}

