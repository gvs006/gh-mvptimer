# MVP Timer

Timer de respawn de MVPs de Ragnarok Online, em pt-BR, para uso de guild.

## Rodar

```bash
npm install
npm run dev      # http://localhost:3000
```

## Estado atual

Funciona, e é local. **Ainda não há backend**: os timers ficam no `localStorage`
de cada navegador, então duas pessoas na mesma página não veem o mesmo dado. O
compartilhamento com a guild (e as duas senhas, membro e admin) é o próximo
passo — ver [mvp-timer-planejamento.md](mvp-timer-planejamento.md).

- Registrar morte com um clique ou digitando `hh:mm`
- Quatro fases: contando → quase nascendo (90%) → pode estar vivo → nasceu e ninguém viu
- Barra mostrando a janela de spawn como faixa, não como instante
- Som no nascimento (Web Audio API, atrás de um botão por causa do autoplay)
- Busca, troca de servidor/modo, apelido de quem registrou

## Dados

O app lê `data/catalog.json`, versionado. Não conversa com emulador nenhum em
runtime — ver [docs/assets.md](docs/assets.md) para as fontes, a checagem de
cobertura de arte e a comparação com o ragnarokmvptimer.com.

Regerar (só quando as tabelas mudarem):

```bash
RATHENA_PATH=/caminho/do/rathena npm run db:mvps   # catálogo base
npm run db:catalog                                  # mescla + overrides de servidor
```

Ajuste de servidor privado vai em `data/custom-servers.json`.

## Créditos

- Sprites de mob: [RateMyServer](https://ratemyserver.net) e [Divine Pride](https://www.divine-pride.net)
- Mapas: Divine Pride
- Tempos de referência: [ragnarokmvptimer.com](https://www.ragnarokmvptimer.com/) (Gallact)

Arte de Ragnarok Online é propriedade da Gravity.
