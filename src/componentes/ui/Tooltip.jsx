import React from 'react';
import { Tooltip as ChakraTooltip, Portal } from '@chakra-ui/react';

// Wrapper fino — só chama Tooltip.Root/Trigger/Positioner/Content por dentro,
// estilizado com os tokens do projeto (ponte em src/tema/chakraSystem.js), nunca
// cinza/azul default do Chakra. `content` vazio não renderiza tooltip nenhum
// (ex.: IconButton sem aria-label em dev, embora isso já devesse ter sido avisado
// pelo próprio console.warn do IconButton).
const Tooltip = ({ content, children }) => {
  if (!content) return children;

  return (
    <ChakraTooltip.Root openDelay={300} closeDelay={100}>
      <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content
            bg="app.surfaceRaised"
            color="app.fg"
            borderWidth="1px"
            borderColor="app.border"
            borderRadius="md"
            fontSize="xs"
            fontWeight="medium"
            px="2.5"
            py="1.5"
            boxShadow="md"
          >
            {content}
          </ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
};

export default Tooltip;
