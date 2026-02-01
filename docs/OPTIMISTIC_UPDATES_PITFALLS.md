# Optimistic Updates: Potential Pitfalls & Solutions

## Overview

While optimistic updates greatly improve perceived performance, they introduce complexity that must be carefully managed. This document outlines common pitfalls and their solutions.

---

## 1. Race Conditions

### Problem
User makes multiple rapid updates before the first API call completes.

**Example:**
```
User updates name to "John" → API call starts
User updates name to "Jane" → API call starts
First API call completes → Name becomes "John" (wrong!)
```

### Solutions

#### Solution A: Debouncing
Wait for user to stop making changes before calling API.

```typescript
const debounceTimer = useRef<NodeJS.Timeout | null>(null);

const handleChange = (value: string) => {
  // Update UI immediately
  updateOptimistically(value);
  
  // Debounce API call
  if (debounceTimer.current) clearTimeout(debounceTimer.current);
  debounceTimer.current = setTimeout(() => {
    execute({ field: value });
  }, 500);
};
```

#### Solution B: Request Cancellation
Cancel previous requests when new ones are made.

```typescript
const abortController = useRef<AbortController | null>(null);

const handleUpdate = async (data) => {
  // Cancel previous request
  if (abortController.current) {
    abortController.current.abort();
  }
  
  abortController.current = new AbortController();
  
  await execute(data, { signal: abortController.current.signal });
};
```

#### Solution C: Request Queue
Process updates sequentially.

```typescript
// See AdvancedOptimisticExamples.tsx - QueuedUpdates component
```

---

## 2. Temporary ID Conflicts

### Problem
Creating multiple entities quickly can result in ID conflicts if using `Date.now()`.

**Example:**
```typescript
const id1 = Date.now(); // 1706472000000
const id2 = Date.now(); // 1706472000000 (same!)
```

### Solutions

#### Solution A: UUID Library
```typescript
import { v4 as uuidv4 } from 'uuid';

const tempId = uuidv4(); // "550e8400-e29b-41d4-a716-446655440000"
```

#### Solution B: Incremental Counter
```typescript
let tempIdCounter = 0;

const getTempId = () => {
  return -(++tempIdCounter); // Negative IDs for temp entities
};
```

#### Solution C: Timestamp + Random
```typescript
const getTempId = () => {
  return Date.now() + Math.random();
};
```

---

## 3. Stale Data After Rollback

### Problem
After rollback, UI shows old data that doesn't match server state.

### Solution
Always refresh from server on error:

```typescript
const { execute } = useOptimisticUpdate({
  onError: () => {
    // ALWAYS refresh from server to ensure consistency
    refreshEntities();
  },
});
```

---

## 4. Partial Update Failures

### Problem
Batch operation partially succeeds, leaving inconsistent state.

**Example:**
```
Update tasks 1, 2, 3
Task 1: ✅ Success
Task 2: ❌ Failed
Task 3: ⏸️ Not attempted
```

### Solutions

#### Solution A: All-or-Nothing
Wrap in transaction or revert all on any failure:

```typescript
onError: () => {
  // Revert ALL changes
  refreshEntities();
}
```

#### Solution B: Partial Success Handling
Track which items succeeded:

```typescript
const results = await Promise.allSettled(promises);
const failed = results.filter(r => r.status === 'rejected');

if (failed.length > 0) {
  // Only revert failed items
  failed.forEach(item => revertItem(item));
}
```

---

## 5. Network Offline Scenarios

### Problem
User makes changes while offline, then comes back online.

### Solutions

#### Solution A: Detect Offline State
```typescript
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

// Queue updates when offline
if (!isOnline) {
  queueForLater(data);
} else {
  execute(data);
}
```

#### Solution B: Retry with Exponential Backoff
```typescript
const { execute } = useOptimisticUpdate({
  autoRetry: true,
  retryAttempts: 5,
  retryDelay: 1000, // Will increase: 1s, 2s, 3s, 4s, 5s
});
```

---

## 6. Cache Invalidation Issues

### Problem
Frontend cache and optimistic state get out of sync.

### Solution
Invalidate cache when making optimistic updates:

```typescript
import { cache } from '../services';

const { execute } = useOptimisticUpdate({
  onOptimisticUpdate: (data) => {
    updateOptimistically(data);
    
    // Invalidate related cache entries
    cache.invalidatePattern('/clients');
  },
  onSuccess: () => {
    // Refresh to populate cache with server data
    refreshClients();
  },
});
```

---

## 7. Complex Nested Updates

### Problem
Updating nested data structures can be error-prone.

**Example:**
```typescript
// Appointment with nested tasks
appointment.tasks[2].status = 'COMPLETED';
```

### Solution
Use immutable update patterns:

```typescript
updateAppointmentOptimistically(id, (appt) => ({
  ...appt,
  tasks: appt.tasks.map(task =>
    task.id === taskId
      ? { ...task, status: 'COMPLETED' }
      : task
  ),
}));
```

---

## 8. User Confusion During Sync

### Problem
User doesn't know if their action succeeded or is still pending.

### Solutions

#### Solution A: Visual Indicators
```typescript
<SyncStatusIndicator status={status} showLabel />
```

#### Solution B: Disable Actions During Sync
```typescript
<button disabled={status === 'syncing'}>
  {status === 'syncing' ? 'Saving...' : 'Save'}
</button>
```

#### Solution C: Toast Notifications
```typescript
const { execute } = useOptimisticUpdate({
  showSuccessToast: true,
  successMessage: 'Changes saved!',
});
```

---

## 9. Memory Leaks

### Problem
Optimistic updates create new objects that aren't garbage collected.

### Solution
Clean up on unmount:

```typescript
useEffect(() => {
  return () => {
    // Cancel pending requests
    abortController.current?.abort();
    
    // Clear timers
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  };
}, []);
```

---

## 10. Testing Challenges

### Problem
Hard to test optimistic updates and rollback scenarios.

### Solutions

#### Solution A: Mock API Delays
```typescript
// In tests
jest.mock('../services/api', () => ({
  create: jest.fn(() => new Promise(resolve => 
    setTimeout(() => resolve({ data: mockData }), 100)
  )),
}));
```

#### Solution B: Simulate Errors
```typescript
// In tests
jest.mock('../services/api', () => ({
  create: jest.fn(() => Promise.reject(new Error('API Error'))),
}));
```

---

## Best Practices Summary

1. ✅ **Always implement rollback** via `onError` callback
2. ✅ **Use debouncing** for rapid updates
3. ✅ **Show sync status** to users
4. ✅ **Refresh from server** after successful creates
5. ✅ **Handle offline scenarios** gracefully
6. ✅ **Invalidate cache** when updating optimistically
7. ✅ **Use immutable updates** for nested data
8. ✅ **Test error scenarios** thoroughly
9. ✅ **Clean up resources** on unmount
10. ✅ **Monitor performance** and user feedback

---

## When NOT to Use Optimistic Updates

- ❌ Critical financial transactions (wait for confirmation)
- ❌ Irreversible actions (e.g., permanent deletions)
- ❌ Operations requiring server validation
- ❌ Multi-step workflows with dependencies
- ❌ When backend processing is complex and slow

For these cases, use traditional loading states and wait for server confirmation.

