import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onComplete?: () => void;
  onDelete?: () => void;
  isCompleted?: boolean;
}

const SwipeableTaskCard: React.FC<Props> = ({
  children,
  onComplete,
  onDelete,
  isCompleted = false,
}) => {
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 100;
    const offset = info.offset.x;

    if (offset > threshold && onComplete && !isCompleted) {
      // Swipe right to complete
      setSwipeDirection('right');
      setTimeout(() => {
        onComplete();
        setSwipeDirection(null);
      }, 300);
    } else if (offset < -threshold && onDelete) {
      // Swipe left to delete
      setSwipeDirection('left');
      setTimeout(() => {
        onDelete();
        setSwipeDirection(null);
      }, 300);
    } else {
      setSwipeDirection(null);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl md:overflow-visible">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-between px-6">
        {/* Complete Action (Right) */}
        {onComplete && !isCompleted && (
          <div className="flex items-center gap-2 text-emerald-500">
            <Check size={24} strokeWidth={3} />
            <span className="font-black text-sm uppercase">Complete</span>
          </div>
        )}
        <div />
        {/* Delete Action (Left) */}
        {onDelete && (
          <div className="flex items-center gap-2 text-red-500">
            <span className="font-black text-sm uppercase">Delete</span>
            <Trash2 size={24} strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={{
          x: swipeDirection === 'right' ? '100%' : swipeDirection === 'left' ? '-100%' : 0,
          opacity: swipeDirection ? 0 : 1,
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative bg-white dark:bg-zinc-900 touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableTaskCard;

