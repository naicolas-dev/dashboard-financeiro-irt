import React from 'react';
import { motion } from 'motion/react';
import { Spinner } from '@chakra-ui/react';

const MotionButton = motion.button;

const estilosPorVariante = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-surface-raised text-foreground border border-border hover:bg-surface-hover',
  ghost: 'bg-transparent text-foreground hover:bg-surface-hover',
  destructive: 'bg-negative text-white hover:opacity-90',
};

const estilosPorTamanho = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-13 px-5 text-base',
};

const Button = React.forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', children, disabled, carregando = false, ...props },
  ref
) {
  const desabilitado = disabled || carregando;

  // Desabilitado vira neutro de verdade, não a cor da variante com opacidade reduzida
  // (senão "Continuar" parece um botão ativo meio apagado, não indisponível).
  const estiloVisual = desabilitado ? 'bg-surface-hover text-foreground-muted' : estilosPorVariante[variant];

  return (
    <MotionButton
      ref={ref}
      whileTap={desabilitado ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.09 }}
      disabled={desabilitado}
      className={`focus-ring cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${estiloVisual} ${estilosPorTamanho[size]} ${className}`}
      {...props}
    >
      {carregando && <Spinner size="sm" />}
      {children}
    </MotionButton>
  );
});

export default Button;
