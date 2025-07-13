import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, increment, where } from 'firebase/firestore';
import { db } from '../firebase/configuracao';
import Swal from 'sweetalert2';
import { PlusCircleIcon, PencilIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import confetti from 'canvas-confetti';
import { useAuth } from '../contexto/AuthContext.jsx';
import PainelBase from './PainelBase';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const MetaCard = ({ meta, onEditar, onExcluir, onAdicionarProgresso }) => {
  const isConcluida = meta.status === 'concluida';
  const isExpirada = meta.status === 'expirada';

  let progresso = meta.progresso || 0;
  let valorAtualFormatado = formatadorMoeda.format(meta.valorAtualCalculado || 0);
  let valorAlvoFormatado = formatadorMoeda.format(meta.valorAlvo || 0);
  let textoProgresso;
  let corBarra;
  const containerClasses = isExpirada ? 'opacity-60 grayscale' : '';

  switch (meta.tipo) {
    case 'GASTO_LIMITE':
      textoProgresso = `${valorAtualFormatado} gastos de ${valorAlvoFormatado}`;
      corBarra = isConcluida ? 'bg-red-600' : progresso > 80 ? 'bg-orange-500' : 'bg-teal-500';
      break;
    case 'SALDO_MES':
      textoProgresso = `Saldo de ${valorAtualFormatado} de ${valorAlvoFormatado}`;
      progresso = meta.valorAtualCalculado < 0 ? 0 : progresso;
      corBarra = isConcluida ? 'bg-green-500' : 'bg-sky-500';
      break;
    default:
      textoProgresso = `${valorAtualFormatado} de ${valorAlvoFormatado}`;
      corBarra = isConcluida ? 'bg-green-500' : 'bg-indigo-500';
      break;
  }

  if (isConcluida && meta.tipo !== 'GASTO_LIMITE') textoProgresso = `Meta Concluída!`;
  if (isExpirada) textoProgresso = `Prazo encerrado.`;

  return (
    <div className={`space-y-2 ${containerClasses}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {isConcluida && <CheckBadgeIcon className="h-6 w-6 text-green-500" />}
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{meta.nome}</h3>
        </div>
        <div className="flex space-x-2 items-center">
          {meta.tipo === 'ECONOMIA' && (
            <button
              onClick={() => onAdicionarProgresso(meta)}
              disabled={isConcluida || isExpirada}
              className="text-slate-400 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Adicionar Progresso"
            >
              <PlusCircleIcon className="h-6 w-6" />
            </button>
          )}
          <button
            onClick={() => onEditar(meta)}
            disabled={isConcluida || isExpirada}
            className="text-slate-400 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => onExcluir(meta.id)}
            className="text-slate-400 hover:text-red-600"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
        <div
          className={`${corBarra} h-2.5 rounded-full transition-all duration-500`}
          style={{ width: `${progresso > 100 ? 100 : progresso}%` }}
        />
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 text-right">{textoProgresso}</p>
    </div>
  );
};

const PainelMetas = ({ onNovaMetaClick, onSelecionarMetaParaEditar, transacoes }) => {
  const { usuario } = useAuth();
  const [metas, setMetas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    if (!usuario) return;

    const q = query(collection(db, "metas"), where("userId", "==", usuario.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setMetas(lista);
      setCarregando(false);
    });

    return () => unsubscribe();
  }, [usuario]);

  const metasComProgresso = useMemo(() => {
    if (!usuario || !transacoes) return [];

    return metas.map(meta => {
      let valorAtualCalculado = meta.valorAtual || 0;
      let status = 'ativa';

      switch (meta.tipo) {
        case 'GASTO_LIMITE':
          valorAtualCalculado = transacoes
            .filter(t => t.tipo === 'despesa' && t.categoria === meta.categoria && t.data.startsWith(meta.mes))
            .reduce((acc, t) => acc + t.valor, 0);
          break;
        case 'SALDO_MES':
          const receitas = transacoes.filter(t => t.tipo === 'receita' && t.data.startsWith(meta.mes)).reduce((acc, t) => acc + t.valor, 0);
          const despesas = transacoes.filter(t => t.tipo === 'despesa' && t.data.startsWith(meta.mes)).reduce((acc, t) => acc + t.valor, 0);
          valorAtualCalculado = receitas - despesas;
          break;
        default:
          break;
      }

      if (meta.valorAlvo > 0 && valorAtualCalculado >= meta.valorAlvo) status = 'concluida';
      else if (meta.dataFim && meta.dataFim.toDate() < new Date()) status = 'expirada';

      const progresso = meta.valorAlvo > 0 ? (valorAtualCalculado / meta.valorAlvo) * 100 : 0;
      return { ...meta, valorAtualCalculado, progresso, status };
    });
  }, [metas, transacoes, usuario]);

  const handleAdicionarProgresso = async (meta) => {
    const { value: valorFinal } = await Swal.fire({
      title: `Adicionar à meta "${meta.nome}"`,
      html: `<input id="swal-input-valor" class="swal2-input" placeholder="R$ 0,00">`,
      confirmButtonText: 'Adicionar',
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      didOpen: () => {
        const input = document.getElementById('swal-input-valor');
        input.focus();
        input.addEventListener('input', (e) => {
          const valor = e.target.value.replace(/\D/g, '');
          e.target.value = valor ? formatadorMoeda.format(Number(valor) / 100) : '';
        });
      },
      preConfirm: () => {
        const valorLimpo = document.getElementById('swal-input-valor').value.replace(/\D/g, '');
        const valorNumerico = Number(valorLimpo) / 100;
        if (!valorNumerico || valorNumerico <= 0) {
          Swal.showValidationMessage('Por favor, insira um valor positivo.');
          return false;
        }
        return valorNumerico;
      }
    });

    if (valorFinal) {
      try {
        await updateDoc(doc(db, 'metas', meta.id), { valorAtual: increment(valorFinal) });
        if (meta.valorAtualCalculado + valorFinal >= meta.valorAlvo) {
          Swal.fire({
            title: 'Parabéns!',
            text: `Você alcançou sua meta "${meta.nome}"!`,
            icon: 'success',
            didOpen: () => confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } })
          });
        } else {
          Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Progresso adicionado!', showConfirmButton: false, timer: 3000 });
        }
      } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Não foi possível atualizar a meta.', 'error');
      }
    }
  };

  const handleExcluirMeta = async (id) => {
    const confirmacao = await Swal.fire({
      title: 'Deseja excluir esta meta?',
      text: 'Esta ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });

    if (confirmacao.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'metas', id));
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Meta excluída!', showConfirmButton: false, timer: 3000 });
      } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Não foi possível remover a meta.', 'error');
      }
    }
  };

  return (
    <PainelBase
      titulo={
        <button onClick={() => setExpandido(!expandido)} className="flex items-center space-x-2 text-left">
          <span>Minhas Metas</span>
          {expandido ? <ChevronUpIcon className="h-5 w-5 text-slate-500" /> : <ChevronDownIcon className="h-5 w-5 text-slate-500" />}
        </button>
      }
      botaoAcao={
        <button
          onClick={onNovaMetaClick}
          className="cursor-pointer flex items-center space-x-2 text-sm bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700"
        >
          <PlusCircleIcon className="h-5 w-5 mx-auto" />
          <span className="cursor-pointer hidden sm:inline">Nova</span>
        </button>
      }
    >
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expandido ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="divide-y divide-slate-100 dark:divide-slate-700 p-4 space-y-3">
          {carregando && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">
              Carregando metas...
            </p>
          )}

          {!carregando && metasComProgresso.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">
              Você ainda não tem nenhuma meta. Que tal criar uma?
            </p>
          )}

          {metasComProgresso.map(meta => (
            <MetaCard
              key={meta.id}
              meta={meta}
              onEditar={onSelecionarMetaParaEditar}
              onExcluir={handleExcluirMeta}
              onAdicionarProgresso={handleAdicionarProgresso}
            />
          ))}
        </div>
      </div>
    </PainelBase>
  );
};

export default PainelMetas;
