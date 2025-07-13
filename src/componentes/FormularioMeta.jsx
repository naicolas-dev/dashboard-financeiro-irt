import React, { useState, useEffect } from 'react';
import { db } from '../firebase/configuracao';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { useAuth } from '../contexto/AuthContext.jsx';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const tiposDeMeta = [
  { valor: 'ECONOMIA', texto: 'Economizar para um Objetivo' },
  { valor: 'GASTO_LIMITE', texto: 'Definir Limite de Gasto' },
  { valor: 'SALDO_MES', texto: 'Alcançar Saldo Mensal' },
];

const categoriasDisponiveis = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Outro'];

const FormularioMeta = ({ aoFinalizar, metaParaEditar }) => {
  const { usuario } = useAuth();

  const [tipo, setTipo] = useState(tiposDeMeta[0].valor);
  const [nome, setNome] = useState('');
  const [valorAlvo, setValorAlvo] = useState('');
  const [categoria, setCategoria] = useState(categoriasDisponiveis[0]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [dataFim, setDataFim] = useState('');
  const [semPrazo, setSemPrazo] = useState(true);

  const modoEdicao = !!metaParaEditar;

  useEffect(() => {
    if (modoEdicao) {
      setTipo(metaParaEditar.tipo);
      setNome(metaParaEditar.nome);
      setValorAlvo(String(metaParaEditar.valorAlvo * 100));

      if (metaParaEditar.tipo === 'GASTO_LIMITE') {
        setCategoria(metaParaEditar.categoria);
        setMes(metaParaEditar.mes);
      } else if (metaParaEditar.tipo === 'SALDO_MES') {
        setMes(metaParaEditar.mes);
      } else if (metaParaEditar.tipo === 'ECONOMIA') {
        if (metaParaEditar.dataFim) {
          setSemPrazo(false);
          setDataFim(metaParaEditar.dataFim.toDate().toISOString().slice(0, 10));
        } else {
          setSemPrazo(true);
          setDataFim('');
        }
      }
    } else {
      setTipo(tiposDeMeta[0].valor);
      setNome('');
      setValorAlvo('');
      setCategoria(categoriasDisponiveis[0]);
      setMes(new Date().toISOString().slice(0, 7));
      setDataFim('');
      setSemPrazo(true);
    }
  }, [metaParaEditar, modoEdicao]);

  const handleValorChange = (e) => {
    setValorAlvo(e.target.value.replace(/\D/g, ''));
  };

  const aoSubmeter = async (e) => {
    e.preventDefault();
    const valorAlvoNumerico = Number(valorAlvo) / 100;

    if (!usuario) {
      Swal.fire('Erro', 'Você precisa estar logado para criar ou editar uma meta.', 'error');
      return;
    }

    if (!nome || !valorAlvoNumerico || valorAlvoNumerico <= 0) {
      Swal.fire('Atenção', 'Preencha o nome e um valor alvo positivo.', 'warning');
      return;
    }

    let dadosMeta = {
      nome,
      tipo,
      valorAlvo: valorAlvoNumerico,
      userId: usuario.uid,
    };

    if (tipo === 'ECONOMIA') {
      dadosMeta.dataFim = semPrazo ? null : new Date(dataFim);
    } else if (tipo === 'GASTO_LIMITE') {
      dadosMeta.categoria = categoria;
      dadosMeta.mes = mes;
    } else if (tipo === 'SALDO_MES') {
      dadosMeta.mes = mes;
    }

    try {
      if (modoEdicao) {
        const metaDocRef = doc(db, 'metas', metaParaEditar.id);
        await updateDoc(metaDocRef, dadosMeta);
        Swal.fire({
          toast: true, position: 'top-end', icon: 'success',
          title: 'Sua meta foi atualizada!',
          showConfirmButton: false, timer: 3000,
        });
      } else {
        dadosMeta.valorAtual = 0;
        dadosMeta.dataCriacao = new Date();
        await addDoc(collection(db, 'metas'), dadosMeta);
        Swal.fire({
          toast: true, position: 'top-end', icon: 'success',
          title: 'Sua nova meta foi criada!',
          showConfirmButton: false, timer: 3000,
        });
      }
      aoFinalizar();
    } catch (error) {
      console.error("Erro ao salvar meta: ", error);
      Swal.fire('Erro', 'Não foi possível salvar a meta.', 'error');
    }
  };

  const inputStyle = 'w-full p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm';
  const labelStyle = "text-sm font-medium text-slate-600 dark:text-slate-200 mb-1 block";

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 p-4 pt-10 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <h2 className="text-lg font-bold text-slate-700 dark:text-white">{modoEdicao ? 'Editar Meta' : 'Criar Nova Meta'}</h2>
      
      <div>
        <label className={labelStyle}>Qual o tipo de meta?</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputStyle} disabled={modoEdicao}>
          {tiposDeMeta.map(t => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
        </select>
      </div>

      <div>
        <label className={labelStyle}>Dê um nome para a meta</label>
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Férias de Fim de Ano" className={inputStyle} />
      </div>

      {tipo === 'GASTO_LIMITE' && (
        <div>
          <label className={labelStyle}>Para qual categoria de gasto?</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputStyle}>
            {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {(tipo === 'GASTO_LIMITE' || tipo === 'SALDO_MES') && (
        <div>
          <label className={labelStyle}>Para qual mês?</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputStyle} />
        </div>
      )}

      <div>
        <label className={labelStyle}>
          {tipo === 'GASTO_LIMITE' ? 'Qual o limite de gasto?' : 'Qual o valor alvo?'}
        </label>
        <input
          type="text"
          value={!valorAlvo ? '' : formatadorMoeda.format(Number(valorAlvo) / 100)}
          onChange={handleValorChange}
          placeholder="R$ 0,00"
          className={inputStyle}
        />
      </div>

      {tipo === 'ECONOMIA' && (
        <>
          <div>
            <label className={labelStyle}>Prazo final (opcional)</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              disabled={semPrazo}
              className={`${inputStyle} ${semPrazo ? 'bg-slate-200 dark:bg-slate-600' : ''}`}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="semPrazo"
              checked={semPrazo}
              onChange={(e) => setSemPrazo(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="semPrazo" className="text-sm text-slate-600 dark:text-slate-300">Sem prazo definido</label>
          </div>
        </>
      )}

      <button type="submit" className=" cursor-pointer w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600">
        {modoEdicao ? 'Salvar Alterações' : 'Criar Meta'}
      </button>
    </form>
  );
};

export default FormularioMeta;
