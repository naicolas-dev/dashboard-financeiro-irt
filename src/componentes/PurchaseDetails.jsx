import React, { useState } from 'react';
import { toast } from 'sonner';
import Input from './ui/Input';
import Button from './ui/Button';
import SelectField from './ui/SelectField';
import ComboboxField from './ui/ComboboxField';
import { CATEGORIAS_TRANSACAO } from '../constantes/categorias.js';
import { OPCOES_PARCELAS, rotuloParcelas, competenciaAtual, atualizarCompraCartao } from '../servicos/cartoes.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const OPCOES_CATEGORIA = CATEGORIAS_TRANSACAO.map((c) => ({ valor: c, texto: c }));
const OPCOES_NUMERO_PARCELAS = OPCOES_PARCELAS.map((n) => ({ valor: String(n), texto: rotuloParcelas(n) }));

// Edição da compra-pai (não de uma parcela isolada). Valor/parcelamento só são
// editáveis se nenhuma parcela já estiver numa competência passada — compra com
// histórico fica restrita a descrição/categoria, pra não reescrever uma fatura já
// fechada. `primeiraCompetencia` nunca é tocada aqui (fica protegida mesmo quando
// reestrutura o valor/número de parcelas).
const PurchaseDetails = ({ compra, cartao, parcelasExistentes, onVoltar, onCompraAtualizada, onExcluido, excluirCompra }) => {
  const [descricao, setDescricao] = useState(compra.descricao);
  const [categoria, setCategoria] = useState(compra.categoria);
  const [valorCentavos, setValorCentavos] = useState(String(Math.round(compra.valorTotal * 100)));
  const [numeroParcelas, setNumeroParcelas] = useState(compra.numeroParcelas);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const temHistorico = parcelasExistentes.some((p) => p.competencia < competenciaAtual());

  const valorNumerico = Number(valorCentavos || '0') / 100;
  const podeSalvar = descricao.trim() !== '' && categoria !== '' && valorNumerico > 0 && !salvando;

  const valorOriginalCentavos = String(Math.round(compra.valorTotal * 100));
  const reestruturar = !temHistorico && (valorCentavos !== valorOriginalCentavos || numeroParcelas !== compra.numeroParcelas);

  const handleValorChange = (e) => {
    const digitos = e.target.value.replace(/\D/g, '');
    setValorCentavos(digitos || '0');
  };

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      const resultado = await atualizarCompraCartao({
        compra,
        cartao,
        descricao,
        categoria,
        valorTotalCentavos: Number(valorCentavos),
        numeroParcelas,
        parcelasExistentes,
        reestruturar,
      });
      onCompraAtualizada(resultado);
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

      {temHistorico ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground-secondary">Valor e parcelamento</p>
          <p className="h-11 px-3.5 rounded-xl bg-surface flex items-center text-sm text-foreground-muted">
            {formatadorMoeda.format(compra.valorTotal)} · {rotuloParcelas(compra.numeroParcelas)}
          </p>
          <p className="text-xs text-foreground-muted">
            Esta compra já tem parcela em fatura fechada — valor e parcelamento não podem mudar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor total" inputMode="numeric" value={formatadorMoeda.format(valorNumerico)} onChange={handleValorChange} />
          <SelectField
            id="parcelas-compra"
            label="Parcelas"
            value={String(numeroParcelas)}
            onChange={(v) => setNumeroParcelas(Number(v))}
            opcoes={OPCOES_NUMERO_PARCELAS}
          />
        </div>
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
