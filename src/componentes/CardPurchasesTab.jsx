import React, { useState } from 'react';
import { PencilSquareIcon, TrashIcon, InboxIcon, PlusIcon } from '@heroicons/react/24/outline';
import IconButton from './ui/IconButton.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import { rotuloParcelas } from '../servicos/cartoes.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Uma linha por compra-pai (não por parcela) — é aqui que mora a administração de
// verdade: editar/excluir a compra inteira, e o modo de seleção múltipla. "Selecionar
// todos" pega TODAS as compras do cartão, não só as da competência aberta no Extrato —
// é o caso de uso de limpar dados de teste de um cartão inteiro.
const CardPurchasesTab = ({ comprasDoCartao, onEditarCompra, onAdicionarCompra, excluirCompra, excluirVariasCompras }) => {
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());

  const toggleSelecionado = (id) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const cancelarSelecao = () => {
    setModoSelecao(false);
    setSelecionados(new Set());
  };

  const selecionarTodos = () => setSelecionados(new Set(comprasDoCartao.map((c) => c.id)));

  const excluirSelecionados = async () => {
    const compras = comprasDoCartao.filter((c) => selecionados.has(c.id));
    const sucesso = await excluirVariasCompras(compras);
    if (sucesso) cancelarSelecao();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Compras</h2>
        {!modoSelecao && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onAdicionarCompra}
              className="focus-ring cursor-pointer flex items-center gap-1 text-sm font-medium text-foreground px-2 py-1 rounded-lg hover:bg-surface-hover"
            >
              <PlusIcon className="h-4 w-4" />
              Adicionar
            </button>
            {comprasDoCartao.length > 0 && (
              <button
                type="button"
                onClick={() => setModoSelecao(true)}
                className="focus-ring cursor-pointer text-sm font-medium text-foreground px-2 py-1 rounded-lg hover:bg-surface-hover"
              >
                Selecionar
              </button>
            )}
          </div>
        )}
        {modoSelecao && (
          <button
            type="button"
            onClick={cancelarSelecao}
            className="focus-ring cursor-pointer text-sm font-medium text-foreground-secondary px-2 py-1 rounded-lg hover:bg-surface-hover"
          >
            Cancelar
          </button>
        )}
      </div>

      {modoSelecao && (
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={selecionarTodos}
            className="focus-ring cursor-pointer text-sm font-medium text-foreground px-2 py-1 rounded-lg hover:bg-surface-hover"
          >
            Selecionar todos
          </button>
          <Button variant="destructive" size="sm" disabled={selecionados.size === 0} onClick={excluirSelecionados}>
            Excluir selecionados ({selecionados.size})
          </Button>
        </div>
      )}

      {comprasDoCartao.length === 0 ? (
        <EmptyState icone={InboxIcon} titulo="Nenhuma compra neste cartão" descricao="Compras parceladas aparecem aqui." />
      ) : (
        <div className="rounded-2xl border border-border bg-surface-raised p-2 divide-y divide-border">
          {comprasDoCartao.map((compra) => {
            const selecionada = selecionados.has(compra.id);
            const conteudo = (
              <>
                <p className="font-medium text-foreground truncate">{compra.descricao}</p>
                <p className="text-xs text-foreground-muted">
                  {compra.categoria} · {rotuloParcelas(compra.numeroParcelas)} · {formatadorMoeda.format(compra.valorTotal)}
                </p>
              </>
            );

            return (
              <div key={compra.id} className="flex items-center gap-3 py-3">
                {modoSelecao && (
                  <input
                    type="checkbox"
                    checked={selecionada}
                    onChange={() => toggleSelecionado(compra.id)}
                    className="h-5 w-5 shrink-0 accent-primary"
                    aria-label={`Selecionar ${compra.descricao}`}
                  />
                )}
                {modoSelecao ? (
                  <button type="button" onClick={() => toggleSelecionado(compra.id)} className="focus-ring cursor-pointer flex-1 min-w-0 text-left">
                    {conteudo}
                  </button>
                ) : (
                  <div className="flex-1 min-w-0">{conteudo}</div>
                )}
                {!modoSelecao && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton aria-label={`Editar ${compra.descricao}`} onClick={() => onEditarCompra(compra)}>
                      <PencilSquareIcon className="h-5 w-5" />
                    </IconButton>
                    <IconButton aria-label={`Excluir ${compra.descricao}`} variant="danger" onClick={() => excluirCompra(compra)}>
                      <TrashIcon className="h-5 w-5" />
                    </IconButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CardPurchasesTab;
