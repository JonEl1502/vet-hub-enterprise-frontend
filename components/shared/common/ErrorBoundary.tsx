import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

/**
 * Catches render-time throws and shows them instead of a white page.
 *
 * WHY THIS EXISTS. `App.tsx` dispatches views from a plain switch with no
 * boundary anywhere in the tree, so ANY throw during render unmounted the whole
 * app to a blank `#root`. Three features have blanked this way; the most recent
 * (2026-08-03) was a one-line missing import in `InventoryView` that threw a
 * `ReferenceError` — the page just went white, with no message, no stack and
 * nothing in the UI to suggest where to look. This turns that class of bug into
 * a readable panel naming the error, which is the difference between a
 * ten-second diagnosis and an afternoon.
 *
 * A boundary catches errors thrown while RENDERING, in lifecycle methods and in
 * constructors of the tree below it. It deliberately does NOT catch:
 *   - errors inside event handlers (they don't break the render pass),
 *   - async rejections / `setTimeout` callbacks,
 *   - errors thrown by the boundary itself.
 * So this is a safety net, not a reason to stop handling errors where they
 * happen.
 */

interface Props {
  children: React.ReactNode;
  /** Shown in the panel so the user can say which page broke. */
  label?: string;
  /** Called after a reset attempt — e.g. to send the user somewhere safe. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the console record — the panel below shows the same thing, but a
    // stack in the console is what survives a screenshot being taken.
    console.error('[ErrorBoundary] render failed', error, info?.componentStack);
    this.setState({ componentStack: info?.componentStack ?? null });
  }

  private reset = () => {
    this.setState({ error: null, componentStack: null });
    this.props.onReset?.();
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
              This page failed to load
            </p>
            <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100 mt-0.5">
              {this.props.label ? `Something broke on ${this.props.label}` : 'Something broke on this page'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
              Your work is not lost — this is a display problem on this page only, and the
              rest of the app still works. Try again, or reload if it keeps happening.
            </p>

            {/* The actual error. This is the whole point — a blank page tells
                nobody anything, and the person seeing it is usually the only
                one who can say what they clicked. */}
            <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-white/70 dark:bg-zinc-900/60 p-3">
              <p className="text-[11px] font-mono text-rose-700 dark:text-rose-400 break-words">
                {error.name}: {error.message}
              </p>
              {(componentStack || error.stack) && (
                <details className="mt-2">
                  <summary className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-seafoam transition-colors">
                    Technical detail
                  </summary>
                  <pre className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-zinc-500 overflow-x-auto max-h-56">
                    {componentStack || error.stack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                onClick={this.reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all"
              >
                <RotateCcw size={12} /> Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              >
                <RefreshCw size={12} /> Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
