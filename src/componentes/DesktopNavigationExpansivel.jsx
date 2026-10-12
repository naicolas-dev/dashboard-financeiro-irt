// Versão animada da navbar desktop (círculo recolhido → pill expansível no
// hover/foco), testada e funcional, mas o usuário decidiu não usar por enquanto —
// preferiu a navbar sempre aberta (ver DesktopNavigation.jsx). Guardado aqui sem
// uso, caso queira retomar essa direção depois; não importado em lugar nenhum.
import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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

const MotionDiv = motion.div;
const MotionButton = motion.button;

const SECOES = [
  { id: 'inicio', label: 'Início', Icone: HomeIcon, IconeAtivo: HomeIconSolido },
  { id: 'movimentacoes', label: 'Movimentações', Icone: ArrowsRightLeftIcon, IconeAtivo: MovimentacoesIconSolido },
  { id: 'cartoes', label: 'Cartões', Icone: CreditCardIcon, IconeAtivo: CartoesIconSolido },
  { id: 'metas', label: 'Metas', Icone: FlagIcon, IconeAtivo: MetasIconSolido },
];

const DesktopNavigationExpansivel = ({ activeSection, onNavegar, temaEscuro, onAlternarTema, onSair }) => {
  const [expandido, setExpandido] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const expandir = () => {
    clearTimeout(timeoutRef.current);
    setExpandido(true);
  };

  const agendarRecolher = () => {
    timeoutRef.current = setTimeout(() => setExpandido(false), 200);
  };

  const aoSairDoFoco = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      agendarRecolher();
    }
  };

  return (
    <div
      className="hidden lg:block fixed top-4 left-1/2 -translate-x-1/2 z-50 p-3"
      onPointerEnter={expandir}
      onPointerLeave={agendarRecolher}
      onFocus={expandir}
      onBlur={aoSairDoFoco}
    >
      <MotionDiv
        layout
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="flex items-center bg-surface-raised border border-border rounded-full p-1 gap-1 shadow-lg shadow-black/5"
        role="navigation"
        aria-label="Navegação principal"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {SECOES.map((secao) => {
            const ativo = secao.id === activeSection;
            if (!expandido && !ativo) return null;

            const Icone = ativo ? secao.IconeAtivo : secao.Icone;

            return (
              <MotionButton
                key={secao.id}
                layout
                type="button"
                onClick={() => onNavegar(secao.id)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className={`focus-ring cursor-pointer flex items-center justify-center gap-2 rounded-full h-9 ${
                  expandido ? 'px-3.5' : 'w-9'
                } ${ativo ? 'bg-surface-active text-foreground' : 'text-foreground-secondary hover:text-foreground'}`}
                aria-current={ativo ? 'page' : undefined}
                aria-label={expandido ? undefined : secao.label}
              >
                <Icone className="h-5 w-5 shrink-0" />
                {expandido && <span className="text-sm font-medium whitespace-nowrap">{secao.label}</span>}
              </MotionButton>
            );
          })}

          {expandido && (
            <motion.div
              key="separador"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="w-px h-5 bg-border mx-0.5 shrink-0"
              aria-hidden="true"
            />
          )}

          {expandido && (
            <MotionButton
              key="tema"
              layout
              type="button"
              onClick={onAlternarTema}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="focus-ring cursor-pointer flex items-center justify-center h-9 w-9 rounded-full text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
              aria-label={temaEscuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {temaEscuro ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </MotionButton>
          )}

          {expandido && (
            <MotionButton
              key="logout"
              layout
              type="button"
              onClick={onSair}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="focus-ring cursor-pointer flex items-center justify-center h-9 w-9 rounded-full text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
              aria-label="Sair"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </MotionButton>
          )}
        </AnimatePresence>
      </MotionDiv>
    </div>
  );
};

export default DesktopNavigationExpansivel;
