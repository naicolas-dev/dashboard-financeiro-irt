import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import GoalCard from '../componentes/GoalCard.jsx';
import GoalForm from '../componentes/GoalForm.jsx';
import GoalAmountDialog from '../componentes/GoalAmountDialog.jsx';
import ResponsiveDialog from '../componentes/ui/ResponsiveDialog.jsx';
import Skeleton from '../componentes/ui/Skeleton.jsx';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function MetasSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

// Mesmo tile pontilhado que Cartões já usa pra "+ novo", só com cantos de card
// comum (rounded-2xl) em vez do rounded-[20px] do CreditCardTile.
function AdicionarMetaTile({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring cursor-pointer rounded-2xl border-2 border-dashed border-border-strong min-h-48 flex flex-col items-center justify-center gap-2 text-foreground-secondary hover:border-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
    >
      <PlusIcon className="h-6 w-6" />
      <span className="text-sm font-medium">Adicionar meta</span>
    </button>
  );
}

// Guardar/retirar dinheiro NUNCA cria transação — só move `valorReservado` da
// própria meta. `saldoDisponivel`/`totalReservadoMetas` vêm prontos do hook (mesma
// fonte de saldo que a Home usa, sem fórmula duplicada aqui).
const Metas = ({
  metas,
  carregando,
  erroCarregamento,
  saldoDisponivel,
  totalReservadoMetas,
  handleMetaSalva,
  handleMetaAtualizada,
  excluirMeta,
}) => {
  const [novaMetaAberta, setNovaMetaAberta] = useState(false);
  const [metaEditando, setMetaEditando] = useState(null);
  const [acaoValor, setAcaoValor] = useState(null); // { meta, modo: 'guardar' | 'retirar' }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Metas</h1>
        {!carregando && metas.length === 0 && (
          <p className={`text-sm mt-1 ${erroCarregamento ? 'text-warning' : 'text-foreground-secondary'}`}>
            {erroCarregamento
              ? 'Sem conexão — não foi possível carregar suas metas.'
              : 'Nenhuma meta criada. Crie uma meta para separar dinheiro para um objetivo.'}
          </p>
        )}
      </div>

      <div className="flex items-center gap-8">
        <div>
          <p className="text-sm text-foreground-secondary">Disponível para guardar</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {erroCarregamento ? '—' : formatadorMoeda.format(saldoDisponivel)}
          </p>
        </div>
        <div>
          <p className="text-sm text-foreground-secondary">Reservado</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {erroCarregamento ? '—' : formatadorMoeda.format(totalReservadoMetas)}
          </p>
        </div>
      </div>

      {carregando ? (
        <MetasSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metas.map((meta) => (
            <GoalCard
              key={meta.id}
              nome={meta.nome}
              valorAtual={meta.valorReservado}
              valorAlvo={meta.valorAlvo}
              onGuardar={() => setAcaoValor({ meta, modo: 'guardar' })}
              onRetirar={() => setAcaoValor({ meta, modo: 'retirar' })}
              onEditar={() => setMetaEditando(meta)}
              onExcluir={() => excluirMeta(meta)}
            />
          ))}
          <AdicionarMetaTile onClick={() => setNovaMetaAberta(true)} />
        </div>
      )}

      <ResponsiveDialog aberto={novaMetaAberta} aoFechar={() => setNovaMetaAberta(false)}>
        <GoalForm onVoltar={() => setNovaMetaAberta(false)} onMetaSalva={handleMetaSalva} onCriado={() => setNovaMetaAberta(false)} />
      </ResponsiveDialog>

      <ResponsiveDialog aberto={!!metaEditando} aoFechar={() => setMetaEditando(null)}>
        {metaEditando && (
          <GoalForm
            metaParaEditar={metaEditando}
            onVoltar={() => setMetaEditando(null)}
            onMetaSalva={handleMetaSalva}
            onEditado={() => setMetaEditando(null)}
            excluirMeta={excluirMeta}
            onExcluido={() => setMetaEditando(null)}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={!!acaoValor} aoFechar={() => setAcaoValor(null)}>
        {acaoValor && (
          <GoalAmountDialog
            meta={acaoValor.meta}
            modo={acaoValor.modo}
            saldoDisponivel={saldoDisponivel}
            onFechar={() => setAcaoValor(null)}
            onConcluido={handleMetaAtualizada}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default Metas;
