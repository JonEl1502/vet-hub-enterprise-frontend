/**
 * Simple Toast Notification System
 */

import { ToastNotification, ToastType } from '../api/types';

type ToastListener = (toast: ToastNotification) => void;

class ToastManager {
  private listeners: ToastListener[] = [];
  private toastCounter = 0;

  /**
   * Subscribe to toast notifications
   */
  subscribe(listener: ToastListener): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Emit a toast notification to all listeners
   */
  private emit(toast: ToastNotification): void {
    this.listeners.forEach(listener => listener(toast));
  }

  /**
   * Show a toast notification
   */
  show(type: ToastType, message: string, duration: number = 5000): void {
    const toast: ToastNotification = {
      id: `toast-${++this.toastCounter}-${Date.now()}`,
      type,
      message,
      duration,
    };

    this.emit(toast);
  }

  /**
   * Show success toast
   */
  success(message: string, duration?: number): void {
    this.show('success', message, duration);
  }

  /**
   * Show error toast
   */
  error(message: string, duration?: number): void {
    this.show('error', message, duration);
  }

  /**
   * Show warning toast
   */
  warning(message: string, duration?: number): void {
    this.show('warning', message, duration);
  }

  /**
   * Show info toast
   */
  info(message: string, duration?: number): void {
    this.show('info', message, duration);
  }
}

/**
 * 🔴 THE SINGLETON IS CALLABLE, AND IT HAS TO BE.
 *
 * `toast` was a bare class instance, so `toast('message')` threw
 * **"toast is not a function"** — which in a production build reads as
 * `TypeError: re is not a function` and takes the whole page down through the
 * error boundary.
 *
 * That was not hypothetical. `BillingView` greets the return from Paystack with
 * `toast('Confirming your card payment…')`, so EVERY customer coming back from
 * a successful checkout hit a crashed billing page — before the status poll it
 * was about to start could run (user, 2026-09-10, on a real KES 15 purchase).
 * Ten more call sites across procedures, group visits, imaging and the client
 * hub carried the same latent crash, each waiting for its own branch to be
 * taken. TypeScript flagged every one of them; the errors were pre-existing and
 * got read as noise.
 *
 * Making the singleton callable fixes all of them at once, which is the point:
 * a rule everybody has already broken eleven times is better absorbed than
 * re-policed. A bare call means INFO — the neutral default those call sites
 * plainly intended.
 *
 * The second argument accepts the `{ icon, duration }` object those sites pass
 * (icon is ignored — the toast UI picks its own icon per type) as well as a
 * plain duration in ms, so no existing call has to change.
 */
type ToastOpts = number | { icon?: string; duration?: number };

const manager = new ToastManager();

const callable = (message: string, opts?: ToastOpts): void => {
  const duration = typeof opts === 'number' ? opts : opts?.duration;
  manager.info(message, duration);
};

export const toast = Object.assign(callable, {
  // ⚠️ BOUND, not copied. These read `this.listeners` / `this.toastCounter`;
  // lifting them off the instance unbound would make `this` undefined and turn
  // every toast in the app into a different TypeError.
  subscribe: manager.subscribe.bind(manager),
  show: manager.show.bind(manager),
  success: manager.success.bind(manager),
  error: manager.error.bind(manager),
  warning: manager.warning.bind(manager),
  info: manager.info.bind(manager),
});

// Export type for components
export type { ToastListener };

