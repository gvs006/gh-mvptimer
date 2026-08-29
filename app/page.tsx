'use client';

import { useEffect, useState } from 'react';
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
      <p className="mt-6 text-center text-xs text-[var(--color-suave)]">
        Modo local: os timers ficam só neste navegador. Para compartilhar com a guild, use o
        endereço <span className="font-mono">/g/&#123;guild&#125;</span>.
      </p>
    </main>
  );
}
