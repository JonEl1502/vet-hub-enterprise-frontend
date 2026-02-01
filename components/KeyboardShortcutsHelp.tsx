import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { KeyboardShortcut, getShortcutDisplay } from '../hooks/useKeyboardShortcuts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

const KeyboardShortcutsHelp: React.FC<Props> = ({ isOpen, onClose, shortcuts }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl shadow-lg">
                    <Keyboard size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">
                    Keyboard Shortcuts
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {shortcuts.map((shortcut, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700"
                  >
                    <span className="text-sm text-pine dark:text-zinc-100 font-medium">
                      {shortcut.description}
                    </span>
                    <kbd className="px-3 py-1.5 bg-white dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-600 rounded-lg text-xs font-black text-pine dark:text-zinc-100 shadow-sm">
                      {getShortcutDisplay(shortcut)}
                    </kbd>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
              <p className="text-xs text-slate-500 dark:text-zinc-400 text-center">
                Press <kbd className="px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded text-[10px] font-bold">?</kbd> anytime to view this help
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default KeyboardShortcutsHelp;

