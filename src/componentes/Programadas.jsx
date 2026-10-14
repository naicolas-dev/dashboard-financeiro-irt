import React, { useState, useCallback } from 'react';
import { CalendarDaysIcon, ExclamationTriangleIcon, SignalSlashIcon } from '@heroicons/react/24/outline';
import ObligationRow from './ObligationRow.jsx';
import ObligationActions from './ObligationActions.jsx';
import RecurrenceRow from './RecurrenceRow.jsx';
import RecurrenceActions from './RecurrenceActions.jsx';
import ResponsiveDialog from './ui/ResponsiveDialog.jsx';
import EmptyState from './ui/EmptyState.jsx';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = (centavos) => formatadorMoeda.format(centavos / 100);
const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;

// Resumo compacto: o ponto colorido é o único toque de cor (semântico: sai = vermelho, entra = verde);
// o valor fica neutro. Informativo — não é botão.
function ResumoCard({ rotulo, tom, centavos, pendentes, atrasadas }) {
  return (
    <div className="rounded-xl bg-surface-raised border border-border px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-foreground-secondary">
        <span className={`h-1.5 w-1.5 rounded-full ${tom}`} aria-hidden="true" />
        {rotulo}
      </p>
      <p className="text-lg font-semibold tabular-nums text-foreground leading-snug">{brl(centavos)}</p>
      <p className="text-xs text-foreground-muted truncate">
        {pendentes === 0 ? 'Nenhuma pendente' : plural(pendentes, 'pendente', 'pendentes')}
        {atrasadas > 0 && <span className="text-warning"> · {plural(atrasadas, 'atrasada', 'atrasadas')}</span>}
      </p>
    </div>
  );
}

// Grupo da agenda: título temporal + linhas leves com divisor discreto (sem caixa por grupo).
function Grupo({ titulo, destaque = false, itens, agora, liquidacoesPorId, onAbrir }) {
  if (itens.length === 0) return null;
  return (
    <section className="space-y-1">
      <h2 className={`px-0.5 text-xs font-semibold uppercase tracking-wide ${destaque ? 'text-warning' : 'text-foreground-muted'}`}>
        {titulo} · {itens.length}
      </h2>
      <div className="divide-y divide-border">
        {itens.map((o) => (
          // O divisor mora no wrapper: no botão (rounded) ele ficaria com pontas curvas.
          <div key={o.id}>
            <ObligationRow ocorrencia={o} agora={agora} liquidacao={liquidacoesPorId[o.transacaoId]} onClick={() => onAbrir(o.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Aviso({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-warning/10 p-3 text-sm text-foreground-secondary">
      <ExclamationTriangleIcon className="h-5 w-5 text-warning shrink-0 mt-0.5" />
      <p>{children}</p>
    </div>
  );
}

// Aba "Programadas" da Home: agenda financeira (o que está atrasado, o que vence agora, o que vem
// depois) e, subordinadas a ela, as recorrências que geram essas contas. Nada aqui altera o saldo —
// só quitar uma conta o faz.
const Programadas = ({
  programadas,
  recorrencias,
  acoes,
  erroCarregamento,
  podeExcluirSerie,
  onEditarSerie,
  onEncerrarSerie,
  onExcluirSerie,
}) => {
  const [abertaId, setAbertaId] = useState(null);
  const [serieAbertaId, setSerieAbertaId] = useState(null);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);

  const { agora, grupos, totais, liquidacoesPorId, indisponivel, inconsistencias, ocorrencias } = programadas;
  const aberta = abertaId ? ocorrencias.find((o) => o.id === abertaId) : null;
  const serieAberta = serieAbertaId ? recorrencias.find((r) => r.id === serieAbertaId) : null;
  const fechar = useCallback(() => setAbertaId(null), []);
  const fecharSerie = useCallback(() => setSerieAbertaId(null), []);

  if (erroCarregamento) {
    return <EmptyState icone={SignalSlashIcon} titulo="Sem conexão" descricao="Não foi possível carregar as contas programadas." />;
  }

  const pendentesDe = (tipo) => [...grupos.atrasadas, ...grupos.venceHoje, ...grupos.proximas].filter((o) => o.tipo === tipo);
  const atrasadasDe = (tipo) => grupos.atrasadas.filter((o) => o.tipo === tipo).length;

  const temContas = grupos.atrasadas.length + grupos.venceHoje.length + grupos.proximas.length + grupos.realizadasRecentes.length + grupos.canceladas.length > 0;
  const temSeries = recorrencias.length > 0;
  const vazioTotal = !temContas && !temSeries && !indisponivel;
  const ativas = recorrencias.filter((r) => r.ativa);
  const encerradas = recorrencias.filter((r) => !r.ativa);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2">
        <ResumoCard rotulo="A pagar" tom="bg-negative" centavos={totais.aPagarCentavos} pendentes={pendentesDe('despesa').length} atrasadas={atrasadasDe('despesa')} />
        <ResumoCard rotulo="A receber" tom="bg-positive" centavos={totais.aReceberCentavos} pendentes={pendentesDe('receita').length} atrasadas={atrasadasDe('receita')} />
      </div>

      {indisponivel && (
        <Aviso>Não foi possível ler as contas programadas agora. Suas recorrências continuam salvas, mas as contas só aparecem quando a leitura voltar a funcionar.</Aviso>
      )}
      {inconsistencias?.temProblemas && <Aviso>Algumas contas têm registros inconsistentes. Abra a conta e use “Desfazer” para reconciliar.</Aviso>}

      {vazioTotal && (
        <EmptyState
          icone={CalendarDaysIcon}
          titulo="Nenhuma conta programada"
          descricao="Crie uma Receita ou Despesa recorrente para acompanhar pagamentos e recebimentos futuros aqui."
        />
      )}

      {!vazioTotal && !temContas && !indisponivel && (
        <p className="text-sm text-foreground-muted px-0.5">Nenhuma conta por vir. As próximas aparecem aqui quando a recorrência gerar um novo mês.</p>
      )}

      <Grupo titulo="Atrasadas" destaque itens={grupos.atrasadas} agora={agora} liquidacoesPorId={liquidacoesPorId} onAbrir={setAbertaId} />
      <Grupo titulo="Vence hoje" itens={grupos.venceHoje} agora={agora} liquidacoesPorId={liquidacoesPorId} onAbrir={setAbertaId} />
      <Grupo titulo="Próximas" itens={grupos.proximas} agora={agora} liquidacoesPorId={liquidacoesPorId} onAbrir={setAbertaId} />
      <Grupo titulo="Realizadas recentes" itens={grupos.realizadasRecentes} agora={agora} liquidacoesPorId={liquidacoesPorId} onAbrir={setAbertaId} />

      {grupos.canceladas.length > 0 && (
        <section className="space-y-1">
          <button
            type="button"
            onClick={() => setMostrarCanceladas((v) => !v)}
            className="focus-ring cursor-pointer text-xs font-medium text-foreground-secondary px-0.5 py-1 rounded-lg"
          >
            {mostrarCanceladas ? 'Ocultar' : 'Ver'} canceladas ({grupos.canceladas.length})
          </button>
          {mostrarCanceladas && (
            <div className="divide-y divide-border">
              {grupos.canceladas.map((o) => (
                <div key={o.id}>
                  <ObligationRow ocorrencia={o} agora={agora} liquidacao={null} onClick={() => setAbertaId(o.id)} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {temSeries && (
        <section className="space-y-1 border-t border-border pt-5">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Recorrências</h2>
          <div>
            {[...ativas, ...encerradas].map((r) => (
              <RecurrenceRow
                key={r.id}
                descricao={r.descricao}
                valor={r.valor}
                tipo={r.tipo}
                diaDoMes={r.diaDoMes}
                encerrada={!r.ativa}
                onClick={() => setSerieAbertaId(r.id)}
              />
            ))}
          </div>
        </section>
      )}

      <ResponsiveDialog aberto={!!aberta} aoFechar={fechar}>
        {aberta && (
          <ObligationActions
            key={aberta.id}
            ocorrencia={aberta}
            agora={agora}
            liquidacao={liquidacoesPorId[aberta.transacaoId] ?? null}
            acoes={acoes}
            onFechar={fechar}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={!!serieAberta} aoFechar={fecharSerie}>
        {serieAberta && (
          <RecurrenceActions
            key={serieAberta.id}
            serie={serieAberta}
            podeExcluir={podeExcluirSerie(serieAberta)}
            onEditar={onEditarSerie}
            onEncerrar={onEncerrarSerie}
            onExcluir={onExcluirSerie}
            onFechar={fecharSerie}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default Programadas;
