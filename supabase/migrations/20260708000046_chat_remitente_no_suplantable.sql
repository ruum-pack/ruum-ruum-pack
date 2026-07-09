-- Auditoría H-3 — Suplantación de remitente en el chat.
--
-- services/chat.ts::enviarMensaje inserta `remitente` como un literal que pasa
-- la UI ("usuario" en app-usuario, "conductor" en app-conductor). La policy de
-- 0013 ("usuario_ve_y_envia_mensajes_de_sus_traslados" / la del conductor) es
-- FOR ALL USING (membresía del traslado), SIN with check sobre `remitente`.
-- Un conductor legítimo del traslado puede entonces insertar un mensaje con
-- remitente='usuario' y suplantar al cliente en el historial de chat — que es
-- evidencia con valor legal en disputas (PRD §4.12 / §16).
--
-- Corrección: el remitente deja de ser un dato del cliente. Se envía por una
-- RPC security definer que DERIVA el rol desde auth.uid() contra el traslado,
-- y se revoca el INSERT directo del cliente sobre mensajes_chat. La lectura y
-- el Realtime (SELECT) siguen igual que en 0013.

create or replace function public.enviar_mensaje_chat(
  p_traslado_id uuid,
  p_contenido text
)
returns public.mensajes_chat
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remitente public.remitente_chat;
  v_es_usuario boolean;
  v_es_conductor boolean;
  v_fila public.mensajes_chat;
  v_contenido text := btrim(p_contenido);
begin
  if v_contenido = '' then
    raise exception 'El mensaje no puede estar vacío.';
  end if;

  -- ¿El auth.uid() es el usuario dueño del traslado?
  select exists (
    select 1 from public.traslados t
    join public.usuarios u on u.id = t.usuario_id
    where t.id = p_traslado_id and u.auth_user_id = auth.uid()
  ) into v_es_usuario;

  -- ¿O el conductor asignado al traslado?
  select exists (
    select 1 from public.traslados t
    join public.conductores c on c.id = t.conductor_id
    where t.id = p_traslado_id and c.auth_user_id = auth.uid()
  ) into v_es_conductor;

  if v_es_usuario then
    v_remitente := 'usuario';
  elsif v_es_conductor then
    v_remitente := 'conductor';
  else
    raise exception 'No formas parte de este traslado.';
  end if;

  insert into public.mensajes_chat (traslado_id, remitente, contenido)
  values (p_traslado_id, v_remitente, v_contenido)
  returning * into v_fila;

  return v_fila;
end;
$$;

-- Cierra la puerta del INSERT directo: las policies FOR ALL de 0013 permitían
-- que el cliente insertara con remitente arbitrario. Se reemplazan por FOR
-- SELECT (lectura/Realtime) y toda escritura pasa por la RPC de arriba.
drop policy if exists "usuario_ve_y_envia_mensajes_de_sus_traslados" on public.mensajes_chat;
drop policy if exists "conductor_ve_y_envia_mensajes_de_sus_traslados" on public.mensajes_chat;

create policy "usuario_lee_mensajes_de_sus_traslados"
  on public.mensajes_chat for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_lee_mensajes_de_sus_traslados"
  on public.mensajes_chat for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

-- La policy admin (FOR ALL) de 0013 se conserva intacta.

-- Nota de aplicación: services/chat.ts::enviarMensaje debe cambiar de
--   cliente.from("mensajes_chat").insert({ traslado_id, remitente, contenido })
-- a
--   cliente.rpc("enviar_mensaje_chat", { p_traslado_id: trasladoId, p_contenido: contenido })
-- y dejar de recibir `remitente` como argumento (los llamadores en
-- ChatTraslado.tsx / ChatViaje.tsx ya no lo pasan).
