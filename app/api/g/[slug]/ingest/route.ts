import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '../../../../../lib/supabase';
import { guildPorSlug } from '../../../../../lib/sessao';
import catalogo from '../../../../../data/catalog.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Ingestão automática — o finder posta aqui quando vê uma lápide.

   Autentica por token de bot no header, não por cookie: quem chama é um
   processo, não um browser. E não é a senha de membro, porque o bot não deve
   cair junto quando a guilda trocar a senha dela. */

interface Corpo {
  mvpId?: number;
  nome?: string;
  map?: string;
  /* Quando o finder VIU a lápide, em ms. */
  vistoEm?: number;
  /* 'exata'  — a lápide nasceu na frente dele, ou alguém leu o túmulo
     'estimada' — já estava lá quando ele chegou; a morte foi em algum momento
                  antes disso, e ninguém sabe quando */
  precisao?: 'exata' | 'estimada';
  por?: string;
}

/* O rAthena solta a lápide `mvp_tomb_delay` depois da morte — 9s no padrão.
   Descontar isso é o que faz o horário automático bater com o que a pessoa
   veria ao clicar no túmulo. */
const ATRASO_LAPIDE_MS = 9000;

function tokenConfere(recebido: string, guardado: string): boolean {
  const a = Buffer.from(recebido, 'utf8');
  const b = Buffer.from(guardado, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

type MvpCat = {
  id: number;
  name: string;
  namePtBr: string | null;
  spawns: Array<{ map: string }>;
};

/* A lápide NÃO diz de quem ela é.

   No rAthena o NPC do túmulo se chama literalmente "Túmulo" (msg 656) para
   todos os MVPs — `mvptomb_create` copia um texto fixo. O nome do morto só
   existe no ponteiro interno do servidor e só sai pelo `run_tomb`, quando
   alguém clica.

   Mas o MAPA quase sempre resolve: dos 56 mapas do catálogo, 48 têm um único
   MVP possível. Uma lápide em beach_dun só pode ser do Tao Gunka. Os 8
   ambíguos são calabouços de guilda e os mapas de Angeling/Ghostring/Deviling
   — nesses, sem clicar no túmulo não há como saber, e chutar colocaria o timer
   errado na tela. */
/* Recebe o CATALOGO ja resolvido, nao o modo: a guilda pode estar num servidor
   customizado, e ali vivem MVPs que o catalogo puro do modo não tem (a Sombra
   de Nidhogg e a Memória de Thanatos do ThanatosRO). Usar o modo aqui fazia o
   finder nunca conseguir registrar justamente os customizados. */
function acharMvp(
  lista: MvpCat[],
  mvpId?: number,
  nome?: string,
  map?: string
): { mvp: MvpCat } | { erro: string } {

  if (mvpId) {
    const porId = lista.find((m) => m.id === mvpId);
    if (porId) return { mvp: porId };
  }

  if (nome) {
    const alvo = nome.trim().toLowerCase();
    const porNome = lista.find(
      (m) => m.name.toLowerCase() === alvo || m.namePtBr?.toLowerCase() === alvo
    );
    if (porNome) return { mvp: porNome };
  }

  /* Sem nome utilizável: deduz pelo mapa. */
  if (map) {
    const noMapa = lista.filter((m) => m.spawns.some((sp) => sp.map === map));
    if (noMapa.length === 1) return { mvp: noMapa[0] };
    if (noMapa.length > 1) {
      const nomes = noMapa.map((m) => m.namePtBr ?? m.name).join(', ');
      return { erro: `${map} tem mais de um MVP (${nomes}) — clique no túmulo para saber qual.` };
    }
  }

  return { erro: `MVP desconhecido: ${nome ?? mvpId ?? 'sem nome'} em ${map ?? 'sem mapa'}` };
}

/* O NPC da lápide tem nome fixo por idioma. Recebê-lo é o mesmo que não
   receber nome nenhum — e deixar passar faria a busca por nome falhar e a
   dedução por mapa nunca acontecer. */
const NOMES_DE_LAPIDE = new Set(['tumulo', 'túmulo', 'tomb']);

/* O pacote de troca de mapa do RO traz o nome COM extensão ("beach_dun.gat"),
   porque o rAthena a recoloca em `mapindex_getmapname_ext` antes de enviar. O
   catálogo usa o nome sem ela. O finder já corta na origem; isto aqui é a rede
   de segurança, para uma versão antiga dele não voltar a falhar em silêncio —
   e para o erro, quando houver, não ser um 422 enigmático. */
const semGat = (m: string) => (m.toLowerCase().endsWith('.gat') ? m.slice(0, -4) : m);

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const token = req.headers.get('x-bot-token') ?? '';
  if (!token) return NextResponse.json({ erro: 'Sem token.' }, { status: 401 });

  const guild = await guildPorSlug(slug);
  if (!guild?.bot_token || !tokenConfere(token, guild.bot_token)) {
    return NextResponse.json({ erro: 'Token inválido.' }, { status: 401 });
  }

  const c = (await req.json().catch(() => null)) as Corpo | null;
  if (!c?.map) return NextResponse.json({ erro: 'map obrigatório.' }, { status: 400 });
  const map = semGat(c.map);

  const nome = c.nome && NOMES_DE_LAPIDE.has(c.nome.trim().toLowerCase()) ? undefined : c.nome;
  /* Mesma resolução da tela da guilda: servidor customizado manda, e sem ele
     vale o catálogo puro do modo. */
  const dados = catalogo as never as {
    'pre-re': MvpCat[];
    re: MvpCat[];
    servers: Array<{ id: string; mvps: MvpCat[] }>;
  };
  const lista =
    dados.servers.find((sv) => sv.id === guild.server_id)?.mvps ?? dados[guild.mode];

  const achado = acharMvp(lista, c.mvpId, nome, map);

  if ('erro' in achado) {
    /* 422 e não 500: o payload está bem formado, o MVP é que não dá para
       identificar. Diferenciar deixa o log do finder útil em vez de ruidoso. */
    return NextResponse.json({ erro: achado.erro }, { status: 422 });
  }

  const mvp = achado.mvp;
  if (!mvp.spawns.some((s) => s.map === map)) {
    return NextResponse.json(
      { erro: `${mvp.name} não nasce em ${map} neste catálogo.` },
      { status: 422 }
    );
  }

  const precisao = c.precisao ?? 'estimada';
  const visto = c.vistoEm ?? Date.now();
  const morte = precisao === 'exata' ? visto - ATRASO_LAPIDE_MS : visto;

  /* Uma estimativa NÃO sobrescreve um horário exato: alguém que viu a morte e
     digitou sabe mais que o bot que passou pelo mapa depois. O caminho
     contrário é livre. */
  const { data: atual } = await db()
    .from('timers')
    .select('precision')
    .eq('guild_id', guild.id)
    .eq('mvp_id', mvp.id)
    .eq('map', map)
    .maybeSingle();

  if (atual?.precision === 'exata' && precisao === 'estimada') {
    return NextResponse.json({ ok: true, ignorado: 'já existe horário exato' });
  }

  const { error } = await db()
    .from('timers')
    .upsert(
      {
        guild_id: guild.id,
        mvp_id: mvp.id,
        map,
        death_at: new Date(morte).toISOString(),
        coord_x: null,
        coord_y: null,
        updated_by: (c.por ?? 'finder').slice(0, 24),
        updated_at: new Date().toISOString(),
        source: 'finder',
        precision: precisao,
      },
      { onConflict: 'guild_id,mvp_id,map' }
    );

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    mvp: mvp.namePtBr ?? mvp.name,
    map,
    morteEm: morte,
    precisao,
  });
}
