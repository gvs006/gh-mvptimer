import catalogo from '../data/catalog.json';

export interface Spawn {
  map: string;
  respawnMinMs: number;
  respawnMaxMs: number;
  source: 'rathena' | 'referencia' | 'custom';
}

export interface Mvp {
  id: number;
  aegis: string | null;
  name: string;
  namePtBr: string | null;
  level: number | null;
  hp: number | null;
  spawns: Spawn[];
}

export interface Servidor {
  id: string;
  label: string;
  mode: 'pre-re' | 're';
  mvps: Mvp[];
}

const dados = catalogo as unknown as {
  'pre-re': Mvp[];
  re: Mvp[];
  servers: Servidor[];
};

export const servidores = dados.servers;

/** Servidor customizado, ou o catálogo puro do modo quando o id não é de um. */
export function mvpsDoServidor(id: string): Mvp[] {
  const srv = servidores.find((s) => s.id === id);
  if (srv) return srv.mvps;
  return id === 're' ? dados.re : dados['pre-re'];
}

export const nomeMvp = (m: Mvp) => m.namePtBr ?? m.name;
