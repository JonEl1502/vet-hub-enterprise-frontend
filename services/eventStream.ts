import { API_BASE_URL } from './api/config';

// Live-event stream (SSE over Redis pub/sub on the backend). Postgres stays
// the source of truth — events are just "something happened" pings carrying a
// type + small payload; consumers toast/badge and refetch through the normal
// APIs. EventSource reconnects automatically on drops.
//
// EventSource cannot set headers, so the access token travels as ?token= —
// the backend's tokenFromQuery shim (stream endpoints only) accepts it.

export interface StreamEvent {
  type: string; // 'message.new' | 'booking.requested' | 'booking.updated' | ...
  payload?: Record<string, any>;
  at?: string;
}

export function openEventStream(
  path: '/stream' | '/portal/me/stream',
  onEvent: (e: StreamEvent) => void
): () => void {
  const token = localStorage.getItem('authToken');
  if (!token || typeof EventSource === 'undefined') return () => {};

  const es = new EventSource(`${API_BASE_URL}${path}?token=${encodeURIComponent(token)}`);
  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      if (data && typeof data.type === 'string') onEvent(data);
    } catch { /* ignore malformed frames */ }
  };
  // onerror: EventSource retries by itself; nothing to do.
  return () => es.close();
}
