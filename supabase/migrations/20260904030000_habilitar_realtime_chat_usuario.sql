-- GAP 2 — el estado del chat se centraliza en el cliente, pero sus eventos
-- deben llegar desde Supabase Realtime para que la fuente de cambios sea única.
do $$
begin
  if exists (
    select 1
      from pg_publication
     where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'mensajes_chat'
  ) then
    alter publication supabase_realtime add table public.mensajes_chat;
  end if;
end
$$;
