import { Variants } from 'framer-motion';

/**
 * Common animation variants for consistent motion design
 */

// Fade in/out
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// Slide up
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// Slide down
export const slideDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

// Slide from left
export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// Slide from right
export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

// Scale in/out
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

// Pop in (spring animation)
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  exit: { opacity: 0, scale: 0.8 },
};

// Stagger children
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// List item (for use with staggerContainer)
export const listItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

// Collapse/Expand
export const collapse: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1 },
};

// Rotate in
export const rotateIn: Variants = {
  hidden: { opacity: 0, rotate: -10 },
  visible: { opacity: 1, rotate: 0 },
  exit: { opacity: 0, rotate: 10 },
};

/**
 * Transition presets
 */
export const transitions = {
  fast: { duration: 0.2 },
  normal: { duration: 0.3 },
  slow: { duration: 0.5 },
  spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
  springBouncy: { type: 'spring' as const, stiffness: 500, damping: 25 },
  springSmooth: { type: 'spring' as const, stiffness: 200, damping: 40 },
};

/**
 * Page transition variants
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

/**
 * Modal/Dialog transition
 */
export const modalTransition: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: transitions.fast,
  },
};

/**
 * Backdrop transition
 */
export const backdropTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.normal },
  exit: { opacity: 0, transition: transitions.fast },
};

/**
 * Status badge pulse animation
 */
export const statusPulse: Variants = {
  idle: { scale: 1 },
  active: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Loading skeleton shimmer
 */
export const shimmer: Variants = {
  initial: { backgroundPosition: '-200% 0' },
  animate: {
    backgroundPosition: '200% 0',
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

