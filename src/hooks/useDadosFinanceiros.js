import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, orderBy, where, getDocs, doc, deleteDoc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase/configuracao';
import { buscarParcelasDeCartao, excluirCompraComParcelas, excluirComprasComParcelasEmLote } from '../servicos/cartoes.js';

const MESES_DE_HISTORICO_PADRAO = 12;

function inicioPadrao() {
  const data = new Date();
  data.setMonth(data.getMonth() - MESES_DE_HISTORICO_PADRAO);
  data.setHours(0, 0, 0, 0);
  return data;
}

function ordenarPorDataDesc(lista) {
  return [...lista].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
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

async function buscarTransacoesEntre(inicio, fim) {
  const q = query(
    collection(db, 'transacoes'),
    where('data', '>=', inicio.toISOString()),
    where('data', '<=', fim.toISOString()),
    orderBy('data', 'desc')
  );
  const snapshot = await getDocs(q);
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
  const [transacoes, setTransacoes] = useState([]);
  const [metas, setMetas] = useState([]);
  const [recorrencias, setRecorrencias] = useState([]);
  const [cartoesBase, setCartoesBase] = useState([]);
  const [comprasCartao, setComprasCartao] = useState([]);
  const [parcelasCartao, setParcelasCartao] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const recorrenciasProcessadas = useRef(false);
  const janelaInicioRef = useRef(null);

  useEffect(() => {
    if (!usuario) {
      setTransacoes([]);
      setMetas([]);
      setRecorrencias([]);
      setCartoesBase([]);
      setComprasCartao([]);
      setParcelasCartao([]);
      setCarregando(false);
      return;
    }

    let ativo = true;

    const carregarDadosIniciais = async () => {
      setCarregando(true);
      try {
        const inicio = inicioPadrao();
        janelaInicioRef.current = inicio;
        const fim = new Date();
        fim.setDate(fim.getDate() + 1);

        const [transacoesCarregadas, metasCarregadas, recorrenciasCarregadas, cartoesCarregados, comprasCartaoCarregadas, parcelasCartaoCarregadas] =
          await Promise.all([
            buscarTransacoesEntre(inicio, fim),
            buscarTodos('metas'),
            buscarTodos('transacoesRecorrentes'),
            buscarTodos('cartoes'),
            buscarTodos('comprasCartao'),
            buscarParcelasDeCartao(),
          ]);

        let transacoesFinais = transacoesCarregadas;
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
        setParcelasCartao(parcelasCartaoCarregadas);
      } catch (erro) {
        console.error('Erro ao carregar os dados financeiros:', erro);
        toast.error('Não foi possível carregar seus dados.');
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregarDadosIniciais();
    return () => {
      ativo = false;
    };
  }, [usuario]);

  // Se o usuário escolher manualmente uma data anterior à janela já carregada,
  // busca só o intervalo que falta e mescla no estado (sem refazer tudo).
  useEffect(() => {
    if (!usuario || !dataInicio || !janelaInicioRef.current) return;

    const inicioDesejado = new Date(dataInicio);
    if (inicioDesejado >= janelaInicioRef.current) return;

    const fimDoIntervaloFaltante = new Date(janelaInicioRef.current);
    fimDoIntervaloFaltante.setDate(fimDoIntervaloFaltante.getDate() - 1);

    buscarTransacoesEntre(inicioDesejado, fimDoIntervaloFaltante)
      .then((novasTransacoes) => {
        if (novasTransacoes.length === 0) return;
        setTransacoes((prev) => ordenarPorDataDesc([...prev, ...novasTransacoes]));
      })
      .catch((erro) => console.error('Erro ao carregar período adicional:', erro));

    janelaInicioRef.current = inicioDesejado;
  }, [usuario, dataInicio]);

  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter((t) => {
      const dataTransacao = new Date(t.data);
      const dataFimAjustada = dataFim ? new Date(dataFim) : null;
      if (dataFimAjustada) dataFimAjustada.setHours(23, 59, 59, 999);
      const passaFiltroData = (!dataInicio || dataTransacao >= new Date(dataInicio)) && (!dataFimAjustada || dataTransacao <= dataFimAjustada);
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

  const excluirTransacao = useCallback(
    (id) =>
      confirmarExclusao({
        titulo: 'Excluir transação?',
        descricao: 'Esta transação será removida permanentemente.',
        acao: async () => {
          try {
            await deleteDoc(doc(db, 'transacoes', id));
            setTransacoes((prev) => prev.filter((t) => t.id !== id));
            toast.success('Transação excluída');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir:', erro);
            toast.error('Não foi possível excluir a transação.');
            return false;
          }
        },
      }),
    [confirmarExclusao]
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

  // Mesma fórmula do `resumo.saldo` calculado em Home.jsx (receitas - despesas da
  // janela de 12 meses). Duplicada aqui de propósito — não extraída pra um util
  // compartilhado nem usada pra substituir o cálculo da Home, pra não expandir esta
  // tarefa (Metas) pra uma refatoração do hook/Home. Se um dia virar fonte única,
  // os dois lugares precisam ficar sincronizados.
  const saldoFinanceiro = useMemo(() => {
    const receitas = transacoes.filter((t) => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
    const despesas = transacoes.filter((t) => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0);
    return receitas - despesas;
  }, [transacoes]);

  const totalReservadoMetas = useMemo(() => metas.reduce((acc, m) => acc + (m.valorReservado || 0), 0), [metas]);

  const saldoDisponivel = saldoFinanceiro - totalReservadoMetas;

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

  // Comprometido = soma de `valorTotal` das compras do cartão (não das parcelas
  // individuais) — nada reduz esse valor ainda (sem pagamento/liberação de fatura
  // neste slice, por decisão consciente: ver seção "Limite" da spec de Cartões).
  const comprometidoPorCartao = useMemo(() => {
    const mapa = {};
    for (const compra of comprasCartao) {
      mapa[compra.cartaoId] = (mapa[compra.cartaoId] || 0) + compra.valorTotal;
    }
    return mapa;
  }, [comprasCartao]);

  const cartoes = useMemo(
    () =>
      cartoesBase.map((cartao) => ({
        ...cartao,
        limiteDisponivel: cartao.limiteTotal - (comprometidoPorCartao[cartao.id] || 0),
      })),
    [cartoesBase, comprometidoPorCartao]
  );

  const handleCartaoSalvo = useCallback((cartaoSalvo) => {
    setCartoesBase((prev) => {
      const existe = prev.some((c) => c.id === cartaoSalvo.id);
      return existe ? prev.map((c) => (c.id === cartaoSalvo.id ? cartaoSalvo : c)) : [...prev, cartaoSalvo];
    });
  }, []);

  // `parcelasCartao` nunca é recortado por data (fatura/extrato de cartão não podem
  // perder parcelas futuras/antigas); `transacoes` continua só "caixa realizado" —
  // só entram aí as parcelas que já caberiam na janela de 12 meses de qualquer forma.
  const handleCompraCriada = useCallback((compra, parcelas) => {
    setComprasCartao((prev) => [...prev, compra]);
    setParcelasCartao((prev) => [...prev, ...parcelas]);

    const limiteJanela = new Date();
    limiteJanela.setDate(limiteJanela.getDate() + 1);
    const parcelasNaJanela = parcelas.filter((p) => new Date(p.data) <= limiteJanela);
    if (parcelasNaJanela.length > 0) {
      setTransacoes((prev) => ordenarPorDataDesc([...prev, ...parcelasNaJanela]));
    }
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
    [comprasCartao, confirmarExclusao]
  );

  const excluirCompra = useCallback(
    (compra) =>
      confirmarExclusao({
        titulo: 'Excluir compra?',
        descricao: 'A compra e todas as parcelas vinculadas serão removidas.',
        acao: async () => {
          const parcelaIds = parcelasCartao.filter((p) => p.compraCartaoId === compra.id).map((p) => p.id);

          try {
            await excluirCompraComParcelas(compra.id, parcelaIds);
            setComprasCartao((prev) => prev.filter((c) => c.id !== compra.id));
            const idsRemovidos = new Set(parcelaIds);
            setParcelasCartao((prev) => prev.filter((p) => !idsRemovidos.has(p.id)));
            setTransacoes((prev) => prev.filter((t) => !idsRemovidos.has(t.id)));
            toast.success('Compra excluída');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir compra:', erro);
            toast.error('Não foi possível excluir a compra.');
            return false;
          }
        },
      }),
    [parcelasCartao, confirmarExclusao]
  );

  const excluirVariasCompras = useCallback(
    (compras) =>
      confirmarExclusao({
        titulo: `Excluir ${compras.length} ${compras.length === 1 ? 'compra' : 'compras'}?`,
        descricao: 'Todas as compras selecionadas e suas parcelas vinculadas serão removidas.',
        acao: async () => {
          const compraIds = compras.map((c) => c.id);
          const idsCompras = new Set(compraIds);
          const parcelaIds = parcelasCartao.filter((p) => idsCompras.has(p.compraCartaoId)).map((p) => p.id);

          try {
            await excluirComprasComParcelasEmLote(compraIds, parcelaIds);
            setComprasCartao((prev) => prev.filter((c) => !idsCompras.has(c.id)));
            const idsParcelas = new Set(parcelaIds);
            setParcelasCartao((prev) => prev.filter((p) => !idsParcelas.has(p.id)));
            setTransacoes((prev) => prev.filter((t) => !idsParcelas.has(t.id)));
            toast.success('Compras excluídas');
            return true;
          } catch (erro) {
            console.error('Erro ao excluir compras em lote:', erro);
            toast.error('Não foi possível excluir as compras selecionadas.');
            return false;
          }
        },
      }),
    [parcelasCartao, confirmarExclusao]
  );

  // Sincroniza o resultado de `atualizarCompraCartao`: se reestruturou (veio
  // `parcelasNovas`), troca as parcelas antigas pelas novas em `parcelasCartao` (sem
  // recorte) e em `transacoes` (só as que já caberiam na janela de 12 meses, mesmo
  // critério de sempre). Se foi só descrição/categoria, atualiza só esses campos nas
  // parcelas existentes, sem tocar em `data`/`competencia`/`valor`.
  const handleCompraAtualizada = useCallback((resultado) => {
    setComprasCartao((prev) => prev.map((c) => (c.id === resultado.compra.id ? resultado.compra : c)));

    if (resultado.parcelasNovas) {
      const idsRemovidos = new Set(resultado.parcelasRemovidasIds);
      setParcelasCartao((prev) => [...prev.filter((p) => !idsRemovidos.has(p.id)), ...resultado.parcelasNovas]);

      const limiteJanela = new Date();
      limiteJanela.setDate(limiteJanela.getDate() + 1);
      const novasNaJanela = resultado.parcelasNovas.filter((p) => new Date(p.data) <= limiteJanela);
      setTransacoes((prev) => ordenarPorDataDesc([...prev.filter((t) => !idsRemovidos.has(t.id)), ...novasNaJanela]));
    } else {
      const { descricao, categoria } = resultado.compra;
      setParcelasCartao((prev) =>
        prev.map((p) => (p.compraCartaoId === resultado.compra.id ? { ...p, descricao, categoria } : p))
      );
      setTransacoes((prev) =>
        prev.map((t) => (t.compraCartaoId === resultado.compra.id ? { ...t, descricao, categoria } : t))
      );
    }
  }, []);

  return {
    transacoes,
    metas,
    recorrencias,
    cartoes,
    comprasCartao,
    parcelasCartao,
    carregando,
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
    saldoDisponivel,
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
