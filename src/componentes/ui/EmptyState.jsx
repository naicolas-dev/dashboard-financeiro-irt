import React from 'react';
import { EmptyState as ChakraEmptyState } from '@chakra-ui/react';
import Button from './Button';

// API externa preservada 1:1 (icone/titulo/descricao/textoAcao/onAcao) — só o
// miolo trocou pra estrutura do Chakra (Root > Content > Indicator/Title/
// Description), nenhuma página que já usa este componente precisa mudar.
const EmptyState = ({ icone: Icone, titulo, descricao, textoAcao, onAcao }) => (
  <ChakraEmptyState.Root size="md" className="py-10 px-6">
    <ChakraEmptyState.Content className="gap-3">
      {Icone && (
        <ChakraEmptyState.Indicator className="h-12 w-12 rounded-full bg-surface-hover flex items-center justify-center text-foreground-muted">
          <Icone className="h-6 w-6" />
        </ChakraEmptyState.Indicator>
      )}
      <div className="space-y-1 text-center">
        <ChakraEmptyState.Title className="font-semibold text-foreground">{titulo}</ChakraEmptyState.Title>
        {descricao && (
          <ChakraEmptyState.Description className="text-sm text-foreground-secondary max-w-xs">
            {descricao}
          </ChakraEmptyState.Description>
        )}
      </div>
      {textoAcao && onAcao && (
        <Button variant="secondary" size="md" onClick={onAcao} className="mt-1">
          {textoAcao}
        </Button>
      )}
    </ChakraEmptyState.Content>
  </ChakraEmptyState.Root>
);

export default EmptyState;
