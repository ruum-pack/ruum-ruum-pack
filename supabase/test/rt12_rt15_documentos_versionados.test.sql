-- RT-12 / RT-13 / RT-14 / RT-15 — Los documentos de conductor sólo entran por
-- `registrar_documento_conductor` (ruta aislada por auth_user_id/solicitud_id,
-- previamente validada en `documentos_storage_validados`), tienen una única
-- versión vigente por tipo, y el reemplazo conserva el historial.

create extension if not exists pgtap with schema extensions;

begin;

select plan(10);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000006-0000-4000-8000-000000000001', 'rt12-auth@rt12.test', now(), '{}'::jsonb, '{"tipo_registro":"conductor","version_registro":2}'::jsonb, now(), now()),
  ('00000006-0000-4000-8000-000000000002', 'rt12-otro@rt12.test', now(), '{}'::jsonb, '{"tipo_registro":"conductor","version_registro":2}'::jsonb, now(), now()),
  ('00000006-0000-4000-8000-00000000000a', 'rt12-admin@rt12.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.admins (id, auth_user_id, nombre)
values ('00000006-0000-4000-8000-0000000000ad', '00000006-0000-4000-8000-00000000000a', 'Admin RT14');

select
  (select id from public.solicitudes_conductor where auth_user_id = '00000006-0000-4000-8000-000000000001') as solicitud,
  (select id from public.solicitudes_conductor where auth_user_id = '00000006-0000-4000-8000-000000000002') as otra_solicitud
\gset

select
  ('00000006-0000-4000-8000-000000000001/' || :'solicitud' || '/licencia_frente/primera.jpg') as ruta1,
  ('00000006-0000-4000-8000-000000000001/' || :'solicitud' || '/licencia_frente/segunda.jpg') as ruta2,
  ('00000006-0000-4000-8000-000000000001/' || :'otra_solicitud' || '/licencia_frente/ajeno.jpg') as ruta_ajena,
  ('00000006-0000-4000-8000-000000000001/' || :'solicitud' || '/licencia_reverso/sin-validar.jpg') as ruta_sin_validar,
  ('00000006-0000-4000-8000-000000000001/' || :'otra_solicitud' || '/licencia_reverso/forzado.jpg') as ruta_forzada
\gset

insert into public.documentos_storage_validados (ruta, auth_user_id, objetivo_id, tipo, sha256) values
  (:'ruta1', '00000006-0000-4000-8000-000000000001', :'solicitud', 'licencia_frente', repeat('a', 64)),
  (:'ruta2', '00000006-0000-4000-8000-000000000001', :'solicitud', 'licencia_frente', repeat('b', 64)),
  (:'ruta_ajena', '00000006-0000-4000-8000-000000000001', :'otra_solicitud', 'licencia_frente', repeat('c', 64));

-- psql no interpola variables `:'var'` dentro de bloques `do $$ ... $$`
-- (las cadenas dollar-quoted quedan fuera de su sustitución léxica), así que
-- los valores que un `do` necesita se puentean vía GUCs de sesión.
select set_config('rt12.solicitud', :'solicitud', true);
select set_config('rt12.otra_solicitud', :'otra_solicitud', true);
select set_config('rt12.ruta1', :'ruta1', true);
select set_config('rt12.ruta2', :'ruta2', true);
select set_config('rt12.ruta_forzada', :'ruta_forzada', true);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000006-0000-4000-8000-000000000001', true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into storage.objects (bucket_id, name, owner_id)
values ('documentos-conductor', :'ruta1', '00000006-0000-4000-8000-000000000001');

select throws_ok(
  format($sql$ insert into storage.objects(bucket_id,name,owner_id) values('documentos-conductor',%L,'00000006-0000-4000-8000-000000000001') $sql$, :'ruta_ajena'),
  '42501', null,
  'RT-12: bloquea subir bajo una solicitud ajena'
);

select throws_ok(
  format($sql$ insert into storage.objects(bucket_id,name,owner_id) values('documentos-conductor',%L,'00000006-0000-4000-8000-000000000001') $sql$, :'ruta_sin_validar'),
  '42501', null,
  'RT-12/16: bloquea el upload directo sin validación de contenido'
);

do $$ begin
  perform public.registrar_documento_conductor(
    current_setting('rt12.solicitud')::uuid, 'licencia_frente', 'primera.jpg', current_setting('rt12.ruta1')
  );
end $$;

select ok(
  exists(
    select 1 from public.documentos_conductor
    where solicitud_id = :'solicitud'::uuid and tipo = 'licencia_frente' and version = 1
      and estado = 'en_revision' and notas_admin is null and es_actual
      and revisado_por is null and revisado_en is null and motivo_rechazo is null
  ),
  'RT-13/14: el servidor fija los campos iniciales del documento'
);

select throws_ok(
  format($sql$ insert into public.documentos_conductor(solicitud_id,tipo,nombre_archivo,url,estado) values(%L,'licencia_reverso','directo.jpg','directo.jpg','aprobado') $sql$, :'solicitud'),
  '42501', null,
  'RT-13: authenticated no puede insertar una fila directamente'
);

insert into storage.objects (bucket_id, name, owner_id)
values ('documentos-conductor', :'ruta2', '00000006-0000-4000-8000-000000000001');

select throws_like(
  format($sql$ select public.registrar_documento_conductor(%L,'licencia_frente','segunda.jpg',%L) $sql$, :'solicitud', :'ruta2'),
  '%versión vigente%',
  'RT-14: rechaza dos versiones vigentes del mismo tipo'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000006-0000-4000-8000-00000000000a', true);
  perform public.revisar_documento_conductor_admin(
    (select id from public.documentos_conductor where solicitud_id = current_setting('rt12.solicitud')::uuid and tipo = 'licencia_frente' and version = 1),
    'rechazado', 'La imagen no permite leer los datos.'
  );
end $$;

select ok(
  exists(
    select 1 from public.documentos_conductor
    where solicitud_id = :'solicitud'::uuid and tipo = 'licencia_frente' and version = 1
      and estado = 'rechazado' and revisado_por = '00000006-0000-4000-8000-0000000000ad'
      and revisado_en is not null and motivo_rechazo is not null
  ),
  'RT-14: la revisión administrativa queda trazable'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000006-0000-4000-8000-000000000001', true);
  perform public.reemplazar_documento_conductor(
    (select id from public.documentos_conductor where solicitud_id = current_setting('rt12.solicitud')::uuid and tipo = 'licencia_frente' and version = 1),
    'segunda.jpg', current_setting('rt12.ruta2')
  );
end $$;

select ok(
  exists(
    select 1 from public.documentos_conductor
    where solicitud_id = :'solicitud'::uuid and tipo = 'licencia_frente' and version = 1
      and estado = 'reemplazado' and not es_actual and reemplazado_en is not null
  ),
  'RT-15: la versión anterior queda marcada como reemplazada'
);
select ok(
  exists(
    select 1 from public.documentos_conductor d2
    where d2.solicitud_id = :'solicitud'::uuid and d2.tipo = 'licencia_frente' and d2.version = 2
      and d2.estado = 'en_revision' and d2.es_actual and d2.revisado_por is null and d2.motivo_rechazo is null
      and d2.documento_anterior_id = (
        select id from public.documentos_conductor
        where solicitud_id = :'solicitud'::uuid and tipo = 'licencia_frente' and version = 1
      )
  ),
  'RT-15: la nueva versión queda enlazada a la anterior y en revisión'
);
select is(
  (select count(*) from public.documentos_conductor where solicitud_id = :'solicitud'::uuid and tipo = 'licencia_frente' and es_actual)::int,
  1,
  'RT-14: sólo existe una versión vigente por tipo'
);

-- Aunque un objeto ajeno hubiese sido creado por un backend privilegiado,
-- el RPC vuelve a comprobar propiedad y ruta antes de registrar la fila.
do $$ begin
  perform set_config('role', 'postgres', true);
  insert into storage.objects (bucket_id, name, owner_id)
  values ('documentos-conductor', current_setting('rt12.ruta_forzada'), '00000006-0000-4000-8000-000000000001');
  perform set_config('role', 'authenticated', true);
end $$;

select throws_like(
  format($sql$ select public.registrar_documento_conductor(%L,'licencia_reverso','forzado.jpg',%L) $sql$, :'otra_solicitud', :'ruta_forzada'),
  '%expediente ajeno%',
  'RT-12/13: el RPC rechaza un expediente ajeno'
);

select * from finish();

rollback;
