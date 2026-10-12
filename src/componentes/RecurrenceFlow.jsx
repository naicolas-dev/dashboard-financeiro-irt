import React, { useState } from 'react';
import { toast } from 'sonner';
import AmountKeypad from './AmountKeypad';
import RecurrenceDetails from './RecurrenceDetails';
import { criarRecorrencia, atualizarRecorrencia } from '../servicos/recorrencias.js';

// Mesmo padrão do TransactionFlow: teclado numérico → tela única de detalhes.
// Criação sempre chega com `tipoInicial` já definido (Home resolve isso com os
// botões Receita/Despesa) — não existe etapa de "escolher tipo" aqui. Edição pula
// o teclado e abre direto em 'detalhes', igual já fizemos pro TransactionFlow.
const RecurrenceFlow = ({ tipoInicial, recorrenciaParaEditar, onFechar, onRecorrenciaSalva, aoExcluir }) => {
  const modoEdicao = !!recorrenciaParaEditar;

  const [estado, setEstado] = useState(() => ({
    etapa: modoEdicao ? 'detalhes' : 'valor',
    tipo: modoEdicao ? recorrenciaParaEditar.tipo : tipoInicial,
    valorCentavos: modoEdicao ? String(Math.round(recorrenciaParaEditar.valor * 100)) : '0',
    categoria: modoEdicao ? recorrenciaParaEditar.categoria : '',
    descricao: modoEdicao ? recorrenciaParaEditar.descricao : '',
    diaDoMes: modoEdicao ? recorrenciaParaEditar.diaDoMes : 1,
    salvando: false,
    excluindo: false,
  }));

  const atualizar = (patch) => setEstado((prev) => ({ ...prev, ...patch }));

  // Sem etapa 'tipo' pra voltar: em edição, 'detalhes' é a única etapa (fecha sem
  // salvar); na criação, voltar de 'detalhes' retorna ao teclado, voltar/cancelar
  // do teclado fecha o fluxo.
  const voltar = () => {
    if (estado.etapa === 'detalhes' && !modoEdicao) {
      atualizar({ etapa: 'valor' });
      return;
    }
    onFechar();
  };

  const salvar = async () => {
    if (estado.salvando) return;
    atualizar({ salvando: true });

    const dados = {
      descricao: estado.descricao,
      valor: Number(estado.valorCentavos) / 100,
      tipo: estado.tipo,
      categoria: estado.categoria,
      diaDoMes: Number(estado.diaDoMes),
    };

    try {
      if (modoEdicao) {
        await atualizarRecorrencia(recorrenciaParaEditar.id, dados);
        onRecorrenciaSalva({ ...recorrenciaParaEditar, ...dados });
        toast.success('Recorrência atualizada!');
      } else {
        const criada = await criarRecorrencia(dados);
        onRecorrenciaSalva(criada);
        toast.success(estado.tipo === 'receita' ? 'Receita recorrente criada!' : 'Despesa recorrente criada!');
      }
      onFechar();
    } catch (erro) {
      console.error('Erro ao salvar recorrência:', erro);
      toast.error('Não foi possível salvar. Tente novamente.');
      atualizar({ salvando: false });
    }
  };

  const excluir = async () => {
    if (estado.excluindo) return;
    atualizar({ excluindo: true });
    try {
      const excluiu = await aoExcluir(recorrenciaParaEditar.id);
      if (excluiu) onFechar();
      else atualizar({ excluindo: false });
    } catch (erro) {
      console.error('Erro ao excluir recorrência:', erro);
      toast.error('Não foi possível excluir. Tente novamente.');
      atualizar({ excluindo: false });
    }
  };

  if (estado.etapa === 'valor') {
    return (
      <AmountKeypad
        valorCentavos={estado.valorCentavos}
        onChange={(v) => atualizar({ valorCentavos: v })}
        titulo={estado.tipo === 'receita' ? 'Receita recorrente' : 'Despesa recorrente'}
        onCancelar={voltar}
        onContinuar={() => atualizar({ etapa: 'detalhes' })}
      />
    );
  }

  return (
    <RecurrenceDetails
      categoria={estado.categoria}
      setCategoria={(v) => atualizar({ categoria: v })}
      descricao={estado.descricao}
      setDescricao={(v) => atualizar({ descricao: v })}
      diaDoMes={estado.diaDoMes}
      setDiaDoMes={(v) => atualizar({ diaDoMes: v })}
      tipo={estado.tipo}
      setTipo={(v) => atualizar({ tipo: v })}
      valorCentavos={estado.valorCentavos}
      setValorCentavos={(v) => atualizar({ valorCentavos: v })}
      salvando={estado.salvando}
      onVoltar={voltar}
      onSalvar={salvar}
      modoEdicao={modoEdicao}
      excluindo={estado.excluindo}
      onExcluir={aoExcluir ? excluir : undefined}
    />
  );
};

export default RecurrenceFlow;
