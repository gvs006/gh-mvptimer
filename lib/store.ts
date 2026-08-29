'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Registro {
  /** `${mvpId}@${map}` — o mesmo MVP em mapas diferentes são timers diferentes. */
  chave: string;
  mvpId: number;
  map: string;
  morteEm: number;
  coordX?: number;
  coordY?: number;
  /* Quem registrou. Ainda não há backend, então é só o apelido local — mas o
     campo já existe para a sincronização não ter que migrar dado depois. */
  por?: string;
}

interface Estado {
  servidorId: string;
  apelido: string;
  registros: Record<string, Registro>;
  setServidor: (id: string) => void;
  setApelido: (n: string) => void;
  registrar: (r: Omit<Registro, 'chave'>) => void;
  remover: (chave: string) => void;
}

export const chaveDe = (mvpId: number, map: string) => `${mvpId}@${map}`;

export const useTimers = create<Estado>()(
  persist(
    (set) => ({
      servidorId: 'ragnabeat',
      apelido: '',
      registros: {},

      setServidor: (servidorId) => set({ servidorId }),
      setApelido: (apelido) => set({ apelido }),

      registrar: (r) =>
        set((s) => ({
          registros: { ...s.registros, [chaveDe(r.mvpId, r.map)]: { ...r, chave: chaveDe(r.mvpId, r.map) } },
        })),

      remover: (chave) =>
        set((s) => {
          const { [chave]: _, ...resto } = s.registros;
          return { registros: resto };
        }),
    }),
    {
      /* O namespace já entra na chave do storage: quando o backend por guild
         chegar, dado de servidor diferente nunca terá se misturado. */
      name: 'mvp-timer',
      version: 1,
    }
  )
);
