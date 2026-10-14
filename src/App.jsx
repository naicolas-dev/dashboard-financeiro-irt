import React, { useState } from 'react';
import { useAuth } from './contexto/AuthContext.jsx';
import { useDadosFinanceiros } from './hooks/useDadosFinanceiros.js';
import Login from './componentes/Login.jsx';
import AppShell from './componentes/AppShell.jsx';
import Home from './paginas/Home.jsx';
import Movimentacoes from './paginas/Movimentacoes.jsx';
import Cartoes from './paginas/Cartoes.jsx';
import Metas from './paginas/Metas.jsx';

function App() {
  const { usuario } = useAuth();
  const dados = useDadosFinanceiros(usuario);
  // Mora aqui (não no AppShell) porque a Home precisa poder navegar pra Cartões pelo
  // QuickAction do Hero — um componente de dados chamando algo que só o chrome da
  // aplicação saberia fazer.
  const [activeSection, setActiveSection] = useState('inicio');

  if (!usuario) {
    return <Login />;
  }

  const home = (
    <Home
      saldoFinanceiro={dados.saldoFinanceiro}
      entradas={dados.entradasHero}
      saidas={dados.saidasHero}
      resultadoMes={dados.resultadoMes}
      transacoesRecentes={dados.transacoesRecentes}
      carregando={dados.carregando}
      erroCarregamento={dados.erroCarregamento}
      handleTransacaoSalva={dados.handleTransacaoSalva}
      recorrencias={dados.recorrencias}
      programadas={dados.programadas}
      acoesProgramadas={dados.acoesProgramadas}
      criarSerieRecorrente={dados.criarSerieRecorrente}
      editarSerieRecorrente={dados.editarSerieRecorrente}
      encerrarSerieRecorrente={dados.encerrarSerieRecorrente}
      excluirSerieRecorrente={dados.excluirSerieRecorrente}
      podeExcluirSerieRecorrente={dados.podeExcluirSerieRecorrente}
      cartoes={dados.cartoes}
      handleCartaoSalvo={dados.handleCartaoSalvo}
      handleCompraCriada={dados.handleCompraCriada}
      metas={dados.metas}
      onAbrirCartoes={() => setActiveSection('cartoes')}
      onAbrirMetas={() => setActiveSection('metas')}
    />
  );

  const movimentacoes = (
    <Movimentacoes
      transacoes={dados.transacoes}
      transacoesFiltradas={dados.transacoesFiltradas}
      filtros={dados.filtros}
      setters={dados.setters}
      limparFiltros={dados.limparFiltros}
      carregando={dados.carregando}
      erroCarregamento={dados.erroCarregamento}
      excluirTransacao={dados.excluirTransacao}
      handleTransacaoSalva={dados.handleTransacaoSalva}
      acoesProgramadas={dados.acoesProgramadas}
      ocorrenciaDaTransacao={dados.ocorrenciaDaTransacao}
      programadas={dados.programadas}
      cartoes={dados.cartoes}
      saldoFinanceiro={dados.saldoFinanceiro}
      saldoDisponivel={dados.saldoDisponivel}
      handlePagamentoSalvo={dados.handlePagamentoSalvo}
      contextoPagamento={dados.contextoPagamento}
    />
  );

  const cartoesPagina = (
    <Cartoes
      cartoes={dados.cartoes}
      comprasCartao={dados.comprasCartao}
      pagamentosFatura={dados.pagamentosFatura}
      saldoFinanceiro={dados.saldoFinanceiro}
      saldoDisponivel={dados.saldoDisponivel}
      carregando={dados.carregando}
      erroCarregamento={dados.erroCarregamento}
      handleCartaoSalvo={dados.handleCartaoSalvo}
      handleCompraCriada={dados.handleCompraCriada}
      handlePagamentoSalvo={dados.handlePagamentoSalvo}
      excluirCartao={dados.excluirCartao}
      excluirCompra={dados.excluirCompra}
      excluirVariasCompras={dados.excluirVariasCompras}
      excluirTransacao={dados.excluirTransacao}
      handleCompraAtualizada={dados.handleCompraAtualizada}
      regrasCompra={dados.regrasCompra}
      validarAlteracaoCompras={dados.validarAlteracaoCompras}
      contextoPagamento={dados.contextoPagamento}
    />
  );

  const metasPagina = (
    <Metas
      metas={dados.metas}
      carregando={dados.carregando}
      erroCarregamento={dados.erroCarregamento}
      saldoDisponivel={dados.saldoDisponivel}
      totalReservadoMetas={dados.totalReservadoMetas}
      handleMetaSalva={dados.handleMetaSalva}
      handleMetaAtualizada={dados.handleMetaAtualizada}
      excluirMeta={dados.excluirMeta}
    />
  );

  return (
    <AppShell
      home={home}
      movimentacoes={movimentacoes}
      cartoes={cartoesPagina}
      metas={metasPagina}
      activeSection={activeSection}
      onNavegar={setActiveSection}
      confirmacao={dados.confirmacao}
    />
  );
}

export default App;
