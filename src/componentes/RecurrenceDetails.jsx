import React from 'react';
import Input from './ui/Input';
import Button from './ui/Button';
import SelectField from './ui/SelectField';
import ComboboxField from './ui/ComboboxField';
import { CATEGORIAS_TRANSACAO } from '../constantes/categorias.js';
import { primeiraCompetenciaPadrao } from '../dominio/recorrencias.js';
import { dataNoMes } from '../dominio/tempo.js';
import { formatarDataNumerica } from '../utils/datas.js';

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
  encerrada = false,
  encerrando = false,
  onEncerrar,
}) => {
  const valorNumerico = Number(valorCentavos || '0') / 100;
  const diaValido = Number(diaDoMes) >= 1 && Number(diaDoMes) <= 31;
  const podeSalvar = categoria !== '' && descricao.trim() !== '' && diaValido && (!modoEdicao || valorNumerico > 0) && !salvando;

  // Na criação: quando vence a primeira conta (primeiro vencimento a partir de hoje).
  const primeiroVencimento = diaValido && !modoEdicao ? dataNoMes(primeiraCompetenciaPadrao(Number(diaDoMes), new Date()), diaDoMes) : null;

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

      {primeiroVencimento && (
        <p className="text-xs text-foreground-muted">
          A primeira conta vence em {formatarDataNumerica(primeiroVencimento)}. Dia 29, 30 ou 31 vale o último dia dos meses mais curtos.
        </p>
      )}

      <p className="text-xs text-foreground-muted">
        {tipo === 'receita'
          ? 'Não recebe sozinha: cada mês vira uma conta em Programadas e só entra no saldo quando você marcar como recebida.'
          : 'Não debita sozinha: cada mês vira uma conta em Programadas e só sai do saldo quando você marcar como paga.'}
      </p>

      <Button size="lg" className="w-full" disabled={!podeSalvar} carregando={salvando} onClick={onSalvar}>
        {modoEdicao ? 'Salvar alterações' : 'Salvar'}
      </Button>

      {modoEdicao && onEncerrar && !encerrada && (
        <Button variant="secondary" size="lg" className="w-full" carregando={encerrando} onClick={onEncerrar}>
          Encerrar recorrência
        </Button>
      )}

      {modoEdicao && onExcluir && (
        <Button variant="destructive" size="lg" className="w-full" carregando={excluindo} onClick={onExcluir}>
          Excluir recorrência
        </Button>
      )}
    </div>
  );
};

export default RecurrenceDetails;
