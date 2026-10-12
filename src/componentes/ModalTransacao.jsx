import React from 'react';
import FormularioTransacao from './FormularioTransacao';
import ModalBase from './ModalBase';

const ModalTransacao = ({ aberto, aoFechar, transacaoParaEditar, onCancelarEdicao, onTransacaoSalva }) => {
  return (
    <ModalBase aberto={aberto} aoFechar={aoFechar}>
      <FormularioTransacao
        transacaoParaEditar={transacaoParaEditar}
        onCancelarEdicao={onCancelarEdicao || aoFechar}
        onTransacaoSalva={onTransacaoSalva}
      />
    </ModalBase>
  );
};

export default ModalTransacao;
