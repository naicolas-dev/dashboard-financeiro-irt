import React from 'react';
import FormularioMeta from './FormularioMeta';
import ModalBase from './ModalBase';

const ModalMeta = ({ aberto, aoFechar, metaParaEditar }) => {
  return (
    <ModalBase aberto={aberto} aoFechar={aoFechar} titulo="Meta Financeira">
      <FormularioMeta 
        aoFinalizar={aoFechar} 
        metaParaEditar={metaParaEditar} 
      />
    </ModalBase>
  );
};

export default ModalMeta;
