import React, { useState } from 'react';
import { toast } from 'sonner';
import AmountKeypad from './AmountKeypad';
import RecurrenceDetails from './RecurrenceDetails';

// Mesmo padrão do TransactionFlow: teclado numérico → tela única de detalhes.
// Criação sempre chega com `tipoInicial` já definido (Home resolve isso com os
// botões Receita/Despesa) — não existe etapa de "escolher tipo" aqui. Edição pula
// o teclado e abre direto em 'detalhes', igual já fizemos pro TransactionFlow.
//
// O flow só coleta os dados: criar/editar/encerrar/excluir (e as confirmações) são do hook,
// que sabe o que acontece com as contas já geradas. Cada callback devolve true/false.
const RecurrenceFlow = ({ tipoInicial, recorrenciaParaEditar, onFechar, aoCriar, aoEditar, aoEncerrar, aoExcluir }) => {
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
    encerrando: false,
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
      descricao: estado.descricao.trim(),
      valor: Number(estado.valorCentavos) / 100,
      tipo: estado.tipo,
      categoria: estado.categoria,
      diaDoMes: Number(estado.diaDoMes),
    };

    try {
      const salvou = modoEdicao ? await aoEditar(recorrenciaParaEditar, dados) : await aoCriar(dados);
      if (salvou) onFechar();
      else atualizar({ salvando: false });
    } catch (erro) {
      console.error('Erro ao salvar recorrência:', erro);
      toast.error('Não foi possível salvar. Tente novamente.');
      atualizar({ salvando: false });
    }
  };

  // Excluir e encerrar passam pela confirmação do hook; `false` = cancelou ou foi recusado.
  const executarAcaoDaSerie = async (acao, chave) => {
    if (estado[chave]) return;
    atualizar({ [chave]: true });
    try {
      const concluiu = await acao(recorrenciaParaEditar);
      if (concluiu) onFechar();
      else atualizar({ [chave]: false });
    } catch (erro) {
      console.error('Erro na ação da recorrência:', erro);
      toast.error('Não foi possível concluir. Tente novamente.');
      atualizar({ [chave]: false });
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
      onExcluir={aoExcluir ? () => executarAcaoDaSerie(aoExcluir, 'excluindo') : undefined}
      encerrada={modoEdicao && recorrenciaParaEditar.ativa === false}
      encerrando={estado.encerrando}
      onEncerrar={aoEncerrar ? () => executarAcaoDaSerie(aoEncerrar, 'encerrando') : undefined}
    />
  );
};

export default RecurrenceFlow;
