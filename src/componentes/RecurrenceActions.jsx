import React, { useState } from 'react';
import Button from './ui/Button';
import Badge from './ui/Badge';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Gestão de UMA recorrência (a regra que gera as contas de Programadas). Editar abre o fluxo de
// edição; Encerrar e Excluir passam pelas confirmações do hook (devolvem true/false). Encerrar
// preserva o histórico; Excluir só aparece quando nunca houve pagamento registrado nela.
const RecurrenceActions = ({ serie, podeExcluir, onEditar, onEncerrar, onExcluir, onFechar }) => {
  const [ocupado, setOcupado] = useState(false);
  const encerrada = serie.ativa === false;

  const executar = async (acao) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const ok = await acao(serie);
      if (ok) onFechar();
      else setOcupado(false);
    } catch (erro) {
      console.error('Erro na ação da recorrência:', erro);
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={onFechar} className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg">
          Fechar
        </button>
        <p className="text-sm font-semibold text-foreground">Recorrência</p>
        <div className="w-16" aria-hidden="true" />
      </div>

      <div className="rounded-xl bg-surface p-4 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-foreground">{serie.descricao}</p>
          {encerrada && <Badge>Encerrada</Badge>}
        </div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{formatadorMoeda.format(serie.valor)}</p>
        <p className="text-xs text-foreground-muted">
          {serie.tipo === 'receita' ? 'Receita' : 'Despesa'} · todo mês, dia {serie.diaDoMes} · {serie.categoria}
        </p>
      </div>

      <div className="space-y-2">
        <Button variant="secondary" size="lg" className="w-full" disabled={ocupado} onClick={() => { onFechar(); onEditar(serie); }}>
          Editar recorrência
        </Button>
        {!encerrada && (
          <Button variant="secondary" className="w-full" disabled={ocupado} onClick={() => executar(onEncerrar)}>
            Encerrar recorrência
          </Button>
        )}
        {podeExcluir && (
          <Button variant="ghost" className="w-full text-negative" disabled={ocupado} onClick={() => executar(onExcluir)}>
            Excluir recorrência
          </Button>
        )}
      </div>
      {!encerrada && <p className="text-xs text-foreground-muted">Encerrar cancela as contas futuras pendentes e mantém o histórico.</p>}
    </div>
  );
};

export default RecurrenceActions;
