import 'server-only';
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/* Sem bcrypt/argon2 e sem lib de JWT: scrypt e HMAC vêm no node:crypto, e as
   duas coisas que precisamos aqui (derivar senha, assinar cookie) são
   exatamente o que ele faz. Dependência nativa a menos para quebrar em build
   de serverless. */

const scryptAsync = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number
) => Promise<Buffer>;

const N = 32; /* bytes de sal e de hash */

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(N);
  const hash = await scryptAsync(senha, sal, N);
  return `scrypt$${sal.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [algo, salB64, hashB64] = guardado.split('$');
  if (algo !== 'scrypt' || !salB64 || !hashB64) return false;

  const esperado = Buffer.from(hashB64, 'base64url');
  const obtido = await scryptAsync(senha, Buffer.from(salB64, 'base64url'), esperado.length);

  /* Comparação em tempo constante: `===` vaza o tamanho do prefixo correto. */
  return timingSafeEqual(esperado, obtido);
}

/* --- Sessão ---------------------------------------------------------------
   Cookie assinado, não criptografado: o conteúdo é público (id da guild,
   papel, versão), o que não pode é ser FORJADO. HMAC resolve isso. */

export type Papel = 'membro' | 'admin';

export interface Sessao {
  guildId: string;
  slug: string;
  papel: Papel;
  /* A versão de sessão do papel no momento do login. É conferida contra o
     banco a cada request — é isso que faz trocar a senha derrubar quem já
     estava dentro, em vez de só mudar o segredo da porta. */
  ver: number;
  exp: number;
}

function segredo(): Buffer {
  const s = process.env.SESSION_SECRET;
  /* Falhar aqui é melhor que assinar com um padrão: um segredo fixo em código
     deixaria qualquer um forjar cookie de admin. */
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET ausente ou com menos de 32 caracteres.');
  }
  return Buffer.from(s, 'utf8');
}

const assinar = (corpo: string) =>
  createHmac('sha256', segredo()).update(corpo).digest('base64url');

export const DURACAO_SESSAO_MS = 30 * 24 * 3600 * 1000;

export function criarCookie(s: Omit<Sessao, 'exp'>): string {
  const sessao: Sessao = { ...s, exp: Date.now() + DURACAO_SESSAO_MS };
  const corpo = Buffer.from(JSON.stringify(sessao), 'utf8').toString('base64url');
  return `${corpo}.${assinar(corpo)}`;
}

export function lerCookie(valor: string | undefined): Sessao | null {
  if (!valor) return null;

  const [corpo, mac] = valor.split('.');
  if (!corpo || !mac) return null;

  const esperado = Buffer.from(assinar(corpo), 'utf8');
  const recebido = Buffer.from(mac, 'utf8');
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;

  try {
    const s = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Sessao;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const NOME_COOKIE = 'mvptimer_sessao';

/* --- Senha de membro gerada -----------------------------------------------
   O maior risco deste modelo é senha escolhida por gente virar "guild123".
   Quatro palavras dão ~44 bits, passam fácil no Discord e ninguém adivinha.
   Vocabulário temático porque a guild vai digitar isso muitas vezes. */
const PALAVRAS = [
  'poring', 'bafome', 'osiris', 'eddga', 'maya', 'drake', 'hatii', 'atroce',
  'ifrit', 'vesper', 'thor', 'odin', 'nidhogg', 'valquiria', 'freeoni',
  'dracula', 'faraó', 'amonra', 'tao', 'kiel', 'orco', 'lobo', 'esporo',
  'zumbi', 'anjo', 'diabo', 'espada', 'escudo', 'poção', 'cartao',
];

export function gerarSenhaMembro(): string {
  const bytes = randomBytes(4);
  const palavras = Array.from(bytes.subarray(0, 3), (b) => PALAVRAS[b % PALAVRAS.length]);
  return `${palavras.join('-')}-${bytes[3] % 90 + 10}`;
}
