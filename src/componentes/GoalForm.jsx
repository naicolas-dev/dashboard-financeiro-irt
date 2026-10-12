import React, { useState } from 'react';
import { toast } from 'sonner';
import Input from './ui/Input';
import Button from './ui/Button';
import { criarMeta, atualizarMeta } from '../servicos/metas.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Criação/edição de meta — mesmo padrão do PaymentCardForm.jsx (cartões): um só
// componente faz os dois, com botão destrutivo "Excluir" só em modo edição. Não
// pergunta depósito inicial na criação de propósito — isso só acontece depois, via
// "Guardar" no card (GoalAmountDialog).
const GoalForm = ({ metaParaEditar, onVoltar, onMetaSalva, onCriado, onEditado, excluirMeta, onExcluido }) => {
  const modoEdicao = !!metaParaEditar;

  const [nome, setNome] = useState(modoEdicao ? metaParaEditar.nome : '');
  const [valorAlvoCentavos, setValorAlvoCentavos] = useState(
    modoEdicao ? String(Math.round(metaParaEditar.valorAlvo * 100)) : '0'
  );
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleValorChange = (e) => {
    const digitos = e.target.value.replace(/\D/g, '');
    setValorAlvoCentavos(digitos || '0');
  };

  const valorAlvoNumerico = Number(valorAlvoCentavos) / 100;
  const valorAbaixoDoReservado = modoEdicao && valorAlvoNumerico < metaParaEditar.valorReservado;

  const podeSalvar = nome.trim() !== '' && valorAlvoNumerico > 0 && !valorAbaixoDoReservado && !salvando;

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);

    const dados = { nome: nome.trim(), valorAlvo: valorAlvoNumerico };

    try {
      if (modoEdicao) {
        await atualizarMeta(metaParaEditar.id, dados);
        onMetaSalva({ ...metaParaEditar, ...dados });
        toast.success('Meta atualizada!');
        onEditado();
      } else {
        const metaCriada = await criarMeta(dados);
        onMetaSalva(metaCriada);
        toast.success('Meta criada!');
        onCriado(metaCriada);
      }
    } catch (erro) {
      console.error('Erro ao salvar meta:', erro);
      toast.error('Não foi possível salvar a meta. Tente novamente.');
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (excluindo) return;
    setExcluindo(true);
    const sucesso = await excluirMeta(metaParaEditar);
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
        <p className="text-sm font-semibold text-foreground">{modoEdicao ? 'Editar meta' : 'Nova meta'}</p>
        <div className="w-12" aria-hidden="true" />
      </div>

      <Input label="Nome" placeholder="Ex: Viagem" value={nome} onChange={(e) => setNome(e.target.value)} />

      <Input label="Objetivo" inputMode="numeric" value={formatadorMoeda.format(valorAlvoNumerico)} onChange={handleValorChange} />

      {valorAbaixoDoReservado && (
        <p className="text-sm text-negative">
          O objetivo não pode ser menor que o valor já reservado ({formatadorMoeda.format(metaParaEditar.valorReservado)}).
        </p>
      )}

      <Button size="lg" className="w-full" disabled={!podeSalvar} carregando={salvando} onClick={salvar}>
        {modoEdicao ? 'Salvar alterações' : 'Criar meta'}
      </Button>

      {modoEdicao && (
        <Button variant="destructive" size="lg" className="w-full" carregando={excluindo} onClick={excluir}>
          Excluir meta
        </Button>
      )}
    </div>
  );
};

export default GoalForm;
