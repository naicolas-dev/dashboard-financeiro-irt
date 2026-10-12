import React from 'react';
import { motion } from 'motion/react';
import { BackspaceIcon } from '@heroicons/react/24/outline';
import Button from './ui/Button';

const MotionButton = motion.button;

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'apagar'];
const MAX_DIGITOS = 9; // até R$ 9.999.999,99

// Entrada de valor dedicada (seções 10-12 do plano de UI): estado controlado em
// centavos, mesmo padrão de digitação já usado em FormularioTransacao/Meta/Recorrente.
const AmountKeypad = ({ valorCentavos, onChange, titulo = 'Despesa', onCancelar, onContinuar }) => {
  const valorNumerico = Number(valorCentavos || '0') / 100;

  const aoPressionar = (tecla) => {
    if (tecla === '') return;
    if (tecla === 'apagar') {
      const restante = valorCentavos.slice(0, -1);
      onChange(restante || '0');
      return;
    }
    const base = valorCentavos === '0' ? '' : valorCentavos;
    const proximo = (base + tecla).replace(/^0+(?=\d)/, '');
    if (proximo.length > MAX_DIGITOS) return;
    onChange(proximo || '0');
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={onCancelar}
          className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg"
        >
          Cancelar
        </button>
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <div className="w-16" aria-hidden="true" />
      </div>

      <div className="flex items-center justify-center py-8">
        <p className="text-4xl sm:text-5xl font-semibold tabular-nums text-foreground">
          {formatadorMoeda.format(valorNumerico)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {TECLAS.map((tecla, indice) => {
          if (tecla === '') return <div key={`vazio-${indice}`} aria-hidden="true" />;
          return (
            <MotionButton
              key={tecla}
              type="button"
              onClick={() => aoPressionar(tecla)}
              whileTap={{ scale: 0.93 }}
              transition={{ duration: 0.08 }}
              aria-label={tecla === 'apagar' ? 'Apagar último dígito' : tecla === '00' ? 'Dois zeros' : `Dígito ${tecla}`}
              className="focus-ring cursor-pointer h-16 rounded-2xl bg-surface hover:bg-surface-hover flex items-center justify-center text-2xl font-medium text-foreground"
            >
              {tecla === 'apagar' ? <BackspaceIcon className="h-6 w-6" /> : tecla}
            </MotionButton>
          );
        })}
      </div>

      <Button size="lg" className="w-full" disabled={valorNumerico <= 0} onClick={onContinuar}>
        Continuar
      </Button>
    </div>
  );
};

export default AmountKeypad;
