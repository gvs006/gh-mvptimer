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
  const [slug, setSlug] = useState('');

  return (
    <form
      action={`/g/${slug || 'minha-guild'}`}
      className="ml-auto flex items-center gap-1"
      onSubmit={(ev) => {
        if (!slug.trim()) ev.preventDefault();
      }}
    >
      <input
        value={slug}
        onChange={(ev) => setSlug(ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
        placeholder="nome-da-guild"
        aria-label="Nome da guild"
        className="w-32 rounded-lg border border-[var(--color-borda)] bg-[var(--color-painel-alto)] px-2 py-1 text-sm outline-none"
      />
      <Link
        href={`/g/${slug}`}
        aria-disabled={!slug}
        className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
          slug
            ? 'bg-[var(--color-iminente)] text-[#0b1020]'
            : 'pointer-events-none bg-[var(--color-borda)] text-[var(--color-suave)]'
        }`}
      >
        Entrar
      </Link>
    </form>
  );
}
