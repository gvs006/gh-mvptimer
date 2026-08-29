'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PainelTimers } from '../../../components/PainelTimers';
import { mvpsDoServidor } from '../../../lib/catalog';
import { chaveDe, type Registro } from '../../../lib/store';

/* Sincronização por polling, não Realtime. Para uma guild de algumas dezenas
   de pessoas, um GET a cada 10s é irrisório e cabe folgado no free tier — e o
   Realtime do Supabase exigiria expor a anon key no browser com RLS por cima,
   o que brigaria com o modelo de duas senhas, onde quem autoriza é o cookie no
   servidor. Menos peça móvel pelo mesmo resultado prático. */
const INTERVALO_MS = 10000;

interface Dados {
  papel: 'membro' | 'admin';
  guild: { name: string; mode: 'pre-re' | 're'; serverLabel: string; serverId: string | null };
  timers: Array<{ mvpId: number; map: string; morteEm: number; por?: string }>;
}

export function GuildCliente({ slug }: { slug: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [apelido, setApelido] = useState('');
  const [painelSenhas, setPainelSenhas] = useState(false);

  /* O apelido é do jogador, não da guild: fica no device e não vai para o
     banco a não ser junto de uma morte registrada. */
  useEffect(() => {
    setApelido(localStorage.getItem('mvp-timer-apelido') ?? '');
  }, []);
  useEffect(() => {
    if (apelido) localStorage.setItem('mvp-timer-apelido', apelido);
  }, [apelido]);

  const buscar = useCallback(async () => {
    const r = await fetch(`/api/g/${slug}/timers`, { cache: 'no-store' });
    if (r.status === 401) {
      /* Pode ser a primeira visita — ou a senha ter sido trocada e esta sessão
         estar revogada. Nos dois casos a tela certa é a de senha. */
      setDados(null);
      setCarregando(false);
      return;
    }
    if (r.ok) setDados(await r.json());
    setCarregando(false);
  }, [slug]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  /* Só faz polling com sessão viva e aba visível: aba de fundo não precisa de
     rede, e o navegador congela o timer de qualquer jeito. */
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  useEffect(() => {
    if (!dados) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void buscar();
    }, INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void buscar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [dados, buscar]);

  async function entrar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    const r = await fetch(`/api/g/${slug}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ senha }),
    });
    if (!r.ok) {
      setErro((await r.json().catch(() => ({}))).erro ?? 'Falha ao entrar.');
      return;
    }
    setSenha('');
    await buscar();
  }

  /* Atualização otimista: o card responde na hora e o servidor confirma
     depois. Sem isso, cada clique pareceria travado pelo tempo de ida e volta.
     Se o POST falhar, o `buscar()` seguinte traz a verdade do servidor de
     volta e o card se corrige sozinho. */
  async function registrar(mvpId: number, map: string, morteEm: number) {
    setDados((d) =>
      d
        ? {
            ...d,
            timers: [
              ...d.timers.filter((t) => !(t.mvpId === mvpId && t.map === map)),
              { mvpId, map, morteEm, por: apelido || undefined },
            ],
          }
        : d
    );
    await fetch(`/api/g/${slug}/timers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mvpId, map, morteEm, por: apelido || undefined }),
    });
    void buscar();
  }

  async function remover(mvpId: number, map: string) {
    setDados((d) =>
      d ? { ...d, timers: d.timers.filter((t) => !(t.mvpId === mvpId && t.map === map)) } : d
    );
    await fetch(`/api/g/${slug}/timers?mvpId=${mvpId}&map=${encodeURIComponent(map)}`, {
      method: 'DELETE',
    });
    void buscar();
  }

  if (carregando) {
    return <p className="p-8 text-center text-sm text-[var(--color-suave)]">Carregando…</p>;
  }

  if (!dados) {
    return (
      <form
        onSubmit={entrar}
        className="mx-auto mt-16 max-w-sm rounded-xl border border-[var(--color-borda)] bg-[var(--color-painel)] p-5"
      >
        <h1 className="mb-1 text-lg font-bold">
          MVP<span className="text-[var(--color-contando)]">Timer</span>
        </h1>
        <p className="mb-4 text-sm text-[var(--color-suave)]">
          Guild <span className="font-mono">{slug}</span>. Use a senha que a guild te passou.
        </p>

        <input
          type="password"
          value={senha}
          onChange={(ev) => setSenha(ev.target.value)}
          placeholder="Senha"
          aria-label="Senha"
          autoFocus
          className="mb-2 w-full rounded-lg border border-[var(--color-borda)] bg-black/25 px-3 py-2 text-sm outline-none focus:border-[var(--color-contando)]"
        />

        {erro && <p className="mb-2 text-xs text-[var(--color-janela)]">{erro}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--color-contando)] px-3 py-2 text-sm font-semibold text-[#0b1020] hover:opacity-90"
        >
          Entrar
        </button>
      </form>
    );
  }

  const registros: Record<string, Registro> = {};
  for (const t of dados.timers) {
    registros[chaveDe(t.mvpId, t.map)] = {
      chave: chaveDe(t.mvpId, t.map),
      mvpId: t.mvpId,
      map: t.map,
      morteEm: t.morteEm,
      por: t.por,
    };
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <PainelTimers
        /* O servidor customizado manda; sem ele, o catálogo puro do modo. É o
           que faz a guild ver os MVPs com o respawn DELA. */
        mvps={mvpsDoServidor(dados.guild.serverId ?? dados.guild.mode)}
        registros={registros}
        apelido={apelido}
        setApelido={setApelido}
        onRegistrar={registrar}
        onRemover={remover}
        cabecalho={
          <>
            <h1 className="mr-1 text-lg font-bold tracking-tight">
              MVP<span className="text-[var(--color-contando)]">Timer</span>
            </h1>
            <span className="rounded-lg border border-[var(--color-borda)] bg-[var(--color-painel-alto)] px-2.5 py-1.5 text-sm">
              {dados.guild.name}
              {dados.guild.serverLabel && (
                <span className="text-[var(--color-suave)]"> · {dados.guild.serverLabel}</span>
              )}
              <span className="text-[var(--color-suave)]"> · {dados.guild.mode}</span>
            </span>
            {dados.papel === 'admin' && (
              <button
                onClick={() => setPainelSenhas((v) => !v)}
                className="rounded-lg border border-[var(--color-iminente)]/50 bg-[var(--color-iminente)]/10 px-2.5 py-1.5 text-sm text-[var(--color-iminente)] hover:bg-[var(--color-iminente)]/20"
              >
                🔑 Senhas
              </button>
            )}
          </>
        }
      />

      {painelSenhas && dados.papel === 'admin' && (
        <PainelSenhas slug={slug} aoFechar={() => setPainelSenhas(false)} />
      )}
    </main>
  );
}

function PainelSenhas({ slug, aoFechar }: { slug: string; aoFechar: () => void }) {
  const [alvo, setAlvo] = useState<'membro' | 'admin'>('membro');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState('');

  async function trocar(ev: React.FormEvent) {
    ev.preventDefault();
    const r = await fetch(`/api/g/${slug}/senhas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alvo, senha }),
    });
    const corpo = await r.json().catch(() => ({}));
    setMsg(
      r.ok
        ? alvo === 'membro'
          ? 'Trocada. Todos os membros foram desconectados — reenvie a senha nova.'
          : 'Senha de admin trocada. Você continua conectado.'
        : (corpo.erro ?? 'Falhou.')
    );
    if (r.ok) setSenha('');
  }

  return (
    <div className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-xl border border-[var(--color-iminente)]/50 bg-[var(--color-painel)] p-4 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Trocar senha</h2>
        <button onClick={aoFechar} aria-label="Fechar" className="text-[var(--color-suave)]">
          ✕
        </button>
      </div>

      <form onSubmit={trocar} className="flex flex-col gap-2">
        <div className="flex gap-2 text-sm">
          {(['membro', 'admin'] as const).map((v) => (
            <label key={v} className="flex items-center gap-1">
              <input
                type="radio"
                checked={alvo === v}
                onChange={() => setAlvo(v)}
                name="alvo"
              />
              {v}
            </label>
          ))}
        </div>

        <input
          type="text"
          value={senha}
          onChange={(ev) => setSenha(ev.target.value)}
          placeholder="Nova senha (mín. 8)"
          className="rounded-lg border border-[var(--color-borda)] bg-black/25 px-3 py-2 text-sm outline-none"
        />

        <p className="text-xs text-[var(--color-suave)]">
          Trocar a de <b>membro</b> desconecta todos os membros e mantém você dentro. Trocar a de{' '}
          <b>admin</b> derruba só as outras sessões de admin.
        </p>

        {msg && <p className="text-xs text-[var(--color-iminente)]">{msg}</p>}

        <button
          type="submit"
          className="rounded-lg bg-[var(--color-iminente)] px-3 py-2 text-sm font-semibold text-[#0b1020]"
        >
          Trocar
        </button>
      </form>
    </div>
  );
}
