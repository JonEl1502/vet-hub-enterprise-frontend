import React, { useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  snapPoints?: number[]; // Percentage heights: [50, 90]
}

const BottomSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [90],
}) => {
  const [currentSnap, setCurrentSnap] = React.useState(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // If dragged down significantly or with high velocity, close
    if (offset > 100 || velocity > 500) {
      onClose();
      return;
    }

    // Snap to nearest snap point
    if (snapPoints.length > 1) {
      const windowHeight = window.innerHeight;
      const currentHeight = windowHeight * (snapPoints[currentSnap] / 100);
      const newHeight = currentHeight - offset;
      const newPercentage = (newHeight / windowHeight) * 100;

      // Find closest snap point
      let closestIndex = 0;
      let closestDiff = Math.abs(snapPoints[0] - newPercentage);

      snapPoints.forEach((snap, index) => {
        const diff = Math.abs(snap - newPercentage);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = index;
        }
      });

      setCurrentSnap(closestIndex);
    }
  };

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ height: `${snapPoints[currentSnap]}vh` }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl z-50 flex flex-col md:hidden"
          >
            {/* Drag Handle */}
            <div className="flex-shrink-0 py-3 px-4 border-b border-slate-200 dark:border-zinc-800">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;

