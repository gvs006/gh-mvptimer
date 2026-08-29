import { NextResponse } from 'next/server';
import { db } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Lista as guildas para o seletor da home.

   Devolve SÓ slug e nome — nada de hash, versão de sessão ou data de rotação.
   O slug já é público por natureza (está na URL que circula na guild), e saber
   que uma guilda existe não dá acesso a nada: quem autoriza é a senha.

   O que isto entrega de fato é a ENUMERAÇÃO: dá para descobrir que guildas
   existem sem conhecer nenhum link. Com uma instância de uma guilda só isso é
   irrelevante; se o app passar a hospedar várias, o certo é trocar esta rota
   por uma lista das guildas que a pessoa já acessou (localStorage). */
export async function GET() {
  const { data, error } = await db().from('guilds').select('slug,name').order('name');
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ guilds: data ?? [] });
}
