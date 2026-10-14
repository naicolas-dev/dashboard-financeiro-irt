import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase/configuracao';
import { buscarPagamentosDeFatura, excluirCompraCartao, excluirComprasCartaoEmLote } from '../servicos/cartoes.js';
import {
  movimentacoesDeCaixa,
  parcelasDaCompra,
  resumoDoCartao,
  regrasDaCompra,
  validarAlteracaoDeCompras,
  faturasDoCartao,
  maximoPagamentoCentavos,
  paraReais,
} from '../dominio/cartoes.js';
import {
  calcularSaldoFinanceiroCentavos,
  calcularSaldoDisponivelCentavos,
  movimentacoesRealizadas,
  movimentacoesComDataInvalida,
  resumoDoHero,
  resultadoDoMesCentavos,
} from '../dominio/caixa.js';
import { paraTimestamp, compararPorTempoDesc, inicioDoDiaLocal, fimDoDiaLocal } from '../dominio/tempo.js';
import {
  ehLiquidacaoRecorrente,
  idLiquidacao,
  normalizarSerie,
  agruparObrigacoes,
  totaisPendentes,
  inconsistenciasDeLiquidacao,
  planejarEdicaoDaSerie,
  planejarEncerramento,
  planejarExclusaoDaSerie,
  rotulosPorTipo,
} from '../dominio/recorrencias.js';
import * as servicoRecorrencias from '../servicos/recorrencias.js';

const QUANTIDADE_DE_RECENTES = 5;

const MOTIVOS_DE_RECUSA = {
  inexistente: 'Esta conta não existe mais. Atualize a tela.',
  ja_realizada: 'Esta conta já foi quitada (talvez em outra aba ou aparelho).',
  cancelada: 'Esta conta está cancelada.',
  nao_cancelada: 'Esta conta não está cancelada.',
  valor_invalido: 'Informe um valor maior que zero.',
  data_invalida: 'Data inválida.',
  descricao_invalida: 'Informe uma descrição.',
  categoria_invalida: 'Informe uma categoria.',
  dia_invalido: 'O dia do mês deve estar entre 1 e 31.',
  tipo_invalido: 'Tipo inválido.',
  realizada_desfazer_antes: 'Esta conta já foi quitada. Desfaça o pagamento antes de alterá-la.',
  nao_realizada: 'Esta conta ainda não foi quitada.',
  sem_transacao: 'O registro do pagamento não foi encontrado. Use "Desfazer" para reconciliar.',
  tem_realizadas: 'Esta recorrência já tem pagamentos registrados. Encerre-a em vez de excluir.',
};

// Toda ordenação de transações é por TEMPO REAL (dominio/tempo.js), nunca por string:
// os documentos misturam 'YYYY-MM-DDTHH:mm' (hora local) e ISO com Z (UTC).
function ordenarPorDataDesc(lista) {
  return [...lista].sort(compararPorTempoDesc);
}

// Metas antigas (legado, de antes da Fase 2) guardam o valor guardado em `valorAtual`;
// o conceito novo é `valorReservado`. Normaliza só na leitura — não escreve nada no
// Firestore aqui, não migra em massa. Uma vez que a meta passar por guardar/retirar/
// editar, o doc ganha `valorReservado` de verdade e essa normalização vira um no-op
// pra ela. `valorAlvo`/`nome` já usam os mesmos nomes em ambos os formatos.
function normalizarMeta(meta) {
  if (typeof meta.valorReservado === 'number') return meta;
  return { ...meta, valorReservado: meta.valorAtual || 0 };
}

async function buscarTodos(nomeColecao) {
  const snapshot = await getDocs(collection(db, nomeColecao));
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
}

// Livro-caixa INTEIRO, sem janela: o saldo é posição acumulada e não pode expirar com a
// idade da movimentação. Sem where/orderBy (nem índice): a ordem é feita em memória por
// tempo real, porque o campo `data` tem formatos diferentes que o Firestore compararia
// como string. Volume atual: dezenas de documentos.
async function buscarTodasTransacoes() {
  const snapshot = await getDocs(collection(db, 'transacoes'));
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
}

// Centraliza o estado e o acesso ao Firestore (transações, metas e recorrentes) que
// antes vivia espalhado dentro de App.jsx. Os formulários continuam fazendo seus
// próprios addDoc/updateDoc (não duplicamos essa camada), mas o carregamento inicial,
// o cache de intervalo de datas e a sincronização do estado local depois de cada
// escrita ficam todos aqui — App.jsx passa a só compor a interface.
export function useDadosFinanceiros(usuario) {
  // `transacoesCarregadas` = documentos crus de `transacoes`; tudo que o resto do app
  // vê passa por `movimentacoesDeCaixa` (logo abaixo) — ponto único da regra.
  const [transacoesCarregadas, setTransacoes] = useState([]);
  const [metas, setMetas] = useState([]);
  const [recorrencias, setRecorrencias] = useState([]);
  // Obrigações programadas (uma por série × mês). `ocorrenciasIndisponiveis` = a coleção não pôde
  // ser lida (ex.: Rule ainda não publicada): séries continuam funcionando, só não há geração.
  const [ocorrencias, setOcorrencias] = useState([]);
  const [ocorrenciasIndisponiveis, setOcorrenciasIndisponiveis] = useState(false);
  const [cartoesBase, setCartoesBase] = useState([]);
  const [comprasCartao, setComprasCartao] = useState([]);
  const [pagamentosFatura, setPagamentosFatura] = useState([]);
  const [carregando, setCarregando] = useState(true);
  // true quando o carregamento inicial falhou (tipicamente offline) — distingue
  // "sem dados de verdade" de "não consegui carregar os dados", pra Home/
  // Movimentações/Cartões/Metas não mostrarem R$0/listas vazias como se fosse
  // informação financeira real.
  const [erroCarregamento, setErroCarregamento] = useState(false);

  // Só filtros de EXIBIÇÃO (Movimentações). Não participam do saldo.
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  useEffect(() => {
    if (!usuario) {
      setTransacoes([]);
      setMetas([]);
      setRecorrencias([]);
      setOcorrencias([]);
      setOcorrenciasIndisponiveis(false);
      setCartoesBase([]);
      setComprasCartao([]);
      setPagamentosFatura([]);
      setCarregando(false);
      return;
    }

    let ativo = true;

    const carregarDadosIniciais = async () => {
      setCarregando(true);
      setErroCarregamento(false);

      // O SDK do Firestore não rejeita a Promise quando está offline — ele cai
      // em "modo offline" por conta própria e resolve com o que tiver no cache
      // em memória (vazio, já que este projeto não habilita persistence), como
      // se fosse uma leitura bem-sucedida de verdade. Sem este check, um
      // carregamento inicial offline parecia "sem dados" em vez de "sem
      // conexão" (achado real ao testar, não só suposição). `navigator.onLine`
      // raramente erra pro lado de dizer "offline" quando na verdade está
      // online — é o sinal mais confiável disponível sem reestruturar pra
      // onSnapshot/metadata.fromCache.
      if (!navigator.onLine) {
        setCarregando(false);
        setErroCarregamento(true);
        return;
      }

      try {
        const [todasAsTransacoes, metasCarregadas, recorrenciasCarregadas, cartoesCarregados, comprasCartaoCarregadas, pagamentosCarregados, ocorrenciasLidas] =
          await Promise.all([
            buscarTodasTransacoes(),
            buscarTodos('metas'),
            buscarTodos('transacoesRecorrentes'),
            buscarTodos('cartoes'),
            buscarTodos('comprasCartao'),
            buscarPagamentosDeFatura(),
            // Falha só nesta coleção (ex.: permission-denied antes de a Rule ser publicada) não
            // derruba o app: `null` = indisponível, e nada é gerado em cima de leitura incerta.
            buscarTodos('ocorrenciasRecorrentes').catch((erro) => {
              console.warn('Não foi possível ler ocorrenciasRecorrentes:', erro?.code ?? erro);
              return null;
            }),
          ]);

        // Gera as obrigações que faltam (idempotente, id determinístico) SÓ depois de ler tudo com
        // sucesso. Falha aqui nunca bloqueia o carregamento: o próximo load tenta de novo.
        let ocorrenciasFinais = ocorrenciasLidas ?? [];
        if (ocorrenciasLidas !== null) {
          try {
            const criadas = await servicoRecorrencias.garantirOcorrencias({ series: recorrenciasCarregadas, ocorrencias: ocorrenciasLidas, agora: new Date() });
            ocorrenciasFinais = [...ocorrenciasLidas, ...criadas];
          } catch (erro) {
            console.warn('Não foi possível gerar as ocorrências recorrentes:', erro);
          }
        }

        if (!ativo) return;
        setTransacoes(ordenarPorDataDesc(todasAsTransacoes));
        setMetas(metasCarregadas.map(normalizarMeta));
        setRecorrencias(recorrenciasCarregadas);
        setOcorrencias(ocorrenciasFinais);
        setOcorrenciasIndisponiveis(ocorrenciasLidas === null);
        setCartoesBase(cartoesCarregados);
        setComprasCartao(comprasCartaoCarregadas);
        setPagamentosFatura(pagamentosCarregados);
      } catch (erro) {
        console.error('Erro ao carregar os dados financeiros:', erro);
        toast.error('Não foi possível carregar seus dados.');
        if (ativo) setErroCarregamento(true);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregarDadosIniciais();
    return () => {
      ativo = false;
    };
  }, [usuario]);

  // Livro-caixa: o que o app inteiro (saldo, Home, Movimentações) enxerga como
  // `transacoes`. Parcelas legadas do modelo antigo, se existirem, ficam de fora.
  const transacoes = useMemo(() => movimentacoesDeCaixa(transacoesCarregadas), [transacoesCarregadas]);

  // Filtro de exibição: início/fim do DIA LOCAL (um 'YYYY-MM-DD' não vira meia-noite UTC)
  // comparados com o instante real da transação.
  const transacoesFiltradas = useMemo(() => {
    const inicioFiltro = dataInicio ? inicioDoDiaLocal(dataInicio) : null;
    const fimFiltro = dataFim ? fimDoDiaLocal(dataFim) : null;
    return transacoes.filter((t) => {
      const instante = paraTimestamp(t.data);
      const passaFiltroData = (inicioFiltro === null || instante >= inicioFiltro) && (fimFiltro === null || instante <= fimFiltro);
      const passaFiltroCategoria = filtroCategoria === 'todas' || t.categoria === filtroCategoria;
      const passaFiltroTipo = filtroTipo === 'todos' || t.tipo === filtroTipo;
      return passaFiltroData && passaFiltroCategoria && passaFiltroTipo;
    });
  }, [transacoes, dataInicio, dataFim, filtroCategoria, filtroTipo]);

  const limparFiltros = useCallback(() => {
    setDataInicio(null);
    setDataFim(null);
    setFiltroCategoria('todas');
    setFiltroTipo('todos');
  }, []);

  const handleTransacaoSalva = useCallback((transacaoSalva) => {
    setTransacoes((prev) => {
      const semAntiga = prev.filter((t) => t.id !== transacaoSalva.id);
      return ordenarPorDataDesc([...semAntiga, transacaoSalva]);
    });
  }, []);

  // Estado do único ConfirmDialog global (renderizado em AppShell, ao lado do
  // Toaster). `pendenteRef` evita que uma segunda confirmação seja aberta (ou um
  // duplo clique seja processado) enquanto a atual ainda não resolveu.
  const [confirmacao, setConfirmacao] = useState(null);
  const pendenteRef = useRef(false);

  const confirmarExclusao = useCallback(({ titulo, descricao, textoConfirmar = 'Excluir', acao }) => {
    if (pendenteRef.current) return Promise.resolve(false);
    pendenteRef.current = true;

    return new Promise((resolve) => {
      const finalizar = (resultado) => {
        pendenteRef.current = false;
        setConfirmacao(null);
        resolve(resultado);
      };

      setConfirmacao({
        titulo,
        descricao,
        textoConfirmar,
        carregando: false,
        onCancelar: () => finalizar(false),
        onConfirmar: async () => {
          setConfirmacao((atual) => (atual ? { ...atual, carregando: true } : atual));
          try {
            const sucesso = await acao();
            finalizar(Boolean(sucesso));
          } catch (erro) {
            // Rede de segurança: se `acao()` escapar do próprio try/catch (não devia —
            // cada handler já tem seu toast.error — mas não pode travar o diálogo).
            console.error('Erro inesperado ao confirmar exclusão:', erro);
            finalizar(false);
          }
        },
      });
    });
  }, []);

  // ------------------------------------------------------------------------------------------
  // Programadas = obrigações recorrentes. Uma ocorrência é uma OBRIGAÇÃO: nunca toca o saldo.
  // Só a liquidação (transação `liq_<ocorrenciaId>`, natureza `liquidacao_recorrente`) entra no
  // caixa, e liquidar/desfazer são atômicos no banco (servicos/recorrencias.js).
  // ------------------------------------------------------------------------------------------
  const guardarOcorrencia = useCallback((atualizada) => {
    setOcorrencias((prev) => (prev.some((o) => o.id === atualizada.id) ? prev.map((o) => (o.id === atualizada.id ? atualizada : o)) : [...prev, atualizada]));
  }, []);

  const guardarLiquidacao = useCallback((transacao) => {
    setTransacoes((prev) => ordenarPorDataDesc([...prev.filter((t) => t.id !== transacao.id), transacao]));
  }, []);

  // Executa uma ação de serviço: recusa do domínio vira toast claro; erro de rede/permissão também.
  const executarAcao = useCallback(
    async (acao) => {
      try {
        const resultado = await acao();
        if (!resultado.ok) {
          toast.error(MOTIVOS_DE_RECUSA[resultado.motivo] ?? 'Não foi possível concluir a ação.');
          return null;
        }
        if (resultado.ocorrencia) guardarOcorrencia(resultado.ocorrencia);
        return resultado;
      } catch (erro) {
        console.error('Erro em ação de recorrência:', erro);
        toast.error('Não foi possível concluir. Tente novamente.');
        return null;
      }
    },
    [guardarOcorrencia]
  );

  const liquidarObrigacao = useCallback(
    async (ocorrencia, { valor, data }) => {
      const resultado = await executarAcao(() => servicoRecorrencias.liquidarOcorrencia({ ocorrenciaId: ocorrencia.id, valor, data }));
      if (!resultado) return false;
      if (resultado.transacao) guardarLiquidacao(resultado.transacao);
      toast.success(ocorrencia.tipo === 'receita' ? 'Recebimento registrado' : 'Pagamento registrado');
      if (resultado.reconciliada) toast.info('Já existia um registro desta quitação; a obrigação foi vinculada a ele.');
      return true;
    },
    [executarAcao, guardarLiquidacao]
  );

  const corrigirObrigacao = useCallback(
    async (ocorrencia, { valor, data }) => {
      const resultado = await executarAcao(() => servicoRecorrencias.corrigirLiquidacao({ ocorrenciaId: ocorrencia.id, valor, data }));
      if (!resultado) return false;
      if (resultado.transacao) guardarLiquidacao(resultado.transacao);
      toast.success(ocorrencia.tipo === 'receita' ? 'Recebimento atualizado' : 'Pagamento atualizado');
      return true;
    },
    [executarAcao, guardarLiquidacao]
  );

  // Desfazer tem confirmação explícita: o valor volta ao saldo e a obrigação volta a pendente.
  const desfazerObrigacao = useCallback(
    (ocorrencia) => {
      const { desfazer, verbo } = rotulosPorTipo(ocorrencia.tipo);
      return confirmarExclusao({
        titulo: `${desfazer}?`,
        descricao: `O ${verbo} sai das movimentações, o saldo é ajustado e a obrigação volta a ficar pendente.`,
        textoConfirmar: desfazer,
        acao: async () => {
          const resultado = await executarAcao(() => servicoRecorrencias.desfazerLiquidacao({ ocorrenciaId: ocorrencia.id }));
          if (!resultado) return false;
          if (resultado.nada) {
            toast.info('Esta obrigação já estava pendente. Atualize a tela se algo parecer diferente.');
            return true;
          }
          setTransacoes((prev) => prev.filter((t) => t.id !== idLiquidacao(ocorrencia.id)));
          toast.success(ocorrencia.tipo === 'receita' ? 'Recebimento desfeito' : 'Pagamento desfeito');
          if (resultado.reconciliada) toast.warning('Os registros estavam inconsistentes e foram reconciliados.');
          return true;
        },
      });
    },
    [confirmarExclusao, executarAcao]
  );

  const adiarObrigacao = useCallback(
    async (ocorrencia, novoVencimento) => {
      const resultado = await executarAcao(() => servicoRecorrencias.adiarOcorrencia({ ocorrenciaId: ocorrencia.id, novoVencimento }));
      if (resultado) toast.success('Vencimento alterado só desta conta');
      return Boolean(resultado);
    },
    [executarAcao]
  );

  const editarObrigacao = useCallback(
    async (ocorrencia, campos) => {
      const resultado = await executarAcao(() => servicoRecorrencias.editarOcorrencia({ ocorrenciaId: ocorrencia.id, campos }));
      if (resultado) toast.success('Conta atualizada (só esta)');
      return Boolean(resultado);
    },
    [executarAcao]
  );

  const cancelarObrigacao = useCallback(
    (ocorrencia) =>
      confirmarExclusao({
        titulo: 'Cancelar esta conta?',
        descricao: 'Só esta ocorrência é cancelada. A recorrência continua e as próximas contas não mudam. Você pode restaurá-la depois.',
        textoConfirmar: 'Cancelar conta',
        acao: async () => {
          const resultado = await executarAcao(() => servicoRecorrencias.cancelarOcorrencia({ ocorrenciaId: ocorrencia.id }));
          if (resultado) toast.success('Conta cancelada');
          return Boolean(resultado);
        },
      }),
    [confirmarExclusao, executarAcao]
  );

  const restaurarObrigacao = useCallback(
    async (ocorrencia) => {
      const resultado = await executarAcao(() => servicoRecorrencias.restaurarOcorrencia({ ocorrenciaId: ocorrencia.id }));
      if (resultado) toast.success('Conta restaurada');
      return Boolean(resultado);
    },
    [executarAcao]
  );

  // Séries ----------------------------------------------------------------------------------
  const guardarSerie = useCallback((serie) => {
    setRecorrencias((prev) => (prev.some((r) => r.id === serie.id) ? prev.map((r) => (r.id === serie.id ? { ...r, ...serie } : r)) : [...prev, serie]));
  }, []);

  // Cria a série e já materializa as contas do horizonte (a primeira vence a partir de hoje).
  const criarSerieRecorrente = useCallback(
    async (dados) => {
      try {
        const agora = new Date();
        const serie = await servicoRecorrencias.criarRecorrencia(dados, agora);
        guardarSerie(serie);
        if (!ocorrenciasIndisponiveis) {
          try {
            const criadas = await servicoRecorrencias.garantirOcorrencias({ series: [serie], ocorrencias: [], agora });
            setOcorrencias((prev) => [...prev, ...criadas.filter((c) => !prev.some((o) => o.id === c.id))]);
          } catch (erro) {
            console.warn('Série criada, mas as contas não puderam ser geradas agora:', erro);
            toast.warning('Recorrência criada. As contas aparecem na próxima vez que você abrir o app.');
          }
        }
        toast.success(dados.tipo === 'receita' ? 'Receita recorrente criada!' : 'Despesa recorrente criada!');
        return true;
      } catch (erro) {
        console.error('Erro ao criar recorrência:', erro);
        toast.error('Não foi possível salvar. Tente novamente.');
        return false;
      }
    },
    [guardarSerie, ocorrenciasIndisponiveis]
  );

  // Editar a série: confirma mostrando QUANTAS contas pendentes serão atualizadas. Pagas, atrasadas e
  // campos alterados só em uma conta ficam como estão.
  const editarSerieRecorrente = useCallback(
    async (serie, campos) => {
      const serieAntiga = normalizarSerie(serie);
      const { contagem } = planejarEdicaoDaSerie({ serieAntiga, serieNova: { ...serieAntiga, ...campos }, ocorrencias, agora: new Date() });

      const aplicar = async () => {
        try {
          const resultado = await servicoRecorrencias.editarSerie({ serieId: serie.id, campos });
          if (!resultado.ok) {
            toast.error(MOTIVOS_DE_RECUSA[resultado.motivo] ?? 'Não foi possível salvar.');
            return false;
          }
          guardarSerie({ ...resultado.serie, id: serie.id });
          const porId = new Map(resultado.patches.map((p) => [p.id, p.campos]));
          setOcorrencias((prev) => prev.map((o) => (porId.has(o.id) ? { ...o, ...porId.get(o.id) } : o)));
          toast.success('Recorrência atualizada!');
          return true;
        } catch (erro) {
          console.error('Erro ao atualizar recorrência:', erro);
          toast.error('Não foi possível salvar. Tente novamente.');
          return false;
        }
      };

      if (contagem === 0) return aplicar();
      return confirmarExclusao({
        titulo: 'Atualizar a recorrência?',
        descricao: `${contagem === 1 ? '1 conta pendente que ainda não venceu vai' : `${contagem} contas pendentes que ainda não venceram vão`} receber a mudança. Contas pagas, atrasadas ou alteradas só nelas não mudam.`,
        textoConfirmar: 'Atualizar',
        acao: aplicar,
      });
    },
    [ocorrencias, confirmarExclusao, guardarSerie]
  );

  const encerrarSerieRecorrente = useCallback(
    (serie) => {
      const plano = planejarEncerramento({ serie: normalizarSerie(serie), ocorrencias, agora: new Date() });
      const n = plano.cancelarIds.length;
      const efeito = n === 0 ? 'Nenhuma conta futura será cancelada.' : n === 1 ? '1 conta futura pendente será cancelada.' : `${n} contas futuras pendentes serão canceladas.`;
      return confirmarExclusao({
        titulo: 'Encerrar a recorrência?',
        descricao: `${efeito} O histórico (contas pagas e atrasadas) é mantido e nada novo será gerado.`,
        textoConfirmar: 'Encerrar',
        acao: async () => {
          try {
            const resultado = await servicoRecorrencias.encerrarSerie({ serieId: serie.id });
            if (!resultado.ok) {
              toast.error(MOTIVOS_DE_RECUSA[resultado.motivo] ?? 'Não foi possível encerrar.');
              return false;
            }
            guardarSerie({ ...resultado.serie, id: serie.id });
            const canceladas = new Set(resultado.cancelarIds);
            setOcorrencias((prev) => prev.map((o) => (canceladas.has(o.id) ? { ...o, status: 'cancelada' } : o)));
            toast.success('Recorrência encerrada');
            return true;
          } catch (erro) {
            console.error('Erro ao encerrar recorrência:', erro);
            toast.error('Não foi possível encerrar. Tente novamente.');
            return false;
          }
        },
      });
    },
    [ocorrencias, confirmarExclusao, guardarSerie]
  );

  const podeExcluirSerieRecorrente = useCallback((serie) => planejarExclusaoDaSerie({ serie, ocorrencias }).ok, [ocorrencias]);

  const excluirSerieRecorrente = useCallback(
    (serie) => {
      if (!planejarExclusaoDaSerie({ serie, ocorrencias }).ok) {
        toast.error(MOTIVOS_DE_RECUSA.tem_realizadas);
        return false;
      }
      return confirmarExclusao({
        titulo: 'Excluir recorrência?',
        descricao: 'A recorrência e as contas pendentes ou canceladas dela serão removidas. Nenhum pagamento foi registrado nela.',
        acao: async () => {
          try {
            const resultado = await servicoRecorrencias.excluirSerie({ serieId: serie.id });
            if (!resultado.ok) {
              toast.error(MOTIVOS_DE_RECUSA[resultado.motivo] ?? 'Não foi possível excluir.');
              return false;
            }
            setRecorrencias((prev) => prev.filter((r) => r.id !== serie.id));
            setOcorrencias((prev) => prev.filter((o) => o.serieId !== serie.id));
            toast.success('Recorrência removida');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir recorrência:', erro);
            toast.error('Não foi possível remover a recorrência.');
            return false;
          }
        },
      });
    },
    [ocorrencias, confirmarExclusao]
  );

  // Movimentações: a transação de liquidação aponta para a obrigação dela.
  const ocorrenciaDaTransacao = useCallback((transacao) => ocorrencias.find((o) => o.id === transacao?.ocorrenciaId) ?? null, [ocorrencias]);

  // Derivados da aba Programadas: grupos pelo relógio (atrasada/vence hoje/próxima), totais e
  // consistência entre obrigações e liquidações.
  const programadas = useMemo(() => {
    const agora = new Date();
    const liquidacoesPorId = Object.fromEntries(transacoesCarregadas.filter(ehLiquidacaoRecorrente).map((t) => [t.id, t]));
    return {
      agora,
      ocorrencias,
      grupos: agruparObrigacoes(ocorrencias, agora, { liquidacoesPorId }),
      totais: totaisPendentes(ocorrencias),
      liquidacoesPorId,
      indisponivel: ocorrenciasIndisponiveis,
      inconsistencias: ocorrenciasIndisponiveis ? null : inconsistenciasDeLiquidacao({ ocorrencias, transacoes: transacoesCarregadas }),
    };
  }, [ocorrencias, transacoesCarregadas, ocorrenciasIndisponiveis]);

  // Dado inconsistente nunca é corrigido em silêncio: avisa uma vez e o usuário reconcilia pelo
  // "Desfazer" da própria obrigação.
  const inconsistenciasAvisadas = useRef(false);
  useEffect(() => {
    const inc = programadas.inconsistencias;
    if (!inc?.temProblemas || inconsistenciasAvisadas.current) return;
    inconsistenciasAvisadas.current = true;
    console.warn('Recorrentes: registros inconsistentes', {
      realizadaSemTransacao: inc.realizadaSemTransacao.map((o) => o.id),
      transacaoSemOcorrencia: inc.transacaoSemOcorrencia.map((t) => t.id),
    });
    toast.warning('Há contas recorrentes com registros inconsistentes. Abra a conta em Programadas e use "Desfazer" para reconciliar.', { duration: 9000 });
  }, [programadas.inconsistencias]);

  const seriesRecorrentes = useMemo(() => recorrencias.map(normalizarSerie), [recorrencias]);

  // Liquidação de recorrente NUNCA é apagada como transação comum (deixaria a obrigação "realizada"
  // sem pagamento): exclui = desfazer a quitação, atomicamente.
  const excluirLiquidacaoRecorrente = useCallback(
    (transacao) => {
      const ocorrencia = ocorrencias.find((o) => o.id === transacao.ocorrenciaId);
      if (!ocorrencia) {
        toast.error('Não foi possível localizar a conta recorrente deste lançamento. Atualize a tela e tente de novo.');
        return false;
      }
      return desfazerObrigacao(ocorrencia);
    },
    [ocorrencias, desfazerObrigacao]
  );

  // Pagamento de fatura também é uma transação (a saída de caixa real): excluir
  // devolve o valor ao saldo e a dívida volta a aparecer — tudo por derivação.
  const excluirTransacao = useCallback(
    (id) => {
      const alvo = transacoesCarregadas.find((t) => t.id === id);
      if (ehLiquidacaoRecorrente(alvo)) return excluirLiquidacaoRecorrente(alvo);
      const ehPagamento = pagamentosFatura.some((p) => p.id === id);
      return confirmarExclusao({
        titulo: ehPagamento ? 'Excluir pagamento de fatura?' : 'Excluir transação?',
        descricao: ehPagamento
          ? 'O valor volta para o saldo e a dívida do cartão aumenta de novo.'
          : 'Esta transação será removida permanentemente.',
        acao: async () => {
          try {
            await deleteDoc(doc(db, 'transacoes', id));
            setTransacoes((prev) => prev.filter((t) => t.id !== id));
            if (ehPagamento) setPagamentosFatura((prev) => prev.filter((p) => p.id !== id));
            toast.success(ehPagamento ? 'Pagamento excluído' : 'Transação excluída');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir:', erro);
            toast.error('Não foi possível excluir a transação.');
            return false;
          }
        },
      });
    },
    [confirmarExclusao, pagamentosFatura, transacoesCarregadas, excluirLiquidacaoRecorrente]
  );

  const handleMetaAtualizada = useCallback((metaAtualizada) => {
    setMetas((prev) => prev.map((m) => (m.id === metaAtualizada.id ? metaAtualizada : m)));
  }, []);

  const handleMetaSalva = useCallback((metaSalva) => {
    setMetas((prev) => {
      const existe = prev.some((m) => m.id === metaSalva.id);
      return existe ? prev.map((m) => (m.id === metaSalva.id ? metaSalva : m)) : [...prev, metaSalva];
    });
  }, []);

  const handleMetaExcluida = useCallback((id) => {
    setMetas((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Bloqueia (toast, sem confirmação — não é permitido, ponto) se a meta ainda tem
  // dinheiro reservado; mesma filosofia de `excluirCartao`. Sem liberação automática:
  // o usuário precisa retirar explicitamente antes.
  const excluirMeta = useCallback(
    (meta) => {
      if (meta.valorReservado > 0) {
        const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(meta.valorReservado);
        toast.error(`Esta meta ainda possui ${valorFormatado} reservado. Retire o dinheiro antes de excluir a meta.`);
        return false;
      }

      return confirmarExclusao({
        titulo: 'Excluir meta?',
        descricao: 'Esta meta será removida permanentemente.',
        acao: async () => {
          try {
            await deleteDoc(doc(db, 'metas', meta.id));
            setMetas((prev) => prev.filter((m) => m.id !== meta.id));
            toast.success('Meta excluída');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir meta:', erro);
            toast.error('Não foi possível excluir a meta.');
            return false;
          }
        },
      });
    },
    [confirmarExclusao]
  );

  // SALDO = posição acumulada de todo o livro-caixa realizado (data ≤ agora); métricas
  // de período (Entradas/Saídas do Hero, resultado do mês) são outra coisa. Uma única
  // implementação, no domínio (dominio/caixa.js) — Home e Metas só consomem estes valores.
  // `agora` é capturado a cada mudança da lista: um movimento com data futura passa a
  // contar quando a lista é recalculada depois do instante dele (ou ao reabrir o app).
  const caixa = useMemo(() => {
    const agora = new Date();
    const saldoCentavos = calcularSaldoFinanceiroCentavos(transacoes, agora);
    const hero = resumoDoHero(transacoes, agora);
    return {
      saldoCentavos,
      entradas: hero.entradasCentavos / 100,
      saidas: hero.saidasCentavos / 100,
      resultadoMes: resultadoDoMesCentavos(transacoes, agora) / 100,
      recentes: movimentacoesRealizadas(transacoes, agora).sort(compararPorTempoDesc).slice(0, QUANTIDADE_DE_RECENTES),
    };
  }, [transacoes]);

  // Documento de caixa com data que não dá pra interpretar fica fora do saldo — avisa,
  // nunca silencioso.
  useEffect(() => {
    const invalidas = movimentacoesComDataInvalida(transacoes);
    if (invalidas.length > 0) {
      console.warn(`${invalidas.length} transação(ões) com data inválida ficaram fora do saldo:`, invalidas.map((t) => t.id));
    }
  }, [transacoes]);

  const saldoFinanceiro = caixa.saldoCentavos / 100;

  const totalReservadoMetas = useMemo(() => metas.reduce((acc, m) => acc + (m.valorReservado || 0), 0), [metas]);

  const saldoDisponivel = calcularSaldoDisponivelCentavos(caixa.saldoCentavos, Math.round(totalReservadoMetas * 100)) / 100;

  // Parcelas são DERIVADAS das compras (nada gravado em `transacoes`). Mesmo formato
  // que a UI já consumia (valor em reais, competência, parcelaAtual/totalParcelas).
  const parcelasCartao = useMemo(
    () =>
      comprasCartao.flatMap(parcelasDaCompra).map((p) => ({
        ...p,
        valor: paraReais(p.centavos),
        valorTotalCompra: paraReais(p.valorTotalCompraCentavos),
      })),
    [comprasCartao]
  );

  // Dívida, fatura atual, próximas parcelas e limite disponível: tudo derivado pelo
  // domínio a partir de compras + pagamentos (nenhum contador gravado).
  const cartoes = useMemo(() => {
    const hoje = new Date();
    return cartoesBase.map((cartao) => {
      const resumo = resumoDoCartao({ cartao, compras: comprasCartao, pagamentos: pagamentosFatura, hoje });
      return {
        ...cartao,
        resumo,
        divida: paraReais(resumo.dividaCentavos),
        limiteDisponivel: paraReais(resumo.limiteDisponivelCentavos),
      };
    });
  }, [cartoesBase, comprasCartao, pagamentosFatura]);

  const regrasCompra = useCallback(
    (compra) => {
      const cartao = cartoesBase.find((c) => c.id === compra.cartaoId);
      if (!cartao) return { podeAlterarValor: true, podeExcluir: true, temHistorico: false, aviso: null };
      return regrasDaCompra({ compra, cartao, compras: comprasCartao, pagamentos: pagamentosFatura, hoje: new Date() });
    },
    [cartoesBase, comprasCartao, pagamentosFatura]
  );

  // Valida (no domínio) uma alteração financeira em compras pelo estado RESULTANTE,
  // um cartão por vez: se os pagamentos existentes passariam da dívida que sobraria,
  // devolve { ok:false, mensagem }. Nunca escreve nada.
  const validarAlteracaoCompras = useCallback(
    ({ removerIds = [], substituir = [] }) => {
      const hoje = new Date();
      const afetadas = [...removerIds, ...substituir.map((s) => s.id)];
      const cartaoIds = new Set(comprasCartao.filter((c) => afetadas.includes(c.id)).map((c) => c.cartaoId));
      for (const cartaoId of cartaoIds) {
        const cartao = cartoesBase.find((c) => c.id === cartaoId);
        if (!cartao) continue;
        const resultado = validarAlteracaoDeCompras({ cartao, compras: comprasCartao, pagamentos: pagamentosFatura, hoje, removerIds, substituir });
        if (!resultado.ok) return resultado;
      }
      return { ok: true, excedenteCentavos: 0, mensagem: null };
    },
    [cartoesBase, comprasCartao, pagamentosFatura]
  );

  // Tudo que o diálogo de pagamento precisa saber sobre uma fatura. Na edição, o
  // próprio pagamento sai da conta (restante e máximo como se ele não existisse).
  const contextoPagamento = useCallback(
    ({ cartaoId, competencia, ignorarPagamentoId }) => {
      const cartao = cartoes.find((c) => c.id === cartaoId);
      if (!cartao) return null;
      const hoje = new Date();
      const pagamentos = ignorarPagamentoId ? pagamentosFatura.filter((p) => p.id !== ignorarPagamentoId) : pagamentosFatura;
      const { faturas } = faturasDoCartao({ cartao, compras: comprasCartao, pagamentos, hoje });
      return {
        cartao,
        restanteFaturaCentavos: faturas.find((f) => f.competencia === competencia)?.restanteCentavos ?? 0,
        maximoCentavos: maximoPagamentoCentavos({ cartao, compras: comprasCartao, pagamentos, hoje, competencia }),
      };
    },
    [cartoes, comprasCartao, pagamentosFatura]
  );

  // Pagamento é ao mesmo tempo caixa (`transacoes`) e redutor de dívida
  // (`pagamentosFatura`, sem janela) — os dois estados andam juntos.
  const handlePagamentoSalvo = useCallback((pagamento) => {
    setPagamentosFatura((prev) => [...prev.filter((p) => p.id !== pagamento.id), pagamento]);
    setTransacoes((prev) => ordenarPorDataDesc([...prev.filter((t) => t.id !== pagamento.id), pagamento]));
  }, []);

  const handleCartaoSalvo = useCallback((cartaoSalvo) => {
    setCartoesBase((prev) => {
      const existe = prev.some((c) => c.id === cartaoSalvo.id);
      return existe ? prev.map((c) => (c.id === cartaoSalvo.id ? cartaoSalvo : c)) : [...prev, cartaoSalvo];
    });
  }, []);

  // Compra no cartão não toca o caixa: só entra em `comprasCartao`.
  const handleCompraCriada = useCallback((compra) => {
    setComprasCartao((prev) => [...prev, compra]);
  }, []);

  // Sem ida ao Firestore pra checar o bloqueio — `comprasCartao` já está carregado
  // por inteiro, então "tem compra vinculada?" é só um filter local. Bloqueado não
  // pede confirmação (a ação simplesmente não é permitida, diferente de "tem certeza?").
  const excluirCartao = useCallback(
    (cartao) => {
      const temCompras = comprasCartao.some((c) => c.cartaoId === cartao.id);
      if (temCompras) {
        // Toast, não diálogo — é um aviso ("não dá pra fazer isso agora"), não uma
        // pergunta que precisa de confirmação como os excluir de verdade.
        toast.error('Este cartão possui compras vinculadas. Exclua as compras antes de remover o cartão.');
        return false;
      }
      if (pagamentosFatura.some((p) => p.cartaoId === cartao.id)) {
        toast.error('Este cartão possui pagamentos de fatura registrados e não pode ser removido.');
        return false;
      }

      return confirmarExclusao({
        titulo: 'Excluir cartão?',
        descricao: 'Este cartão será removido permanentemente.',
        acao: async () => {
          try {
            await deleteDoc(doc(db, 'cartoes', cartao.id));
            setCartoesBase((prev) => prev.filter((c) => c.id !== cartao.id));
            toast.success('Cartão excluído');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir cartão:', erro);
            toast.error('Não foi possível excluir o cartão.');
            return false;
          }
        },
      });
    },
    [comprasCartao, pagamentosFatura, confirmarExclusao]
  );

  // Permitido mesmo com fatura fechada/paga (pode ter sido lançamento errado), desde
  // que os pagamentos existentes continuem cabendo na dívida que sobrar. Se não
  // couberem, bloqueia ANTES de abrir qualquer confirmação (nada é alterado).
  const excluirCompra = useCallback(
    (compra) => {
      const validacao = validarAlteracaoCompras({ removerIds: [compra.id] });
      if (!validacao.ok) {
        toast.error(validacao.mensagem, { duration: 9000 });
        return false;
      }
      const regras = regrasCompra(compra);
      return confirmarExclusao({
        titulo: 'Excluir compra?',
        descricao: regras.aviso ?? 'A compra e as parcelas dela saem da fatura.',
        acao: async () => {
          try {
            await excluirCompraCartao(compra.id);
            setComprasCartao((prev) => prev.filter((c) => c.id !== compra.id));
            toast.success('Compra excluída');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir compra:', erro);
            toast.error('Não foi possível excluir a compra.');
            return false;
          }
        },
      });
    },
    [regrasCompra, validarAlteracaoCompras, confirmarExclusao]
  );

  const excluirVariasCompras = useCallback(
    (compras) => {
      const validacao = validarAlteracaoCompras({ removerIds: compras.map((c) => c.id) });
      if (!validacao.ok) {
        toast.error(validacao.mensagem, { duration: 9000 });
        return false;
      }
      const comHistorico = compras.filter((c) => regrasCompra(c).temHistorico).length;
      return confirmarExclusao({
        titulo: `Excluir ${compras.length} ${compras.length === 1 ? 'compra' : 'compras'}?`,
        descricao:
          comHistorico > 0
            ? `${comHistorico === 1 ? '1 delas já tem' : `${comHistorico} delas já têm`} parcela em fatura fechada ou paga — o total dessas faturas muda; os pagamentos já registrados não são alterados.`
            : 'As compras selecionadas e as parcelas delas saem das faturas.',
        acao: async () => {
          const idsCompras = new Set(compras.map((c) => c.id));
          try {
            await excluirComprasCartaoEmLote([...idsCompras]);
            setComprasCartao((prev) => prev.filter((c) => !idsCompras.has(c.id)));
            toast.success('Compras excluídas');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir compras em lote:', erro);
            toast.error('Não foi possível excluir as compras selecionadas.');
            return false;
          }
        },
      });
    },
    [regrasCompra, validarAlteracaoCompras, confirmarExclusao]
  );

  // Parcelas são derivadas da compra — basta trocar o documento.
  const handleCompraAtualizada = useCallback((compraAtualizada) => {
    setComprasCartao((prev) => prev.map((c) => (c.id === compraAtualizada.id ? compraAtualizada : c)));
  }, []);

  return {
    transacoes,
    metas,
    cartoes,
    comprasCartao,
    parcelasCartao,
    carregando,
    erroCarregamento,
    transacoesFiltradas,
    filtros: { dataInicio, dataFim, filtroCategoria, filtroTipo },
    setters: { setDataInicio, setDataFim, setFiltroCategoria, setFiltroTipo },
    limparFiltros,
    excluirTransacao,
    handleTransacaoSalva,
    handleMetaAtualizada,
    handleMetaSalva,
    handleMetaExcluida,
    excluirMeta,
    totalReservadoMetas,
    saldoFinanceiro,
    saldoDisponivel,
    entradasHero: caixa.entradas,
    saidasHero: caixa.saidas,
    resultadoMes: caixa.resultadoMes,
    transacoesRecentes: caixa.recentes,
    pagamentosFatura,
    handlePagamentoSalvo,
    regrasCompra,
    validarAlteracaoCompras,
    contextoPagamento,
    recorrencias: seriesRecorrentes,
    programadas,
    acoesProgramadas: {
      liquidar: liquidarObrigacao,
      corrigir: corrigirObrigacao,
      desfazer: desfazerObrigacao,
      adiar: adiarObrigacao,
      editar: editarObrigacao,
      cancelar: cancelarObrigacao,
      restaurar: restaurarObrigacao,
    },
    ocorrenciaDaTransacao,
    criarSerieRecorrente,
    editarSerieRecorrente,
    encerrarSerieRecorrente,
    excluirSerieRecorrente,
    podeExcluirSerieRecorrente,
    handleCartaoSalvo,
    handleCompraCriada,
    excluirCartao,
    excluirCompra,
    excluirVariasCompras,
    handleCompraAtualizada,
    confirmacao,
  };
}
