import React from 'react';
import ResponsiveDialog from './ResponsiveDialog.jsx';
import Button from './Button.jsx';

// Genérico de propósito — nenhuma noção de transação/cartão/meta aqui dentro.
// Cada domínio só fornece título/descrição/handler; infraestrutura (abrir/travar
// durante loading/resolver a Promise) mora em `confirmarExclusao`, no hook.
const ConfirmDialog = ({
  aberto,
  titulo,
  descricao,
  textoConfirmar = 'Excluir',
  textoCancelar = 'Cancelar',
  carregando = false,
  onConfirmar,
  onCancelar,
}) => (
  <ResponsiveDialog aberto={aberto} aoFechar={carregando ? () => {} : onCancelar} titulo={titulo}>
    <div className="space-y-5">
      {descricao && <p className="text-sm text-foreground-muted">{descricao}</p>}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
        <Button variant="secondary" className="w-full sm:w-auto" disabled={carregando} onClick={onCancelar}>
          {textoCancelar}
        </Button>
        <Button variant="destructive" className="w-full sm:w-auto" carregando={carregando} onClick={onConfirmar}>
          {textoConfirmar}
        </Button>
      </div>
    </div>
  </ResponsiveDialog>
);

export default ConfirmDialog;
