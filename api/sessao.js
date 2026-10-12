import { sessaoAutenticada } from './_sessao.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  return res.status(200).json({ autenticado: sessaoAutenticada(req) });
}
