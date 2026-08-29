# MVP Timer — Planejamento do Projeto

## Visão Geral

Timer de respawn de MVPs para Ragnarok Online, inspirado na mecânica/UX do [ragnarokmvptimer.com](https://www.ragnarokmvptimer.com/) (bom fluxo, bom UX) e no layout visual do [ragnarokmvp.github.io](https://ragnarokmvp.github.io/) (bom layout, UX ruim — corrigir).

- Idioma padrão: **pt-BR**, com arquitetura i18n pronta para **en** desde o início.
- Modo de jogo padrão: **Pre-RE**, com toggle para **RE** (tempos de respawn diferem entre os dois).
- Dados salvos **por guild** (namespacing, sem misturar timers de guilds/servidores diferentes).
- Sistema **compartilhável** com outras pessoas da guild (não é só localStorage — precisa de sync).
- Hospedagem: **Vercel (free tier)**.
- Repositório: **público no GitHub**.
- **Ferramenta de jogador, não de servidor.** Não conversa com rAthena, não lê banco de emulador, não precisa que ninguém rode servidor. Roda no browser de quem joga.

## Mecânica de UX (herdada do site de referência bom)

- Selecionar MVP → clique único para registrar horário de morte (default: agora) ou digitar horário manual.
- Clique para **resetar** o timer.
- Clique para **editar/definir** o horário diretamente no card (inline, sem modal pesado).
- Card fica **vermelho** (estado de warning) quando o MVP já passou do horário provável de nascimento.
- **Som** quando o MVP nasce (Web Audio API, com permissão explícita pedida ao usuário, já que navegadores bloqueiam autoplay sem interação).
- Persistência de sessão robusta: sobrevive a reload, fechamento de aba e queda de energia (localStorage com escrita imediata/debounce curto, não só estado em memória).
- Opção de salvar coordenadas do túmulo clicando no mapa (como no site de referência).

## Correções de UX/UI em relação ao site de layout bom

- Hierarquia visual clara entre: MVPs vivos / em contagem / em warning (vermelho + ícone, não só cor).
- Barra de progresso visual até o horário mínimo/máximo de spawn, não apenas números estáticos.
- Ações rápidas sem modais pesados (inline edit).

## Acesso e Compartilhamento — duas senhas

Sem conta por pessoa: o escopo é uma guild, algumas dezenas de jogadores. Duas
senhas compartilhadas, e a rota identifica a guild sem esconder nada:

```
/g/{slug}        →  slug é público e legível ("ragnabeat"). Só a senha autentica.
```

| senha | pode |
|---|---|
| **membro** | ver e registrar horário de morte |
| **admin** | tudo isso + trocar as duas senhas |

### Por que privilégio separado, e não um segredo só

Com um único segredo, quem entra pode derrubar o acesso — inclusive o impostor,
que trancaria a guild inteira do lado de fora antes de ser descoberto. Só a
senha de admin revoga. É o que torna o botão de troca seguro de existir.

### Trocar a senha precisa matar as sessões abertas

O ponto que decide se a revogação é real. O app troca senha por cookie de
sessão; se o cookie sobrevive à troca, o sabotador não precisa mais da senha —
ele já está dentro, e a troca vira teatro: você reenvia a senha nova para a
guild enquanto ele segue editando.

Por isso a guild guarda `memberSessionVersion` e `adminSessionVersion`, que vão
no cookie. Trocar uma senha incrementa **só a versão dela**:

- trocar a de membro → derruba todos os membros, **não** derruba o admin
  (senão você se expulsa no meio da faxina);
- trocar a de admin → derruba só as sessões de admin.

### Senha gerada, não escolhida

Aqui mora o único risco que o magic link não tinha. Token aleatório é
imbrutável; senha escolhida por gente vira `guild123`, e aí o cadeado é
enfeite. Duas defesas:

1. **Senha de membro gerada por padrão** — quatro palavras, tipo
   `bafome-thor-porata-93`. Passa fácil no Discord e não é adivinhável. Admin
   pode trocar por outra se quiser.
2. **Hash (bcrypt/argon2) e limite de tentativas por IP**, com atraso
   progressivo em vez de bloqueio duro — bloqueio duro deixa qualquer um
   trancar a guild de fora só errando senha.

Senha em texto puro no banco não entra em cogitação: o repo é público e o banco
é de terceiro.

### Saber *quem* sabotou, não só *que* sabotaram

Trocar a senha responde "como tiro o impostor". Não responde "quem era" — e
como o reenvio é manual, se o sabotador for um membro de verdade ele recebe a
senha nova e o ciclo recomeça.

O que resolve é atribuição, e é barato: ao entrar, o jogador escolhe um
**apelido**, guardado no device; toda escrita grava quem foi; o card mostra as
últimas alterações ("Bafomé 14:32 — por Fulano"). Não é identidade de verdade
(dá para digitar o apelido de outro), mas contra sabotador casual basta, e
transforma "descobriríamos rápido" em "está escrito na tela".

### Guild é o namespace

Com o acesso amarrado à guild, `Server` e `Guild` colapsam num só: a guild tem
um nome de servidor (rótulo livre — "bRO Thor", "Ragnabeat"), um modo Pre-RE/RE
e seus timers. Um objeto a menos e some o risco de misturar dados de servidores
diferentes, que era a razão do namespacing.

## Arquitetura Técnica

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Deploy nativo Vercel, i18n fácil |
| i18n | next-intl / next-i18next | pt-BR default, en pronto |
| Estado local | Zustand + localStorage | Persistência client-side instantânea |
| Persistência por guild | Namespace por `guildId` | Evita mistura de dados |
| Compartilhamento com guild | Supabase (Postgres, free tier) | localStorage não sincroniza entre pessoas |
| Acesso | Duas senhas (membro/admin) + cookie de sessão | Sem conta por pessoa; só admin revoga |
| Realtime sync | Supabase Realtime | Mudanças refletem pra todos da guild |
| Som | Web Audio API + arquivo local | Alerta de nascimento |
| Hospedagem | Vercel (free tier) | Requisito do projeto |

## Assets Visuais dos Mobs (GIFs) — RESOLVIDO

Fontes apuradas e conferidas contra os MVPs reais: ver **[docs/assets.md](docs/assets.md)**, código em `lib/sprites.ts`.

- Mob (GIF e PNG): reaproveitados do ragna-site, sem alteração.
- **Mapa**: necessidade nova do timer, não existia no ragna-site. É `www.divine-pride.net/img/map/original/{map}` — e já vem com os pontos de spawn marcados em vermelho, que é justamente o desenho de que a feature de marcar túmulo precisa.
- Cobertura 100% nos dois modos (Pre-RE e RE): todo MVP cronometrável tem arte, todo mapa de spawn tem minimapa. Nenhuma fonte nova é necessária.

Cuidado registrado: `static.divine-pride.net/images/maps/...` devolve `200 image/png` para qualquer nome, sempre o mesmo placeholder — nunca o mapa. Detalhes em docs/assets.md.

## Modelo de Dados (rascunho)

```
Guild {
  id, slug, name,
  serverLabel,                  /* rótulo livre: "bRO Thor". Não é um servidor real. */
  mode: "pre-re" | "re",
  memberPasswordHash,           /* bcrypt/argon2 — nunca texto puro */
  adminPasswordHash,
  memberSessionVersion,         /* +1 ao trocar a senha de membro; derruba os membros */
  adminSessionVersion,          /* +1 ao trocar a de admin; não mexe nos membros */
  passwordsRotatedAt
}
MvpDefinition {
  id, aegis, name, namePtBr, level, hp,
  respawnMinMinutes, respawnMaxMinutes,  /* varia por mode; ver nota abaixo */
  spawns: [{ map, respawnMinMinutes, respawnMaxMinutes }]
}
/* gifUrl não é campo: é função pura de `id` (lib/sprites.ts), não dado a guardar. */
MvpTimerEntry {
  id, guildId, mvpId,
  deathTimestamp,
  spawnAtEarliest, spawnAtLatest,
  isOverdue: boolean,           /* derivado do relógio, não guardado */
  location?: { map, coordX, coordY },
  updatedBy,                    /* o apelido — é o que identifica o sabotador */
  updatedAt
}
```

`MvpDefinition` é **estático** (vem de `data/mvps.json`, versionado no repo) e
não vai para o banco. Só `Guild` e `MvpTimerEntry` persistem — o banco guarda
o que a guild digita, nunca o catálogo do jogo.

**O respawn é um intervalo, não um instante.** No rAthena a linha de spawn traz
`delay1` (piso fixo) e `delay2` (janela aleatória somada): o MVP nasce em
qualquer ponto entre os dois. Por isso `spawnAtEarliest`/`spawnAtLatest`, e por
isso a barra de progresso precisa mostrar faixa, não uma marca só. Um MVP com
vários mapas (Atroce, Eddga, Doppelganger) pode ter delay diferente em cada um
— daí `spawns[]` guardar o tempo por mapa.

## Roadmap

1. [x] MVP local (CRUD de timers por servidor, sem guild) — clique/reset/warning funcionando.
2. [x] Estrutura i18n (`messages/pt-BR.json`, `messages/en.json`) — arquivos existem; **ainda não ligados**, a UI está com pt-BR embutido.
3. [x] Persistência local (localStorage via Zustand `persist`).
4. [x] Som de nascimento (Web Audio API, atrás de botão por causa do autoplay).
5. [x] Toggle Pre-RE/RE + servidor customizado, persistido.
6. Backend compartilhado (Supabase) + sync em tempo real.
7. Acesso `/g/{slug}`: senha de membro e de admin, cookie de sessão, troca de senha com bump de versão, apelido e histórico de quem alterou.
8. ~~GIFs dos mobs~~ — feito, ver docs/assets.md.
9. Deploy contínuo Vercel + repositório público GitHub + README.

## Pendências / Próximos Passos

- [x] Reler projeto **ragna-site** para reaproveitar a base de GIFs confiável dos mobs. → `lib/sprites.ts` + [docs/assets.md](docs/assets.md)
- [x] Levantar tabela de tempos de respawn Pre-RE vs RE por MVP. → `data/mvps.json`, gerado de `scripts/build-mvps.mjs`
- [x] Scaffold do Next.js (App Router + TS + Tailwind 4) — `npm run dev`, roda e é testável.
- [ ] Nomes pt-BR: conferir os cronometráveis sem entrada (17 no Pre-RE), separando "falta traduzir" de "o bRO também não traduz".
- [x] Decidir se login será necessário. → **Sem conta por pessoa**: duas senhas compartilhadas (membro/admin), ver seção Acesso e Compartilhamento.
- [ ] Decidir provedor de backend/sync — Supabase é o encaixe (Postgres + Realtime + free tier), falta confirmar.
- [x] Override de tempo por servidor. → `data/custom-servers.json`, já com a Sombra de Nidhogg (4h, nyd_dun02).
- [ ] Ligar o i18n de verdade (hoje os JSON existem mas a UI tem texto embutido).
- [ ] Coordenadas do túmulo clicando no mapa — o campo existe no modelo, a tela ainda não.
- [ ] Decidir se a arte fica em hotlink ou é baixada para `public/` (ver seção Licença em docs/assets.md).

### Dados: de onde saem (e por que isto não é integração com rAthena)

`data/mvps.json` está **versionado no repo** e é o que o app lê. O app não fala
com rAthena, não lê banco de emulador e não precisa que nada esteja rodando —
o arquivo é um catálogo estático, como seria uma planilha de tempos digitada à
mão. A diferença é só que ninguém digitou.

O `scripts/build-mvps.mjs` é ferramenta de manutenção, roda na minha máquina
quando a tabela precisar ser refeita, e não faz parte do build nem do deploy:

```
RATHENA_PATH=C:/IT/repo/ragnabeat npm run db:mvps
```

**Os tempos são os oficiais do jogo.** Conferido: `npc/pre-re/mobs`,
`npc/re/mobs` e `db/pre-re/mob_db.yml` do ragnabeat estão idênticos ao rAthena
oficial (`git diff upstream/master` vazio); o único desvio no `db/re/mob_db.yml`
é `DamageTaken` em ABRs, que não são MVP. Ou seja, a tabela não está enviesada
pelas customizações daquele servidor — vale para qualquer servidor que use os
tempos padrão.

Os nomes pt-BR saem do cliente oficial do RO LATAM, não do servidor.
