import React, { useState } from 'react';
import { toast } from 'sonner';
import AmountKeypad from './AmountKeypad';
import { guardarNaMeta, retirarDaMeta } from '../servicos/metas.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Guardar/retirar dinheiro de uma meta — nunca cria transação (nem despesa nem
// receita), só altera `valorReservado` da própria meta. Reaproveita o AmountKeypad
// de sempre tal como está; a validação de limite (saldo disponível / restante da
// meta) é feita aqui como mensagem inline, já que o AmountKeypad não conhece esses
// limites — "Continuar" dali vira o próprio confirmar.
const GoalAmountDialog = ({ meta, modo, saldoDisponivel, onFechar, onConcluido }) => {
  const [valorCentavos, setValorCentavos] = useState('0');
  const [salvando, setSalvando] = useState(false);

  const valorNumerico = Number(valorCentavos) / 100;
  const restanteMeta = meta.valorAlvo - meta.valorReservado;
  const maximoPermitido = modo === 'guardar' ? Math.max(0, Math.min(saldoDisponivel, restanteMeta)) : meta.valorReservado;
  const excedeLimite = valorNumerico > maximoPermitido;

  const confirmar = async () => {
    if (salvando || valorNumerico <= 0) return;
    if (excedeLimite) {
      toast.error(modo === 'guardar' ? 'Saldo disponível insuficiente.' : 'Valor maior que o reservado.');
      return;
    }

    setSalvando(true);
    try {
      const resultado =
        modo === 'guardar' ? await guardarNaMeta(meta, valorNumerico) : await retirarDaMeta(meta, valorNumerico);
      onConcluido(resultado);
      toast.success(modo === 'guardar' ? 'Valor guardado!' : 'Valor retirado!');
      onFechar();
    } catch (erro) {
      console.error('Erro ao atualizar meta:', erro);
      toast.error('Não foi possível concluir. Tente novamente.');
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-2">
      <AmountKeypad
        valorCentavos={valorCentavos}
        onChange={setValorCentavos}
        titulo={modo === 'guardar' ? `Guardar em ${meta.nome}` : `Retirar de ${meta.nome}`}
        onCancelar={onFechar}
        onContinuar={confirmar}
      />
      <p className="text-center text-sm text-foreground-secondary">
        {modo === 'guardar' ? 'Disponível' : 'Reservado'} {formatadorMoeda.format(maximoPermitido)}
      </p>
      {excedeLimite && valorNumerico > 0 && (
        <p className="text-center text-sm text-negative">
          {modo === 'guardar' ? 'Saldo disponível insuficiente.' : 'Valor maior que o reservado.'}
        </p>
      )}
    </div>
  );
};

export default GoalAmountDialog;
