import React, { useState } from 'react';
import { toast } from 'sonner';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import AmountKeypad from './AmountKeypad';
import TransactionDetails from './TransactionDetails';
import PaymentCardPicker from './PaymentCardPicker';
import PaymentCardForm from './PaymentCardForm';
import InstallmentsPicker from './InstallmentsPicker';
import { criarTransacao, atualizarTransacao } from '../servicos/transacoes.js';
import { criarCompraCartao } from '../servicos/cartoes.js';
import { obterDataHoraLocal } from '../utils/datas.js';

function estadoInicial(tipoInicial, transacaoParaEditar) {
  if (transacaoParaEditar) {
    // Edição não é um wizard: todos os campos (incl. tipo e valor) já aparecem
    // editáveis de uma vez em 'detalhes' — abrir pelo teclado numérico de novo só
    // pra chegar na descrição/categoria era o fluxo lento que motivou esta mudança.
    return { etapa: 'detalhes', etapaInicial: 'detalhes', tipo: transacaoParaEditar.tipo };
  }
  if (tipoInicial) {
    return { etapa: 'valor', etapaInicial: 'valor', tipo: tipoInicial };
  }
  return { etapa: 'tipo', etapaInicial: 'tipo', tipo: null };
}

// Máquina de estados do fluxo de nova transação (seção "TransactionFlow" do plano).
// Aberto via Home.abrirTransacao(tipo?): com tipo pula a etapa de escolha (QuickAction),
// sem tipo começa escolhendo Receita/Despesa (FAB). "Voltar" depende de onde começou.
// Reaproveitado também pela edição (Movimentações, via `transacaoParaEditar`): mesma
// máquina, começando em 'valor' já preenchido — "Voltar"/fechar nesse caso encerra o
// fluxo sem salvar, igual já acontecia pra QuickAction.
const TransactionFlow = ({
  tipoInicial,
  transacaoParaEditar,
  onFechar,
  onTransacaoSalva,
  aoExcluir,
  cartoes,
  onCartaoSalvo,
  onCompraCartaoSalva,
  cartaoForcado,
}) => {
  const modoEdicao = !!transacaoParaEditar;
  const infoParcelaCartao =
    modoEdicao && transacaoParaEditar.origem === 'cartao'
      ? {
          parcelaAtual: transacaoParaEditar.parcelaAtual,
          totalParcelas: transacaoParaEditar.totalParcelas,
          cartaoNome: cartoes?.find((c) => c.id === transacaoParaEditar.cartaoId)?.nome ?? 'cartão',
        }
      : null;

  const [estado, setEstado] = useState(() => ({
    ...estadoInicial(tipoInicial, transacaoParaEditar),
    valorCentavos: modoEdicao ? String(Math.round(transacaoParaEditar.valor * 100)) : '0',
    categoria: modoEdicao ? transacaoParaEditar.categoria : '',
    descricao: modoEdicao ? transacaoParaEditar.descricao : '',
    data: modoEdicao ? transacaoParaEditar.data.slice(0, 16) : obterDataHoraLocal(),
    // `cartaoForcado` (aberto a partir da aba "Compras" de um cartão específico): já
    // nasce com forma de pagamento e cartão resolvidos, sem opção de trocar — só
    // categoria/descrição/data/parcelas ficam por conta do usuário.
    formaPagamento: cartaoForcado ? 'cartao' : 'sem_cartao',
    cartaoId: cartaoForcado ? cartaoForcado.id : null,
    numeroParcelas: 1,
    salvando: false,
    excluindo: false,
  }));

  const atualizar = (patch) => setEstado((prev) => ({ ...prev, ...patch }));

  const escolherTipo = (tipo) => atualizar({ tipo, etapa: 'valor' });

  const voltar = () => {
    if (estado.etapa === 'detalhes') {
      if (estado.etapaInicial === 'detalhes') {
        onFechar();
      } else {
        atualizar({ etapa: 'valor' });
      }
      return;
    }
    if (estado.etapa === 'valor') {
      if (estado.etapaInicial === 'tipo') {
        atualizar({ etapa: 'tipo' });
      } else {
        onFechar();
      }
    }
  };

  const salvar = async () => {
    if (estado.salvando) return;
    atualizar({ salvando: true });

    const dados = {
      descricao: estado.descricao,
      valor: Number(estado.valorCentavos) / 100,
      tipo: estado.tipo,
      categoria: estado.categoria,
      data: estado.data,
    };

    const ehCompraNoCartao = !modoEdicao && estado.tipo === 'despesa' && estado.formaPagamento === 'cartao';

    try {
      if (ehCompraNoCartao) {
        const cartao = cartoes.find((c) => c.id === estado.cartaoId);
        const { compra, parcelas } = await criarCompraCartao({
          cartao,
          descricao: estado.descricao,
          categoria: estado.categoria,
          valorTotalCentavos: Number(estado.valorCentavos),
          numeroParcelas: estado.numeroParcelas,
          dataCompraISO: estado.data,
        });
        onCompraCartaoSalva(compra, parcelas);
        onFechar();
        toast.success(`Compra parcelada em ${estado.numeroParcelas === 1 ? 'à vista' : `${estado.numeroParcelas}x`}!`);
      } else {
        const salva = modoEdicao ? await atualizarTransacao(transacaoParaEditar.id, dados) : await criarTransacao(dados);
        onTransacaoSalva(salva);
        onFechar();
        toast.success(modoEdicao ? 'Transação atualizada!' : estado.tipo === 'receita' ? 'Receita adicionada!' : 'Despesa adicionada!');
      }
    } catch (erro) {
      console.error('Erro ao salvar transação:', erro);
      toast.error('Não foi possível salvar. Tente novamente.');
      atualizar({ salvando: false });
    }
  };

  const excluir = async () => {
    if (estado.excluindo) return;
    atualizar({ excluindo: true });
    try {
      const excluiu = await aoExcluir(transacaoParaEditar.id);
      if (excluiu) onFechar();
      else atualizar({ excluindo: false });
    } catch (erro) {
      console.error('Erro ao excluir transação:', erro);
      toast.error('Não foi possível excluir. Tente novamente.');
      atualizar({ excluindo: false });
    }
  };

  if (estado.etapa === 'tipo') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground text-center mb-1">O que você quer registrar?</p>
        <button
          type="button"
          onClick={() => escolherTipo('despesa')}
          className="focus-ring cursor-pointer w-full flex items-center gap-3 p-4 rounded-xl bg-surface hover:bg-surface-hover text-left"
        >
          <span className="h-10 w-10 rounded-full bg-negative/10 text-negative flex items-center justify-center shrink-0">
            <MinusIcon className="h-5 w-5" />
          </span>
          <span className="font-medium text-foreground">Despesa</span>
        </button>
        <button
          type="button"
          onClick={() => escolherTipo('receita')}
          className="focus-ring cursor-pointer w-full flex items-center gap-3 p-4 rounded-xl bg-surface hover:bg-surface-hover text-left"
        >
          <span className="h-10 w-10 rounded-full bg-positive/10 text-positive flex items-center justify-center shrink-0">
            <PlusIcon className="h-5 w-5" />
          </span>
          <span className="font-medium text-foreground">Receita</span>
        </button>
      </div>
    );
  }

  if (estado.etapa === 'valor') {
    return (
      <AmountKeypad
        valorCentavos={estado.valorCentavos}
        onChange={(v) => atualizar({ valorCentavos: v })}
        titulo={estado.tipo === 'receita' ? 'Receita' : 'Despesa'}
        onCancelar={voltar}
        onContinuar={() => atualizar({ etapa: 'detalhes' })}
      />
    );
  }

  // Sub-telas da forma de pagamento (cartão): sempre voltam pra 'detalhes', nunca
  // fecham o fluxo nem descartam o que já foi preenchido na despesa.
  if (estado.etapa === 'selecionar-cartao') {
    return (
      <PaymentCardPicker
        cartoes={cartoes}
        onSelecionar={(id) => atualizar({ cartaoId: id, etapa: 'detalhes' })}
        onNovoCartao={() => atualizar({ etapa: 'novo-cartao' })}
        onVoltar={() => atualizar({ etapa: 'detalhes' })}
      />
    );
  }

  if (estado.etapa === 'novo-cartao') {
    return (
      <PaymentCardForm
        onVoltar={() => atualizar({ etapa: 'selecionar-cartao' })}
        onCartaoSalvo={onCartaoSalvo}
        onCriado={(cartao) => atualizar({ cartaoId: cartao.id, etapa: 'detalhes' })}
      />
    );
  }

  if (estado.etapa === 'selecionar-parcelas') {
    return (
      <InstallmentsPicker
        numeroParcelas={estado.numeroParcelas}
        onSelecionar={(n) => atualizar({ numeroParcelas: n, etapa: 'detalhes' })}
        onVoltar={() => atualizar({ etapa: 'detalhes' })}
      />
    );
  }

  return (
    <TransactionDetails
      categoria={estado.categoria}
      setCategoria={(v) => atualizar({ categoria: v })}
      descricao={estado.descricao}
      setDescricao={(v) => atualizar({ descricao: v })}
      data={estado.data}
      setData={(v) => atualizar({ data: v })}
      tipo={estado.tipo}
      setTipo={(v) => atualizar({ tipo: v })}
      valorCentavos={estado.valorCentavos}
      setValorCentavos={(v) => atualizar({ valorCentavos: v })}
      salvando={estado.salvando}
      onVoltar={voltar}
      onSalvar={salvar}
      modoEdicao={modoEdicao}
      excluindo={estado.excluindo}
      onExcluir={aoExcluir ? excluir : undefined}
      infoParcelaCartao={infoParcelaCartao}
      cartoes={cartoes}
      formaPagamento={estado.formaPagamento}
      setFormaPagamento={(v) => atualizar({ formaPagamento: v })}
      cartaoId={estado.cartaoId}
      numeroParcelas={estado.numeroParcelas}
      onAbrirCartao={() => atualizar({ etapa: 'selecionar-cartao' })}
      onAbrirParcelas={() => atualizar({ etapa: 'selecionar-parcelas' })}
      cartaoForcado={!!cartaoForcado}
    />
  );
};

export default TransactionFlow;
