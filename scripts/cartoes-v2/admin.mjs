// Acesso administrativo ao Firestore pros scripts da migração Cartões V2. Mesmas
// credenciais do backend (/api), carregadas do .env pelo loadEnv do Vite (que
// entende aspas, \n e o escape \$ do jeito que o projeto já usa).
import { loadEnv } from 'vite';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function obterFirestoreAdmin() {
  const env = loadEnv('production', process.cwd(), '');
  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error('Credenciais do firebase-admin ausentes no .env.');
  }
  const app =
    getApps()[0] ??
    initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey }) });
  return getFirestore(app);
}

export async function lerColecao(db, nome) {
  const snap = await db.collection(nome).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}
