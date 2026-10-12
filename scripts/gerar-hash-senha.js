// Uso: node scripts/gerar-hash-senha.js "sua senha aqui"
// Copie o resultado para a variável APP_PASSWORD_HASH (.env local e Vercel).
import bcrypt from 'bcryptjs';

const senha = process.argv[2];

if (!senha) {
  console.error('Uso: node scripts/gerar-hash-senha.js "sua senha"');
  process.exit(1);
}

const hash = bcrypt.hashSync(senha, 12);
console.log(hash);
console.log('');
console.log('No .env LOCAL (não na Vercel), escape cada "$" com "\\$" antes de colar:');
console.log(hash.replaceAll('$', '\\$'));
