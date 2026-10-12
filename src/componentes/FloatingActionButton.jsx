import React from 'react';
import { motion } from 'motion/react';
import { PlusIcon } from '@heroicons/react/24/solid';

const MotionButton = motion.button;

const FloatingActionButton = ({ onClick, visivel = true }) => (
  <MotionButton
    type="button"
    onClick={onClick}
    aria-label="Novo lançamento"
    whileTap={{ scale: 0.93 }}
    animate={{ opacity: visivel ? 1 : 0, y: visivel ? 0 : 20 }}
    transition={{ duration: 0.2 }}
    style={{ pointerEvents: visivel ? 'auto' : 'none' }}
    className="focus-ring fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-8 right-5 lg:right-8 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center cursor-pointer"
  >
    <PlusIcon className="h-7 w-7" />
  </MotionButton>
);

export default FloatingActionButton;
