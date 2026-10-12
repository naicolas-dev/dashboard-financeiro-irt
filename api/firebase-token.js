import { obterAdmin, obterUidFixo, sessaoAutenticada } from './_sessao.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  if (!sessaoAutenticada(req)) {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }

  try {
    const admin = obterAdmin();
    const firebaseToken = await admin.createCustomToken(obterUidFixo());
    return res.status(200).json({ firebaseToken });
  } catch (erro) {
    console.error('Erro ao gerar custom token do Firebase:', erro);
    return res.status(500).json({ erro: 'Não foi possível gerar o token.' });
  }
}
