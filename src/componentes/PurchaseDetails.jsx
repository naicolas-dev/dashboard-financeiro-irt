import React, { useState } from 'react';
import { toast } from 'sonner';
import Input from './ui/Input';
import Button from './ui/Button';
import SelectField from './ui/SelectField';
import ComboboxField from './ui/ComboboxField';
import { CATEGORIAS_TRANSACAO } from '../constantes/categorias.js';
import { OPCOES_PARCELAS, rotuloParcelas, atualizarCompraCartao } from '../servicos/cartoes.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const OPCOES_CATEGORIA = CATEGORIAS_TRANSACAO.map((c) => ({ valor: c, texto: c }));
const OPCOES_NUMERO_PARCELAS = OPCOES_PARCELAS.map((n) => ({ valor: String(n), texto: rotuloParcelas(n) }));

// Edição da compra (as parcelas são derivadas dela). `regras` vem do domínio: com
// parcela em fatura fechada ou paga tudo continua editável, mas com `regras.aviso`
// visível (muda o total dessas faturas; pagamentos não mudam).
// `primeiraCompetencia` nunca é tocada aqui.
const PurchaseDetails = ({ compra, cartao, regras, onVoltar, onCompraAtualizada, onExcluido, excluirCompra }) => {
  const [descricao, setDescricao] = useState(compra.descricao);
  const [categoria, setCategoria] = useState(compra.categoria);
  const [valorCentavos, setValorCentavos] = useState(String(Math.round(compra.valorTotal * 100)));
  const [numeroParcelas, setNumeroParcelas] = useState(compra.numeroParcelas);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const valorNumerico = Number(valorCentavos || '0') / 100;
  const podeSalvar = descricao.trim() !== '' && categoria !== '' && valorNumerico > 0 && !salvando;

  const valorOriginalCentavos = String(Math.round(compra.valorTotal * 100));
  const alterarValor = valorCentavos !== valorOriginalCentavos || numeroParcelas !== compra.numeroParcelas;

  const handleValorChange = (e) => {
    const digitos = e.target.value.replace(/\D/g, '');
    setValorCentavos(digitos || '0');
  };

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      const compraAtualizada = await atualizarCompraCartao({
        compra,
        descricao,
        categoria,
        valorTotalCentavos: Number(valorCentavos),
        numeroParcelas,
        alterarValor,
      });
      onCompraAtualizada(compraAtualizada);
      toast.success('Compra atualizada!');
      onVoltar();
    } catch (erro) {
      console.error('Erro ao atualizar compra:', erro);
      toast.error('Não foi possível salvar. Tente novamente.');
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (excluindo) return;
    setExcluindo(true);
    const sucesso = await excluirCompra(compra);
    if (sucesso) onExcluido();
    else setExcluindo(false);
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
        <p className="text-sm font-semibold text-foreground">Editar compra</p>
        <div className="w-12" aria-hidden="true" />
      </div>

      <div>
        <p className="text-sm font-medium text-foreground-secondary mb-1.5">Cartão</p>
        <p className="h-11 px-3.5 rounded-xl bg-surface flex items-center text-sm text-foreground-muted">{cartao.nome}</p>
      </div>

      <ComboboxField id="categoria-compra" label="Categoria" value={categoria} onChange={setCategoria} opcoes={OPCOES_CATEGORIA} />

      <Input label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="valor-compra"
          label="Valor total"
          inputMode="numeric"
          value={formatadorMoeda.format(valorNumerico)}
          onChange={handleValorChange}
        />
        <SelectField
          id="parcelas-compra"
          label="Parcelas"
          value={String(numeroParcelas)}
          onChange={(v) => setNumeroParcelas(Number(v))}
          opcoes={OPCOES_NUMERO_PARCELAS}
        />
      </div>

      {regras.aviso && (
        <p className="rounded-xl bg-warning/10 text-warning text-xs p-3">
          {regras.aviso} Hoje: {formatadorMoeda.format(compra.valorTotal)} · {rotuloParcelas(compra.numeroParcelas)}.
        </p>
      )}

      <Button size="lg" className="w-full" disabled={!podeSalvar} carregando={salvando} onClick={salvar}>
        Salvar alterações
      </Button>

      <Button variant="destructive" size="lg" className="w-full" carregando={excluindo} onClick={excluir}>
        Excluir compra
      </Button>
    </div>
  );
};

export default PurchaseDetails;
