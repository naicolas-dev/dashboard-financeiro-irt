import React from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import Tooltip from './ui/Tooltip.jsx';
import Progress from './ui/Progress.jsx';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Usado em Cartoes.jsx com dados reais (coleção `cartoes` + `parcelasCartao`). Nunca
// exibir dado sensível de cartão real (número completo, CVV, validade) — só
// identificação visual.
//
// Cada cartão tem identidade própria por banco/bandeira — não usa o --color-primary
// do app, senão todo cartão parece "mais uma caixa roxa da UI" em vez de um cartão de
// verdade (achado da revisão visual do Design Lab).
const TEMAS = {
  nubank: 'from-[#5A0FC8] to-[#8A2BE2]',
  inter: 'from-[#FF7A00] to-[#2B2B2E]',
  c6: 'from-[#232326] to-[#000000]',
  mercadopago: 'from-[#0038FF] to-[#2D9CFF]',
  grafite: 'from-[#27272A] to-[#3F3F46]',
};

// `onAbrir`/`onEditar`/`onExcluir` opcionais: com eles, o card inteiro vira clicável
// (abre o detalhe) e ganha dois botões-ferramenta (editar/excluir o cartão) direto
// na listagem — não precisa mais entrar no detalhe só pra isso. `stopPropagation` nos
// botões evita que clicar neles também dispare `onAbrir`.
const CreditCardTile = ({
  banco,
  bandeira,
  faturaAtual,
  limiteDisponivel,
  limiteTotal,
  fechamento,
  vencimento,
  tema = 'nubank',
  onAbrir,
  onEditar,
  onExcluir,
}) => {
  // Barra representa DISPONÍVEL, não usado — barra cheia tem que ser algo bom (muito
  // espaço livre), não o contrário. Cor por faixa de disponibilidade, não de uso.
  const percentualDisponivel = limiteTotal > 0 ? Math.max(0, Math.min(100, (limiteDisponivel / limiteTotal) * 100)) : 0;
  const corBarra = percentualDisponivel >= 50 ? 'bg-positive' : percentualDisponivel >= 20 ? 'bg-warning' : 'bg-negative';

  return (
    <div
      role={onAbrir ? 'button' : undefined}
      tabIndex={onAbrir ? 0 : undefined}
      onClick={onAbrir}
      onKeyDown={
        onAbrir
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onAbrir();
            }
          : undefined
      }
      className={`rounded-[20px] p-5 text-white bg-gradient-to-br ${TEMAS[tema] || TEMAS.grafite} space-y-4 ${
        onAbrir ? 'focus-ring cursor-pointer w-full text-left' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold">{banco}</p>
        <div className="flex items-center gap-1">
          {bandeira && <p className="text-xs opacity-80">{bandeira}</p>}
          {onEditar && (
            <Tooltip content={`Editar ${banco}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditar();
                }}
                aria-label={`Editar ${banco}`}
                className="focus-ring cursor-pointer h-7 w-7 rounded-full flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white"
              >
                <PencilSquareIcon className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
          {onExcluir && (
            <Tooltip content={`Excluir ${banco}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExcluir();
                }}
                aria-label={`Excluir ${banco}`}
                className="focus-ring cursor-pointer h-7 w-7 rounded-full flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs opacity-75">Fatura atual</p>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatadorMoeda.format(faturaAtual)}</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs opacity-75 tabular-nums">
          Disponível {formatadorMoeda.format(limiteDisponivel)} de {formatadorMoeda.format(limiteTotal)}
        </p>
        <Progress percentual={percentualDisponivel} corClasse={corBarra} trackClasse="bg-white/20" alturaClasse="h-1.5" />
      </div>

      <div className="flex items-center justify-between text-xs opacity-75">
        <span>Fecha dia {fechamento}</span>
        <span>Vence dia {vencimento}</span>
      </div>
    </div>
  );
};

export default CreditCardTile;
