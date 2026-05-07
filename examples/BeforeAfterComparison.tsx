/**
 * Before/After Comparison: Traditional vs Optimistic Updates
 * 
 * Shows the difference between traditional loading states and optimistic updates
 */

import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { clientsAPI } from '../services';
import { SyncStatusIndicator } from '../components/shared/common/SyncStatusIndicator';
import { Client } from '../types';

// ============================================
// BEFORE: Traditional Approach (Slow)
// ============================================

export const TraditionalClientCreate: React.FC = () => {
  const { refreshClients } = useData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateClient = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create client (3-5 seconds)
      const response = await clientsAPI.create({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-0123',
      });

      // Step 2: Refresh all clients to show new one (3-5 seconds)
      await refreshClients();

      // Total time: 6-10 seconds
      // User sees loading spinner the entire time
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Traditional Approach</h3>
      <button
        onClick={handleCreateClient}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
      >
        {loading ? 'Creating... (6-10 seconds)' : 'Create Client'}
      </button>
      {loading && (
        <div className="mt-2 text-gray-600">
          ⏳ Please wait... This takes 6-10 seconds
        </div>
      )}
      {error && <div className="mt-2 text-red-600">Error: {error}</div>}
    </div>
  );
};

// ============================================
// AFTER: Optimistic Approach (Instant)
// ============================================

export const OptimisticClientCreate: React.FC = () => {
  const { addClientOptimistically, refreshClients } = useData();

  const { execute, status, error } = useOptimisticUpdate<Partial<Client>, { client: Client }>({
    onOptimisticUpdate: (clientData) => {
      // Step 1: Update UI immediately (instant!)
      const tempClient: Client = {
        id: Date.now(),
        name: clientData.name || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        address: clientData.address || '',
        clinicId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Client;

      addClientOptimistically(tempClient);
      // User sees new client in list immediately
    },
    onApiCall: async (clientData) => {
      // Step 2: Call API in background (3-5 seconds, but user doesn't wait)
      return await clientsAPI.create(clientData);
    },
    onSuccess: () => {
      // Step 3: Refresh to get real server data (3-5 seconds, but user doesn't wait)
      refreshClients();
      // Total perceived time: ~0 seconds (instant feedback)
      // Actual time: 6-10 seconds (happens in background)
    },
    onError: () => {
      // Revert if failed
      refreshClients();
    },
    showSuccessToast: true,
    successMessage: 'Client created successfully!',
    errorMessage: 'Failed to create client',
  });

  const handleCreateClient = async () => {
    await execute({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-0123',
    });
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Optimistic Approach</h3>
      <button
        onClick={handleCreateClient}
        disabled={status === 'syncing'}
        className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
      >
        Create Client (Instant!)
      </button>
      <div className="mt-2">
        <SyncStatusIndicator status={status} showLabel />
      </div>
      {error && (
        <div className="mt-2 text-red-600">
          Error: {error.message}
          <button onClick={() => execute({ name: 'John Doe' })} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// Side-by-Side Comparison
// ============================================

export const ComparisonDemo: React.FC = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Performance Comparison</h2>
        <div className="grid grid-cols-2 gap-4">
          <TraditionalClientCreate />
          <OptimisticClientCreate />
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded">
        <h3 className="font-bold mb-2">Key Differences:</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-red-600">Traditional (Slow)</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>User waits 6-10 seconds</li>
              <li>Loading spinner blocks UI</li>
              <li>No feedback until complete</li>
              <li>Feels sluggish</li>
              <li>User might click multiple times</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-green-600">Optimistic (Fast)</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>User sees result instantly</li>
              <li>UI remains responsive</li>
              <li>Subtle sync indicator</li>
              <li>Feels snappy</li>
              <li>Better user experience</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded">
        <h3 className="font-bold mb-2">⚠️ Important Notes:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Backend processing time is the same (6-10 seconds)</li>
          <li>Optimistic updates only improve <strong>perceived</strong> performance</li>
          <li>Must handle errors gracefully with rollback</li>
          <li>Best for operations where success is highly likely</li>
          <li>Not suitable for critical operations requiring confirmation</li>
        </ul>
      </div>
    </div>
  );
};

