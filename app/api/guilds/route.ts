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
/* Guilda de sandbox não entra no seletor: quem abre a home é jogador
   procurando a própria guilda, e "Guilda de Teste" na lista só gera dúvida.

   O filtro é por prefixo, e não por uma coluna nova, porque é uma decisão de
   apresentação — a guilda continua existindo e acessível pela URL direta
   (/g/zz-teste), que é o que os testes usam. */
const PREFIXO_SANDBOX = 'zz-';

export async function GET() {
  const { data, error } = await db().from('guilds').select('slug,name').order('name');
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const guilds = (data ?? []).filter((g) => !g.slug.startsWith(PREFIXO_SANDBOX));
  return NextResponse.json({ guilds });
}
