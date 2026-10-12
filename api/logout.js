import { cookieDeLogout } from './_sessao.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  res.setHeader('Set-Cookie', cookieDeLogout());
  return res.status(200).json({ ok: true });
}
