import React from 'react';
import { Badge as ChakraBadge } from '@chakra-ui/react';

// Wrapper fino — `variant` mapeado pros tokens certos, nunca `colorPalette`
// default do Chakra (blue/teal/purple/orange). Cor só aparece quando é
// semanticamente real (positive/warning); "neutro" é só um rótulo discreto.
const ESTILOS = {
  positive: 'bg-positive/10 text-positive',
  warning: 'bg-warning/10 text-warning',
  neutro: 'bg-surface-active text-foreground-secondary',
};

const Badge = ({ variant = 'neutro', children, className = '' }) => (
  // variant="plain" no Chakra remove o background/cor default dele (nenhum
  // colorPalette azul/verde/laranja chega a ser aplicado) — a cor vem só das
  // classes Tailwind abaixo.
  <ChakraBadge
    variant="plain"
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ESTILOS[variant]} ${className}`}
  >
    {children}
  </ChakraBadge>
);

export default Badge;
