'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PainelTimers } from '../components/PainelTimers';
import { mvpsDoServidor, servidores } from '../lib/catalog';
import { chaveDe, useTimers } from '../lib/store';

export default function Pagina() {
  const { servidorId, setServidor, apelido, setApelido, registros, registrar, remover } = useTimers();
  const [montado, setMontado] = useState(false);

  /* O estado vem do localStorage, então o primeiro render do cliente não bate
     com o do servidor. Renderizar só depois de montar evita o erro de
     hidratação. */
  useEffect(() => setMontado(true), []);
  if (!montado) return null;

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* Banner no TOPO, não nota de rodapé. Esta tela é visualmente idêntica à
          da guild, e as duas se confundem com facilidade: dá para passar horas
          marcando MVP aqui achando que a guild está vendo. O aviso precisa
          estar onde não dá para não ver. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-iminente)]/50 bg-[var(--color-iminente)]/10 p-3 text-sm">
        <span className="text-[var(--color-iminente)]">⚠ Modo local</span>
        <span className="text-[var(--color-suave)]">
          Estes timers ficam só neste navegador. Ninguém da guild vê.
        </span>
        <IrParaGuild />
      </div>

      <PainelTimers
        mvps={mvpsDoServidor(servidorId)}
        registros={registros}
        apelido={apelido}
        setApelido={setApelido}
        onRegistrar={(mvpId, map, morteEm) =>
          registrar({ mvpId, map, morteEm, por: apelido || undefined })
        }
        onRemover={(mvpId, map) => remover(chaveDe(mvpId, map))}
        cabecalho={
          <>
            <h1 className="mr-1 text-lg font-bold tracking-tight">
              MVP<span className="text-[var(--color-contando)]">Timer</span>
            </h1>
            <select
              value={servidorId}
              onChange={(ev) => setServidor(ev.target.value)}
              aria-label="Servidor"
              className="rounded-lg border border-[var(--color-borda)] bg-[var(--color-painel-alto)] px-2 py-1.5 text-sm outline-none"
            >
              {servidores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.mode})
                </option>
              ))}
              <option value="pre-re">Catálogo Pre-RE</option>
              <option value="re">Catálogo RE</option>
            </select>
          </>
        }
      />
    </main>
  );
}

/* Atalho para o modo compartilhado. Sem isto, quem cai na home só descobre o
   caminho da guild se alguém contar. */
function IrParaGuild() {
  const [guilds, setGuilds] = useState<Array<{ slug: string; name: string }>>([]);
  const [slug, setSlug] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch('/api/guilds')
      .then((r) => (r.ok ? r.json() : { guilds: [] }))
      .then((d) => {
        const lista = d.guilds ?? [];
        setGuilds(lista);
        /* Com uma guilda só, escolher não é decisão — já vem selecionada. */
        if (lista.length === 1) setSlug(lista[0].slug);
      })
      .catch(() => setGuilds([]))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return <span className="ml-auto text-xs text-[var(--color-suave)]">carregando guildas…</span>;
  }

  /* Sem backend configurado a lista vem vazia: some o seletor em vez de
     oferecer um campo que não vai levar a lugar nenhum. */
  if (guilds.length === 0) {
    return (
      <span className="ml-auto text-xs text-[var(--color-suave)]">
        nenhuma guilda disponível
      </span>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <div className="relative">
        <select
          value={slug}
          onChange={(ev) => setSlug(ev.target.value)}
          aria-label="Escolher guilda"
          /* `appearance-none` + seta própria: a seta nativa do select muda de
             cara em cada sistema e destoa do resto do painel. */
          className="appearance-none rounded-lg border border-[var(--color-borda)] bg-[var(--color-painel-alto)] py-1.5 pr-8 pl-3 text-sm outline-none focus:border-[var(--color-iminente)]"
        >
          <option value="">Escolher guilda…</option>
          {guilds.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-[var(--color-suave)]"
        >
          ▾
        </span>
      </div>

      <Link
        href={slug ? `/g/${slug}` : '#'}
        aria-disabled={!slug}
        tabIndex={slug ? undefined : -1}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-opacity ${
          slug
            ? 'bg-[var(--color-iminente)] text-[#0b1020] hover:opacity-90'
            : 'pointer-events-none bg-[var(--color-borda)] text-[var(--color-suave)]'
        }`}
      >
        Entrar
      </Link>
    </div>
  );
}
