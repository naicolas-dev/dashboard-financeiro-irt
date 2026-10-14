import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
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

const QUANTIDADE_DE_RECENTES = 5;

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

// Cria as transações do mês ainda não geradas para as regras recorrentes ativas,
// reaproveitando a lista de regras já carregada (sem disparar uma segunda query).
async function processarRecorrenciasDevidas(recorrencias) {
  const hoje = new Date();
  const novasTransacoes = [];
  const recorrenciasAtualizadas = recorrencias.map((r) => ({ ...r }));

  for (let i = 0; i < recorrenciasAtualizadas.length; i++) {
    const regra = recorrenciasAtualizadas[i];
    if (!regra.ativa) continue;

    const ultimoRegistro = regra.ultimoRegistro ? regra.ultimoRegistro.toDate() : null;
    let deveCriar = false;

    if (!ultimoRegistro) {
      if (hoje.getDate() >= regra.diaDoMes) deveCriar = true;
    } else {
      const noMesmoMes = hoje.getMonth() === ultimoRegistro.getMonth() && hoje.getFullYear() === ultimoRegistro.getFullYear();
      if (!noMesmoMes && hoje.getDate() >= regra.diaDoMes) deveCriar = true;
    }

    if (!deveCriar) continue;

    const dataDaTransacao = new Date(hoje.getFullYear(), hoje.getMonth(), regra.diaDoMes);
    const novaTransacao = {
      descricao: `${regra.descricao} (Recorrente)`,
      valor: regra.valor,
      tipo: regra.tipo,
      categoria: regra.categoria,
      data: dataDaTransacao.toISOString(),
    };

    const docRef = await addDoc(collection(db, 'transacoes'), novaTransacao);
    const agora = new Date();
    await updateDoc(doc(db, 'transacoesRecorrentes', regra.id), { ultimoRegistro: agora });

    novasTransacoes.push({ id: docRef.id, ...novaTransacao });
    recorrenciasAtualizadas[i] = { ...regra, ultimoRegistro: Timestamp.fromDate(agora) };
  }

  return { novasTransacoes, recorrenciasAtualizadas };
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

  const recorrenciasProcessadas = useRef(false);

  useEffect(() => {
    if (!usuario) {
      setTransacoes([]);
      setMetas([]);
      setRecorrencias([]);
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
        const [todasAsTransacoes, metasCarregadas, recorrenciasCarregadas, cartoesCarregados, comprasCartaoCarregadas, pagamentosCarregados] =
          await Promise.all([
            buscarTodasTransacoes(),
            buscarTodos('metas'),
            buscarTodos('transacoesRecorrentes'),
            buscarTodos('cartoes'),
            buscarTodos('comprasCartao'),
            buscarPagamentosDeFatura(),
          ]);

        let transacoesFinais = todasAsTransacoes;
        let recorrenciasFinais = recorrenciasCarregadas;

        if (!recorrenciasProcessadas.current) {
          const resultado = await processarRecorrenciasDevidas(recorrenciasCarregadas);
          if (resultado.novasTransacoes.length > 0) {
            transacoesFinais = [...resultado.novasTransacoes, ...transacoesFinais];
          }
          recorrenciasFinais = resultado.recorrenciasAtualizadas;
          recorrenciasProcessadas.current = true;
        }

        if (!ativo) return;
        setTransacoes(ordenarPorDataDesc(transacoesFinais));
        setMetas(metasCarregadas.map(normalizarMeta));
        setRecorrencias(recorrenciasFinais);
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

  // Pagamento de fatura também é uma transação (a saída de caixa real): excluir
  // devolve o valor ao saldo e a dívida volta a aparecer — tudo por derivação.
  const excluirTransacao = useCallback(
    (id) => {
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
    [confirmarExclusao, pagamentosFatura]
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

  const handleRecorrenciaSalva = useCallback((recorrenciaSalva) => {
    setRecorrencias((prev) => {
      const existe = prev.some((r) => r.id === recorrenciaSalva.id);
      return existe ? prev.map((r) => (r.id === recorrenciaSalva.id ? recorrenciaSalva : r)) : [...prev, recorrenciaSalva];
    });
  }, []);

  const handleRecorrenciaExcluida = useCallback((id) => {
    setRecorrencias((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Mesmo padrão de `excluirTransacao`: confirmação + delete + sincroniza o estado
  // local + toast, tudo centralizado aqui (antes essa lógica vivia duplicada dentro
  // de PainelRecorrentes.jsx).
  const excluirRecorrencia = useCallback(
    (id) =>
      confirmarExclusao({
        titulo: 'Excluir recorrência?',
        descricao: 'Esta recorrência será removida permanentemente.',
        acao: async () => {
          try {
            await deleteDoc(doc(db, 'transacoesRecorrentes', id));
            setRecorrencias((prev) => prev.filter((r) => r.id !== id));
            toast.success('Recorrência removida');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir recorrência:', erro);
            toast.error('Não foi possível remover a regra.');
            return false;
          }
        },
      }),
    [confirmarExclusao]
  );

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
    recorrencias,
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
    handleRecorrenciaSalva,
    handleRecorrenciaExcluida,
    excluirRecorrencia,
    handleCartaoSalvo,
    handleCompraCriada,
    excluirCartao,
    excluirCompra,
    excluirVariasCompras,
    handleCompraAtualizada,
    confirmacao,
  };
}
