import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/supabase';
import { sessaoAtual } from '../../../../../lib/sessao';

export const runtime = 'nodejs';
/* Timer muda o tempo todo e é compartilhado: nada de cache. */
export const dynamic = 'force-dynamic';

import type { Database } from '../../../../../lib/supabase';

type LinhaTimer = Pick<
  Database['public']['Tables']['timers']['Row'],
  'mvp_id' | 'map' | 'death_at' | 'coord_x' | 'coord_y' | 'updated_by'
>;

const paraCliente = (t: LinhaTimer) => ({
  mvpId: t.mvp_id,
  map: t.map,
  morteEm: new Date(t.death_at).getTime(),
  coordX: t.coord_x ?? undefined,
  coordY: t.coord_y ?? undefined,
  por: t.updated_by ?? undefined,
});

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sessao = await sessaoAtual(slug);
  if (!sessao) return NextResponse.json({ erro: 'Sem sessão.' }, { status: 401 });

  const { data, error } = await db()
    .from('timers')
    .select('mvp_id,map,death_at,coord_x,coord_y,updated_by,updated_at')
    .eq('guild_id', sessao.guild.id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({
    papel: sessao.sessao.papel,
    guild: {
      name: sessao.guild.name,
      mode: sessao.guild.mode,
      serverLabel: sessao.guild.server_label,
      serverId: sessao.guild.server_id,
    },
    timers: (data ?? []).map(paraCliente),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sessao = await sessaoAtual(slug);
  if (!sessao) return NextResponse.json({ erro: 'Sem sessão.' }, { status: 401 });

  const corpo = (await req.json().catch(() => null)) as {
    mvpId?: number;
    map?: string;
    morteEm?: number;
    coordX?: number;
    coordY?: number;
    por?: string;
  } | null;

  if (!corpo || typeof corpo.mvpId !== 'number' || !corpo.map || typeof corpo.morteEm !== 'number') {
    return NextResponse.json({ erro: 'Payload inválido.' }, { status: 400 });
  }

  const { error } = await db()
    .from('timers')
    .upsert(
      {
        guild_id: sessao.guild.id,
        mvp_id: corpo.mvpId,
        map: corpo.map,
        death_at: new Date(corpo.morteEm).toISOString(),
        coord_x: corpo.coordX ?? null,
        coord_y: corpo.coordY ?? null,
        /* Apelido vem do cliente e é só um rótulo — cortar o tamanho evita que
           vire vandalismo de layout. */
        updated_by: corpo.por?.slice(0, 24) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guild_id,mvp_id,map' }
    );

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sessao = await sessaoAtual(slug);
  if (!sessao) return NextResponse.json({ erro: 'Sem sessão.' }, { status: 401 });

  const url = new URL(req.url);
  const mvpId = Number(url.searchParams.get('mvpId'));
  const map = url.searchParams.get('map');
  if (!mvpId || !map) return NextResponse.json({ erro: 'mvpId e map obrigatórios.' }, { status: 400 });

  const { error } = await db()
    .from('timers')
    .delete()
    .eq('guild_id', sessao.guild.id)
    .eq('mvp_id', mvpId)
    .eq('map', map);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
