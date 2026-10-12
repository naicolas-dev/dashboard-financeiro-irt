import React from 'react';
import { motion } from 'motion/react';

const MotionButton = motion.button;

// Cor só é forte quando tem significado financeiro: Receita é verde (positive),
// Despesa é vermelha (negative). O resto (Guardar, Cartões) é neutro de alto
// contraste — não existe mais uma "cor de destaque" genérica pra tudo.
const CORES_ICONE = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutro: 'text-foreground',
};

function QuickAction({ icone, label, tom = 'neutro', onClick }) {
  const Icone = icone;
  return (
    <MotionButton
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.09 }}
      className="focus-ring cursor-pointer flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface hover:bg-surface-hover py-3 px-2 min-h-16"
    >
      <Icone className={`h-5 w-5 ${CORES_ICONE[tom] || CORES_ICONE.neutro}`} />
      <span className="text-xs font-medium text-foreground-secondary">{label}</span>
    </MotionButton>
  );
}

export default QuickAction;
