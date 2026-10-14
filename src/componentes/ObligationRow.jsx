import React from 'react';
import { CalendarDaysIcon, CheckIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { descreverObrigacao } from '../utils/obrigacoes.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Um único sinal visual por conta: o ícone (forma + tom) e a cor do texto temporal andam juntos.
// Ícones falam de DATA/obrigação (a repetição, ArrowPath, é só das recorrências).
const SINAIS = {
  atrasada: { Icone: ExclamationCircleIcon, circulo: 'bg-warning/10 text-warning', texto: 'text-warning font-medium' },
  venceHoje: { Icone: CalendarDaysIcon, circulo: 'bg-foreground/10 text-foreground', texto: 'text-foreground font-medium' },
  proxima: { Icone: CalendarDaysIcon, circulo: 'bg-surface-hover text-foreground-secondary', texto: 'text-foreground-secondary' },
  realizada: { Icone: CheckIcon, circulo: 'bg-positive/10 text-positive', texto: 'text-foreground-muted' },
  cancelada: { Icone: XMarkIcon, circulo: 'bg-surface-hover text-foreground-muted', texto: 'text-foreground-muted' },
};

// Linha de AGENDA (não é uma transação nem uma regra). Prioridade: descrição → valor → vencimento/status.
// Sem caixa própria: fica sobre o fundo, separada das vizinhas por divisor. Receita prevista leva "+" e
// verde (dinheiro entrando); despesa fica neutra — vermelho/verde seguem estritamente semânticos.
const ObligationRow = ({ ocorrencia, agora, liquidacao, onClick }) => {
  const { estado, texto } = descreverObrigacao(ocorrencia, agora, liquidacao);
  const { Icone, circulo, texto: tomTexto } = SINAIS[estado];
  const ehReceita = ocorrencia.tipo === 'receita';
  const cancelada = estado === 'cancelada';
  const valor = formatadorMoeda.format(ocorrencia.valor);

  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring cursor-pointer w-[calc(100%+1rem)] min-h-16 flex items-center gap-3 py-3 px-2 -mx-2 rounded-xl text-left hover:bg-surface-hover"
    >
      <span className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${circulo}`}>
        <Icone className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-3">
          <span className={`font-medium truncate ${cancelada ? 'text-foreground-muted line-through' : 'text-foreground'}`}>{ocorrencia.descricao}</span>
          <span className={`font-semibold tabular-nums shrink-0 ${cancelada ? 'text-foreground-muted line-through' : ehReceita ? 'text-positive' : 'text-foreground'}`}>
            {ehReceita ? '+ ' : ''}
            {valor}
          </span>
        </span>
        <span className={`block text-sm truncate ${tomTexto}`}>{texto}</span>
      </span>
    </button>
  );
};

export default ObligationRow;
