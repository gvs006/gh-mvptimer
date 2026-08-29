/* ============================================================================
   GERA data/catalog.json — o que o app realmente lê.

     npm run db:catalog

   Mescla três camadas, da mais genérica para a mais específica. Cada uma só
   existe porque a anterior não basta:

     1. data/mvps.json           rAthena oficial. Traz TODOS os MVPs com nome
                                 pt-BR, level e HP — mas só os que o emulador
                                 marca como `Modes.Mvp` e spawna com
                                 `boss_monster`.

     2. data/reference-times.json  ragnarokmvptimer.com. Traz o que a camada 1
                                 não vê: Angeling, Ghostring, Deviling, Maya
                                 Macho, Kraken — mini-bosses que o rAthena não
                                 marca como MVP e que jogador cronometra
                                 igual. Tempos curados por quem joga.

     3. data/custom-servers.json Servidor privado. Customiza respawn e às vezes
                                 solta MVP que no oficial é de instância.

   Conferido antes de escolher a precedência: 29 dos 37 MVPs coincidem exato
   entre 1 e 2. As divergências são de MAPA, quase todas nos calabouços de
   guild (gld_dun01-04), onde cada servidor rotaciona MVP de um jeito — não são
   divergências de tempo. Por isso a união de mapas é segura, e onde os dois
   descrevem o mesmo mapa vale a camada 2, que é curada por jogador.
   ========================================================================= */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DATA = join(AQUI, '..', 'data');
const ler = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const base = ler('mvps.json');
const ref = ler('reference-times.json');
const custom = ler('custom-servers.json');

/* Chave de spawn = mapa. Um MVP pode nascer em vários, com tempo diferente em
   cada (Atroce, Eddga), então o tempo mora no spawn, nunca no MVP. */
function spawnsDaRef(r) {
  return r.respawn.map((s) => ({
    map: s.map,
    respawnMinMs: s.cdr,
    respawnMaxMs: s.cdr + (s.max_delay ?? 0),
    source: 'referencia',
  }));
}

function spawnsDaBase(m) {
  return m.spawns.map((s) => ({
    map: s.map,
    respawnMinMs: Math.round(s.respawnMinMinutes * 60000),
    respawnMaxMs: Math.round(s.respawnMaxMinutes * 60000),
    source: 'rathena',
  }));
}

function montar(modo) {
  const porId = new Map();

  for (const m of base[modo]) {
    porId.set(m.id, {
      id: m.id,
      aegis: m.aegis,
      name: m.name,
      namePtBr: m.namePtBr,
      level: m.level,
      hp: m.hp,
      spawns: spawnsDaBase(m),
    });
  }

  /* A referência só vale para Pre-RE — é o que o site cobre. */
  if (modo === 'pre-re') {
    for (const r of ref) {
      const existente = porId.get(r.id);
      const novos = spawnsDaRef(r);

      if (!existente) {
        /* Mini-boss que o rAthena não marca como MVP. Entra só com o que a
           referência sabe: sem level nem HP, e o nome dela é pt-BR. */
        porId.set(r.id, {
          id: r.id,
          aegis: null,
          name: r.name,
          namePtBr: r.name,
          level: null,
          hp: null,
          spawns: novos,
        });
        continue;
      }

      /* União por mapa; onde os dois falam do mesmo, a referência ganha. */
      const porMapa = new Map(existente.spawns.map((s) => [s.map, s]));
      for (const s of novos) porMapa.set(s.map, s);
      existente.spawns = [...porMapa.values()];
      existente.namePtBr ??= r.name;
    }
  }

  return porId;
}

const catalogo = {};
for (const modo of ['pre-re', 're']) {
  const porId = montar(modo);
  catalogo[modo] = [...porId.values()]
    .filter((m) => m.spawns.length > 0) /* sem respawn livre não é cronometrável */
    .sort((a, b) => (a.namePtBr ?? a.name).localeCompare(b.namePtBr ?? b.name, 'pt-BR'));
}

/* Servidores: o catálogo do modo, com os overrides aplicados por cima. Cada
   servidor vira uma lista já resolvida, para o app não ter que mesclar nada em
   runtime. */
catalogo.servers = custom.servers.map((srv) => {
  const porId = new Map(catalogo[srv.mode].map((m) => [m.id, m]));

  for (const ov of srv.overrides) {
    const existente = porId.get(ov.id);
    const base2 = base[srv.mode].find((m) => m.id === ov.id);
    const spawns = ov.respawn.map((s) => ({
      map: s.map,
      respawnMinMs: s.cdr,
      respawnMaxMs: s.cdr + (s.max_delay ?? 0),
      source: 'custom',
    }));

    porId.set(ov.id, {
      ...(existente ?? {
        id: ov.id,
        aegis: base2?.aegis ?? null,
        name: base2?.name ?? ov.namePtBr,
        level: base2?.level ?? null,
        hp: base2?.hp ?? null,
      }),
      namePtBr: ov.namePtBr ?? existente?.namePtBr ?? base2?.namePtBr ?? null,
      /* Override SUBSTITUI os spawns, não soma: se o servidor diz que o MVP
         nasce em nyd_dun02 em 4h, os mapas do oficial não valem mais para ele. */
      spawns,
    });
  }

  return {
    id: srv.id,
    label: srv.label,
    mode: srv.mode,
    mvps: [...porId.values()].sort((a, b) =>
      (a.namePtBr ?? a.name).localeCompare(b.namePtBr ?? b.name, 'pt-BR')
    ),
  };
});

writeFileSync(join(DATA, 'catalog.json'), JSON.stringify(catalogo, null, 2) + '\n');

for (const modo of ['pre-re', 're']) console.log(`${modo.padEnd(7)} ${catalogo[modo].length} MVPs cronometráveis`);
for (const s of catalogo.servers) {
  const custom2 = s.mvps.filter((m) => m.spawns.some((x) => x.source === 'custom'));
  console.log(`servidor ${s.id}: ${s.mvps.length} MVPs (${custom2.length} customizado: ${custom2.map((m) => m.namePtBr ?? m.name).join(', ')})`);
}
