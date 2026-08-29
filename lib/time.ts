/* ============================================================================
   O cálculo do timer. Tudo aqui é função pura de (entrada, agora) — nada de
   Date.now() escondido lá dentro, senão não dá para testar nem para renderizar
   igual no servidor e no cliente.
   ========================================================================= */

export type Fase = 'contando' | 'iminente' | 'janela' | 'atrasado';

/* O aviso tem que vir ANTES de o MVP poder nascer — depois disso já é tarde
   para se deslocar até o mapa. 90% do caminho é o ponto em que ainda dá tempo
   de sair andando. */
export const LIMIAR_IMINENTE = 0.9;

export interface Janela {
  fase: Fase;
  /** 0..1 até o início da janela de spawn. */
  progresso: number;
  /** ms até o início da janela; negativo depois que ela abriu. */
  faltaParaMin: number;
  /** ms até o fim da janela; negativo quando o MVP está atrasado. */
  faltaParaMax: number;
  spawnMin: number;
  spawnMax: number;
}

export function calcular(
  morteEm: number,
  respawnMinMs: number,
  respawnMaxMs: number,
  agora: number
): Janela {
  const spawnMin = morteEm + respawnMinMs;
  const spawnMax = morteEm + respawnMaxMs;

  const total = spawnMin - morteEm;
  const progresso = total <= 0 ? 1 : Math.min(1, Math.max(0, (agora - morteEm) / total));

  /* Quatro fases. O respawn é um INTERVALO: entre spawnMin e spawnMax o MVP
     pode já estar vivo — isso é urgência, vermelho, vá agora. O amarelo tem
     que morar antes disso, na reta final da contagem, que é quando o aviso
     ainda serve para alguma coisa.

     Depois de spawnMax ele certamente nasceu e ninguém viu: continua vermelho,
     mas com outro rótulo, porque a ação deixa de ser "corre" e passa a ser
     "o timer se perdeu, confirme no mapa". */
  const fase: Fase =
    agora >= spawnMin
      ? agora <= spawnMax
        ? 'janela'
        : 'atrasado'
      : progresso >= LIMIAR_IMINENTE
        ? 'iminente'
        : 'contando';

  return {
    fase,
    progresso,
    faltaParaMin: spawnMin - agora,
    faltaParaMax: spawnMax - agora,
    spawnMin,
    spawnMax,
  };
}

/** "2h 05m", "05m 12s", "-14m" — sempre curto, cabe no card. */
export function formatarDuracao(ms: number): string {
  const negativo = ms < 0;
  const t = Math.abs(ms);
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);

  const corpo = h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  return negativo ? `-${corpo}` : corpo;
}

/** Horário local no formato que o jogador usa para conferir: "14:32". */
export function formatarHora(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* Aceita "14:32" e devolve o timestamp de HOJE nesse horário — ou de ONTEM, se
   o horário digitado ainda não chegou. Quem registra uma morte às 00:10
   digitando "23:50" está falando da noite anterior; assumir hoje jogaria o
   timer 24h para a frente sem avisar. */
export function horaParaTimestamp(texto: string, agora = Date.now()): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;

  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;

  const d = new Date(agora);
  d.setHours(h, min, 0, 0);
  return d.getTime() > agora ? d.getTime() - 86400000 : d.getTime();
}
