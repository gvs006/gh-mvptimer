/* ============================================================================
   DEFINE UMA SENHA ESPECIFICA de uma guilda.

     npm run guild:senha -- <slug> <membro|admin> "<senha>"

   Diferente de `guild:criar`, que gera as duas senhas aleatorias e derruba
   todo mundo: aqui voce escolhe a senha e so o papel alvo cai.

   Trocar a senha SEMPRE sobe a versao de sessao daquele papel — e o que faz a
   revogacao valer contra quem ja esta dentro, em vez de so mudar o segredo da
   porta. Trocar a de membro nao mexe nas sessoes de admin, e vice-versa.
   ========================================================================= */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/* Mesma derivacao de lib/auth.ts. Duplicada porque este script roda em Node
   puro, fora do bundle do Next. Se um lado mudar, o outro tem que mudar. */
async function hashSenha(senha) {
  const sal = randomBytes(32);
  const hash = await scryptAsync(senha, sal, 32);
  return `scrypt$${sal.toString('base64url')}$${hash.toString('base64url')}`;
}

const [slug, alvo, senha] = process.argv.slice(2);

if (!slug || !alvo || !senha) {
  console.error('uso: npm run guild:senha -- <slug> <membro|admin> "<senha>"');
  process.exit(1);
}
if (alvo !== 'membro' && alvo !== 'admin') {
  console.error('alvo: membro ou admin.');
  process.exit(1);
}
if (senha.length < 8) {
  console.error('senha: minimo 8 caracteres (mesma regra da tela).');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.');
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

const { data: guild } = await db
  .from('guilds')
  .select('id,name,member_session_version,admin_session_version')
  .eq('slug', slug)
  .maybeSingle();

if (!guild) {
  console.error(`guilda "${slug}" nao existe.`);
  process.exit(1);
}

const campos =
  alvo === 'admin'
    ? {
        admin_password_hash: await hashSenha(senha),
        admin_session_version: guild.admin_session_version + 1,
      }
    : {
        member_password_hash: await hashSenha(senha),
        member_session_version: guild.member_session_version + 1,
      };

const { error } = await db
  .from('guilds')
  .update({ ...campos, passwords_rotated_at: new Date().toISOString() })
  .eq('id', guild.id);

if (error) {
  console.error('falhou:', error.message);
  process.exit(1);
}

console.log(`\nSenha de ${alvo} da ${guild.name} trocada.`);
console.log(
  alvo === 'admin'
    ? 'As sessoes de ADMIN abertas foram derrubadas. Membros seguem conectados.'
    : 'As sessoes de MEMBRO abertas foram derrubadas. O admin segue conectado.'
);
console.log(`\n  entrar em  /g/${slug}  com a senha nova\n`);

/* Aviso de forca: senha curta e sem simbolo cai rapido em ataque de
   dicionario. O login tem atraso progressivo por IP, o que ajuda, mas nao
   substitui uma senha decente na porta que troca as senhas de todo mundo. */
const fraca = senha.length < 12 || !/[^A-Za-z0-9]/.test(senha);
if (fraca && alvo === 'admin') {
  console.log('AVISO: senha de admin curta ou sem simbolo. E ela que revoga o');
  console.log('acesso da guilda inteira — considere algo mais longo.\n');
}
