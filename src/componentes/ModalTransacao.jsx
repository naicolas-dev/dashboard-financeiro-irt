import React from 'react';
import FormularioTransacao from './FormularioTransacao';
import ModalBase from './ModalBase';

const ModalTransacao = ({ aberto, aoFechar, transacaoParaEditar, onCancelarEdicao }) => {
  return (
    <ModalBase aberto={aberto} aoFechar={aoFechar}>
      <FormularioTransacao
        transacaoParaEditar={transacaoParaEditar}
        onCancelarEdicao={onCancelarEdicao || aoFechar}
      />
    </ModalBase>
  );
};

export default ModalTransacao;
