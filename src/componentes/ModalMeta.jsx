import React from 'react';
import FormularioMeta from './FormularioMeta';
import ModalBase from './ModalBase';

const ModalMeta = ({ aberto, aoFechar, metaParaEditar, onMetaSalva }) => {
  return (
    <ModalBase aberto={aberto} aoFechar={aoFechar} titulo="Meta Financeira">
      <FormularioMeta
        aoFinalizar={aoFechar}
        metaParaEditar={metaParaEditar}
        onMetaSalva={onMetaSalva}
      />
    </ModalBase>
  );
};

export default ModalMeta;
