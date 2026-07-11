-- P0 — Bucket y actualización documental de usuarios endurecidos.
create extension if not exists pgtap with schema extensions;

begin;
select plan(16);

select is(
  (select file_size_limit from storage.buckets where id = 'documentos-identidad'),
  10485760::bigint,
  'P0: el bucket limita archivos a 10 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'documentos-identidad'),
  array['image/jpeg', 'image/png', 'application/pdf']::text[],
  'P0: el bucket sólo admite JPEG, PNG y PDF'
);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000007-0000-4000-8000-000000000001', 'p0-identidad@p0.test', now(), '{}', '{"tipo_registro":"usuario","tipo_cuenta":"personal"}', now(), now()),
  ('00000007-0000-4000-8000-000000000010', 'p0-identidad-otro@p0.test', now(), '{}', '{"tipo_registro":"usuario","tipo_cuenta":"personal"}', now(), now());

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000007-0000-4000-8000-000000000001', true);
  perform set_config('role', 'authenticated', true);
end $$;

do $$ begin
  perform set_config('role', 'postgres', true);
  insert into public.documentos_identidad_storage_validados(id, ruta, auth_user_id, usuario_id, sha256, mime, tamano_bytes)
  values (
    '00000007-0000-4000-8000-000000000099',
    '00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000002.pdf',
    '00000007-0000-4000-8000-000000000001',
    (select id from public.usuarios where auth_user_id = '00000007-0000-4000-8000-000000000001'),
    repeat('a', 64), 'application/pdf', 1024
  );
  perform set_config('role', 'authenticated', true);
end $$;
insert into storage.objects(bucket_id, name, owner_id)
values (
  'documentos-identidad',
  '00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000002.pdf',
  '00000007-0000-4000-8000-000000000001'
);

select throws_ok(
  $$insert into storage.objects(bucket_id,name,owner_id) values ('documentos-identidad','00000007-0000-4000-8000-000000000001/arbitrario/identidad.pdf','00000007-0000-4000-8000-000000000001')$$,
  '42501', null, 'P0: rechaza subdirectorios arbitrarios'
);
select throws_ok(
  $$insert into storage.objects(bucket_id,name,owner_id) values ('documentos-identidad','00000007-0000-4000-8000-000000000001/otro.pdf','00000007-0000-4000-8000-000000000001')$$,
  '42501', null, 'P0: rechaza nombres fuera del patrón'
);
select throws_ok(
  $$insert into storage.objects(bucket_id,name,owner_id) values ('documentos-identidad','00000007-0000-4000-8000-000000000001/identidad.exe','00000007-0000-4000-8000-000000000001')$$,
  '42501', null, 'P0: rechaza extensiones no permitidas'
);
select throws_ok(
  $$insert into storage.objects(bucket_id,name,owner_id) values ('documentos-identidad','00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000003.pdf','00000007-0000-4000-8000-000000000001')$$,
  '42501', null, 'P0: rechaza incluso una ruta válida si no tiene sello temporal'
);
select throws_like(
  $$update public.usuarios set doc_identidad_url='https://falso.test/doc.pdf' where auth_user_id='00000007-0000-4000-8000-000000000001'$$,
  '%flujo autorizado%', 'P0: el usuario no puede colocar una URL falsa'
);
select throws_like(
  $$update public.usuarios set estado_verificacion='en_revision' where auth_user_id='00000007-0000-4000-8000-000000000001'$$,
  '%flujo autorizado%', 'P0: el usuario no puede autoasignarse en_revision'
);

update public.usuarios set nombre = 'Perfil todavía editable'
where auth_user_id = '00000007-0000-4000-8000-000000000001';
select is(
  (select nombre from public.usuarios where auth_user_id = '00000007-0000-4000-8000-000000000001'),
  'Perfil todavía editable', 'P0: el resto del perfil sigue editable'
);

select lives_ok(
  $$select public.registrar_documento_identidad('00000007-0000-4000-8000-000000000099','00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000002.pdf',repeat('a',64))$$,
  'P0: la RPC controlada registra el documento existente'
);
select is(
  (select estado_verificacion::text from public.usuarios where auth_user_id = '00000007-0000-4000-8000-000000000001'),
  'en_revision', 'P0: la RPC mueve el expediente a en_revision'
);
select is(
  public.ruta_identidad_validada_para_auth('00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000002.pdf'),
  false, 'P0: la RPC consume el sello y no permite reutilizarlo'
);
select throws_like(
  $$select public.registrar_documento_identidad('00000007-0000-4000-8000-000000000099','00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000002.pdf',repeat('a',64))$$,
  '%ya fue consumido%', 'P0: el sello no puede consumirse dos veces'
);

do $$ begin
  perform set_config('role', 'postgres', true);
  insert into public.documentos_identidad_storage_validados(
    id, ruta, auth_user_id, usuario_id, sha256, mime, tamano_bytes, creado_en, expira_en
  ) values (
    '00000007-0000-4000-8000-000000000098',
    '00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000004.pdf',
    '00000007-0000-4000-8000-000000000001',
    (select id from public.usuarios where auth_user_id='00000007-0000-4000-8000-000000000001'),
    repeat('b',64), 'application/pdf', 2048, now()-interval '20 minutes', now()-interval '10 minutes'
  );
  insert into storage.objects(bucket_id,name,owner_id) values (
    'documentos-identidad',
    '00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000004.pdf',
    '00000007-0000-4000-8000-000000000001'
  );
  insert into public.documentos_identidad_storage_validados(
    id, ruta, auth_user_id, usuario_id, sha256, mime, tamano_bytes
  ) values (
    '00000007-0000-4000-8000-000000000097',
    '00000007-0000-4000-8000-000000000010/00000007-0000-4000-8000-000000000005.pdf',
    '00000007-0000-4000-8000-000000000010',
    (select id from public.usuarios where auth_user_id='00000007-0000-4000-8000-000000000010'),
    repeat('c',64), 'application/pdf', 2048
  );
  perform set_config('role', 'authenticated', true);
end $$;

select throws_like(
  $$select public.registrar_documento_identidad('00000007-0000-4000-8000-000000000098','00000007-0000-4000-8000-000000000001/00000007-0000-4000-8000-000000000004.pdf',repeat('b',64))$$,
  '%está vencido%', 'P0: la RPC rechaza sellos vencidos'
);
select throws_like(
  $$select public.registrar_documento_identidad('00000007-0000-4000-8000-000000000097','00000007-0000-4000-8000-000000000010/00000007-0000-4000-8000-000000000005.pdf',repeat('c',64))$$,
  '%no pertenece%', 'P0: un sello de otro usuario no funciona'
);
select set_config('role', 'postgres', true);
select ok(
  exists(
    select 1 from public.registro_auditoria a
    where a.evento='carga_documento_identidad'
      and a.actor_id=(select id from public.usuarios where auth_user_id='00000007-0000-4000-8000-000000000001')
      and a.datos ?& array['fecha','sha256','mime_detectado','tamano_bytes','version','estado','origen','documento_anterior_id']
      and a.datos->>'origen'='edge_function'
  ),
  'P0: la auditoría conserva metadatos y origen sin contenido del documento'
);

select * from finish();
rollback;
