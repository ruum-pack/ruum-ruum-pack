-- ============================================================================
-- Migration: 20260823000100_p1_sanear_signed_urls_datos_operativos.sql
-- Objetivo: Eliminar la persistencia de signed URLs en datos operativos
--           (gastos_traslado e incidencias) y asegurar el almacenamiento exclusivo
--           de rutas privadas de Storage.
-- ============================================================================

-- 1. Agregar columna comprobante_ruta a gastos_traslado
alter table public.gastos_traslado add column if not exists comprobante_ruta text;

comment on column public.gastos_traslado.comprobante_ruta is 
  'Ruta relativa privada en Supabase Storage (bucket evidencia). Nunca persistir signed URLs.';

-- 2. Migrar y sanear datos históricos en gastos_traslado
do $$
declare
  r record;
  v_ruta text;
  v_desc text;
begin
  for r in (
    select id, descripcion, comprobante_ruta
    from public.gastos_traslado
    where descripcion like '%/object/sign/%'
       or descripcion like '%[COMPROBANTE:%'
       or descripcion like '%[COMPROBANTE_RUTA:%'
  ) loop
    v_ruta := r.comprobante_ruta;
    v_desc := r.descripcion;

    -- Si no tenemos ruta aún, extraerla de la descripción
    if v_ruta is null then
      if v_desc ~ '/storage/v1/object/sign/evidencia/([^?# ]+)' then
        v_ruta := (regexp_match(v_desc, '/storage/v1/object/sign/evidencia/([^?# ]+)'))[1];
      elsif v_desc ~ '\[COMPROBANTE_RUTA:\s*([^\]]+)\]' then
        v_ruta := trim((regexp_match(v_desc, '\[COMPROBANTE_RUTA:\s*([^\]]+)\]'))[1]);
      elsif v_desc ~ '\[COMPROBANTE:\s*([^\]]+)\]' then
        v_ruta := trim((regexp_match(v_desc, '\[COMPROBANTE:\s*([^\]]+)\]'))[1]);
        if v_ruta ~ '/storage/v1/object/sign/evidencia/([^?# ]+)' then
          v_ruta := (regexp_match(v_ruta, '/storage/v1/object/sign/evidencia/([^?# ]+)'))[1];
        end if;
      end if;
    end if;

    -- Sanear descripción eliminando URLs firmadas con tokens
    if v_desc is not null then
      v_desc := regexp_replace(v_desc, '\[COMPROBANTE:\s*https?://[^\s\]]+/storage/v1/object/sign/[^\s\]]+\]', case when v_ruta is not null then '[COMPROBANTE_RUTA: ' || v_ruta || ']' else '' end, 'g');
      v_desc := regexp_replace(v_desc, 'https?://[^\s]+/storage/v1/object/sign/[^\s]+', coalesce(v_ruta, ''), 'g');
      v_desc := trim(v_desc);
      if v_desc = '' then
        v_desc := null;
      end if;
    end if;

    update public.gastos_traslado
    set comprobante_ruta = coalesce(r.comprobante_ruta, v_ruta),
        descripcion = v_desc
    where id = r.id;
  end loop;
end $$;

-- 3. Migrar y sanear datos históricos en incidencias
do $$
declare
  r record;
  v_desc text;
begin
  for r in (
    select id, descripcion
    from public.incidencias
    where descripcion like '%URL temporal:%'
       or descripcion like '%/storage/v1/object/sign/%'
  ) loop
    v_desc := r.descripcion;

    -- Quitar la línea 'URL temporal: ...' con signed URL
    v_desc := regexp_replace(v_desc, '\n*URL temporal:\s*https?://[^\n\r]+', '', 'g');
    -- Quitar cualquier signed URL residual
    v_desc := regexp_replace(v_desc, 'https?://[^\s]+/storage/v1/object/sign/[^\s]+', '', 'g');
    v_desc := trim(v_desc);

    update public.incidencias
    set descripcion = v_desc
    where id = r.id;
  end loop;
end $$;
