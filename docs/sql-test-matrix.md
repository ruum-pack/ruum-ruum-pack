# Matriz de Pruebas SQL

Esta matriz es la referencia unica para los archivos de `supabase/test`. Cada cambio sensible debe elegir la fila afectada y correr el subconjunto correspondiente despues de `pnpm db:reset`.

## Cobertura por flujo

| Flujo | Archivos |
| --- | --- |
| Traslado | `a1_cancelacion_estados.test.sql`, `b1_usuario_crea_traslado.test.sql`, `b2_piso_techo_precio.test.sql` |
| Pago | `b1_usuario_crea_traslado.test.sql`, `b2_piso_techo_precio.test.sql` |
| Identidad | `p0_documentos_identidad.test.sql`, `p1_registro_confirmacion.test.sql`, `rt03_rt04_solicitudes_integridad.test.sql`, `rt05_rt07_metadata_minima_compatibilidad.test.sql` |
| Conductor | `rt02_estados_expediente_conductor.test.sql`, `rt03_rt04_solicitudes_integridad.test.sql`, `rt05_rt07_metadata_minima_compatibilidad.test.sql`, `rt08_rt11_rpc_flujo_solicitud.test.sql`, `rt12_rt15_documentos_versionados.test.sql`, `rt17_rt18_consentimientos_separados.test.sql`, `rt23_rt24_torre_control_auditoria.test.sql`, `rt25_rls_perfiles_reales.test.sql`, `rt27_metricas_registro_conductor.test.sql` |
| Admin | `rt02_estados_expediente_conductor.test.sql`, `rt23_rt24_torre_control_auditoria.test.sql`, `rt25_rls_perfiles_reales.test.sql`, `rt27_metricas_registro_conductor.test.sql` |
| Auditoria | `rt17_rt18_consentimientos_separados.test.sql`, `rt23_rt24_torre_control_auditoria.test.sql`, `rt27_metricas_registro_conductor.test.sql` |
| RLS | `b1_usuario_crea_traslado.test.sql`, `p0_documentos_identidad.test.sql`, `rt02_estados_expediente_conductor.test.sql`, `rt12_rt15_documentos_versionados.test.sql`, `rt17_rt18_consentimientos_separados.test.sql`, `rt23_rt24_torre_control_auditoria.test.sql`, `rt25_rls_perfiles_reales.test.sql`, `rt27_metricas_registro_conductor.test.sql` |
| Metricas | `rt27_metricas_registro_conductor.test.sql` |

## Matriz por archivo

| Archivo | Flujos | Regresion que protege | Cuando correrlo |
| --- | --- | --- | --- |
| `a1_cancelacion_estados.test.sql` | Traslado | Cancelacion y coherencia de estados del traslado. | Cambios en estados, cancelacion o transiciones de traslado. |
| `b1_usuario_crea_traslado.test.sql` | Traslado, pago, RLS | Creacion por usuario via RPC, autorizacion, vehiculos, decision server-side de `tipo_pago` y datos operativos. | Cambios en alta de traslado, permisos de usuario, vehiculos o contratos de `usuario_crea_traslado`. |
| `b2_piso_techo_precio.test.sql` | Traslado, pago | Separacion de `presupuesto_usuario` frente a `precio_cotizado`/`precio_final`, idempotencia y limites de precio. | Cambios en cotizacion, pago, Stripe, presupuesto, precio final o reglas de piso/techo. |
| `p0_documentos_identidad.test.sql` | Identidad, RLS | Bucket/documentos de identidad, acceso privado y escrituras controladas. | Cambios en validacion documental, storage, privacidad o documentos de usuario. |
| `p1_registro_confirmacion.test.sql` | Identidad | Registro con confirmacion, consentimiento y persistencia sin depender de sesion inmediata. | Cambios en auth, signup, confirmacion de correo o terminos. |
| `rt02_estados_expediente_conductor.test.sql` | Conductor, admin, RLS | Maquina de estados de expediente y bloqueo de cambios administrativos directos. | Cambios en estados de conductor, aprobacion, rechazo, suspension o servicios admin. |
| `rt03_rt04_solicitudes_integridad.test.sql` | Conductor, identidad | Integridad entre solicitudes/conductores y normalizacion de datos como CURP, telefono y licencia. | Cambios en captura de registro, indices unicos o normalizadores de solicitud. |
| `rt05_rt07_metadata_minima_compatibilidad.test.sql` | Conductor, identidad | Metadata minima de auth, compatibilidad legacy y ausencia de PII innecesaria. | Cambios en metadata de auth, migraciones de perfil o compatibilidad de registro. |
| `rt08_rt11_rpc_flujo_solicitud.test.sql` | Conductor | RPCs de iniciar, guardar y enviar solicitud; idempotencia, validacion y bloqueo posterior. | Cambios en flujo de registro CONCER o RPCs de solicitud. |
| `rt12_rt15_documentos_versionados.test.sql` | Conductor, RLS | Documentos versionados, version actual, reemplazos y ruta validada de storage. | Cambios en documentos de conductor, buckets, versiones o reemplazos. |
| `rt17_rt18_consentimientos_separados.test.sql` | Conductor, auditoria, RLS | Consentimientos separados, hashes, append-only y restriccion de escrituras directas. | Cambios en consentimientos, terminos, auditoria legal o historial. |
| `rt23_rt24_torre_control_auditoria.test.sql` | Conductor, admin, auditoria, RLS | Decisiones de Torre de Control por RPC, actor/motivo e historial auditable. | Cambios en panel admin, revision de expedientes o auditoria de decisiones. |
| `rt25_rls_perfiles_reales.test.sql` | Admin, RLS | Perfiles operativos reales, aislamiento por rol y privilegios admin. | Cambios en politicas RLS, perfiles, roles o permisos transversales. |
| `rt27_metricas_registro_conductor.test.sql` | Admin, auditoria, RLS, metricas | Telemetria de registro, privacidad, inmutabilidad y agregacion admin. | Cambios en metricas de registro, eventos de conductor o dashboard admin. |

## Comandos

Matriz completa:

```powershell
pnpm db:reset
supabase test db supabase/test/a1_cancelacion_estados.test.sql supabase/test/b1_usuario_crea_traslado.test.sql supabase/test/b2_piso_techo_precio.test.sql supabase/test/p0_documentos_identidad.test.sql supabase/test/p1_registro_confirmacion.test.sql supabase/test/rt02_estados_expediente_conductor.test.sql supabase/test/rt03_rt04_solicitudes_integridad.test.sql supabase/test/rt05_rt07_metadata_minima_compatibilidad.test.sql supabase/test/rt08_rt11_rpc_flujo_solicitud.test.sql supabase/test/rt12_rt15_documentos_versionados.test.sql supabase/test/rt17_rt18_consentimientos_separados.test.sql supabase/test/rt23_rt24_torre_control_auditoria.test.sql supabase/test/rt25_rls_perfiles_reales.test.sql supabase/test/rt27_metricas_registro_conductor.test.sql
```

Subconjunto obligatorio para traslado/pago:

```powershell
pnpm db:reset
supabase test db supabase/test/b1_usuario_crea_traslado.test.sql supabase/test/b2_piso_techo_precio.test.sql
```
