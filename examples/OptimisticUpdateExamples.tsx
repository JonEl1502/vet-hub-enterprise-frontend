/**
 * Optimistic Update Examples
 * 
 * Demonstrates how to use optimistic updates for different entities
 * Copy these patterns into your actual components
 */

import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { clientsAPI, petsAPI, appointmentsAPI } from '../services';
import { SyncStatusIndicator, SyncBadge } from '../components/shared/common/SyncStatusIndicator';
import { Client, Pet, Appointment } from '../types';

// ============================================
// Example 1: Create Client with Optimistic Update
// ============================================

export const CreateClientExample: React.FC = () => {
  const {
    addClientOptimistically,
    refreshClients,
  } = useData();

  const { execute, status, error } = useOptimisticUpdate<Partial<Client>, { client: Client }>({
    onOptimisticUpdate: (clientData) => {
      // Create temporary client with optimistic ID
      const tempClient: Client = {
        id: Date.now(), // Temporary ID (will be replaced by server)
        name: clientData.name || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        address: clientData.address || '',
        // ... other required fields with defaults
      } as Client;

      // Add to local state immediately
      addClientOptimistically(tempClient);
    },
    onApiCall: async (clientData) => {
      // Call API in background
      return await clientsAPI.create(clientData);
    },
    onSuccess: (result) => {
      // Refresh to get the real ID from server
      refreshClients();
    },
    onError: () => {
      // Revert by refreshing from server
      refreshClients();
    },
    showSuccessToast: true,
    successMessage: 'Client created successfully!',
    errorMessage: 'Failed to create client',
  });

  const handleCreateClient = async () => {
    const newClient = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-0123',
      address: '123 Main St',
    };

    await execute(newClient);
  };

  return (
    <div>
      <button onClick={handleCreateClient} disabled={status === 'syncing'}>
        Create Client
      </button>
      <SyncStatusIndicator status={status} showLabel />
      {error && <p className="text-red-600">Error: {error.message}</p>}
    </div>
  );
};

// ============================================
// Example 2: Update Client with Optimistic Update
// ============================================

export const UpdateClientExample: React.FC<{ clientId: number }> = ({ clientId }) => {
  const {
    updateClientOptimistically,
    refreshClients,
    getClientById,
  } = useData();

  const { execute, status } = useOptimisticUpdate<Partial<Client>, { client: Client }>({
    onOptimisticUpdate: (updates) => {
      // Update local state immediately
      updateClientOptimistically(clientId, (client) => ({
        ...client,
        ...updates,
      }));
    },
    onApiCall: async (updates) => {
      // Call API in background
      return await clientsAPI.update(clientId, updates);
    },
    onSuccess: (result) => {
      // Optionally update with server response
      updateClientOptimistically(clientId, () => result.data.client);
    },
    onError: () => {
      // Revert by refreshing from server
      refreshClients();
    },
    showSuccessToast: true,
    successMessage: 'Client updated!',
  });

  const handleUpdateClient = async () => {
    await execute({
      name: 'Updated Name',
      email: 'updated@example.com',
    });
  };

  const client = getClientById(clientId);

  return (
    <div>
      <h3>{client?.name} <SyncBadge status={status} /></h3>
      <button onClick={handleUpdateClient}>Update Client</button>
    </div>
  );
};

// ============================================
// Example 3: Create Pet with Optimistic Update
// ============================================

export const CreatePetExample: React.FC<{ ownerId: number }> = ({ ownerId }) => {
  const { addPetOptimistically, refreshPets } = useData();

  const { execute, status } = useOptimisticUpdate<Partial<Pet>, { pet: Pet }>({
    onOptimisticUpdate: (petData) => {
      const tempPet: Pet = {
        id: Date.now(),
        name: petData.name || '',
        species: petData.species || '',
        breed: petData.breed || '',
        ownerId,
        // ... other required fields
      } as Pet;

      addPetOptimistically(tempPet);
    },
    onApiCall: async (petData) => {
      return await petsAPI.create({ ...petData, ownerId });
    },
    onSuccess: () => {
      refreshPets();
    },
    onError: () => {
      refreshPets();
    },
    showSuccessToast: true,
    successMessage: 'Pet added successfully!',
  });

  return (
    <div>
      <button onClick={() => execute({ name: 'Fluffy', species: 'Cat', breed: 'Persian' })}>
        Add Pet
      </button>
      <SyncStatusIndicator status={status} showLabel />
    </div>
  );
};

