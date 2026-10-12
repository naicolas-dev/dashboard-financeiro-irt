import React from 'react';
import { motion } from 'motion/react';
import { HomeIcon, ArrowsRightLeftIcon, CreditCardIcon, FlagIcon } from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolido,
  ArrowsRightLeftIcon as MovimentacoesIconSolido,
  CreditCardIcon as CartoesIconSolido,
  FlagIcon as MetasIconSolido,
} from '@heroicons/react/24/solid';

const MotionButton = motion.button;

const ITENS = [
  { id: 'inicio', label: 'Início', Icone: HomeIcon, IconeAtivo: HomeIconSolido },
  { id: 'movimentacoes', label: 'Movimentações', Icone: ArrowsRightLeftIcon, IconeAtivo: MovimentacoesIconSolido },
  { id: 'cartoes', label: 'Cartões', Icone: CreditCardIcon, IconeAtivo: CartoesIconSolido },
  { id: 'metas', label: 'Metas', Icone: FlagIcon, IconeAtivo: MetasIconSolido },
];

// Visível em mobile/tablet, escondida em desktop (>= lg). Item ativo vira uma pill
// com ícone+label (neutra, sem roxo); inativos ficam só com o ícone — `layout` do
// Motion anima a largura de cada botão sozinho quando o ativo muda.
const BottomNavigation = ({ ativo, aoNavegar }) => (
  <nav
    className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-raised border-t border-border pb-safe"
    aria-label="Navegação principal"
  >
    <ul className="flex items-center justify-around px-2 py-2">
      {ITENS.map(({ id, label, Icone, IconeAtivo }) => {
        const estaAtivo = ativo === id;
        const IconeFinal = estaAtivo ? IconeAtivo : Icone;
        return (
          <li key={id}>
            <MotionButton
              layout
              type="button"
              onClick={() => aoNavegar(id)}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className={`focus-ring cursor-pointer flex items-center justify-center gap-1.5 rounded-full min-h-11 ${
                estaAtivo ? 'bg-surface-active text-foreground px-4 py-2.5' : 'text-foreground-muted px-3.5 py-2.5'
              }`}
              aria-current={estaAtivo ? 'page' : undefined}
              aria-label={estaAtivo ? undefined : label}
            >
              <IconeFinal className="h-5 w-5 shrink-0" />
              {estaAtivo && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
            </MotionButton>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default BottomNavigation;
