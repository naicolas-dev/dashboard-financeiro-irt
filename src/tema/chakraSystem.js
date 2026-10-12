import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

// Ponte, não substituição: os valores aqui são literalmente as CSS vars que
// `src/index.css` já define (e que já trocam de valor sob `.dark`, controlado
// só por `TemaContext`). O Chakra nunca precisa saber se o modo é light ou dark
// — ele só lê a variável que já está certa. Nada de `colorMode`/`next-themes`.
const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        'app.bg': { value: 'var(--color-background)' },
        'app.surface': { value: 'var(--color-surface)' },
        'app.surfaceRaised': { value: 'var(--color-surface-raised)' },
        'app.surfaceHover': { value: 'var(--color-surface-hover)' },
        'app.surfaceActive': { value: 'var(--color-surface-active)' },
        'app.fg': { value: 'var(--color-foreground)' },
        'app.fgSecondary': { value: 'var(--color-foreground-secondary)' },
        'app.fgMuted': { value: 'var(--color-foreground-muted)' },
        'app.border': { value: 'var(--color-border)' },
        'app.borderStrong': { value: 'var(--color-border-strong)' },
        'app.focusRing': { value: 'var(--color-focus-ring)' },
        'finance.positive': { value: 'var(--color-positive)' },
        'finance.negative': { value: 'var(--color-negative)' },
        'finance.warning': { value: 'var(--color-warning)' },
      },
    },
  },
});

export const chakraSystem = createSystem(defaultConfig, config);
