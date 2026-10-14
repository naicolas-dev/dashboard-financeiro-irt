import React, { useState } from 'react';
import Button from './ui/Button';
import Badge from './ui/Badge';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Gestão de UMA assinatura. Editar abre o formulário; Cancelar e Excluir passam pelas confirmações do hook
// (devolvem true/false). Cancelar para novas cobranças e preserva o histórico; Excluir só aparece quando a
// assinatura nunca gerou cobrança.
const SubscriptionActions = ({ assinatura, cartaoNome, podeExcluir, onEditar, onCancelar, onExcluir, onFechar }) => {
  const [ocupado, setOcupado] = useState(false);

  const executar = async (acao) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const ok = await acao(assinatura);
      if (ok) onFechar();
      else setOcupado(false);
    } catch (erro) {
      console.error('Erro na ação da assinatura:', erro);
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={onFechar} className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg">
          Fechar
        </button>
        <p className="text-sm font-semibold text-foreground">Assinatura</p>
        <div className="w-16" aria-hidden="true" />
      </div>

      <div className="rounded-xl bg-surface p-4 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-foreground">{assinatura.descricao}</p>
          {!assinatura.ativa && <Badge>Cancelada</Badge>}
        </div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{formatadorMoeda.format(assinatura.valor)}<span className="text-sm font-normal text-foreground-muted">/mês</span></p>
        <p className="text-xs text-foreground-muted">
          Todo dia {assinatura.diaDoMes} · {assinatura.categoria} · {cartaoNome}
        </p>
      </div>

      <div className="space-y-2">
        <Button variant="secondary" size="lg" className="w-full" disabled={ocupado} onClick={() => { onFechar(); onEditar(assinatura); }}>
          Editar assinatura
        </Button>
        {assinatura.ativa && (
          <Button variant="secondary" className="w-full" disabled={ocupado} onClick={() => executar(onCancelar)}>
            Cancelar assinatura
          </Button>
        )}
        {podeExcluir && (
          <Button variant="ghost" className="w-full text-negative" disabled={ocupado} onClick={() => executar(onExcluir)}>
            Excluir assinatura
          </Button>
        )}
      </div>
      {assinatura.ativa && <p className="text-xs text-foreground-muted">Cancelar para as próximas cobranças e mantém o histórico, as faturas e os pagamentos.</p>}
      {!podeExcluir && <p className="text-xs text-foreground-muted">Esta assinatura já gerou cobranças, por isso não pode ser excluída. Cancele-a para parar as próximas.</p>}
    </div>
  );
};

export default SubscriptionActions;
