'use client';

import { useState } from 'react';
import { sprite } from '../lib/sprites';
import { nomeMvp, type Mvp, type Spawn } from '../lib/catalog';
import { calcular, formatarDuracao, formatarHora, horaParaTimestamp } from '../lib/time';
import type { Registro } from '../lib/store';
import { BarraProgresso } from './BarraProgresso';

const ESTILO = {
  contando: { cor: 'var(--color-contando)', icone: '⏳', rotulo: 'nasce em', urgente: false },
  iminente: { cor: 'var(--color-iminente)', icone: '⚠', rotulo: 'quase nascendo', urgente: false },
  janela: { cor: 'var(--color-janela)', icone: '🔥', rotulo: 'pode estar vivo — vá agora', urgente: true },
  atrasado: { cor: 'var(--color-atrasado)', icone: '❗', rotulo: 'nasceu e ninguém viu', urgente: false },
} as const;

interface Props {
  mvp: Mvp;
  spawn: Spawn;
  registro?: Registro;
  agora: number;
  onRegistrar: (morteEm: number) => void;
  onRemover: () => void;
  somenteLeitura?: boolean;
}

export function MvpCard({ mvp, spawn, registro, agora, onRegistrar, onRemover, somenteLeitura }: Props) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(false);

  const j = registro ? calcular(registro.morteEm, spawn.respawnMinMs, spawn.respawnMaxMs, agora) : null;
  const e = j ? ESTILO[j.fase] : null;

  function confirmar() {
    const ts = horaParaTimestamp(texto);
    if (ts === null) return setErro(true);
    onRegistrar(ts);
    cancelar();
  }

  /* Fecha o campo e devolve o card ao estado limpo. Sem zerar texto e erro, o
     campo reabre com o lixo da tentativa anterior. */
  function cancelar() {
    setEditando(false);
    setTexto('');
    setErro(false);
  }

  return (
    <div
      className="group relative flex flex-col gap-2.5 rounded-xl border bg-gradient-to-b from-[var(--color-painel-alto)] to-[var(--color-painel)] p-3 transition-colors"
      style={{
        borderColor: e ? `color-mix(in srgb, ${e.cor} 55%, var(--color-borda))` : 'var(--color-borda)',
        boxShadow: e?.urgente ? `0 0 0 1px ${e.cor}, 0 4px 20px -6px ${e.cor}` : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-black/25">
          <img
            src={sprite.mobGif(mvp.id)}
            alt=""
            className="max-h-12 max-w-12 object-contain [image-rendering:pixelated]"
            /* Nem todo mob tem GIF; o PNG é o retrato estático do mesmo id.
               Sem o guard, o onError volta a disparar no próprio fallback. */
            onError={(ev) => {
              const img = ev.currentTarget;
              if (img.dataset.caiu) return;
              img.dataset.caiu = '1';
              img.src = sprite.mobPng(mvp.id);
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold leading-tight">{nomeMvp(mvp)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[var(--color-suave)]">
            <span className="truncate font-mono">{spawn.map}</span>
            {spawn.source === 'custom' && (
              <span className="rounded bg-[var(--color-iminente)]/20 px-1 py-px text-[10px] text-[var(--color-iminente)]">
                custom
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--color-suave)]">
            {formatarDuracao(spawn.respawnMinMs)}
            {spawn.respawnMaxMs > spawn.respawnMinMs && ` – ${formatarDuracao(spawn.respawnMaxMs)}`}
          </div>
        </div>

        {registro && !somenteLeitura && (
          <button
            onClick={onRemover}
            aria-label="Remover timer"
            title="Remover timer"
            className="grid size-7 shrink-0 place-items-center rounded-md border border-[var(--color-janela)]/60 bg-[var(--color-janela)]/15 text-sm leading-none text-[var(--color-janela)] transition-colors hover:bg-[var(--color-janela)] hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {j && e ? (
        <>
          <div className="flex items-baseline gap-2">
            <span aria-hidden className={e.urgente ? 'pulsa' : undefined}>
              {e.icone}
            </span>
            <span
              className="font-mono text-2xl leading-none font-semibold tabular-nums"
              style={{ color: e.cor }}
            >
              {j.fase === 'contando' || j.fase === 'iminente'
                ? formatarDuracao(j.faltaParaMin)
                : formatarDuracao(-j.faltaParaMin)}
            </span>
          </div>

          <div className="text-xs font-medium" style={{ color: e.cor }}>
            {e.rotulo}
          </div>

          <BarraProgresso
            morteEm={registro!.morteEm}
            spawnMin={j.spawnMin}
            spawnMax={j.spawnMax}
            agora={agora}
            cor={e.cor}
          />

          <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-suave)]">
            <span className="truncate">
              † {formatarHora(registro!.morteEm)} · janela {formatarHora(j.spawnMin)}
              {j.spawnMax > j.spawnMin && `–${formatarHora(j.spawnMax)}`}
            </span>
            {registro!.por && <span className="shrink-0 truncate">por {registro!.por}</span>}
          </div>

          {!somenteLeitura && (
            <button
              onClick={() => onRegistrar(Date.now())}
              className="rounded-lg border border-[var(--color-borda)] px-2 py-1.5 text-xs hover:bg-[var(--color-borda)]"
            >
              Resetar (morreu agora)
            </button>
          )}
        </>
      ) : somenteLeitura ? (
        <div className="text-xs text-[var(--color-suave)]">sem timer</div>
      ) : editando ? (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <input
              autoFocus
              value={texto}
              onChange={(ev) => {
                setTexto(ev.target.value);
                setErro(false);
              }}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') confirmar();
                if (ev.key === 'Escape') cancelar();
              }}
              placeholder="14:32"
              aria-label="Horário da morte"
              aria-invalid={erro}
              inputMode="numeric"
              className="w-full rounded-lg border bg-black/25 px-2 py-1.5 text-sm outline-none"
              style={{ borderColor: erro ? 'var(--color-janela)' : 'var(--color-borda)' }}
            />
            <button
              onClick={confirmar}
              title="Confirmar horário"
              className="rounded-lg border border-[var(--color-borda)] px-3 text-xs hover:bg-[var(--color-borda)]"
            >
              OK
            </button>
            {/* Escape resolve no teclado, mas não é descobrível e não existe em
                celular: sem este botão, quem abre o campo por engano fica preso
                nele — só sai digitando um horário que não quer registrar. */}
            <button
              onClick={cancelar}
              aria-label="Cancelar"
              title="Cancelar (Esc)"
              className="rounded-lg border border-[var(--color-borda)] px-2.5 text-xs text-[var(--color-suave)] hover:bg-[var(--color-borda)] hover:text-[var(--color-texto)]"
            >
              ✕
            </button>
          </div>

          {erro && (
            <span className="text-[11px] text-[var(--color-janela)]">
              Use o formato hh:mm — ex.: 14:32
            </span>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onRegistrar(Date.now())}
            className="flex-1 rounded-lg bg-[var(--color-contando)] px-2 py-1.5 text-xs font-semibold text-[#0b1020] transition-opacity hover:opacity-90"
          >
            Morreu agora
          </button>
          <button
            onClick={() => setEditando(true)}
            title="Digitar horário da morte"
            className="rounded-lg border border-[var(--color-borda)] px-2.5 py-1.5 font-mono text-xs text-[var(--color-suave)] hover:bg-[var(--color-borda)] hover:text-[var(--color-texto)]"
          >
            hh:mm
          </button>
        </div>
      )}
    </div>
  );
}
