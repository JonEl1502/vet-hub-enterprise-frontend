/**
 * Advanced Optimistic Update Examples
 * 
 * Demonstrates advanced patterns including:
 * - Race condition handling
 * - Multiple rapid updates
 * - Batch operations
 * - Complex state updates
 */

import React, { useState, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { clientsAPI, visitsAPI } from '../services';
import { SyncStatusIndicator } from '../components/shared/common/SyncStatusIndicator';
import { Client, Visit, TaskStatus } from '../types';

// ============================================
// Example 1: Debounced Updates (Prevent Race Conditions)
// ============================================

export const DebouncedClientUpdate: React.FC<{ clientId: number }> = ({ clientId }) => {
  const { updateClientOptimistically, refreshClients } = useData();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const { execute, status } = useOptimisticUpdate<Partial<Client>, { client: Client }>({
    onOptimisticUpdate: (updates) => {
      updateClientOptimistically(clientId, (client) => ({
        ...client,
        ...updates,
      }));
    },
    onApiCall: async (updates) => {
      return await clientsAPI.update(clientId, updates);
    },
    onSuccess: (result) => {
      updateClientOptimistically(clientId, () => result.data.client);
    },
    onError: () => {
      refreshClients();
    },
  });

  const handleFieldChange = (field: string, value: string) => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Update UI immediately (optimistic)
    updateClientOptimistically(clientId, (client) => ({
      ...client,
      [field]: value,
    }));

    // Debounce API call
    debounceTimer.current = setTimeout(() => {
      execute({ [field]: value });
    }, 500); // Wait 500ms after user stops typing
  };

  return (
    <div>
      <input
        type="text"
        onChange={(e) => handleFieldChange('name', e.target.value)}
        placeholder="Client Name"
      />
      <SyncStatusIndicator status={status} showLabel />
    </div>
  );
};

// ============================================
// Example 2: Request Queue (Handle Multiple Rapid Updates)
// ============================================

export const QueuedUpdates: React.FC<{ clientId: number }> = ({ clientId }) => {
  const { updateClientOptimistically, refreshClients } = useData();
  const [queue, setQueue] = useState<Array<Partial<Client>>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;

    setIsProcessing(true);

    while (queue.length > 0) {
      const update = queue[0];
      
      try {
        await clientsAPI.update(clientId, update);
        setQueue(prev => prev.slice(1)); // Remove processed item
      } catch (error) {
        console.error('Update failed:', error);
        refreshClients(); // Revert all on error
        setQueue([]); // Clear queue
        break;
      }
    }

    setIsProcessing(false);
  };

  const queueUpdate = (updates: Partial<Client>) => {
    // Update UI immediately
    updateClientOptimistically(clientId, (client) => ({
      ...client,
      ...updates,
    }));

    // Add to queue
    setQueue(prev => [...prev, updates]);

    // Process queue
    processQueue();
  };

  return (
    <div>
      <button onClick={() => queueUpdate({ name: 'Update 1' })}>Update 1</button>
      <button onClick={() => queueUpdate({ email: 'update2@example.com' })}>Update 2</button>
      <button onClick={() => queueUpdate({ phone: '555-0123' })}>Update 3</button>
      {isProcessing && <span>Processing {queue.length} updates...</span>}
    </div>
  );
};

// ============================================
// Example 3: Optimistic Batch Operations
// ============================================

export const BatchTaskUpdate: React.FC<{ appointmentId: number }> = ({ appointmentId }) => {
  const { updateAppointmentOptimistically, refreshAppointments } = useData();

  const { execute, status } = useOptimisticUpdate({
    onOptimisticUpdate: (taskIds: number[]) => {
      // Update all tasks optimistically
      updateAppointmentOptimistically(appointmentId, (appt) => ({
        ...appt,
        tasks: appt.tasks.map(task =>
          taskIds.includes(task.id)
            ? { ...task, status: TaskStatus.COMPLETED }
            : task
        ),
      }));
    },
    onApiCall: async (taskIds: number[]) => {
      // Call API for each task (could be batched on backend)
      const promises = taskIds.map(taskId =>
        visitsAPI.updateTask(appointmentId, taskId, { status: TaskStatus.COMPLETED })
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      refreshAppointments();
    },
    onError: () => {
      refreshAppointments();
    },
    showSuccessToast: true,
    successMessage: 'All tasks completed!',
  });

  const handleCompleteAll = () => {
    const taskIds = [1, 2, 3, 4]; // Example task IDs
    execute(taskIds);
  };

  return (
    <div>
      <button onClick={handleCompleteAll}>Complete All Tasks</button>
      <SyncStatusIndicator status={status} showLabel />
    </div>
  );
};

// ============================================
// Example 4: Optimistic Update with Validation
// ============================================

export const ValidatedClientUpdate: React.FC<{ clientId: number }> = ({ clientId }) => {
  const { updateClientOptimistically, refreshClients, getClientById } = useData();
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const { execute, status } = useOptimisticUpdate<Partial<Client>, { client: Client }>({
    onOptimisticUpdate: (updates) => {
      updateClientOptimistically(clientId, (client) => ({
        ...client,
        ...updates,
      }));
    },
    onApiCall: async (updates) => {
      return await clientsAPI.update(clientId, updates);
    },
    onSuccess: (result) => {
      setValidationError(null);
      updateClientOptimistically(clientId, () => result.data.client);
    },
    onError: (error) => {
      setValidationError(error.message);
      refreshClients();
    },
  });

  const handleUpdateEmail = async (email: string) => {
    // Client-side validation
    if (!validateEmail(email)) {
      setValidationError('Invalid email format');
      return;
    }

    await execute({ email });
  };

  const client = getClientById(clientId);

  return (
    <div>
      <input
        type="email"
        defaultValue={client?.email}
        onBlur={(e) => handleUpdateEmail(e.target.value)}
      />
      <SyncStatusIndicator status={status} showLabel />
      {validationError && <p className="text-red-600">{validationError}</p>}
    </div>
  );
};

