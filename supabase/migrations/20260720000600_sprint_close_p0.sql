-- Sprint CLOSE P0: versión única de app conductor
insert into public.politicas_version_app (plataforma, version_vigente, version_minima, version_recomendada, mensaje, funcionalidades_incompatibles, actualizado_en)
values ('android','1.0.0','1.0.0','1.0.0','Ruum Ruum Conductor 1.0.0 es la versión operativa vigente.','{}'::text[],now())
on conflict (plataforma) do update set version_vigente=excluded.version_vigente, version_minima=excluded.version_minima, version_recomendada=excluded.version_recomendada, mensaje=excluded.mensaje, actualizado_en=now();
