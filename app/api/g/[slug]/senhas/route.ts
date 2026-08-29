import { NextResponse } from 'next/server';
import { criarCookie, DURACAO_SESSAO_MS, hashSenha, NOME_COOKIE } from '../../../../../lib/auth';
import { db } from '../../../../../lib/supabase';
import { sessaoAtual } from '../../../../../lib/sessao';

export const runtime = 'nodejs';

/* Troca de senha. Só admin — é o que impede o impostor de trancar a guild do
   lado de fora antes de ser descoberto. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sessao = await sessaoAtual(slug);
  if (!sessao) return NextResponse.json({ erro: 'Sem sessão.' }, { status: 401 });
  if (sessao.sessao.papel !== 'admin') {
    return NextResponse.json({ erro: 'Só o admin troca senha.' }, { status: 403 });
  }

  const { alvo, senha } = (await req.json().catch(() => ({}))) as {
    alvo?: 'membro' | 'admin';
    senha?: string;
  };
  if (alvo !== 'membro' && alvo !== 'admin') {
    return NextResponse.json({ erro: 'alvo deve ser membro ou admin.' }, { status: 400 });
  }
  if (!senha || senha.length < 8) {
    return NextResponse.json({ erro: 'Senha precisa de ao menos 8 caracteres.' }, { status: 400 });
  }

  const g = sessao.guild;

  /* Incrementa SÓ a versão do papel trocado. Trocar a senha dos membros derruba
     todos eles e mantém o admin logado — que é o ponto: você está expulsando
     alguém, não a si mesmo. */
  const campos =
    alvo === 'admin'
      ? { admin_password_hash: await hashSenha(senha), admin_session_version: g.admin_session_version + 1 }
      : { member_password_hash: await hashSenha(senha), member_session_version: g.member_session_version + 1 };

  const { error } = await db()
    .from('guilds')
    .update({ ...campos, passwords_rotated_at: new Date().toISOString() })
    .eq('id', g.id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const res = NextResponse.json({ ok: true, alvo });

  /* Se o admin trocou a própria senha, o cookie dele acabou de ficar velho.
     Reemitir na hora evita que ele se deslogue ao trocar a senha — o que
     assusta e leva a achar que quebrou algo. */
  if (alvo === 'admin') {
    const valor = criarCookie({
      guildId: g.id,
      slug,
      papel: 'admin',
      ver: g.admin_session_version + 1,
    });
    res.cookies.set(NOME_COOKIE, valor, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: DURACAO_SESSAO_MS / 1000,
    });
  }

  return res;
}
