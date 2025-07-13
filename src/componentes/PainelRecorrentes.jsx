import React, { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/configuracao';
import Swal from 'sweetalert2';
import { PlusCircleIcon, TrashIcon, PencilIcon, ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexto/AuthContext.jsx';
import PainelBase from './PainelBase';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const RecorrenteCard = ({ regra, onEditar, onExcluir }) => {
  const cor = regra.tipo === 'receita' ? 'text-green-600' : 'text-red-600';
  const corBg = regra.tipo === 'receita' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30';
  const vencimento = `Todo dia ${regra.diaDoMes}`;

  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-full ${corBg}`}>
          <ArrowPathIcon className={`h-5 w-5 ${cor}`} />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{regra.descricao}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{vencimento}</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <p className={`font-bold ${cor}`}>{formatadorMoeda.format(regra.valor)}</p>
        <div className="flex space-x-2">
          <button onClick={() => onEditar(regra)} className="text-slate-400 hover:text-indigo-600" title="Editar Regra">
            <PencilIcon className="h-5 w-5" />
          </button>
          <button onClick={() => onExcluir(regra.id)} className="text-slate-400 hover:text-red-600" title="Excluir Regra">
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const PainelRecorrentes = ({ onSelecionarParaEditar, onNovaRecorrenciaClick }) => {
  const { usuario } = useAuth();
  const [recorrencias, setRecorrencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    if (!usuario) return;

    const q = query(collection(db, 'transacoesRecorrentes'), where('userId', '==', usuario.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecorrencias(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setCarregando(false);
    });

    return () => unsubscribe();
  }, [usuario]);

  const handleExcluir = async (id) => {
    const confirmacao = await Swal.fire({
      title: 'Excluir esta regra?',
      text: 'As transações já criadas não serão afetadas, mas novas não serão geradas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });

    if (confirmacao.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'transacoesRecorrentes', id));
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Regra de recorrência removida!', timer: 3000, showConfirmButton: false });
      } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Não foi possível remover a regra.', 'error');
      }
    }
  };

  return (
    <PainelBase
      titulo={
        <button onClick={() => setExpandido(!expandido)} className="flex items-center space-x-2 text-left">
          <span>Transações Recorrentes</span>
          {expandido ? <ChevronUpIcon className="h-5 w-5 text-slate-500" /> : <ChevronDownIcon className="h-5 w-5 text-slate-500" />}
        </button>
      }
      botaoAcao={
        <button
          onClick={onNovaRecorrenciaClick}
          className="cursor-pointer flex items-center space-x-2 text-sm bg-teal-600 text-white px-3 py-1 rounded-md hover:bg-teal-700"
        >
          <PlusCircleIcon className="h-5 w-5 mx-auto" />
          <span className="cursor-pointer hidden sm:inline">Nova</span>
        </button>
      }
    >
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expandido ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="divide-y divide-slate-100 dark:divide-slate-700 p-4 space-y-3">
          {carregando && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">Carregando...</p>
          )}
          {!carregando && recorrencias.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">Nenhuma transação recorrente configurada.</p>
          )}
          {recorrencias.map(regra => (
            <RecorrenteCard
              key={regra.id}
              regra={regra}
              onEditar={onSelecionarParaEditar}
              onExcluir={handleExcluir}
            />
          ))}
        </div>
      </div>
    </PainelBase>
  );
};

export default PainelRecorrentes;
