import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../contexto/AuthContext.jsx';
import { criarTransacao, atualizarTransacao } from '../servicos/transacoes.js';
import { CATEGORIAS_TRANSACAO } from '../constantes/categorias.js';
import { obterDataHoraLocal } from '../utils/datas.js';

const categoriasDisponiveis = CATEGORIAS_TRANSACAO;
const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const FormularioTransacao = ({ transacaoParaEditar, onCancelarEdicao, onTransacaoSalva }) => {
  const { usuario } = useAuth();
  const modoEdicao = !!transacaoParaEditar;

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('despesa');
  const [categoria, setCategoria] = useState(categoriasDisponiveis[0]);
  const [data, setData] = useState(obterDataHoraLocal());

  useEffect(() => {
    if (modoEdicao) {
      setDescricao(transacaoParaEditar.descricao);
      setValor(String(transacaoParaEditar.valor * 100));
      setTipo(transacaoParaEditar.tipo);
      setCategoria(transacaoParaEditar.categoria);
      setData(transacaoParaEditar.data?.slice(0, 16) || obterDataHoraLocal());
    } else {
      setDescricao('');
      setValor('');
      setTipo('despesa');
      setCategoria(categoriasDisponiveis[0]);
      setData(obterDataHoraLocal());
    }
  }, [modoEdicao, transacaoParaEditar]);

  const handleValorChange = (e) => {
    setValor(e.target.value.replace(/\D/g, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const valorNumerico = Number(valor) / 100;

    if (!usuario) {
      Swal.fire('Erro', 'Você precisa estar logado para esta ação.', 'error');
      return;
    }

    if (!descricao || valorNumerico <= 0) {
      Swal.fire('Atenção', 'Preencha todos os campos com valores válidos.', 'warning');
      return;
    }

    const dadosTransacao = {
      descricao,
      valor: valorNumerico,
      tipo,
      categoria,
      data,
    };

    try {
      if (modoEdicao) {
        const salva = await atualizarTransacao(transacaoParaEditar.id, dadosTransacao);
        onTransacaoSalva?.(salva);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Transação atualizada!', showConfirmButton: false, timer: 3000 });
        onCancelarEdicao();
      } else {
        const salva = await criarTransacao(dadosTransacao);
        onTransacaoSalva?.(salva);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Transação adicionada!', showConfirmButton: false, timer: 3000 });
        setDescricao('');
        setValor('');
        setTipo('despesa');
        setCategoria(categoriasDisponiveis[0]);
        setData(obterDataHoraLocal());
        if (onCancelarEdicao) onCancelarEdicao();
      }
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      Swal.fire('Erro', 'Não foi possível salvar a transação.', 'error');
    }
  };

  const inputStyle = 'w-full p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm';
  const labelStyle = 'text-sm font-medium text-slate-600 dark:text-slate-200 mb-1 block';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-10 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <h2 className="text-lg font-bold text-slate-700 dark:text-white">
        {modoEdicao ? 'Editar Transação' : 'Novo Lançamento'}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelStyle}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputStyle}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </div>

        <div>
          <label className={labelStyle}>Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputStyle}>
            {categoriasDisponiveis.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelStyle}>Descrição</label>
          <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Compras do mercado" className={inputStyle} />
        </div>

        <div>
          <label className={labelStyle}>Valor (R$)</label>
          <input type="text" value={!valor ? '' : formatadorMoeda.format(Number(valor) / 100)} onChange={handleValorChange} placeholder="R$ 0,00" className={inputStyle} />
        </div>

        <div>
          <label className={labelStyle}>Data e Hora</label>
          <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} className={inputStyle} />
        </div>
      </div>

      <div className="pt-2 space-y-2">
        <button type="submit" className="cursor-pointer w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors">
          {modoEdicao ? 'Salvar Alterações' : 'Adicionar'}
        </button>
        {modoEdicao && (
          <button type="button" onClick={onCancelarEdicao} className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-center">
            Cancelar Edição
          </button>
        )}
      </div>
    </form>
  );
};

export default FormularioTransacao;
