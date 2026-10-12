import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const NOME_COOKIE = 'sessao';
const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30; // 30 dias

function obterSegredo() {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) {
    throw new Error('SESSION_SECRET não configurado.');
  }
  return segredo;
}

function assinar(valor) {
  return crypto.createHmac('sha256', obterSegredo()).update(valor).digest('hex');
}

export function criarTokenSessao() {
  const expiraEm = Math.floor(Date.now() / 1000) + DURACAO_SESSAO_SEGUNDOS;
  const payload = String(expiraEm);
  const assinatura = assinar(payload);
  return `${payload}.${assinatura}`;
}

export function tokenSessaoValido(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;

  const [payload, assinatura] = token.split('.');
  if (!payload || !assinatura) return false;

  const assinaturaEsperada = assinar(payload);
  const bufferRecebido = Buffer.from(assinatura);
  const bufferEsperado = Buffer.from(assinaturaEsperada);
  if (bufferRecebido.length !== bufferEsperado.length) return false;
  if (!crypto.timingSafeEqual(bufferRecebido, bufferEsperado)) return false;

  const expiraEm = Number(payload);
  if (!Number.isFinite(expiraEm)) return false;

  return expiraEm > Math.floor(Date.now() / 1000);
}

export function lerCookie(req, nome) {
  const cabecalho = req.headers?.cookie;
  if (!cabecalho) return null;

  for (const parte of cabecalho.split(';')) {
    const indice = parte.indexOf('=');
    if (indice === -1) continue;
    const chave = parte.slice(0, indice).trim();
    if (chave === nome) {
      return decodeURIComponent(parte.slice(indice + 1).trim());
    }
  }
  return null;
}

export function sessaoAutenticada(req) {
  const token = lerCookie(req, NOME_COOKIE);
  return tokenSessaoValido(token);
}

export function cookieDeLogin() {
  const token = criarTokenSessao();
  return `${NOME_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DURACAO_SESSAO_SEGUNDOS}`;
}

export function cookieDeLogout() {
  return `${NOME_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// APP_PASSWORD_HASH_TESTE é um segundo hash opcional, só pra automação de testes
// (Playwright) rodando localmente. `process.env.VERCEL` é definido automaticamente
// pela própria Vercel em produção — mesmo que essa variável vaze pra lá por engano,
// fica ignorada fora do ambiente local.
export async function senhaEhValida(senha) {
  const hashPrincipal = process.env.APP_PASSWORD_HASH;
  if (!hashPrincipal) {
    throw new Error('APP_PASSWORD_HASH não configurado.');
  }

  if (await bcrypt.compare(senha, hashPrincipal)) return true;

  const hashTeste = !process.env.VERCEL ? process.env.APP_PASSWORD_HASH_TESTE : undefined;
  if (hashTeste && (await bcrypt.compare(senha, hashTeste))) return true;

  return false;
}

export function obterAdmin() {
  const existente = getApps()[0];
  if (existente) return getAuth(existente);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Credenciais do Firebase Admin SDK não configuradas.');
  }

  const appAdmin = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return getAuth(appAdmin);
}

export function obterUidFixo() {
  const uid = process.env.FIREBASE_OWNER_UID;
  if (!uid) {
    throw new Error('FIREBASE_OWNER_UID não configurado.');
  }
  return uid;
}
