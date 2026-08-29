/* ============================================================================
   Construtores de URL de arte — só funções puras, sem nenhum dado.

   Portado do ragna-site (lib/sprites.ts), que já tinha mob e item validados.
   O que é NOVO aqui é o mapa: o ragna-site não precisava dele, o timer precisa
   (marcar o túmulo clicando no mapa). Ver docs/assets.md para o teste que
   apurou cada endpoint — em especial por que o mapa NÃO vem do mesmo host que
   o mob, embora exista uma URL em static.divine-pride que parece servir.

   Vive separado de qualquer módulo que importe data/mvps.json: um Client
   Component que só precise montar uma URL não deve arrastar o catálogo
   inteiro para o bundle do browser.
   ========================================================================= */

export const sprite = {
  /** GIF animado do mob, pelo Id do mob_db. */
  mobGif: (id: number) => `https://ratemyserver.net/mobs/${id}.gif`,

  /** Retrato estático do mob. Fallback de quando o GIF não existe. */
  mobPng: (id: number) => `https://static.divine-pride.net/images/mobs/png/${id}.png`,

  /* Minimapa do mapa, pelo nome interno (`prt_maze03`), sem extensão.

     Já vem com os pontos de spawn marcados em vermelho pelo próprio
     Divine Pride — de graça, é o desenho que o timer precisa.

     ATENÇÃO a dois vizinhos que parecem servir e não servem:

       static.divine-pride.net/images/maps/original/{map}.png
         Devolve 200 image/png para QUALQUER nome, sempre o mesmo
         placeholder de 5.610 bytes. Nunca o mapa. É o host do mob, e é
         justamente por isso que se cai nele.

       www.divine-pride.net/img/map/{map}          (sem o /original/)
         404 sempre, inclusive para mapa que existe.

     O host aqui é `www`, não `static`, e o caminho é `/img/map/original/`. */
  mapImage: (map: string) => `https://www.divine-pride.net/img/map/original/${map}`,
};

/* MD5 do placeholder que o Divine Pride devolve, com 200, no lugar de um mapa
   inexistente. Só serve para o script de validação/download: em runtime não dá
   para hashear um <img>. É a razão de a conferência de cobertura ser feita uma
   vez, offline, e não confiada ao browser do jogador. */
export const MAPA_PLACEHOLDER_MD5 = '1e92868d31890f7e46f867da225d4f56';
