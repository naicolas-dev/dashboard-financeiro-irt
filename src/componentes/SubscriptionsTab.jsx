import React from 'react';
import { ArrowPathIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import EmptyState from './ui/EmptyState.jsx';
import { proximaCobranca } from '../dominio/assinaturasCartao.js';
import { formatarDataCurta } from '../utils/datas.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Lista de ASSINATURAS do cartão (os templates), separada do extrato da fatura: as cobranças geradas
// aparecem como compras normais. Tocar numa linha abre a gestão (editar / cancelar / excluir).
const SubscriptionsTab = ({ assinaturas, indisponivel, onNova, onAbrir }) => {
  const agora = new Date();
  const ativas = assinaturas.filter((a) => a.ativa);
  const canceladas = assinaturas.filter((a) => !a.ativa);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Assinaturas</h2>
        {!indisponivel && (
          <button
            type="button"
            onClick={onNova}
            className="focus-ring cursor-pointer flex items-center gap-1 text-sm font-medium text-foreground px-2 py-1 rounded-lg hover:bg-surface-hover"
          >
            <PlusIcon className="h-4 w-4" />
            Nova
          </button>
        )}
      </div>

      {indisponivel ? (
        <EmptyState icone={ArrowPathIcon} titulo="Assinaturas indisponíveis" descricao="Não foi possível ler as assinaturas agora. Suas compras e faturas continuam normais." />
      ) : assinaturas.length === 0 ? (
        <EmptyState
          icone={ArrowPathIcon}
          titulo="Nenhuma assinatura"
          descricao="Cadastre cobranças mensais, como streaming ou apps. Cada mês vira uma compra na fatura."
          textoAcao="Nova assinatura"
          onAcao={onNova}
        />
      ) : (
        <div className="divide-y divide-border">
          {[...ativas, ...canceladas].map((a) => {
            const proxima = proximaCobranca(a, agora);
            return (
              <div key={a.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(a.id)}
                  className={`focus-ring cursor-pointer w-[calc(100%+1rem)] min-h-14 flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl text-left hover:bg-surface-hover ${a.ativa ? '' : 'opacity-60'}`}
                >
                  <span className="h-8 w-8 rounded-full bg-surface-hover text-foreground-muted flex items-center justify-center shrink-0">
                    <ArrowPathIcon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{a.descricao}</span>
                    <span className="block text-xs text-foreground-muted truncate">
                      {formatadorMoeda.format(a.valor)}/mês · dia {a.diaDoMes} · {a.ativa ? (proxima ? `próxima ${formatarDataCurta(proxima.data)}` : 'ativa') : 'cancelada'}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 text-foreground-muted shrink-0" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubscriptionsTab;
