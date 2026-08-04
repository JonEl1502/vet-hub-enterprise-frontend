/**
 * Global dialog manager — replaces native window.confirm / window.alert.
 *
 * Pattern mirrors toast: a singleton publisher and one DialogHost subscriber
 * mounted in App.tsx. Components import { dialog } and await:
 *
 *   if (await dialog.confirm({ message: 'Discard changes?' })) { ... }
 *   await dialog.alert({ message: 'Saved.' });
 *   if (await dialog.confirmDelete({ entityName: client.name })) { ... }
 */

export type DialogVariant = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
}

export interface DeleteOptions {
  title?: string;
  message?: string;
  entityName?: string;
  confirmLabel?: string;
  busyLabel?: string;
  entityLabel?: string;
  warning?: string | null;
  tone?: 'danger' | 'warning';
}

/**
 * A confirm that also collects a line of text (a void reason, a note). Added
 * because the void-payment flow was still calling native `prompt()`, which
 * renders the browser's own "app.vethubcore.com says" box (user, 2026-08-04).
 */
export interface PromptOptions {
  title?: string;
  message: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  /** Refuse to submit an empty value. */
  required?: boolean;
}

export interface AlertOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  variant?: DialogVariant;
}

export type DialogRequest =
  | { kind: 'confirm'; id: number; opts: Required<Pick<ConfirmOptions, 'message'>> & ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert'; id: number; opts: Required<Pick<AlertOptions, 'message'>> & AlertOptions; resolve: () => void }
  | { kind: 'delete'; id: number; opts: DeleteOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; id: number; opts: PromptOptions; resolve: (v: string | null) => void };

type Listener = (req: DialogRequest | null) => void;

class DialogManager {
  private listener: Listener | null = null;
  private queue: DialogRequest[] = [];
  private active: DialogRequest | null = null;
  private counter = 0;

  /** DialogHost subscribes once; only one active host at a time. */
  subscribe(listener: Listener): () => void {
    this.listener = listener;
    // Replay current state so a host mounted after a request still sees it.
    listener(this.active);
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }

  private push(req: DialogRequest) {
    this.queue.push(req);
    this.pump();
  }

  private pump() {
    if (this.active || this.queue.length === 0) return;
    this.active = this.queue.shift()!;
    this.listener?.(this.active);
  }

  /** Called by DialogHost after the user resolves the active dialog. */
  finish(id: number, value: boolean, text?: string | null) {
    if (!this.active || this.active.id !== id) return;
    const req = this.active;
    this.active = null;
    this.listener?.(null);
    if (req.kind === 'alert') (req.resolve as () => void)();
    // A prompt resolves with the TEXT, or null when cancelled — so an empty
    // string (a deliberate blank reason) stays distinct from dismissing.
    else if (req.kind === 'prompt') (req.resolve as (v: string | null) => void)(value ? (text ?? '') : null);
    else (req.resolve as (v: boolean) => void)(value);
    this.pump();
  }

  confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.push({ kind: 'confirm', id: ++this.counter, opts, resolve });
    });
  }

  alert(opts: AlertOptions | string): Promise<void> {
    const o: AlertOptions = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<void>((resolve) => {
      this.push({ kind: 'alert', id: ++this.counter, opts: o, resolve });
    });
  }

  /** Resolves with the typed text, or null if the user cancelled. */
  prompt(opts: PromptOptions): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      this.push({ kind: 'prompt', id: ++this.counter, opts, resolve });
    });
  }

  confirmDelete(opts: DeleteOptions = {}): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.push({ kind: 'delete', id: ++this.counter, opts, resolve });
    });
  }
}

export const dialog = new DialogManager();
