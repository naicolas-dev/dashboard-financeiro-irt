import React from 'react';
import { motion } from 'motion/react';
import Tooltip from './ui/Tooltip.jsx';
import {
  HomeIcon,
  ArrowsRightLeftIcon,
  CreditCardIcon,
  FlagIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolido,
  ArrowsRightLeftIcon as MovimentacoesIconSolido,
  CreditCardIcon as CartoesIconSolido,
  FlagIcon as MetasIconSolido,
} from '@heroicons/react/24/solid';

const MotionButton = motion.button;

const SECOES = [
  { id: 'inicio', label: 'Início', Icone: HomeIcon, IconeAtivo: HomeIconSolido },
  { id: 'movimentacoes', label: 'Movimentações', Icone: ArrowsRightLeftIcon, IconeAtivo: MovimentacoesIconSolido },
  { id: 'cartoes', label: 'Cartões', Icone: CreditCardIcon, IconeAtivo: CartoesIconSolido },
  { id: 'metas', label: 'Metas', Icone: FlagIcon, IconeAtivo: MetasIconSolido },
];

// ÚNICA navbar do desktop — flutuante, fora do fluxo do header (que no desktop nem
// existe mais, ver AppShell.jsx). Sempre aberta, sem hover/colapso — testamos a
// versão animada (círculo → pill, guardada em DesktopNavigationExpansivel.jsx) e na
// prática não fez sentido; pode voltar a fazer sentido no futuro, mas por ora fica
// fixa mostrando as 4 seções + tema/logout o tempo todo.
const DesktopNavigation = ({ activeSection, onNavegar, temaEscuro, onAlternarTema, onSair }) => (
  <div
    className="hidden lg:flex items-center bg-surface-raised border border-border rounded-full p-1 gap-1 shadow-lg shadow-black/5 fixed top-4 left-1/2 -translate-x-1/2 z-50"
    role="navigation"
    aria-label="Navegação principal"
  >
    {SECOES.map((secao) => {
      const ativo = secao.id === activeSection;
      const Icone = ativo ? secao.IconeAtivo : secao.Icone;

      return (
        <MotionButton
          key={secao.id}
          type="button"
          onClick={() => onNavegar(secao.id)}
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.09 }}
          className={`focus-ring cursor-pointer flex items-center justify-center gap-2 rounded-full h-9 px-3.5 ${
            ativo ? 'bg-surface-active text-foreground' : 'text-foreground-secondary hover:text-foreground'
          }`}
          aria-current={ativo ? 'page' : undefined}
        >
          <Icone className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">{secao.label}</span>
        </MotionButton>
      );
    })}

    <div className="w-px h-5 bg-border mx-0.5 shrink-0" aria-hidden="true" />

    <Tooltip content={temaEscuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}>
      <MotionButton
        type="button"
        onClick={onAlternarTema}
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.09 }}
        className="focus-ring cursor-pointer flex items-center justify-center h-9 w-9 rounded-full text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
        aria-label={temaEscuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      >
        {temaEscuro ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
      </MotionButton>
    </Tooltip>

    <Tooltip content="Sair">
      <MotionButton
        type="button"
        onClick={onSair}
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.09 }}
        className="focus-ring cursor-pointer flex items-center justify-center h-9 w-9 rounded-full text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
        aria-label="Sair"
      >
        <ArrowRightOnRectangleIcon className="h-5 w-5" />
      </MotionButton>
    </Tooltip>
  </div>
);

export default DesktopNavigation;
