# Optimistic UI Updates Implementation Guide

## Overview

Optimistic UI updates improve perceived performance by updating the UI immediately when users perform actions, while synchronizing with the backend in the background.

**Benefits:**
- ✅ Instant UI feedback (no 10-second wait)
- ✅ Better user experience
- ✅ No backend changes required
- ✅ Automatic rollback on errors
- ✅ Visual sync indicators

## Architecture

```
User Action
    ↓
1. Update Local State (Optimistic)
    ↓
2. Show Updated UI Immediately
    ↓
3. Call API in Background
    ↓
4a. Success → Keep Changes (or update with server data)
4b. Error → Revert Changes + Show Error
```

## Quick Start

### 1. Import the Hook

```typescript
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { useData } from '../contexts/DataContext';
```

### 2. Set Up Optimistic Update

```typescript
const { addClientOptimistically, refreshClients } = useData();

const { execute, status, error } = useOptimisticUpdate({
  onOptimisticUpdate: (data) => {
    // Update local state immediately
    const tempClient = { id: Date.now(), ...data };
    addClientOptimistically(tempClient);
  },
  onApiCall: async (data) => {
    // Call API in background
    return await clientsAPI.create(data);
  },
  onSuccess: () => {
    // Refresh to get real server data
    refreshClients();
  },
  onError: () => {
    // Revert by refreshing from server
    refreshClients();
  },
  showSuccessToast: true,
  successMessage: 'Client created!',
});
```

### 3. Execute the Update

```typescript
const handleCreate = async () => {
  await execute({ name: 'John Doe', email: 'john@example.com' });
};
```

### 4. Show Sync Status (Optional)

```typescript
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';

<SyncStatusIndicator status={status} showLabel />
```

## Common Patterns

### Pattern 1: Create Entity

```typescript
const { execute, status } = useOptimisticUpdate({
  onOptimisticUpdate: (data) => {
    const temp = { id: Date.now(), ...data };
    addEntityOptimistically(temp);
  },
  onApiCall: (data) => api.create(data),
  onSuccess: () => refreshEntities(),
  onError: () => refreshEntities(),
});
```

### Pattern 2: Update Entity

```typescript
const { execute, status } = useOptimisticUpdate({
  onOptimisticUpdate: (updates) => {
    updateEntityOptimistically(id, (entity) => ({
      ...entity,
      ...updates,
    }));
  },
  onApiCall: (updates) => api.update(id, updates),
  onSuccess: (result) => {
    // Use server response
    updateEntityOptimistically(id, () => result.data.entity);
  },
  onError: () => refreshEntities(),
});
```

### Pattern 3: Delete Entity

```typescript
const { execute, status } = useOptimisticUpdate({
  onOptimisticUpdate: () => {
    removeEntityOptimistically(id);
  },
  onApiCall: () => api.delete(id),
  onSuccess: () => {
    // Already removed from UI
  },
  onError: () => refreshEntities(),
});
```

## Available DataContext Methods

### Clients
- `addClientOptimistically(client: Client)`
- `updateClientOptimistically(id, updater)`
- `removeClientOptimistically(id)`

### Pets
- `addPetOptimistically(pet: Pet)`
- `updatePetOptimistically(id, updater)`
- `removePetOptimistically(id)`

### Appointments
- `addAppointmentOptimistically(appointment: Appointment)`
- `updateAppointmentOptimistically(id, updater)`
- `removeAppointmentOptimistically(id)`

## Sync Status Indicators

### Inline Indicator
```typescript
<SyncStatusIndicator status={status} showLabel size="md" />
```

### Badge
```typescript
<SyncBadge status={status} />
```

### Floating Indicator
```typescript
<FloatingSyncIndicator status={status} />
```

## Error Handling

### Automatic Retry
```typescript
const { execute } = useOptimisticUpdate({
  // ... other options
  autoRetry: true,
  retryAttempts: 3,
  retryDelay: 1000,
});
```

### Manual Retry
```typescript
const { retry, error } = useOptimisticUpdate({...});

{error && (
  <button onClick={retry}>Retry</button>
)}
```

## Best Practices

1. **Always provide onError callback** to revert optimistic updates
2. **Use temporary IDs** (e.g., `Date.now()`) for new entities
3. **Refresh from server** after successful create to get real IDs
4. **Show sync indicators** for long-running operations
5. **Handle race conditions** by refreshing on success
6. **Test error scenarios** to ensure rollback works correctly

## Migration Strategy

### Phase 1: High-Impact Operations
- ✅ Client create/update
- ✅ Pet create/update
- ✅ Appointment status updates

### Phase 2: Medium-Impact Operations
- Appointment create/update
- Transaction create
- Inventory updates

### Phase 3: Low-Impact Operations
- Settings updates
- Profile updates
- Preferences

## See Also

- `frontend/hooks/useOptimisticUpdate.ts` - Hook implementation
- `frontend/examples/OptimisticUpdateExamples.tsx` - Working examples
- `frontend/components/SyncStatusIndicator.tsx` - UI components

