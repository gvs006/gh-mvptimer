import { NextResponse } from 'next/server';
import { conferirSenha, criarCookie, DURACAO_SESSAO_MS, NOME_COOKIE, type Papel } from '../../../../../lib/auth';
import { db } from '../../../../../lib/supabase';

/* scrypt é síncrono-pesado e o cookie precisa de node:crypto: runtime Node,
   não Edge. */
export const runtime = 'nodejs';

const JANELA_MS = 15 * 60 * 1000;
const LIVRES = 5;
const ATRASO_MAX_MS = 8000;

function ip(req: Request): string {
  /* Na Vercel o IP real vem no x-forwarded-for; o primeiro da lista é o
     cliente. Sem proxy conhecido isso é falsificável, mas aqui só alimenta o
     atraso — não autoriza nada. */
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { senha } = (await req.json().catch(() => ({}))) as { senha?: string };
  if (!senha) return NextResponse.json({ erro: 'Senha obrigatória.' }, { status: 400 });

  const cliente = db();
  const endereco = ip(req);

  void cliente.rpc('purge_login_attempts');

  const { count } = await cliente
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
    .eq('ip', endereco)
    .gte('at', new Date(Date.now() - JANELA_MS).toISOString());

  const erradas = count ?? 0;

  /* Atraso progressivo, não bloqueio: bloqueio duro deixaria qualquer um
     trancar a guild inteira do lado de fora só errando senha de propósito. */
  if (erradas > LIVRES) {
    const espera = Math.min(ATRASO_MAX_MS, 2 ** (erradas - LIVRES) * 250);
    await new Promise((r) => setTimeout(r, espera));
  }

  const { data: guild } = await cliente.from('guilds').select('*').eq('slug', slug).maybeSingle();
  if (!guild) return NextResponse.json({ erro: 'Guild não encontrada.' }, { status: 404 });

  const g = guild;

  /* Admin primeiro: se as duas senhas forem iguais, o papel maior ganha. */
  let papel: Papel | null = null;
  if (await conferirSenha(senha, g.admin_password_hash)) papel = 'admin';
  else if (await conferirSenha(senha, g.member_password_hash)) papel = 'membro';

  if (!papel) {
    await cliente.from('login_attempts').insert({ slug, ip: endereco });
    /* Mensagem única: dizer qual senha errou entrega qual delas existe. */
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  const ver = papel === 'admin' ? g.admin_session_version : g.member_session_version;
  const valor = criarCookie({ guildId: g.id, slug, papel, ver });

  const res = NextResponse.json({ papel, guild: { name: g.name, mode: g.mode, serverLabel: g.server_label } });
  res.cookies.set(NOME_COOKIE, valor, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACAO_SESSAO_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NOME_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
