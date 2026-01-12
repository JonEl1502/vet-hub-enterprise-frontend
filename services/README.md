# API Service Layer Documentation

## Overview

The API service layer has been refactored to provide a more maintainable, type-safe, and feature-rich architecture for making HTTP requests to the backend.

## Architecture

```
services/
├── api/
│   ├── config.ts              # Base URLs, endpoints, timeouts
│   ├── client.ts              # Axios instance with interceptors
│   ├── types.ts               # TypeScript types for API
│   └── interceptors.ts        # Request/response interceptors
├── modules/
│   ├── auth.api.ts            # Authentication endpoints
│   ├── users.api.ts           # User management
│   ├── clinics.api.ts         # Clinic management
│   ├── clients.api.ts         # Client management
│   ├── pets.api.ts            # Pet management
│   ├── appointments.api.ts    # Appointments
│   └── transactions.api.ts    # Transactions
├── utils/
│   ├── cache.ts               # Response caching
│   ├── toast.ts               # Toast notifications
│   ├── transformers.ts        # Data transformers
│   └── errorHandler.ts        # Error handling
└── index.ts                   # Main export file
```

## Usage

### Basic Import

```typescript
import { clientsAPI, petsAPI, appointmentsAPI } from '../services';
```

### Making API Calls

#### Simple GET Request
```typescript
const response = await clientsAPI.getAll();
console.log(response.data.clients);
```

#### With Loading State
```typescript
const [loading, setLoading] = useState(false);

const response = await clientsAPI.getAll({
  setLoading,
  loadingTarget: 'table',
});
```

#### With Caching
```typescript
const response = await clientsAPI.getAll({
  cache: true,
  cacheDuration: 300000, // 5 minutes
});
```

#### With Custom Error Handling
```typescript
const response = await clientsAPI.create(data, {
  showError: true,
  customErrorMessage: 'Failed to create client',
});
```

#### Silent Request (No UI Feedback)
```typescript
const response = await authAPI.refreshToken({
  silent: true,
});
```

## Request Options

All API methods accept an optional `RequestOptions` parameter:

```typescript
interface RequestOptions {
  // Error handling
  showError?: boolean;              // Show error toast (default: true)
  customErrorMessage?: string;      // Custom error message
  silent?: boolean;                 // Suppress all UI feedback (default: false)

  // Loading states
  setLoading?: (loading: boolean) => void;  // Loading state setter
  loadingTarget?: LoadingTarget;    // 'button' | 'table' | 'form' | 'modal' | 'page'
  loadingMessage?: string;          // Custom loading message

  // Caching
  cache?: boolean;                  // Enable caching (default: false)
  cacheDuration?: number;           // Cache duration in ms (default: 5 minutes)

  // Retry logic
  retry?: number;                   // Number of retry attempts (default: 0)
  retryDelay?: number;              // Delay between retries in ms (default: 1000)

  // Axios options
  signal?: AbortSignal;             // For request cancellation
  timeout?: number;                 // Request timeout
  headers?: Record<string, string>; // Custom headers
}
```

## Features

### 1. Automatic Error Handling

Errors are automatically handled and displayed as toast notifications:

```typescript
// Error toast will be shown automatically
await clientsAPI.create(data);

// Suppress error toast
await clientsAPI.create(data, { showError: false });

// Custom error message
await clientsAPI.create(data, {
  customErrorMessage: 'Failed to create client. Please try again.',
});
```

### 2. Response Caching

GET requests can be cached to improve performance:

```typescript
// Cache for 5 minutes (default)
const response = await clientsAPI.getAll({ cache: true });

// Custom cache duration
const response = await clientsAPI.getAll({
  cache: true,
  cacheDuration: 60000, // 1 minute
});
```

### 3. Automatic BigInt Conversion

BigInt values are automatically converted to strings in responses.

### 4. Authentication Handling

- Auth tokens are automatically added to requests
- 401 errors redirect to login page
- Clinic headers are automatically added

### 5. Request Retry

Failed requests can be automatically retried:

```typescript
const response = await clientsAPI.getAll({
  retry: 3,
  retryDelay: 1000,
});
```

### 6. Loading States

Component-specific loading states:

```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  await clientsAPI.create(data, {
    setLoading,
    loadingTarget: 'button',
  });
};
```

## Toast Notifications

Toast notifications are automatically shown for errors. To use toast manually:

```typescript
import { toast } from '../services';

toast.success('Client created successfully!');
toast.error('Failed to create client');
toast.warning('Please fill all required fields');
toast.info('Loading data...');
```

## Cache Management

```typescript
import { cache } from '../services';

// Invalidate specific cache
cache.invalidate('/clients');

// Invalidate by pattern
cache.invalidatePattern(/^\/clients/);

// Clear all cache
cache.clear();

// Get cache stats
const stats = cache.getStats();
console.log(stats.size, stats.keys);
```

## Migration from Old API

### Before
```typescript
import { clientsAPI } from '../services/api';

try {
  const response = await clientsAPI.getAll();
  if (response.success) {
    setClients(response.data.clients);
  }
} catch (error) {
  console.error('Error:', error);
}
```

### After
```typescript
import { clientsAPI } from '../services';

const response = await clientsAPI.getAll({
  setLoading,
  showError: true,
});
setClients(response.data.clients);
```

## Best Practices

1. **Use caching for frequently accessed data**
   ```typescript
   clientsAPI.getAll({ cache: true })
   ```

2. **Provide loading states for better UX**
   ```typescript
   clientsAPI.create(data, { setLoading, loadingTarget: 'button' })
   ```

3. **Use silent mode for background requests**
   ```typescript
   authAPI.refreshToken({ silent: true })
   ```

4. **Invalidate cache after mutations**
   ```typescript
   await clientsAPI.create(data);
   cache.invalidatePattern(/^\/clients/);
   ```

5. **Handle errors gracefully**
   ```typescript
   await clientsAPI.create(data, {
     customErrorMessage: 'Failed to create client',
   })
   ```

