import React, { useMemo, useState } from 'react';
import Input from './ui/Input';
import Button from './ui/Button';
import SelectField from './ui/SelectField';
import ComboboxField from './ui/ComboboxField';
import { CATEGORIAS_TRANSACAO } from '../constantes/categorias.js';
import { primeiraCompetenciaPadrao } from '../dominio/recorrencias.js';
import { dataNoMes, mesLocal, somarMesesCompetencia, paraTimestamp } from '../dominio/tempo.js';
import { formatarDataNumerica } from '../utils/datas.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const OPCOES_CATEGORIA = CATEGORIAS_TRANSACAO.map((c) => ({ valor: c, texto: c }));

function nomeDoMes(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

// Criar/editar uma assinatura do cartão (cobrança mensal, à vista). O cartão já é conhecido (o fluxo parte do
// detalhe do cartão). Na edição só mudam descrição, valor, categoria e dia — e só para cobranças FUTURAS.
const SubscriptionForm = ({ cartao, assinaturaParaEditar, onSalvar, onVoltar }) => {
  const modoEdicao = !!assinaturaParaEditar;
  const [descricao, setDescricao] = useState(modoEdicao ? assinaturaParaEditar.descricao : '');
  const [valorCentavos, setValorCentavos] = useState(modoEdicao ? String(Math.round(assinaturaParaEditar.valor * 100)) : '0');
  const [categoria, setCategoria] = useState(modoEdicao ? assinaturaParaEditar.categoria : '');
  const [dia, setDia] = useState(modoEdicao ? String(assinaturaParaEditar.diaDoMes) : '');
  const [primeiraEscolhida, setPrimeiraEscolhida] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const diaValido = Number.isInteger(Number(dia)) && Number(dia) >= 1 && Number(dia) <= 31;
  const valorReais = Number(valorCentavos || '0') / 100;

  // Primeira cobrança: por padrão o primeiro dia de cobrança a partir de hoje (nada retroativo); as outras
  // opções são escolhas explícitas do usuário.
  const opcoesPrimeira = useMemo(() => {
    if (!diaValido) return [];
    const mesAtual = mesLocal(new Date());
    return [0, 1, 2].map((n) => {
      const competencia = somarMesesCompetencia(mesAtual, n);
      return { valor: competencia, texto: `${nomeDoMes(competencia)} · ${formatarDataNumerica(dataNoMes(competencia, dia))}` };
    });
  }, [dia, diaValido]);
  const primeira = primeiraEscolhida ?? (diaValido ? primeiraCompetenciaPadrao(Number(dia), new Date()) : '');
  const primeiraNoPassado = diaValido && primeira && paraTimestamp(dataNoMes(primeira, dia)) <= Date.now();

  const podeSalvar = descricao.trim() !== '' && valorReais > 0 && categoria !== '' && diaValido && (modoEdicao || primeira !== '') && !salvando;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    const dados = { descricao: descricao.trim(), valor: valorReais, categoria, diaDoMes: Number(dia) };
    const ok = await onSalvar(modoEdicao ? dados : { ...dados, primeiraCompetencia: primeira });
    if (!ok) setSalvando(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={onVoltar} className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg">
          Cancelar
        </button>
        <p className="text-sm font-semibold text-foreground">{modoEdicao ? 'Editar assinatura' : 'Nova assinatura'}</p>
        <div className="w-16" aria-hidden="true" />
      </div>

      <p className="text-xs text-foreground-muted">Cobrança mensal no {cartao.nome}, à vista. Entra na fatura como uma compra; o caixa só muda quando você paga a fatura.</p>

      <Input id="descricao-assinatura" label="Descrição" placeholder="Ex: Netflix" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <Input
        id="valor-assinatura"
        label="Valor mensal"
        inputMode="numeric"
        value={formatadorMoeda.format(valorReais)}
        onChange={(e) => setValorCentavos(e.target.value.replace(/\D/g, '') || '0')}
      />
      <ComboboxField id="categoria-assinatura" label="Categoria" value={categoria} onChange={setCategoria} opcoes={OPCOES_CATEGORIA} placeholder="Selecione uma categoria" />
      <Input id="dia-assinatura" label="Dia da cobrança" type="number" min="1" max="31" value={dia} onChange={(e) => setDia(e.target.value)} />

      {!modoEdicao && diaValido && (
        <>
          <SelectField id="primeira-assinatura" label="Primeira cobrança" value={primeira} onChange={setPrimeiraEscolhida} opcoes={opcoesPrimeira} />
          <p className="text-xs text-foreground-muted">
            {primeiraNoPassado
              ? 'Essa data já passou: a cobrança deste mês será gerada agora.'
              : `A primeira cobrança acontece em ${formatarDataNumerica(dataNoMes(primeira, dia))}. Dia 29, 30 ou 31 vale o último dia dos meses mais curtos.`}
          </p>
        </>
      )}
      {modoEdicao && <p className="text-xs text-foreground-muted">A mudança vale só para as próximas cobranças. As já geradas não mudam; para corrigir uma delas, edite a compra.</p>}

      <Button size="lg" className="w-full" disabled={!podeSalvar} carregando={salvando} onClick={salvar}>
        {modoEdicao ? 'Salvar alterações' : 'Criar assinatura'}
      </Button>
    </div>
  );
};

export default SubscriptionForm;
