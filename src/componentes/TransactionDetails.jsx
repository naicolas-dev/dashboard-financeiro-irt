import React from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { SegmentGroup } from '@chakra-ui/react';
import Input from './ui/Input';
import Button from './ui/Button';
import SelectField from './ui/SelectField';
import ComboboxField from './ui/ComboboxField';
import DateTimeField from './ui/DateTimeField';
import { CATEGORIAS_TRANSACAO } from '../constantes/categorias.js';
import { gerarValoresParcelas, calcularPrimeiraCompetencia, nomeFatura, rotuloParcelas } from '../servicos/cartoes.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const OPCOES_TIPO = [
  { valor: 'despesa', texto: 'Despesa' },
  { valor: 'receita', texto: 'Receita' },
];

const OPCOES_CATEGORIA = CATEGORIAS_TRANSACAO.map((c) => ({ valor: c, texto: c }));

// Começa com categoria vazia de propósito (não a primeira da lista) — escolha
// automática poderia virar classificação errada por pressa. Só vale pro fluxo
// novo; o FormularioTransacao legado continua com o default antigo.
const TransactionDetails = ({
  categoria,
  setCategoria,
  descricao,
  setDescricao,
  data,
  setData,
  tipo,
  setTipo,
  valorCentavos,
  setValorCentavos,
  salvando,
  onVoltar,
  onSalvar,
  modoEdicao = false,
  excluindo = false,
  onExcluir,
  cartoes,
  formaPagamento,
  setFormaPagamento,
  cartaoId,
  numeroParcelas,
  onAbrirCartao,
  onAbrirParcelas,
  cartaoForcado = false,
}) => {
  const valorNumerico = Number(valorCentavos || '0') / 100;

  const cartaoSelecionado = cartoes?.find((c) => c.id === cartaoId);
  const limiteInsuficiente =
    formaPagamento === 'cartao' && cartaoSelecionado && valorNumerico > cartaoSelecionado.limiteDisponivel;
  const pagamentoValido =
    tipo !== 'despesa' || modoEdicao || formaPagamento !== 'cartao' || (cartaoId && numeroParcelas && !limiteInsuficiente);

  const podeSalvar =
    categoria !== '' && descricao.trim() !== '' && (!modoEdicao || valorNumerico > 0) && pagamentoValido && !salvando;

  const handleValorChange = (e) => {
    const digitos = e.target.value.replace(/\D/g, '');
    setValorCentavos(digitos || '0');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={onVoltar}
          className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg"
        >
          Voltar
        </button>
        <p className="text-sm font-semibold text-foreground">Detalhes</p>
        <div className="w-12" aria-hidden="true" />
      </div>

      {modoEdicao && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField id="tipo-transacao" label="Tipo" value={tipo} onChange={setTipo} opcoes={OPCOES_TIPO} />
          <Input
            label="Valor"
            inputMode="numeric"
            value={formatadorMoeda.format(valorNumerico)}
            onChange={handleValorChange}
          />
        </div>
      )}

      <ComboboxField
        id="categoria-transacao"
        label="Categoria"
        value={categoria}
        onChange={setCategoria}
        opcoes={OPCOES_CATEGORIA}
        placeholder="Selecione uma categoria"
      />

      <Input label="Descrição" placeholder="Ex: Mercado" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

<DateTimeField id="data-transacao" label="Data e hora" value={data} onChange={setData} />

      {tipo === 'despesa' && !modoEdicao && (
        <div className="space-y-3">
          {!cartaoForcado && (
            <div>
              <p className="text-sm font-medium text-foreground-secondary mb-1.5">Forma de pagamento</p>
              <SegmentGroup.Root
                value={formaPagamento}
                onValueChange={(details) => setFormaPagamento(details.value)}
                className="w-full p-1 rounded-xl bg-surface-hover"
              >
                <SegmentGroup.Indicator className="rounded-lg bg-surface-raised dark:bg-surface-active shadow-sm" />
                {[
                  { valor: 'sem_cartao', texto: 'Sem cartão' },
                  { valor: 'cartao', texto: 'Cartão de crédito' },
                ].map((opcao) => (
                  <SegmentGroup.Item key={opcao.valor} value={opcao.valor} className="flex-1">
                    <SegmentGroup.ItemText
                      className={`focus-ring cursor-pointer flex items-center justify-center h-9 rounded-lg text-sm font-medium transition-colors ${
                        formaPagamento === opcao.valor ? 'text-foreground' : 'text-foreground-secondary'
                      }`}
                    >
                      {opcao.texto}
                    </SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                ))}
              </SegmentGroup.Root>
            </div>
          )}

          {formaPagamento === 'cartao' && (
            <div className="space-y-3">
              {cartaoForcado ? (
                <div className="w-full flex items-center justify-between h-11 px-3.5 rounded-xl bg-surface text-sm">
                  <span className="text-foreground-secondary">Cartão</span>
                  <span className="text-foreground font-medium">{cartaoSelecionado?.nome}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onAbrirCartao}
                  className="focus-ring cursor-pointer w-full flex items-center justify-between h-11 px-3.5 rounded-xl bg-surface-raised border border-border text-sm"
                >
                  <span className="text-foreground-secondary">Cartão</span>
                  <span className="flex items-center gap-1 text-foreground font-medium">
                    {cartaoSelecionado ? cartaoSelecionado.nome : 'Selecionar'}
                    <ChevronRightIcon className="h-4 w-4 text-foreground-muted" />
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={onAbrirParcelas}
                className="focus-ring cursor-pointer w-full flex items-center justify-between h-11 px-3.5 rounded-xl bg-surface-raised border border-border text-sm"
              >
                <span className="text-foreground-secondary">Parcelas</span>
                <span className="flex items-center gap-1 text-foreground font-medium">
                  {rotuloParcelas(numeroParcelas)}
                  <ChevronRightIcon className="h-4 w-4 text-foreground-muted" />
                </span>
              </button>

              {cartaoSelecionado &&
                numeroParcelas &&
                (limiteInsuficiente ? (
                  <div className="rounded-xl bg-negative/10 text-negative text-sm p-3 space-y-1">
                    <p className="font-semibold">Limite disponível insuficiente</p>
                    <div className="flex justify-between tabular-nums">
                      <span>Compra</span>
                      <span>{formatadorMoeda.format(valorNumerico)}</span>
                    </div>
                    <div className="flex justify-between tabular-nums">
                      <span>Disponível</span>
                      <span>{formatadorMoeda.format(cartaoSelecionado.limiteDisponivel)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-surface p-3 text-sm space-y-1">
                    <p className="font-medium text-foreground">{cartaoSelecionado.nome}</p>
                    <p className="text-foreground-secondary">
                      {numeroParcelas === 1
                        ? 'À vista'
                        : `${numeroParcelas}x de aproximadamente ${formatadorMoeda.format(
                            gerarValoresParcelas(Number(valorCentavos || '0'), numeroParcelas)[0] / 100
                          )}`}
                    </p>
                    <p className="text-foreground-secondary">Total {formatadorMoeda.format(valorNumerico)}</p>
                    <p className="text-foreground-muted text-xs">
                      Primeira fatura: {nomeFatura(calcularPrimeiraCompetencia(new Date(data), cartaoSelecionado.diaFechamento), cartaoSelecionado)}
                    </p>
                    <p className="text-foreground-muted text-xs">
                      Vira dívida no cartão — o saldo só muda quando você pagar a fatura.
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <Button size="lg" className="w-full" disabled={!podeSalvar} carregando={salvando} onClick={onSalvar}>
        {modoEdicao ? 'Salvar alterações' : 'Salvar'}
      </Button>

      {modoEdicao && onExcluir && (
        <Button variant="destructive" size="lg" className="w-full" carregando={excluindo} onClick={onExcluir}>
          Excluir transação
        </Button>
      )}
    </div>
  );
};

export default TransactionDetails;
