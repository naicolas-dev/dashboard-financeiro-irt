import React, { useState } from 'react';
import { toast } from 'sonner';
import Input from './ui/Input';
import Button from './ui/Button';
import DateTimeField from './ui/DateTimeField';
import { obterDataHoraLocal } from '../utils/datas.js';
import { criarPagamentoFatura, atualizarPagamentoFatura, nomeFatura } from '../servicos/cartoes.js';
import { validarPagamento, paraCentavos } from '../dominio/cartoes.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = (centavos) => formatadorMoeda.format(centavos / 100);

// Registrar ou editar um pagamento de fatura — a única saída de caixa do cartão.
// Bloqueia só o que o modelo não representa (valor ≤ 0 ou acima da dívida restante
// a partir desta fatura). Saldo insuficiente NÃO bloqueia: mostra aviso forte e
// deixa "Registrar mesmo assim" (o app registra a realidade — cheque especial,
// outra conta, dinheiro ainda não lançado).
const InvoicePaymentDialog = ({
  cartao,
  competencia,
  restanteFaturaCentavos,
  maximoCentavos,
  saldoFinanceiro,
  saldoDisponivel,
  pagamentoParaEditar,
  onSalvo,
  onExcluir,
  onFechar,
}) => {
  const modoEdicao = !!pagamentoParaEditar;
  const [valorCentavos, setValorCentavos] = useState(() =>
    String(modoEdicao ? paraCentavos(pagamentoParaEditar.valor) : Math.min(restanteFaturaCentavos, maximoCentavos))
  );
  const [data, setData] = useState(() => (modoEdicao ? pagamentoParaEditar.data.slice(0, 16) : obterDataHoraLocal()));
  const [confirmandoAviso, setConfirmandoAviso] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const valor = Number(valorCentavos || '0');
  // Na edição, o valor antigo deste pagamento já está descontado do saldo atual.
  const devolvido = modoEdicao ? paraCentavos(pagamentoParaEditar.valor) : 0;
  const validacao = validarPagamento({
    valorCentavos: valor,
    maximoCentavos,
    saldoFinanceiroCentavos: paraCentavos(saldoFinanceiro) + devolvido,
    saldoDisponivelCentavos: paraCentavos(saldoDisponivel) + devolvido,
  });

  const handleValorChange = (e) => {
    setValorCentavos(e.target.value.replace(/\D/g, '') || '0');
    setConfirmandoAviso(false);
  };

  const salvar = async (ignorarAviso = false) => {
    if (salvando || !validacao.ok) return;
    if (validacao.aviso && !ignorarAviso) {
      setConfirmandoAviso(true);
      return;
    }
    setSalvando(true);
    try {
      const salvo = modoEdicao
        ? await atualizarPagamentoFatura(pagamentoParaEditar, { valorCentavos: valor, data })
        : await criarPagamentoFatura({ cartao, competencia, valorCentavos: valor, data });
      onSalvo(salvo);
      toast.success(modoEdicao ? 'Pagamento atualizado' : 'Pagamento registrado');
      onFechar();
    } catch (erro) {
      console.error('Erro ao salvar pagamento de fatura:', erro);
      toast.error('Não foi possível salvar o pagamento. Tente novamente.');
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (excluindo) return;
    setExcluindo(true);
    const excluiu = await onExcluir(pagamentoParaEditar.id);
    if (excluiu) onFechar();
    else setExcluindo(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={onFechar} className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg">
          Cancelar
        </button>
        <p className="text-sm font-semibold text-foreground">{modoEdicao ? 'Editar pagamento' : 'Pagar fatura'}</p>
        <div className="w-16" aria-hidden="true" />
      </div>

      <div className="rounded-xl bg-surface p-3 text-sm space-y-1">
        <p className="font-medium text-foreground">
          {cartao.nome} · Fatura de {nomeFatura(competencia, cartao)}
        </p>
        <p className="text-foreground-secondary tabular-nums">Restante desta fatura: {brl(restanteFaturaCentavos)}</p>
        <p className="text-foreground-muted text-xs tabular-nums">Máximo (esta fatura e as seguintes): {brl(maximoCentavos)}</p>
      </div>

      <Input id="valor-pagamento" label="Valor do pagamento" inputMode="numeric" value={formatadorMoeda.format(valor / 100)} onChange={handleValorChange} />

      <DateTimeField id="data-pagamento" label="Data do pagamento" value={data} onChange={setData} />

      {!validacao.ok && valor > 0 && <p className="text-sm text-negative">{validacao.erro}</p>}

      {validacao.ok && valor > restanteFaturaCentavos && (
        <p className="text-xs text-foreground-muted">
          {brl(valor - restanteFaturaCentavos)} acima do restante desta fatura serão usados para adiantar as próximas.
        </p>
      )}

      {confirmandoAviso && validacao.aviso ? (
        <div className="rounded-xl bg-warning/10 p-3 text-sm space-y-3">
          <p className="font-semibold text-warning">
            {validacao.aviso === 'saldo_negativo' ? 'Saldo insuficiente para este pagamento' : 'Este pagamento usa dinheiro reservado em metas'}
          </p>
          <p className="text-foreground-secondary">
            {validacao.aviso === 'saldo_negativo'
              ? 'Seu saldo vai ficar negativo. Registre mesmo assim se a fatura foi paga de verdade (cheque especial, outra conta etc.).'
              : 'O valor cabe no saldo, mas passa do que está livre fora das metas.'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmandoAviso(false)}>
              Cancelar
            </Button>
            <Button carregando={salvando} onClick={() => salvar(true)}>
              Registrar mesmo assim
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" className="w-full" disabled={!validacao.ok || salvando} carregando={salvando} onClick={() => salvar(false)}>
          {modoEdicao ? 'Salvar alterações' : 'Registrar pagamento'}
        </Button>
      )}

      {modoEdicao && onExcluir && (
        <Button variant="destructive" size="lg" className="w-full" carregando={excluindo} onClick={excluir}>
          Excluir pagamento
        </Button>
      )}
    </div>
  );
};

export default InvoicePaymentDialog;
