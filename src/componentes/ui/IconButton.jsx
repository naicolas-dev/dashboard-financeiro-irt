import React from 'react';
import { motion } from 'motion/react';
import Tooltip from './Tooltip.jsx';

const MotionButton = motion.button;

const estilosPorVariante = {
  default: 'text-foreground-secondary hover:text-foreground hover:bg-surface-hover',
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  danger: 'text-foreground-secondary hover:text-negative hover:bg-surface-hover',
};

// Botão só-ícone com área de toque >= 44px mesmo quando o SVG interno é pequeno
// (achado da auditoria: PainelMetas/PainelRecorrentes tinham botões de ~20px).
const IconButton = React.forwardRef(function IconButton(
  { variant = 'default', className = '', children, 'aria-label': ariaLabel, ...props },
  ref
) {
  if (!ariaLabel && import.meta.env.DEV) {
    console.warn('IconButton sem aria-label — ícone sozinho não é acessível.');
  }

  return (
    <Tooltip content={ariaLabel}>
      <MotionButton
        ref={ref}
        whileTap={{ scale: 0.93 }}
        transition={{ duration: 0.08 }}
        aria-label={ariaLabel}
        className={`focus-ring cursor-pointer inline-flex items-center justify-center h-11 w-11 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${estilosPorVariante[variant]} ${className}`}
        {...props}
      >
        {children}
      </MotionButton>
    </Tooltip>
  );
});

export default IconButton;
