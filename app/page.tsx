'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MvpCard } from '../components/MvpCard';
import { mvpsDoServidor, nomeMvp, servidores, type Mvp, type Spawn } from '../lib/catalog';
import { chaveDe, useTimers } from '../lib/store';
import { calcular } from '../lib/time';
import { prepararSom, tocarAlerta } from '../lib/som';

/* Um MVP que nasce em três mapas são três timers independentes — matar o
   Atroce em ra_fild03 não diz nada sobre o de ve_fild02. Por isso a lista é de
   pares (mvp, spawn), não de MVPs. */
interface Linha {
  mvp: Mvp;
  spawn: Spawn;
  chave: string;
}

/* Ordenado por ação exigida, não por tempo: primeiro o que ainda dá para
   pegar, depois o que já se perdeu, e a espera por último. */
const ORDEM = { janela: 0, atrasado: 1, iminente: 2, contando: 3 } as const;

export default function Pagina() {
  const { servidorId, setServidor, apelido, setApelido, registros, registrar, remover } = useTimers();

  const [agora, setAgora] = useState(() => Date.now());
  const [busca, setBusca] = useState('');
  const [som, setSom] = useState(false);
  const [montado, setMontado] = useState(false);

  /* O estado vem do localStorage, então o primeiro render do cliente não bate
     com o do servidor. Renderizar só depois de montar evita o erro de
     hidratação — e o relógio tem o mesmo problema. */
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const linhas: Linha[] = useMemo(() => {
    const lista = mvpsDoServidor(servidorId).flatMap((mvp) =>
      mvp.spawns.map((spawn) => ({ mvp, spawn, chave: chaveDe(mvp.id, spawn.map) }))
    );
    const q = busca.trim().toLowerCase();
    return q ? lista.filter((l) => nomeMvp(l.mvp).toLowerCase().includes(q) || l.spawn.map.includes(q)) : lista;
  }, [servidorId, busca]);

  /* Ativos primeiro, e dentro deles o mais urgente no topo: quem já passou da
     janela some da vista se ficar ordenado por nome. */
  const ativas = useMemo(() => {
    return linhas
      .filter((l) => registros[l.chave])
      .map((l) => ({ l, j: calcular(registros[l.chave].morteEm, l.spawn.respawnMinMs, l.spawn.respawnMaxMs, agora) }))
      .sort((a, b) => ORDEM[a.j.fase] - ORDEM[b.j.fase] || a.j.faltaParaMin - b.j.faltaParaMin);
  }, [linhas, registros, agora]);

  const inativas = useMemo(() => linhas.filter((l) => !registros[l.chave]), [linhas, registros]);

  /* Toca uma vez quando a janela ABRE — não no aviso de 90%, senão o alerta
     vira duas notificações por MVP e some o significado. Sem o registro do que
     já tocou, dispararia a cada segundo enquanto a fase durasse. */
  const jaTocou = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!som) return;
    for (const { l, j } of ativas) {
      if (j.fase === 'contando' || j.fase === 'iminente') {
        jaTocou.current.delete(l.chave);
      } else if (!jaTocou.current.has(l.chave)) {
        jaTocou.current.add(l.chave);
        tocarAlerta();
      }
    }
  }, [ativas, som]);

  if (!montado) return null;

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--color-borda)] bg-[var(--color-painel)]/60 p-3 backdrop-blur">
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

        <input
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          placeholder="Buscar MVP ou mapa…"
          aria-label="Buscar"
          className="min-w-40 flex-1 rounded-lg border border-[var(--color-borda)] bg-[var(--color-painel-alto)] px-3 py-1.5 text-sm outline-none placeholder:text-[var(--color-suave)] focus:border-[var(--color-contando)]"
        />

        <input
          value={apelido}
          onChange={(ev) => setApelido(ev.target.value)}
          placeholder="Seu apelido"
          aria-label="Seu apelido"
          title="Fica gravado em cada morte que você registrar"
          className="w-32 rounded-lg border border-[var(--color-borda)] bg-[var(--color-painel-alto)] px-3 py-1.5 text-sm outline-none placeholder:text-[var(--color-suave)] focus:border-[var(--color-contando)]"
        />

        <button
          onClick={() => {
            /* Browser só deixa criar AudioContext dentro de um gesto — por
               isso isto é um botão, e não algo feito no carregamento. */
            if (prepararSom()) {
              setSom(true);
              tocarAlerta();
            }
          }}
          className="rounded-lg border border-[var(--color-borda)] bg-[var(--color-painel-alto)] px-3 py-1.5 text-sm hover:bg-[var(--color-borda)]"
        >
          {som ? '🔊 Som ativo' : '🔇 Ativar som'}
        </button>
      </header>

      {ativas.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-[var(--color-suave)] uppercase">
            Em contagem ({ativas.length})
          </h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(255px,1fr))]">
            {ativas.map(({ l }) => (
              <MvpCard
                key={l.chave}
                mvp={l.mvp}
                spawn={l.spawn}
                registro={registros[l.chave]}
                agora={agora}
                onRegistrar={(morteEm) =>
                  registrar({ mvpId: l.mvp.id, map: l.spawn.map, morteEm, por: apelido || undefined })
                }
                onRemover={() => remover(l.chave)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-[var(--color-suave)] uppercase">
          Sem timer ({inativas.length})
        </h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(255px,1fr))]">
          {inativas.map((l) => (
            <MvpCard
              key={l.chave}
              mvp={l.mvp}
              spawn={l.spawn}
              agora={agora}
              onRegistrar={(morteEm) =>
                registrar({ mvpId: l.mvp.id, map: l.spawn.map, morteEm, por: apelido || undefined })
              }
              onRemover={() => remover(l.chave)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
