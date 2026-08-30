import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/supabase';
import { sessaoAtual } from '../../../../../lib/sessao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Despriorizar é decisão de guilda, não de pessoa: muda a tela de todo mundo.
   Por isso só admin escreve — senão qualquer um esconde o MVP que os outros
   estão esperando, e ninguém entende por que ele sumiu. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sessao = await sessaoAtual(slug);
  if (!sessao) return NextResponse.json({ erro: 'Sem sessão.' }, { status: 401 });
  if (sessao.sessao.papel !== 'admin') {
    return NextResponse.json({ erro: 'Só o admin muda a prioridade.' }, { status: 403 });
  }

  const c = (await req.json().catch(() => null)) as {
    mvpId?: number;
    map?: string;
    despriorizado?: boolean;
    por?: string;
  } | null;

  if (!c || typeof c.mvpId !== 'number' || !c.map) {
    return NextResponse.json({ erro: 'mvpId e map obrigatórios.' }, { status: 400 });
  }

  if (c.despriorizado) {
    const { error } = await db()
      .from('guild_mvp_prefs')
      .upsert(
        {
          guild_id: sessao.guild.id,
          mvp_id: c.mvpId,
          map: c.map,
          updated_by: c.por?.slice(0, 24) || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'guild_id,mvp_id,map' }
      );
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  } else {
    const { error } = await db()
      .from('guild_mvp_prefs')
      .delete()
      .eq('guild_id', sessao.guild.id)
      .eq('mvp_id', c.mvpId)
      .eq('map', c.map);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
