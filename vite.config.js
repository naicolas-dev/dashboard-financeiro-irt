import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
    plugins: [react(), tailwindcss(), apiDevPlugin()],
  };
});
