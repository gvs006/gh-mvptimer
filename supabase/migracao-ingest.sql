-- Token de bot: como o finder registra morte sem ser gente.
--
-- Separado da senha de membro de propósito. O finder roda na máquina de quem
-- joga, e a senha de membro circula no Discord — se o bot usasse a mesma, cada
-- troca de senha derrubaria o bot junto, e quem tem o bot teria a senha da
-- guilda. Token próprio: revoga um sem mexer no outro.
alter table guilds add column if not exists bot_token text;

-- Como o timer entrou: quem digitou, ou o finder. Some do card a dúvida de
-- "isso aí foi alguém que viu, ou o bot que passou no mapa?".
alter table timers add column if not exists source text not null default 'manual';

-- Quão confiável é o horário. O finder sabe a hora em que VIU a lápide, que só
-- é a hora da morte se a lápide nasceu na frente dele (o rAthena solta a lápide
-- 9s depois da morte — battle_config.mvp_tomb_delay). Lápide que já estava lá
-- quando ele chegou tem hora desconhecida, e marcar isso como exato colocaria
-- um timer errado na tela, que é pior que timer nenhum.
alter table timers add column if not exists precision text not null default 'exata';
