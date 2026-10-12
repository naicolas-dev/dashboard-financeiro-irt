import { cookieDeLogin, obterAdmin, obterUidFixo, senhaEhValida } from './_sessao.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  const { senha } = req.body ?? {};

  if (typeof senha !== 'string' || !senha) {
    return res.status(400).json({ erro: 'Senha é obrigatória.' });
  }

  let valida;
  try {
    valida = await senhaEhValida(senha);
  } catch (erro) {
    console.error(erro.message);
    return res.status(500).json({ erro: 'Login não configurado no servidor.' });
  }

  if (!valida) {
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }

  let firebaseToken;
  try {
    const admin = obterAdmin();
    firebaseToken = await admin.createCustomToken(obterUidFixo());
  } catch (erro) {
    console.error('Erro ao gerar custom token do Firebase:', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir o login.' });
  }

  res.setHeader('Set-Cookie', cookieDeLogin());
  return res.status(200).json({ ok: true, firebaseToken });
}
