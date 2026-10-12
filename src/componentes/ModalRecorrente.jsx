import React from 'react';
import FormularioRecorrente from './FormularioRecorrente';
import ModalBase from './ModalBase';

const ModalRecorrente = ({ aberto, aoFechar, recorrenciaParaEditar, onRecorrenciaSalva, tipoInicial }) => {
  return (
    <ModalBase
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Transação Recorrente"
      larguraMaxima="max-w-lg"
    >
      <FormularioRecorrente
        aoFinalizar={aoFechar}
        recorrenciaParaEditar={recorrenciaParaEditar}
        onRecorrenciaSalva={onRecorrenciaSalva}
        tipoInicial={tipoInicial}
      />
    </ModalBase>
  );
};

export default ModalRecorrente;
