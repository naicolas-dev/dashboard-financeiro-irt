import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Roda as funções de /api dentro do próprio servidor do Vite durante `npm run dev`,
// imitando o runtime Node da Vercel — assim não é preciso `vercel dev`/login para
// testar localmente. Em produção a Vercel continua servindo esses mesmos arquivos
// nativamente; este plugin não entra no build (só se aplica a configureServer).
function apiDevPlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();

        const nomeRota = req.url.split('?')[0].slice('/api/'.length);
        const caminhoArquivo = path.join(__dirname, 'api', `${nomeRota}.js`);
        if (!fs.existsSync(caminhoArquivo)) return next();

        try {
          if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            let corpo = '';
            for await (const pedaco of req) corpo += pedaco;
            req.body = corpo ? JSON.parse(corpo) : {};
          }

          res.status = (codigo) => {
            res.statusCode = codigo;
            return res;
          };
          res.json = (dados) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(dados));
          };

          const modulo = await server.ssrLoadModule(caminhoArquivo);
          await modulo.default(req, res);
        } catch (erro) {
          console.error('[api-dev-middleware] erro ao processar', req.url, erro);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ erro: 'Erro interno no servidor de desenvolvimento.' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    // Vite só expõe variáveis VITE_* em process.env por padrão; as funções em
    // /api precisam também das privadas (SESSION_SECRET, APP_PASSWORD_HASH etc.).
    const env = loadEnv(mode, __dirname, '');
    for (const [chave, valor] of Object.entries(env)) {
      if (process.env[chave] === undefined) process.env[chave] = valor;
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      apiDevPlugin(),
      VitePWA({
        registerType: 'prompt',
        strategies: 'generateSW',
        // Sem favicon.svg — a fonte (public/ico.png) é PNG, o gerador só produz um
        // SVG de verdade quando a fonte já é SVG. includeAssets só garante que
        // esses arquivos entrem no precache; os <link> do <head> são manuais em
        // index.html (a integração automática é experimental, não estamos usando).
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          id: '/',
          name: 'Dashboard Financeiro',
          short_name: 'Finanças',
          description: 'Dashboard financeiro pessoal — receitas, despesas, cartões e metas.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          // Light — é o tema default quando não há preferência salva (ver script
          // inline em index.html). Fallback estático só; em runtime o
          // <meta name="theme-color"> é sincronizado pelo PWAController com o
          // TemaContext, que continua a única autoridade de tema.
          background_color: '#f7f6f2',
          theme_color: '#f7f6f2',
          categories: ['finance', 'productivity'],
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{html,js,css,png,svg,ico,webp,woff2}'],
          cleanupOutdatedCaches: true,
          // /api/** precisa ficar fora do fallback de navegação do SW — não tem
          // tratamento offline próprio (comportamento esperado, igual hoje).
          navigateFallbackDenylist: [/^\/api\//],
          // Sem runtimeCaching nenhum — nada de /api, Firebase Auth, Firestore,
          // googleapis. O SW cuida só do app shell e assets estáticos.
        },
        // PWA só é validada via `npm run build` + `npm run preview` — não ativar
        // o SW durante o dev cotidiano.
        devOptions: { enabled: false },
      }),
    ],
  };
});
