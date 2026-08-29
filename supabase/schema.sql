-- ============================================================================
-- MVP Timer — schema
-- Rodar uma vez no SQL Editor do Supabase.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Guild: o namespace de tudo. Não existe conta por pessoa — duas senhas
-- compartilhadas, uma de membro e uma de admin.
-- ---------------------------------------------------------------------------
create table if not exists guilds (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text unique not null,
  name                   text not null,
  server_label           text not null default '',
  mode                   text not null default 'pre-re' check (mode in ('pre-re','re')),

  -- scrypt, nunca texto puro: o repo é público e o banco é de terceiro.
  member_password_hash   text not null,
  admin_password_hash    text not null,

  -- O que faz a troca de senha REVOGAR de verdade, em vez de só renomear o
  -- segredo. A versão viaja dentro do cookie de sessão e é conferida a cada
  -- request; trocar a senha incrementa a versão e todo cookie antigo morre.
  -- São duas versões separadas de propósito: derrubar os membros não pode
  -- derrubar o admin, senão ele se expulsa no meio da faxina.
  member_session_version int not null default 1,
  admin_session_version  int not null default 1,

  passwords_rotated_at   timestamptz,
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Timers. A chave é (guild, mvp, mapa): o mesmo MVP em mapas diferentes são
-- timers independentes — matar o Atroce em ra_fild03 não diz nada sobre o de
-- ve_fild02.
-- ---------------------------------------------------------------------------
create table if not exists timers (
  guild_id   uuid not null references guilds(id) on delete cascade,
  mvp_id     int  not null,
  map        text not null,
  death_at   timestamptz not null,
  coord_x    int,
  coord_y    int,
  -- Apelido de quem registrou. Não é identidade forte (dá para digitar o nome
  -- de outro), mas é o que responde "quem sabotou" antes de trocar a senha.
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (guild_id, mvp_id, map)
);

create index if not exists timers_guild_idx on timers(guild_id);

-- ---------------------------------------------------------------------------
-- Tentativas de login, para o atraso progressivo.
-- Senha de guild é curta e compartilhada; sem limite, cai em minutos.
-- Atraso progressivo em vez de bloqueio duro: bloqueio deixa qualquer um
-- trancar a guild inteira do lado de fora só errando senha de propósito.
-- ---------------------------------------------------------------------------
create table if not exists login_attempts (
  id       bigserial primary key,
  slug     text not null,
  ip       text not null,
  at       timestamptz not null default now()
);

create index if not exists login_attempts_lookup on login_attempts(slug, ip, at desc);

-- ---------------------------------------------------------------------------
-- RLS ligado e SEM policy nenhuma = ninguém entra pela anon key.
-- Todo acesso passa pelas rotas do Next com a service role key, que ignora RLS
-- e roda só no servidor. Se a anon key vazar (ela é pública por natureza), não
-- dá acesso a nada.
-- ---------------------------------------------------------------------------
alter table guilds         enable row level security;
alter table timers         enable row level security;
alter table login_attempts enable row level security;

-- Privilégios explícitos, para não depender das caixinhas marcadas na criação
-- do projeto ("Automatically expose new tables", "Enable automatic RLS"). O
-- que vale é o que está escrito aqui: revoga de quem fala pelo browser, concede
-- a quem só existe no servidor. Rodar isto deixa o schema correto com qualquer
-- combinação daquelas opções.
revoke all on guilds         from anon, authenticated;
revoke all on timers         from anon, authenticated;
revoke all on login_attempts from anon, authenticated;

grant usage on schema public to service_role;
grant all on guilds         to service_role;
grant all on timers         to service_role;
grant all on login_attempts to service_role;

-- login_attempts.id é bigserial: sem a sequence, o insert do login falha.
grant usage, select on all sequences in schema public to service_role;

-- Limpeza das tentativas antigas. Chamada pela própria rota de login; não
-- depende de cron, que o free tier não tem.
create or replace function purge_login_attempts() returns void
language sql as $$
  delete from login_attempts where at < now() - interval '1 hour';
$$;

-- ---------------------------------------------------------------------------
-- Ajuste de servidor por guild.
-- A guild joga num servidor específico, que pode customizar respawn (a Sombra
-- de Nidhogg do ThanatosRO nasce em 4h num mapa onde o oficial nem a solta).
-- Sem isto a guild cairia no catálogo puro do modo e não veria o MVP custom.
-- Aponta para um `id` de data/custom-servers.json; nulo = catálogo puro.
-- ---------------------------------------------------------------------------
alter table guilds add column if not exists server_id text;
