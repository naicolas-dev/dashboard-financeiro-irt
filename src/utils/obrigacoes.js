// Texto de apresentação das obrigações recorrentes. As DECISÕES (atrasada, adiada, quitada) vêm do
// domínio (dominio/recorrencias.js); aqui só viram frases em pt-BR.
import { statusEfetivo, diasDeAtraso, diasParaVencer, rotulosPorTipo } from '../dominio/recorrencias.js';
import { formatarDataCurta, formatarDataComDiaDaSemana } from './datas.js';

const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;

export const foiAdiada = (ocorrencia) =>
  ocorrencia.status === 'pendente' && ocorrencia.vencimento !== ocorrencia.vencimentoOriginal && (ocorrencia.sobrescritos ?? []).includes('vencimento');

// → { estado: statusEfetivo, texto, badge: { texto, variant } | null }
// `texto` é o sinal temporal que a linha da agenda destaca ("Amanhã · 15 out", "Atrasada há 3 dias · venceu 10 out").
export function descreverObrigacao(ocorrencia, agora, liquidacao = null) {
  const estado = statusEfetivo(ocorrencia, agora);
  const adiada = foiAdiada(ocorrencia) ? ` · adiada de ${formatarDataCurta(ocorrencia.vencimentoOriginal)}` : '';
  const { estado: rotuloQuitada } = rotulosPorTipo(ocorrencia.tipo);

  switch (estado) {
    case 'atrasada': {
      const dias = diasDeAtraso(ocorrencia, agora);
      return { estado, texto: `Atrasada há ${plural(dias, 'dia', 'dias')} · venceu ${formatarDataCurta(ocorrencia.vencimento)}${adiada}`, badge: { texto: 'Atrasada', variant: 'warning' } };
    }
    case 'venceHoje':
      return { estado, texto: `Hoje · ${formatarDataCurta(ocorrencia.vencimento)}${adiada}`, badge: { texto: 'Hoje', variant: 'warning' } };
    case 'proxima': {
      const dias = diasParaVencer(ocorrencia, agora);
      const quando = dias === 1 ? `Amanhã · ${formatarDataCurta(ocorrencia.vencimento)}` : formatarDataComDiaDaSemana(ocorrencia.vencimento);
      return { estado, texto: `${quando}${adiada}`, badge: null };
    }
    case 'realizada':
      return {
        estado,
        texto: `${rotuloQuitada} em ${formatarDataCurta(liquidacao?.data ?? ocorrencia.vencimento)} · venc. ${formatarDataCurta(ocorrencia.vencimento)}`,
        badge: { texto: rotuloQuitada, variant: 'positive' },
      };
    default:
      return { estado, texto: `Cancelada · venc. ${formatarDataCurta(ocorrencia.vencimento)}`, badge: { texto: 'Cancelada', variant: 'neutro' } };
  }
}
