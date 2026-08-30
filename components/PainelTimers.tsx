'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MvpCard } from './MvpCard';
import { nomeMvp, type Mvp, type Spawn } from '../lib/catalog';
import { chaveDe, type Registro } from '../lib/store';
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

interface Props {
  mvps: Mvp[];
  registros: Record<string, Registro>;
  apelido: string;
  setApelido: (n: string) => void;
  onRegistrar: (mvpId: number, map: string, morteEm: number) => void;
  onRemover: (mvpId: number, map: string) => void;
  /** Bloco à esquerda do cabeçalho: seletor de servidor ou identidade da guild. */
  cabecalho: ReactNode;
  somenteLeitura?: boolean;
  /** Chaves `mvpId@map` que a guilda tirou da frente. */
  despriorizados?: Set<string>;
  /** Só admin recebe; sem isso o controle nem aparece. */
  onDespriorizar?: (mvpId: number, map: string, valor: boolean) => void;
}

export function PainelTimers({
  mvps,
  registros,
  apelido,
  setApelido,
  onRegistrar,
  onRemover,
  cabecalho,
  somenteLeitura,
  despriorizados,
  onDespriorizar,
}: Props) {
  const [verDespriorizados, setVerDespriorizados] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [busca, setBusca] = useState('');
  const [som, setSom] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const linhas: Linha[] = useMemo(() => {
    const lista = mvps.flatMap((mvp) =>
      mvp.spawns.map((spawn) => ({ mvp, spawn, chave: chaveDe(mvp.id, spawn.map) }))
    );
    const q = busca.trim().toLowerCase();
    return q
      ? lista.filter((l) => nomeMvp(l.mvp).toLowerCase().includes(q) || l.spawn.map.includes(q))
      : lista;
  }, [mvps, busca]);

  const ativas = useMemo(
    () =>
      linhas
        .filter((l) => registros[l.chave] && !fora.has(l.chave))
        .map((l) => ({
          l,
          j: calcular(registros[l.chave].morteEm, l.spawn.respawnMinMs, l.spawn.respawnMaxMs, agora),
        }))
        .sort((a, b) => ORDEM[a.j.fase] - ORDEM[b.j.fase] || a.j.faltaParaMin - b.j.faltaParaMin),
    [linhas, registros, agora, despriorizados]
  );

  /* Despriorizado sai das duas listas de cima e vai para a gaveta do fim —
     inclusive se tiver timer rodando. Se continuasse aparecendo em "em
     contagem", despriorizar não teria efeito nenhum onde mais incomoda. */
  const fora = despriorizados ?? new Set<string>();
  const inativas = useMemo(
    () => linhas.filter((l) => !registros[l.chave] && !fora.has(l.chave)),
    [linhas, registros, despriorizados]
  );
  const escondidas = useMemo(() => linhas.filter((l) => fora.has(l.chave)), [linhas, despriorizados]);

  /* Toca uma vez quando a janela ABRE — não no aviso de 90%, senão o alerta
     vira duas notificações por MVP e some o significado. Sem o registro do que
     já tocou, dispararia a cada segundo enquanto a fase durasse. */
  const jaTocou = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!som) return;
    for (const { l, j } of ativas) {
      if (j.fase === 'contando' || j.fase === 'iminente') jaTocou.current.delete(l.chave);
      else if (!jaTocou.current.has(l.chave)) {
        jaTocou.current.add(l.chave);
        tocarAlerta();
      }
    }
  }, [ativas, som]);

  /* Celular fica em 2 colunas fixas, não em auto-fill: com minmax(255px) a
     tela estreita cai para 1 coluna e vira uma lista longa — rolar até o MVP
     certo custa mais que a leitura de cada card. Duas colunas cabem porque o
     card encolhe junto (ver `compacto` no MvpCard). */
  const grade =
    'grid grid-cols-2 gap-2 sm:gap-3 sm:[grid-template-columns:repeat(auto-fill,minmax(255px,1fr))]';

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--color-borda)] bg-[var(--color-painel)]/60 p-3 backdrop-blur">
        {cabecalho}

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
            /* Browser só deixa criar AudioContext dentro de um gesto — por isso
               isto é um botão, e não algo feito no carregamento. */
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
          <div className={grade}>
            {ativas.map(({ l }) => (
              <MvpCard
                key={l.chave}
                mvp={l.mvp}
                spawn={l.spawn}
                registro={registros[l.chave]}
                agora={agora}
                somenteLeitura={somenteLeitura}
                onRegistrar={(morteEm) => onRegistrar(l.mvp.id, l.spawn.map, morteEm)}
                onRemover={() => onRemover(l.mvp.id, l.spawn.map)}
                onDespriorizar={
                  onDespriorizar ? () => onDespriorizar(l.mvp.id, l.spawn.map, true) : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-[var(--color-suave)] uppercase">
          Sem timer ({inativas.length})
        </h2>
        <div className={grade}>
          {inativas.map((l) => (
            <MvpCard
              key={l.chave}
              mvp={l.mvp}
              spawn={l.spawn}
              agora={agora}
              somenteLeitura={somenteLeitura}
              onRegistrar={(morteEm) => onRegistrar(l.mvp.id, l.spawn.map, morteEm)}
              onRemover={() => onRemover(l.mvp.id, l.spawn.map)}
              onDespriorizar={
                onDespriorizar ? () => onDespriorizar(l.mvp.id, l.spawn.map, true) : undefined
              }
            />
          ))}
        </div>
      </section>

      {/* Gaveta dos despriorizados. Fechada por padrão, mas o cabeçalho fica
          sempre visível e diz quantos são: escondido de vez faria a guilda
          procurar um MVP que "sumiu" sem saber que alguém o tirou da frente. */}
      {escondidas.length > 0 && (
        <section className="mt-6">
          <button
            onClick={() => setVerDespriorizados((v) => !v)}
            aria-expanded={verDespriorizados}
            className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-borda)] bg-[var(--color-painel)]/50 px-3 py-2 text-xs font-semibold tracking-wide text-[var(--color-suave)] uppercase hover:bg-[var(--color-painel)]"
          >
            <span aria-hidden>{verDespriorizados ? '▾' : '▸'}</span>
            Não prioritários ({escondidas.length})
            {!onDespriorizar && (
              <span className="ml-auto text-[10px] normal-case">
                definido pela guilda
              </span>
            )}
          </button>

          {verDespriorizados && (
            <div className={`mt-2.5 ${grade}`}>
              {escondidas.map((l) => (
                <div key={l.chave} className="opacity-55 transition-opacity hover:opacity-100">
                  <MvpCard
                    mvp={l.mvp}
                    spawn={l.spawn}
                    registro={registros[l.chave]}
                    agora={agora}
                    somenteLeitura={somenteLeitura}
                    onRegistrar={(morteEm) => onRegistrar(l.mvp.id, l.spawn.map, morteEm)}
                    onRemover={() => onRemover(l.mvp.id, l.spawn.map)}
                    onDespriorizar={
                      onDespriorizar ? () => onDespriorizar(l.mvp.id, l.spawn.map, false) : undefined
                    }
                    despriorizado
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
