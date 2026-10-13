import React from 'react';
import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  MinusIcon,
  BanknotesIcon,
  CreditCardIcon,
  FlagIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import QuickAction from './QuickAction';

const MotionDiv = motion.div;

const formatoMoeda = { style: 'currency', currency: 'BRL' };
const formatadorEstatico = new Intl.NumberFormat('pt-BR', formatoMoeda);

// `recolhido` é controlado de fora (Home.jsx, via um único IntersectionObserver).
// Importante: o observer NÃO pode observar este <section> inteiro, porque a altura
// dele muda quando `recolhido` muda (a grade de QuickActions colapsa) — isso cria
// um loop de realimentação (colapsa → encolhe → observer dispara de novo → expande
// → cresce → dispara de novo...). Por isso existe `sentinelRef`: um marcador fixo
// colocado ANTES da parte que colapsa, cuja posição nunca muda.
const FinancialHero = ({
  sentinelRef,
  saldo,
  receitas,
  despesas,
  variacaoMes,
  dadosIndisponiveis = false,
  recolhido = false,
  modoRecorrentes = false,
  metaDestaque,
  onAbrirMetaDestaque,
  onReceita,
  onDespesa,
  onGuardar,
  onCartoes,
}) => {
  return (
    <section className="rounded-[22px] bg-surface-raised border border-border p-5 sm:p-6 space-y-5">
      <div>
        <p className="text-sm text-foreground-secondary">Saldo atual</p>
        {dadosIndisponiveis ? (
          <>
            <p className="text-4xl sm:text-[42px] font-semibold tracking-tight text-foreground-muted leading-tight">—</p>
            <p className="text-sm mt-1 text-warning">Sem conexão — dados financeiros não atualizados.</p>
          </>
        ) : (
          <>
            <p className="text-4xl sm:text-[42px] font-semibold tracking-tight text-foreground tabular-nums leading-tight">
              <NumberFlow value={saldo} format={formatoMoeda} locales="pt-BR" />
            </p>
            {typeof variacaoMes === 'number' && (
              <p
                className={`text-sm mt-1 tabular-nums ${
                  variacaoMes > 0 ? 'text-positive' : variacaoMes < 0 ? 'text-negative' : 'text-foreground-muted'
                }`}
              >
                {variacaoMes > 0 ? '+' : ''}
                {formatadorEstatico.format(variacaoMes)} este mês
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <ArrowUpIcon className="h-4 w-4 text-positive shrink-0" />
          <div>
            <p className="text-xs text-foreground-muted">Receitas</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {dadosIndisponiveis ? '—' : formatadorEstatico.format(receitas)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ArrowDownIcon className="h-4 w-4 text-negative shrink-0" />
          <div>
            <p className="text-xs text-foreground-muted">Despesas</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {dadosIndisponiveis ? '—' : formatadorEstatico.format(despesas)}
            </p>
          </div>
        </div>
      </div>

      {metaDestaque && !modoRecorrentes && (
        <button
          type="button"
          onClick={onAbrirMetaDestaque}
          className="focus-ring cursor-pointer w-full flex items-center gap-3 p-3 rounded-xl bg-surface hover:bg-surface-hover text-left"
        >
          <span className="h-9 w-9 rounded-full bg-surface-hover text-foreground-secondary flex items-center justify-center shrink-0">
            <FlagIcon className="h-4.5 w-4.5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-xs text-foreground-muted">Quase lá</span>
            <span className="block text-sm font-medium text-foreground truncate">{metaDestaque.nome}</span>
          </span>
          <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">{metaDestaque.progresso}%</span>
          <ChevronRightIcon className="h-4 w-4 text-foreground-muted shrink-0" />
        </button>
      )}

      <div ref={sentinelRef} aria-hidden="true" />

      <MotionDiv
        initial={false}
        animate={{ height: recolhido ? 0 : 'auto', opacity: recolhido ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className={`grid gap-2 ${modoRecorrentes ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
          <QuickAction icone={PlusIcon} label="Receita" tom="positive" onClick={onReceita} />
          <QuickAction icone={MinusIcon} label="Despesa" tom="negative" onClick={onDespesa} />
          {!modoRecorrentes && (
            <>
              <QuickAction icone={BanknotesIcon} label="Guardar" onClick={onGuardar} />
              <QuickAction icone={CreditCardIcon} label="Cartões" onClick={onCartoes} />
            </>
          )}
        </div>
      </MotionDiv>
    </section>
  );
};

export default FinancialHero;
