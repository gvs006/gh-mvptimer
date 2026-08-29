/* ============================================================================
   CRIA UMA GUILD (ou reseta as senhas de uma existente).

     npm run guild:criar -- <slug> "<Nome>" [pre-re|re] ["Rótulo"] [serverId]

   `serverId` é um `id` de data/custom-servers.json (ex.: thanatosro). Sem ele
   a guild usa o catálogo puro do modo e não enxerga MVP customizado.

   Existe como script de linha de comando, e não como tela de cadastro, de
   propósito: uma rota pública que cria guild é uma rota pública que qualquer
   um usa. Guild nova é evento raro — cabe na mão de quem tem as chaves.

   Imprime as duas senhas UMA vez. Elas não são recuperáveis depois: o banco
   guarda só o hash scrypt.
   ========================================================================= */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/* Mesma derivação de lib/auth.ts. Duplicada porque este script roda em Node
   puro, fora do bundle do Next — importar o .ts exigiria um passo de build só
   para isto. Se um lado mudar, o outro tem que mudar junto. */
async function hashSenha(senha) {
  const sal = randomBytes(32);
  const hash = await scryptAsync(senha, sal, 32);
  return `scrypt$${sal.toString('base64url')}$${hash.toString('base64url')}`;
}

const PALAVRAS = [
  'poring', 'bafome', 'osiris', 'eddga', 'maya', 'drake', 'hatii', 'atroce',
  'ifrit', 'vesper', 'thor', 'odin', 'nidhogg', 'valquiria', 'freeoni',
  'dracula', 'farao', 'amonra', 'tao', 'kiel', 'orco', 'lobo', 'esporo',
  'zumbi', 'anjo', 'diabo', 'espada', 'escudo', 'pocao', 'cartao',
];

function gerarSenha(palavras = 3) {
  const bytes = randomBytes(palavras + 1);
  const escolhidas = Array.from(bytes.subarray(0, palavras), (b) => PALAVRAS[b % PALAVRAS.length]);
  return `${escolhidas.join('-')}-${(bytes[palavras] % 90) + 10}`;
}

const [slug, nome, modo = 'pre-re', rotulo = '', serverId = null] = process.argv.slice(2);

if (!slug || !nome) {
  console.error('uso: npm run guild:criar -- <slug> "<Nome>" [pre-re|re] ["Rótulo"] [serverId]');
  process.exit(1);
}
if (!/^[a-z0-9-]{2,32}$/.test(slug)) {
  console.error('slug: só minúsculas, números e hífen (2 a 32 caracteres). Ele aparece na URL.');
  process.exit(1);
}
if (modo !== 'pre-re' && modo !== 're') {
  console.error('modo: pre-re ou re.');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes. Use --env-file=.env.local');
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

const senhaMembro = gerarSenha(3);
/* Admin com uma palavra a mais: ela derruba o acesso de todo mundo, então
   merece mais entropia que a que circula no Discord da guild. */
const senhaAdmin = gerarSenha(4);

const { data: existente } = await db.from('guilds').select('id').eq('slug', slug).maybeSingle();

const campos = {
  slug,
  name: nome,
  server_label: rotulo,
  mode: modo,
  server_id: serverId,
  member_password_hash: await hashSenha(senhaMembro),
  admin_password_hash: await hashSenha(senhaAdmin),
};

if (existente) {
  /* Guild que já existe = reset de senha. Sobe as duas versões de sessão, o
     que desconecta todo mundo, admin incluído — é um reset de emergência, não
     a troca do dia a dia (essa fica na tela, e não derruba o admin). */
  const { data: atual } = await db
    .from('guilds')
    .select('member_session_version,admin_session_version')
    .eq('id', existente.id)
    .single();

  const { error } = await db
    .from('guilds')
    .update({
      ...campos,
      member_session_version: atual.member_session_version + 1,
      admin_session_version: atual.admin_session_version + 1,
      passwords_rotated_at: new Date().toISOString(),
    })
    .eq('id', existente.id);

  if (error) {
    console.error('falhou:', error.message);
    process.exit(1);
  }
  console.log(`\nGuild "${slug}" JÁ EXISTIA — as duas senhas foram trocadas.`);
  console.log('Todas as sessões abertas foram derrubadas, a sua inclusive.');
} else {
  const { error } = await db.from('guilds').insert(campos);
  if (error) {
    console.error('falhou:', error.message);
    process.exit(1);
  }
  console.log(`\nGuild "${nome}" criada.`);
}

console.log(`\n  URL      /g/${slug}`);
console.log(`  modo     ${modo}${rotulo ? `  (${rotulo})` : ''}`);
console.log(`  catálogo ${serverId ?? 'padrão do modo'}`);
console.log(`\n  membro   ${senhaMembro}`);
console.log(`  admin    ${senhaAdmin}`);
console.log('\nAnote agora: o banco guarda só o hash, não dá para recuperar depois.');
console.log('Passe a de membro para a guild. A de admin não.\n');
