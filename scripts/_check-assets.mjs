/* Conferência de cobertura de arte. Descartável — roda uma vez, informa
   docs/assets.md, não faz parte de build nenhum. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PLACEHOLDER = '1e92868d31890f7e46f867da225d4f56';
const d = JSON.parse(readFileSync('data/mvps.json', 'utf8'));
const MODO = process.argv[2] ?? 'pre-re';
const mvps = d[MODO].filter((m) => m.spawns.length);
const maps = [...new Set(mvps.flatMap((m) => m.spawns.map((s) => s.map)))];

async function pega(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const b = Buffer.from(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get('content-type') ?? '', size: b.length, md5: createHash('md5').update(b).digest('hex') };
  } catch (e) {
    return { status: 0, type: 'ERRO ' + e.message, size: 0, md5: '' };
  }
}

async function lote(itens, fn, n = 10) {
  const out = [];
  for (let i = 0; i < itens.length; i += n) out.push(...(await Promise.all(itens.slice(i, i + n).map(fn))));
  return out;
}

const rMap = await lote(maps, async (m) => ({ k: m, ...(await pega(`https://www.divine-pride.net/img/map/original/${m}`)) }));
console.log('mapas conferidos');
const rGif = await lote(mvps, async (m) => ({ k: `${m.id} ${m.name}`, ...(await pega(`https://ratemyserver.net/mobs/${m.id}.gif`)) }));
console.log('gifs conferidos');
const rPng = await lote(mvps, async (m) => ({ k: `${m.id} ${m.name}`, ...(await pega(`https://static.divine-pride.net/images/mobs/png/${m.id}.png`)) }));
console.log('pngs conferidos');

for (const [nome, r] of [
  ['MAPA   www.divine-pride.net/img/map/original/{map}', rMap],
  ['GIF    ratemyserver.net/mobs/{id}.gif', rGif],
  ['PNG    static.divine-pride.net/images/mobs/png/{id}.png', rPng],
]) {
  const ruim = r.filter((x) => x.status !== 200 || !x.type.startsWith('image/') || x.md5 === PLACEHOLDER || x.size < 200);
  console.log(`\n${nome}\n   ${r.length - ruim.length}/${r.length} ok`);
  for (const x of ruim) console.log(`   FALHA  ${x.k}  status=${x.status} type=${x.type} size=${x.size}${x.md5 === PLACEHOLDER ? ' PLACEHOLDER' : ''}`);
}
