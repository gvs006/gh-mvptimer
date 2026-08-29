# Fontes de arte e de dados

Fecha o pendente *"Reler o ragna-site para reaproveitar a base de GIFs confiável"*.
O `lib/sprites.ts` daqui é o do ragna-site portado, mais o **mapa**, que é
necessidade nova do timer (marcar o túmulo clicando no mapa) e não existia lá.

Cada URL abaixo foi conferida contra os MVPs reais do catálogo, não contra um
exemplo só — a cobertura medida está no fim.

## Mob

| uso | URL |
|---|---|
| GIF animado | `ratemyserver.net/mobs/{id}.gif` |
| PNG estático | `static.divine-pride.net/images/mobs/png/{id}.png` |

`{id}` é o Id do `mob_db.yml`, o mesmo que está em `data/mvps.json`.

## Mapa

```
https://www.divine-pride.net/img/map/original/{map}
```

Sem extensão. `{map}` é o nome interno (`prt_maze03`), que vem dos spawns em
`data/mvps.json`. A imagem **já vem com os pontos de spawn marcados em
vermelho** pelo próprio Divine Pride, que é exatamente o desenho que o timer
quer mostrar.

### Dois vizinhos que parecem servir e não servem

Vale escrever porque os dois falham de um jeito que não aparece como erro:

**`static.divine-pride.net/images/maps/original/{map}.png`** — devolve
`200 image/png` para qualquer nome, sempre o mesmo placeholder de 5.610 bytes
(md5 `1e92868d3189…`). Testado com quatro mapas válidos diferentes: md5
idêntico nos quatro. É o host de onde vem o sprite do mob, o que faz dele o
palpite natural — e ele nunca acusa o erro.

**`www.divine-pride.net/img/map/{map}`** (sem o `/original/`) — 404 sempre,
inclusive para mapa que existe.

O host certo é `www`, não `static`, e o caminho precisa do `/original/`.

O mesmo placeholder também é o que o endpoint bom devolve para um mapa
**inexistente** — com 200. Então "deu 200" não prova nada: a conferência é por
md5, feita offline pelo `scripts/_check-assets.mjs`. Em runtime não dá para
hashear um `<img>`, e é por isso que a cobertura é apurada uma vez e não
confiada ao browser do jogador.

> Isto é a mesma armadilha que o ragna-site documentou para os sprites de
> classe do `nn.ai4rei.net` (200 com corpo vazio). Não é coincidência: acervos
> de RO servem placeholder em vez de 404 com frequência.

## Licença

Sprites e mapas de RO são propriedade da Gravity. Uso em ferramenta de fã é
prática consolidada no meio, mas é material licenciado, não domínio público —
mesma ressalva registrada no ragna-site.

Hoje as URLs apontam para o site de origem (hotlink). Se o volume justificar,
o caminho é o que o ragna-site fez: baixar uma vez para `public/`, versionar e
servir do próprio domínio — poupa banda de terceiro e tira o timer da
dependência de um site alheio estar no ar. Nenhum dos dois endpoints exige
`Referer`, então o hotlink funciona por ora.

---

# Dados: o catálogo de MVPs

O app **não integra com rAthena**. Ele lê `data/mvps.json`, que está versionado
no repo — um catálogo estático, equivalente a uma planilha de tempos, só que
derivada em vez de digitada. Nada em runtime toca emulador ou banco de servidor.

O `scripts/build-mvps.mjs` é ferramenta de manutenção offline, fora do build e
do deploy. Roda só quando a tabela precisar ser refeita:

```
RATHENA_PATH=C:/IT/repo/ragnabeat npm run db:mvps
```

## Os tempos são os oficiais do jogo

Importa porque a ferramenta é para jogadores de qualquer servidor, e o repo de
onde extraí é de um servidor privado — o dado podia estar enviesado pelas
customizações dele. Não está:

| caminho | vs rAthena oficial |
|---|---|
| `npc/pre-re/mobs` | idêntico |
| `npc/re/mobs` | idêntico |
| `db/pre-re/mob_db.yml` | idêntico |
| `db/re/mob_db.yml` | só `DamageTaken` em ABRs, que não são MVP |

(`git diff upstream/master` em cada caminho.) As customizações do servidor vivem
em `db/ragnabeat_*.yml` e `db/import/`, que o script não aplica — com uma
exceção deliberada, os nomes pt-BR, que vêm do cliente oficial do RO LATAM e não
do servidor.

Servidores privados costumam mexer nos tempos. Se isso virar necessidade, o
caminho é override por guild, não refazer a tabela.

## O respawn não está no mob_db

Fecha o pendente *"Levantar tabela de tempos de respawn Pre-RE vs RE"*.

O `mob_db.yml` diz **quem** é MVP (`Modes.Mvp`), não de quanto em quanto tempo
ele nasce. O respawn está na linha de spawn, em `npc/{modo}/mobs/**.txt`:

```
abbey02,236,78,21,18	boss_monster	Fallen Bishop Hibram	1871,1,7200000,600000,1
                                                                 └ delay1 ┘ └delay2┘
```

`delay1` é o piso fixo em ms depois da morte; `delay2` é a janela aleatória
somada a ele. O MVP nasce **entre `delay1` e `delay1+delay2`** — não em um
instante. É o intervalo min/máx que a barra de progresso do card precisa
desenhar, e a razão de o modelo de dados ter `spawnAtEarliest` e
`spawnAtLatest` em vez de um horário só.

Pre-RE e RE são bases separadas no rAthena (`db/pre-re` e `db/re`, cada uma com
seu `mob_db` e sua árvore de spawn), então o mesmo MVP pode ter tempo diferente
nos dois — que é o que dá sentido ao toggle.

Um MVP com mais de um mapa (Atroce, Eddga, Doppelganger) pode ter delay
diferente por mapa. O JSON guarda todos em `spawns[]`; `respawnMinMinutes` no
topo é o menor piso, o padrão do card.

## Nomes em pt-BR

`db/ragnabeat_mob_names.yml`, no repo do rAthena: nomes oficiais do bRO,
extraídos do i18n do cliente RO LATAM. Resolve o i18n de nome de MVP sem
tradução manual — Bafomé, Senhor das Trevas, Valquíria Randgris.

**O arquivo está em latin-1, não em UTF-8.** Lido como UTF-8 vira `Escorpi<?>o`
sem estourar erro nenhum. O `build-mvps.mjs` passa o encoding explicitamente.
MVP sem entrada fica em inglês de propósito, e o script conta quantos são.

## MVP sem respawn livre

Nem todo `Modes.Mvp` entra no timer: instância (Memory of Thanatos, Biolab),
invocado por script (Ktullanux) e evento não têm linha `boss_monster` e portanto
não têm respawn cronometrável. Ficam no JSON com `spawns: []` e
`respawnMinMinutes: null`, e o script lista todos ao rodar — some do timer sem
sumir do catálogo.

## Cobertura

Conferido com `node scripts/_check-assets.mjs [pre-re|re]`, que baixa cada
arquivo de verdade e rejeita status ≠ 200, content-type que não seja imagem,
corpo minúsculo e o md5 do placeholder:

| modo | mapas | GIF | PNG |
|---|---|---|---|
| Pre-RE | 46/46 | 37/37 | 37/37 |
| RE | 70/70 | 59/59 | 59/59 |

Nenhum buraco: todo MVP cronometrável tem arte, e todo mapa de spawn tem
minimapa. **Não precisamos de fonte de imagem nova** — as duas que o ragna-site
já tinha, mais o endpoint de mapa apurado aqui, cobrem o timer inteiro.

| modo | MVPs (`Modes.Mvp`) | cronometráveis | mapas |
|---|---|---|---|
| Pre-RE | 53 | 37 | 46 |
| RE | 190 | 59 | 70 |

Sobre nome: 17 dos 37 cronometráveis do Pre-RE não têm entrada pt-BR, mas boa
parte deles é nome que o bRO também não traduz (Maya, Drake, Hatii, Atroce,
Ifrit). O fallback mostra a mesma string, então o buraco real é menor que o
número sugere — só vale revisar na hora de montar a tela.

---

# Camada de referência: ragnarokmvptimer.com

O site tem os tempos curados por jogador, e a estrutura de dados dele
(`js/mvp_list.js` → `cdr` + `max_delay`) é a mesma que derivei do rAthena
(`delay1` + `delay2`) — boa confirmação de que o modelo de intervalo está certo.

Comparado MVP a MVP, Pre-RE: **29 dos 37 batem exato**. As divergências não são
de tempo, são de **mapa**, e quase todas nos calabouços de guild
(`gld_dun01`–`gld_dun04`), onde cada servidor rotaciona MVP de um jeito:

| MVP | site | rAthena |
|---|---|---|
| Eddga | pay_fild10 | pay_fild11, gld_dun01 |
| Doppelganger | gld_dun04 | gld_dun02 |
| Bafomé, Flor do Luar, Abelha-Rainha | +gld_dun0X | — |
| Maya, Senhor das Trevas, Atroce | — | +gld_dun0X, +ra_fild02 |

O site também cronometra **mini-bosses que o rAthena não marca como
`Modes.Mvp`** — Angeling, Ghostring, Deviling, Arc Angeling, Maya Macho,
Kraken, Belzebu (id 1873, que o filtro perdia porque o `Modes.Mvp` está no
1874). Era um buraco real do meu filtro: jogador cronometra esses igual.

Por isso `build-catalog.mjs` **une** os mapas das duas fontes e, onde as duas
descrevem o mesmo mapa, deixa a referência ganhar. Isso levou o Pre-RE de 37
para 45 MVPs cronometráveis.

Créditos: dados de tempo de [ragnarokmvptimer.com](https://www.ragnarokmvptimer.com/)
(Gallact). São tempos de jogo — fato, não conteúdo autoral — mas o crédito fica
registrado.

# Ajuste por servidor

`data/custom-servers.json`. Servidor privado customiza respawn, e às vezes solta
como MVP livre algo que no oficial é de instância. O exemplo que motivou:

```json
{ "id": 2022, "namePtBr": "Sombra de Nidhogg",
  "respawn": [{ "map": "nyd_dun02", "cdr": 14400000, "max_delay": 0 }] }
```

O override **substitui** os spawns do MVP, não soma: se o servidor diz que ele
nasce em `nyd_dun02` a cada 4h, os mapas do oficial não valem mais ali.

O catálogo base nunca é editado à mão — o que muda de servidor para servidor
mora só neste arquivo, e é o que vai virar configuração por guild quando o
backend chegar.
