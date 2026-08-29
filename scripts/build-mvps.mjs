/* ============================================================================
   GERA data/mvps.json — o catálogo de MVPs com tempos de respawn.

     RATHENA_PATH=C:/IT/repo/ragnabeat node scripts/build-mvps.mjs

   Roda sob demanda, não a cada build: mob_db e os scripts de spawn mudam
   raramente, e o build não deve depender de um repo externo estar no disco.
   O JSON gerado é versionado.

   TRÊS FONTES, todas no repo do rAthena:

     db/{modo}/mob_db.yml      quem é MVP (Modes.Mvp), nome, level, HP
     npc/{modo}/mobs/**.txt    o RESPAWN — é aqui que ele mora, não no mob_db
     db/ragnabeat_mob_names.yml  nomes pt-BR oficiais do bRO (latin-1!)

   O respawn NÃO está no mob_db. Ele é o 3º e 4º campo da linha de spawn:

     abbey02,236,78,21,18<TAB>boss_monster<TAB>Fallen Bishop Hibram<TAB>1871,1,7200000,600000,1
                                                                           └ delay1 ┘ └delay2┘

   delay1 = piso fixo em ms depois da morte; delay2 = janela aleatória extra.
   Ou seja: nasce entre delay1 e delay1+delay2. É exatamente o intervalo
   min/max que o timer precisa desenhar — não é um número só.

   Pre-RE e RE são bases SEPARADAS no rAthena (db/pre-re e db/re, cada uma com
   seu mob_db e sua árvore de spawn), então o mesmo MVP pode ter tempo
   diferente nos dois — que é a razão de o toggle existir no timer.
   ========================================================================= */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

/* O mob_db.yml do RE tem chave repetida (`EP172ALPHA: true` duas vezes) — bug
   upstream do rAthena, que o emulador engole. Com o parser estrito isso vira
   exceção e derruba a geração inteira por causa de uma flag que nem usamos.
   `uniqueKeys: false` faz a última vencer, que é o comportamento do emulador. */
const parse = (texto) => parseYaml(texto, { uniqueKeys: false });

const ROOT = process.env.RATHENA_PATH;
if (!ROOT) {
  console.error('RATHENA_PATH não definido. Ex.: RATHENA_PATH=C:/IT/repo/ragnabeat node scripts/build-mvps.mjs');
  process.exit(1);
}

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, '..', 'data');
const MODOS = ['pre-re', 're'];

/* --- Nomes pt-BR ----------------------------------------------------------
   O arquivo é gerado a partir do i18n do cliente RO LATAM e está em latin-1,
   não em UTF-8. Lido como UTF-8 vira "Escorpi<?>o" — silenciosamente, sem
   erro. Quem não passar o encoding aqui só descobre na tela. */
function nomesPtBr() {
  const bruto = readFileSync(join(ROOT, 'db', 'ragnabeat_mob_names.yml'), 'latin1');
  const doc = parse(bruto);
  const mapa = new Map();
  for (const m of doc?.Body ?? []) if (m.Id && m.Name) mapa.set(m.Id, m.Name);
  return mapa;
}

/* --- Linhas de spawn ------------------------------------------------------
   Campos separados por TAB. O bloco de coordenadas é opcional (mapas onde o
   MVP nasce em ponto aleatório aparecem só como "bra_dun02"), e o `event`
   final também. Só interessa `boss_monster`: MVP declarado como `monster`
   comum não tem respawn com delay fixo. */
const LINHA_SPAWN =
  /^([A-Za-z0-9_@]+)(?:,\d+,\d+(?:,\d+,\d+)?)?\tboss_monster\t([^\t]+)\t(\d+),(\d+)(?:,(\d+))?(?:,(\d+))?/;

function arquivosTxt(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosTxt(caminho));
    else if (nome.endsWith('.txt')) saida.push(caminho);
  }
  return saida;
}

function spawnsDeBoss(modo) {
  const porMob = new Map();
  for (const arquivo of arquivosTxt(join(ROOT, 'npc', modo, 'mobs'))) {
    for (const linha of readFileSync(arquivo, 'latin1').split('\n')) {
      if (linha.startsWith('//')) continue;
      const m = LINHA_SPAWN.exec(linha.trimEnd());
      if (!m) continue;
      const [, mapa, , mobId, , delay1, delay2] = m;
      const id = Number(mobId);
      if (!porMob.has(id)) porMob.set(id, []);
      porMob.get(id).push({
        map: mapa,
        respawnMinMs: Number(delay1 ?? 0),
        respawnWindowMs: Number(delay2 ?? 0),
      });
    }
  }
  return porMob;
}

/* --- Montagem ------------------------------------------------------------ */
const ptBr = nomesPtBr();
const resultado = {};
const semSpawn = {};

for (const modo of MODOS) {
  const mobDb = parse(readFileSync(join(ROOT, 'db', modo, 'mob_db.yml'), 'latin1'))?.Body ?? [];
  const spawns = spawnsDeBoss(modo);

  const mvps = mobDb
    .filter((m) => m.Modes?.Mvp)
    .map((m) => {
      const locais = spawns.get(m.Id) ?? [];
      /* Um MVP com mais de um mapa (Atroce, Eddga, Doppelganger) pode ter
         delay diferente em cada um. Guardamos todos e expomos o menor piso
         como o "principal", que é o que o card mostra por padrão. */
      const principal = locais.reduce(
        (a, b) => (a === null || b.respawnMinMs < a.respawnMinMs ? b : a),
        null
      );
      return {
        id: m.Id,
        aegis: m.AegisName,
        name: m.Name,
        namePtBr: ptBr.get(m.Id) ?? null,
        level: m.Level ?? null,
        hp: m.Hp ?? null,
        /* Em minutos, que é a unidade da UI. ms é detalhe do emulador. */
        respawnMinMinutes: principal ? principal.respawnMinMs / 60000 : null,
        respawnMaxMinutes: principal
          ? (principal.respawnMinMs + principal.respawnWindowMs) / 60000
          : null,
        spawns: locais.map((l) => ({
          map: l.map,
          respawnMinMinutes: l.respawnMinMs / 60000,
          respawnMaxMinutes: (l.respawnMinMs + l.respawnWindowMs) / 60000,
        })),
      };
    })
    .sort((a, b) => a.id - b.id);

  resultado[modo] = mvps;
  semSpawn[modo] = mvps.filter((m) => m.spawns.length === 0);

  const comSpawn = mvps.length - semSpawn[modo].length;
  console.log(`${modo.padEnd(7)} ${String(mvps.length).padStart(3)} MVPs  ${comSpawn} com respawn declarado`);
}

mkdirSync(SAIDA, { recursive: true });
writeFileSync(join(SAIDA, 'mvps.json'), JSON.stringify(resultado, null, 2) + '\n');

/* MVP sem linha de spawn não é erro: é instância (Thanatos, Biolab), invocado
   por script (Ktullanux) ou evento. Não entra no timer de respawn livre —
   mas precisa ficar visível, senão some sem ninguém notar. */
for (const modo of MODOS) {
  if (semSpawn[modo].length === 0) continue;
  console.log(`\n${modo} — sem respawn livre (instância/script/evento), ${semSpawn[modo].length}:`);
  for (const m of semSpawn[modo]) console.log(`  ${String(m.id).padStart(5)}  ${m.name}`);
}

const semNome = MODOS.flatMap((mo) => resultado[mo]).filter((m) => !m.namePtBr);
const ids = new Set(semNome.map((m) => m.id));
if (ids.size) console.log(`\n${ids.size} MVPs sem nome pt-BR (ficam em inglês na UI).`);

console.log(`\ndata/mvps.json gerado.`);
