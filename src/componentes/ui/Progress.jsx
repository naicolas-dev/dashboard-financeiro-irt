import React from 'react';
import { Progress as ChakraProgress } from '@chakra-ui/react';

// Wrapper fino — só dá a estrutura acessível (role="progressbar" com min/max/now
// via Progress.Root/Track/Range). A cor do preenchimento continua 100% decidida
// por quem chama (`corClasse`, uma classe Tailwind já calculada com a semântica
// real: disponível/warning/crítico em CreditCardTile, neutro/positive em
// GoalCard) — o recipe padrão do Chakra nunca entra na decisão de cor aqui.
const Progress = ({ percentual, corClasse = 'bg-foreground', trackClasse = 'bg-surface-active', alturaClasse = 'h-2' }) => (
  <ChakraProgress.Root value={percentual} min={0} max={100} className="w-full">
    <ChakraProgress.Track className={`${alturaClasse} rounded-full overflow-hidden ${trackClasse}`}>
      <ChakraProgress.Range className={`h-full rounded-full transition-all duration-500 ${corClasse}`} />
    </ChakraProgress.Track>
  </ChakraProgress.Root>
);

export default Progress;
