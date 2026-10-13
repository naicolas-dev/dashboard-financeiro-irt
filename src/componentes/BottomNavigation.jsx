import React from 'react';
import { HomeIcon, ArrowsRightLeftIcon, CreditCardIcon, FlagIcon } from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolido,
  ArrowsRightLeftIcon as MovimentacoesIconSolido,
  CreditCardIcon as CartoesIconSolido,
  FlagIcon as MetasIconSolido,
} from '@heroicons/react/24/solid';

const ITENS = [
  { id: 'inicio', label: 'Início', Icone: HomeIcon, IconeAtivo: HomeIconSolido },
  { id: 'movimentacoes', label: 'Movimentações', Icone: ArrowsRightLeftIcon, IconeAtivo: MovimentacoesIconSolido },
  { id: 'cartoes', label: 'Cartões', Icone: CreditCardIcon, IconeAtivo: CartoesIconSolido },
  { id: 'metas', label: 'Metas', Icone: FlagIcon, IconeAtivo: MetasIconSolido },
];

// Visível em mobile/tablet, escondida em desktop (>= lg). Item ativo vira uma pill
// com ícone+label (neutra, sem roxo); inativos ficam só com o ícone. Sem `layout`
// do Motion de propósito: ele media a posição dos 4 botões (leitura forçada de
// layout) a cada troca, bem quando a página nova está montando. A largura muda
// direto; a sensação de transição vem só de cor + rótulo entrando (CSS barato).
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
            <button
              type="button"
              onClick={() => aoNavegar(id)}
              className={`focus-ring cursor-pointer flex items-center justify-center gap-1.5 rounded-full min-h-11 transition-colors duration-150 ${
                estaAtivo ? 'bg-surface-active text-foreground px-4 py-2.5' : 'text-foreground-muted px-3.5 py-2.5'
              }`}
              aria-current={estaAtivo ? 'page' : undefined}
              aria-label={estaAtivo ? undefined : label}
            >
              <IconeFinal className="h-5 w-5 shrink-0" />
              {estaAtivo && <span className="rotulo-nav-entrar text-sm font-medium whitespace-nowrap">{label}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default BottomNavigation;
