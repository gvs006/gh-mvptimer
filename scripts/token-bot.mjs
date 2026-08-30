/* ============================================================================
   GERA (ou troca) o token de bot de uma guilda.

     npm run guild:token -- <slug>

   O token e o que o finder usa para postar lapide em /api/g/{slug}/ingest.
   Deliberadamente separado da senha de membro: o finder roda na maquina de
   quem joga e a senha de membro circula no Discord. Com um segredo so, toda
   troca de senha derrubaria o bot junto, e quem tivesse o bot teria a senha da
   guilda. Assim, revogar um nao mexe no outro.

   Rodar de novo troca o token — o finder antigo para de postar na hora.
   ========================================================================= */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const [slug] = process.argv.slice(2);
if (!slug) {
  console.error('uso: npm run guild:token -- <slug>');
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
  .select('id,name,bot_token')
  .eq('slug', slug)
  .maybeSingle();

if (!guild) {
  console.error(`guilda "${slug}" nao existe.`);
  process.exit(1);
}

/* Aleatorio de 32 bytes, nao frase de palavras: ninguem digita isto, vai
   colado num campo de config. Entropia alta sai de graca. */
const token = randomBytes(32).toString('base64url');

const { error } = await db.from('guilds').update({ bot_token: token }).eq('id', guild.id);
if (error) {
  console.error('falhou:', error.message);
  process.exit(1);
}

console.log(`\n${guild.bot_token ? 'Token TROCADO' : 'Token criado'} para ${guild.name}.`);
if (guild.bot_token) console.log('O finder que usava o token antigo para de postar agora.');
console.log(`\n  slug   ${slug}`);
console.log(`  token  ${token}`);
console.log('\nCole no finder (aba de config do MVP Timer). Nao e a senha da guilda.\n');
