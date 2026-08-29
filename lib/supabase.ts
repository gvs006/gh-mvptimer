import 'server-only';
import { createClient } from '@supabase/supabase-js';

/* Service role key: ignora RLS e NUNCA pode chegar ao browser. Por isso este
   módulo é `server-only` — se algum componente de cliente importar por engano,
   o build quebra em vez de vazar a chave em produção.

   As tabelas têm RLS ligado e nenhuma policy, então a anon key (que é pública
   por natureza) não abre nada. Todo acesso passa por aqui. */

/* Tipos escritos à mão em vez de gerados: são três tabelas, e depender do
   `supabase gen types` colocaria o build refém de ter CLI logada. Se o schema
   mudar, isto muda junto — está ao lado de supabase/schema.sql. */
export interface Database {
  public: {
    Tables: {
      guilds: {
        Row: {
          id: string;
          slug: string;
          name: string;
          server_label: string;
          mode: 'pre-re' | 're';
          server_id: string | null;
          member_password_hash: string;
          admin_password_hash: string;
          member_session_version: number;
          admin_session_version: number;
          passwords_rotated_at: string | null;
          created_at: string;
        };
        Insert: {
          slug: string;
          name: string;
          server_label?: string;
          mode?: 'pre-re' | 're';
          server_id?: string | null;
          member_password_hash: string;
          admin_password_hash: string;
        };
        Update: Partial<Database['public']['Tables']['guilds']['Row']>;
        Relationships: [];
      };
      timers: {
        Row: {
          guild_id: string;
          mvp_id: number;
          map: string;
          death_at: string;
          coord_x: number | null;
          coord_y: number | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Database['public']['Tables']['timers']['Row'];
        Update: Partial<Database['public']['Tables']['timers']['Row']>;
        Relationships: [];
      };
      login_attempts: {
        Row: { id: number; slug: string; ip: string; at: string };
        Insert: { slug: string; ip: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      purge_login_attempts: { Args: Record<string, never>; Returns: void };
    };
  };
}

let cliente: ReturnType<typeof createClient<Database>> | null = null;

export function db() {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.');

  cliente = createClient<Database>(url, chave, { auth: { persistSession: false } });
  return cliente;
}
