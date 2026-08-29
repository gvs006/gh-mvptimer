import 'server-only';
import { cookies } from 'next/headers';
import { lerCookie, NOME_COOKIE, type Papel, type Sessao } from './auth';
import { db } from './supabase';

import type { Database } from './supabase';

export type Guild = Database['public']['Tables']['guilds']['Row'];

export async function guildPorSlug(slug: string): Promise<Guild | null> {
  const { data } = await db().from('guilds').select('*').eq('slug', slug).maybeSingle();
  return data;
}

/* Valida o cookie CONTRA O BANCO, não só a assinatura. Um cookie pode estar
   perfeitamente assinado e mesmo assim morto, porque a senha daquele papel foi
   trocada depois que ele foi emitido — é justamente esse caso que a troca de
   senha precisa cobrir para ser revogação de verdade. */
export async function sessaoAtual(
  slug: string
): Promise<{ sessao: Sessao; guild: Guild } | null> {
  const bruto = (await cookies()).get(NOME_COOKIE)?.value;
  const sessao = lerCookie(bruto);
  if (!sessao || sessao.slug !== slug) return null;

  const guild = await guildPorSlug(slug);
  if (!guild || guild.id !== sessao.guildId) return null;

  const atual =
    sessao.papel === 'admin' ? guild.admin_session_version : guild.member_session_version;
  if (sessao.ver !== atual) return null;

  return { sessao, guild };
}

export const podeEscrever = (p: Papel) => p === 'membro' || p === 'admin';
