'use client';

/* A barra cobre morte → spawnMax, não morte → spawnMin. Assim a janela de
   spawn aparece como uma FAIXA desenhada na trilha, e dá para ver de relance
   quanto ainda falta e qual o tamanho da incerteza — que é a pergunta real
   ("já vale ir?"). Uma barra que termina em spawnMin esconde metade disso.

   Quando a janela é zero (respawn fixo, tipo o Nidhoggr custom de 4h) a faixa
   simplesmente não é desenhada e a barra vira uma contagem comum. */
interface Props {
  morteEm: number;
  spawnMin: number;
  spawnMax: number;
  agora: number;
  cor: string;
}

export function BarraProgresso({ morteEm, spawnMin, spawnMax, agora, cor }: Props) {
  const total = Math.max(1, spawnMax - morteEm);
  const inicioJanela = ((spawnMin - morteEm) / total) * 100;
  const larguraJanela = ((spawnMax - spawnMin) / total) * 100;
  const preenchido = Math.min(100, Math.max(0, ((agora - morteEm) / total) * 100));

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-borda)]">
      {larguraJanela > 0.5 && (
        <div
          className="absolute inset-y-0"
          style={{
            left: `${inicioJanela}%`,
            width: `${larguraJanela}%`,
            /* Listra em vez de cor chapada: comunica "aqui é incerto" sem
               competir com o preenchimento que passa por cima. */
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(255,255,255,.16) 0 3px, transparent 3px 6px)',
          }}
        />
      )}

      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear"
        style={{
          width: `${preenchido}%`,
          background: `linear-gradient(90deg, color-mix(in srgb, ${cor} 55%, transparent), ${cor})`,
        }}
      />

      {/* Marca o instante em que ele já pode estar vivo. */}
      {larguraJanela > 0.5 && (
        <div
          className="absolute inset-y-0 w-px bg-white/45"
          style={{ left: `${inicioJanela}%` }}
        />
      )}
    </div>
  );
}
