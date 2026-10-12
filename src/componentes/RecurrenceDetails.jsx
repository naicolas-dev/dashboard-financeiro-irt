import React from 'react';
import Input from './ui/Input';
import Button from './ui/Button';
import SelectField from './ui/SelectField';
import ComboboxField from './ui/ComboboxField';
import { CATEGORIAS_TRANSACAO } from '../constantes/categorias.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const OPCOES_TIPO = [
  { valor: 'despesa', texto: 'Despesa' },
  { valor: 'receita', texto: 'Receita' },
];

const OPCOES_CATEGORIA = CATEGORIAS_TRANSACAO.map((c) => ({ valor: c, texto: c }));

// Mesmo padrão do TransactionDetails: campos de tipo/valor só aparecem em edição
// (na criação já vieram resolvidos pelo teclado/botão que abriu o fluxo).
const RecurrenceDetails = ({
  categoria,
  setCategoria,
  descricao,
  setDescricao,
  diaDoMes,
  setDiaDoMes,
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
}) => {
  const valorNumerico = Number(valorCentavos || '0') / 100;
  const diaValido = Number(diaDoMes) >= 1 && Number(diaDoMes) <= 31;
  const podeSalvar = categoria !== '' && descricao.trim() !== '' && diaValido && (!modoEdicao || valorNumerico > 0) && !salvando;

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
          <SelectField id="tipo-recorrencia" label="Tipo" value={tipo} onChange={setTipo} opcoes={OPCOES_TIPO} />
          <Input
            label="Valor"
            inputMode="numeric"
            value={formatadorMoeda.format(valorNumerico)}
            onChange={handleValorChange}
          />
        </div>
      )}

      <ComboboxField
        id="categoria-recorrencia"
        label="Categoria"
        value={categoria}
        onChange={setCategoria}
        opcoes={OPCOES_CATEGORIA}
        placeholder="Selecione uma categoria"
      />

      <Input label="Descrição" placeholder="Ex: Aluguel" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

      <Input
        label="Dia do mês"
        type="number"
        min="1"
        max="31"
        value={diaDoMes}
        onChange={(e) => setDiaDoMes(e.target.value)}
      />

      <Button size="lg" className="w-full" disabled={!podeSalvar} carregando={salvando} onClick={onSalvar}>
        {modoEdicao ? 'Salvar alterações' : 'Salvar'}
      </Button>

      {modoEdicao && onExcluir && (
        <Button variant="destructive" size="lg" className="w-full" carregando={excluindo} onClick={onExcluir}>
          Excluir recorrência
        </Button>
      )}
    </div>
  );
};

export default RecurrenceDetails;
