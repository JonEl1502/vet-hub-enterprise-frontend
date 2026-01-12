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

// Export singleton instance
export const toast = new ToastManager();

// Export type for components
export type { ToastListener };

