import React from 'react';
import { PencilSquareIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Progress from './ui/Progress';
import Badge from './ui/Badge';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// `valorAtual` aqui é o `valorReservado` da meta — nome do prop mantido como já
// existia (Design Lab) pra não quebrar quem já consumia este componente.
const GoalCard = ({ nome, valorAtual, valorAlvo, onGuardar, onRetirar, onEditar, onExcluir }) => {
  const progresso = valorAlvo > 0 ? Math.min(100, (valorAtual / valorAlvo) * 100) : 0;
  const concluida = valorAlvo > 0 && valorAtual >= valorAlvo;

  return (
    <div className="rounded-2xl bg-surface-raised border border-border p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">{nome}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground mt-1">
            {formatadorMoeda.format(valorAtual)}
          </p>
          <p className="text-sm text-foreground-muted tabular-nums">de {formatadorMoeda.format(valorAlvo)}</p>
        </div>
        {(onEditar || onExcluir) && (
          <div className="flex items-center gap-0.5 shrink-0 -mr-1.5 -mt-1">
            {onEditar && (
              <IconButton aria-label={`Editar ${nome}`} onClick={onEditar}>
                <PencilSquareIcon className="h-4 w-4" />
              </IconButton>
            )}
            {onExcluir && (
              <IconButton aria-label={`Excluir ${nome}`} variant="danger" onClick={onExcluir}>
                <TrashIcon className="h-4 w-4" />
              </IconButton>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {/* Neutro em andamento — progresso de meta não é "ganho financeiro". Só vira
            positive quando concluída: aí sim a cor comunica algo de verdade. */}
        <Progress percentual={progresso} corClasse={concluida ? 'bg-positive' : 'bg-foreground'} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground-muted">{Math.round(progresso)}%</span>
          {concluida && (
            <Badge variant="positive">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Concluída
            </Badge>
          )}
        </div>
      </div>

      {(onGuardar || onRetirar) && (
        <div className="grid grid-cols-2 gap-2">
          {onGuardar && (
            <Button variant="secondary" size="sm" onClick={onGuardar} disabled={concluida}>
              Guardar
            </Button>
          )}
          {onRetirar && (
            <Button variant="secondary" size="sm" onClick={onRetirar} disabled={valorAtual <= 0}>
              Retirar
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default GoalCard;
