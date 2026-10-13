import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';

const MotionDiv = motion.div;

// Mesmo componente/DOM para mobile e desktop (seção 27 do plano de UI: "evitar
// manter duas cópias da lógica"). Só a curva de entrada muda com o viewport:
// sobe do rodapé (bottom sheet) no mobile, cresce a partir do centro no desktop.
function useEhDesktop() {
  const [ehDesktop, setEhDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 768px)');
    const aoMudar = (e) => setEhDesktop(e.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  return ehDesktop;
}

const ResponsiveDialog = ({ aberto, aoFechar, titulo, children }) => {
  const ehDesktop = useEhDesktop();
  const reduzirMovimento = useReducedMotionConfig();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      // Se houver algo empilhado por cima (ex.: o Drawer mobile do ComboboxField,
      // que também é um [role="dialog"] via Portal), o Escape fecha só o de cima
      // primeiro — sem isso, o listener global daqui fechava os dois juntos.
      const todos = document.querySelectorAll('[role="dialog"]');
      if (todos[todos.length - 1] !== dialogRef.current) return;
      aoFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, aoFechar]);

  const variantes = ehDesktop
    ? {
        initial: { opacity: 0, scale: 0.97 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.97 },
        transition: { duration: 0.18 },
      }
    : // `transform` inteiro (não `y`): no Motion só `transform`/`opacity` vão pro
      // compositor — `y` é recalculado em JS a cada frame e travava a sheet
      // justamente enquanto o conteúdo (ex.: keypad) monta. Tween curto, sem spring.
      // O MotionConfig global não cobre `transform` explícito, por isso o
      // reduced-motion é aplicado aqui à mão.
      {
        initial: { transform: 'translateY(100%)' },
        animate: { transform: 'translateY(0%)', transition: { duration: reduzirMovimento ? 0 : 0.24, ease: [0.32, 0.72, 0, 1] } },
        exit: { transform: 'translateY(100%)', transition: { duration: reduzirMovimento ? 0 : 0.18, ease: [0.4, 0, 1, 1] } },
      };

  return (
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          <MotionDiv
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--color-overlay)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={aoFechar}
            aria-hidden="true"
          />
          <MotionDiv
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            {...variantes}
            className="focus-ring relative w-full md:w-auto md:min-w-[22rem] md:max-w-md bg-surface-raised text-foreground border border-border rounded-t-3xl md:rounded-2xl pb-safe max-h-[90dvh] overflow-y-auto shadow-xl"
          >
            {titulo && (
              <div className="px-5 pt-5 pb-2">
                <h2 className="text-lg font-semibold">{titulo}</h2>
              </div>
            )}
            <div className="px-5 pb-6 pt-2">{children}</div>
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ResponsiveDialog;
