'use client';

/* Alerta de nascimento. Web Audio API em vez de um arquivo .mp3: são dois
   bipes, não vale um request nem um asset para isso — e evita o problema de o
   autoplay de <audio> ser bloqueado de um jeito diferente em cada browser.

   O contexto só pode ser criado depois de um gesto do usuário, então quem
   chama `prepararSom` é o clique no botão de permissão, nunca o carregamento
   da página. */

let ctx: AudioContext | null = null;

export function prepararSom(): boolean {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    return true;
  } catch {
    return false;
  }
}

export function tocarAlerta() {
  if (!ctx) return;
  /* Um contexto criado antes de um gesto nasce suspenso; retomar é barato e
     idempotente. */
  if (ctx.state === 'suspended') void ctx.resume();

  const agora = ctx.currentTime;
  for (const [i, freq] of [880, 1174].entries()) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    /* Rampa curta nas pontas: onda quadrada crua estala no alto-falante. */
    ganho.gain.setValueAtTime(0, agora + i * 0.18);
    ganho.gain.linearRampToValueAtTime(0.25, agora + i * 0.18 + 0.02);
    ganho.gain.linearRampToValueAtTime(0, agora + i * 0.18 + 0.16);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(agora + i * 0.18);
    osc.stop(agora + i * 0.18 + 0.18);
  }
}

export const somPronto = () => ctx !== null;
