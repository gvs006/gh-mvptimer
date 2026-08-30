# MVP Timer

Timer de respawn de MVPs de Ragnarok Online, em pt-BR, para uso de guild.

## Rodar

```bash
npm install
npm run dev      # http://localhost:3000
```

## Duas telas

| rota | o que é |
|---|---|
| `/` | modo local — timers só no seu navegador, sem senha, sem backend |
| `/g/{slug}` | modo guild — compartilhado, atrás de senha |

- Registrar morte com um clique ou digitando `hh:mm`
- Quatro fases: contando → quase nascendo (90%) → pode estar vivo → nasceu e ninguém viu
- Barra mostrando a janela de spawn como faixa, não como instante
- Som no nascimento (Web Audio API, atrás de um botão por causa do autoplay)
- Busca, troca de servidor/modo, apelido de quem registrou

## Guild: as duas senhas

Sem conta por pessoa. A guild tem uma senha de **membro** (ver e registrar) e
uma de **admin** (isso + trocar as senhas). O slug na URL é público; só a senha
autentica.

Trocar a senha **derruba as sessões abertas** daquele papel — é o que faz a
revogação valer contra alguém que já está dentro, em vez de só mudar o segredo
da porta. Trocar a de membro não derruba o admin, senão você se expulsaria no
meio da faxina.

O que a troca de senha **não** faz é dizer quem sabotou. Para isso serve o
apelido gravado em cada registro.

## Backend (Supabase)

1. Criar projeto no [Supabase](https://supabase.com) (free tier).
2. SQL Editor → colar e rodar [`supabase/schema.sql`](supabase/schema.sql).
3. `cp .env.example .env` e preencher. A key é a **secret** (`sb_secret_…`, ou a
   service_role antiga), nunca a publishable/anon. `SESSION_SECRET` se gera com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

4. Criar a guild:

```bash
npm run guild:criar -- <slug> "<Nome>" pre-re "<Servidor>" [serverId]
```

O último argumento é opcional e liga a guild a um servidor de
`data/custom-servers.json` — sem ele a guild usa o catálogo puro do modo e
**não enxerga MVP customizado**. Exemplo real:

```bash
npm run guild:criar -- bloodfalls "BloodFalls" pre-re "ThanatosRO" thanatosro
```

Ele imprime as duas senhas uma vez. O banco guarda só o hash scrypt: não dá
para recuperar depois, só resetar (rodar o mesmo comando de novo troca as duas
e derruba todas as sessões, a sua inclusive).

### Deploy na Vercel

Importar o repo e definir as três variáveis (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`) em Project Settings › Environment
Variables. Nenhuma delas é `NEXT_PUBLIC_` — se alguma virar, a chave vaza para
o browser.

Sincronização é por polling de 10s, não Realtime: o Realtime exigiria expor a
anon key com RLS por cima, o que brigaria com o modelo de senha, onde quem
autoriza é o cookie no servidor. Para uma guild de algumas dezenas de pessoas o
polling é irrisório.

## Dados

O app lê `data/catalog.json`, versionado. Não conversa com emulador nenhum em
runtime: o catálogo é estático, equivalente a uma planilha de tempos, só que
derivada em vez de digitada.

Fontes de arte, todas conferidas contra os MVPs reais (cobertura 100% nos dois
modos):

| uso | URL |
|---|---|
| GIF do mob | `ratemyserver.net/mobs/{id}.gif` |
| PNG do mob | `static.divine-pride.net/images/mobs/png/{id}.png` |
| minimapa | `www.divine-pride.net/img/map/original/{map}` |

Cuidado com o minimapa: `static.divine-pride.net/images/maps/...` devolve
`200 image/png` para qualquer nome, sempre o mesmo placeholder de 5.610 bytes —
nunca o mapa. O host certo é `www`, e o caminho precisa do `/original/`.

Os tempos são os oficiais do rAthena (Pre-RE e RE são bases separadas),
cruzados com os do ragnarokmvptimer.com — 29 dos 37 batem exato, e as
divergências são de mapa nos calabouços de guild, não de tempo.

Regerar (só quando as tabelas mudarem):

```bash
RATHENA_PATH=/caminho/do/rathena npm run db:mvps   # catálogo base
npm run db:catalog                                  # mescla + overrides de servidor
```

Ajuste de servidor privado vai em `data/custom-servers.json`.

## Testes

Teste sempre contra a guilda `zz-teste`, nunca contra uma guilda em uso, e
nunca escreva `delete` sem `guild_id` no filtro. As regras e o incidente que
as originou estão em [TESTES.md](TESTES.md).

## Créditos

- Sprites de mob: [RateMyServer](https://ratemyserver.net) e [Divine Pride](https://www.divine-pride.net)
- Mapas: Divine Pride
- Tempos de referência: [ragnarokmvptimer.com](https://www.ragnarokmvptimer.com/) (Gallact)

Arte de Ragnarok Online é propriedade da Gravity.
