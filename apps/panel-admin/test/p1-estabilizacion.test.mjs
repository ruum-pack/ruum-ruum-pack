import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL(`../../../${p}`,import.meta.url),'utf8');
test('dashboard usa refresco híbrido y no polling de 30 segundos',()=>{
  const page=read('apps/panel-admin/src/app/DashboardCliente.tsx');
  assert.match(page,/useHybridRefresh/); assert.doesNotMatch(page,/setInterval\(\(\) => void cargar\(true\), 30000\)/);
});
test('trazabilidad administrativa no usa localStorage',()=>{
  const page=read('apps/panel-admin/src/app/viajes/page.tsx');
  assert.match(page,/guardarPreferenciaAdmin/); assert.doesNotMatch(page,/STORAGE_AUDITORIA_MASIVA|localStorage\.setItem\([^\n]*auditoria/);
});
test('historial masivo de traslados se lee de auditoria persistente',()=>{
  const page=read('apps/panel-admin/src/app/viajes/page.tsx');
  const service=read('packages/api/src/services/admin.ts');
  assert.doesNotMatch(page,/PREF_AUDITORIA_MASIVA|viajes\.auditoria_masiva/);
  assert.match(page,/listarAuditoriaOperativaTraslados/);
  assert.match(service,/registro_auditoria/);
  assert.match(service,/modificacion_masiva_traslados/);
});
test('P1 integridad funcional usa RPCs y permisos propios',()=>{
  const service=read('packages/api/src/services/admin.ts');
  const permisos=read('packages/api/src/services/permisos-admin.ts');
  const sql=read('supabase/migrations/20260723001000_p1_integridad_funcional_admin.sql');
  assert.match(service,/admin_actualizar_usuario_atomic/);
  assert.match(service,/admin_actualizar_conductor_atomic/);
  assert.match(service,/admin_listar_solicitudes_conductor_paginadas/);
  assert.match(service,/admin_finanzas_traslado/);
  assert.match(permisos,/vehiculos:leer/);
  assert.match(permisos,/vehiculos:gestionar/);
  assert.match(sql,/entidad_afectada','usuario/);
  assert.match(sql,/entidad_afectada','conductor/);
  assert.match(sql,/gastos_traslado/);
  assert.match(sql,/margen_estimado/);
});
test('traslados no conserva ramas demo',()=>{
  const list=read('apps/panel-admin/src/app/viajes/page.tsx');
  const detail=read('apps/panel-admin/src/app/viajes/[id]/page.tsx');
  assert.doesNotMatch(`${list}\n${detail}`,/puedeUsarDatosDemo|esDemo|Modo demo|modo demo|datos de ejemplo|demo-\$\{Date\.now\(\)\}|Tarifa normativa aplicada en modo demo|Traslado marcado como fallido en modo demo/);
});
test('no quedan alert confirm ni innerHTML en panel admin',()=>{
  const root=new URL('../src/',import.meta.url);
  const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(new URL(`${e.name}/`,dir)):[new URL(e.name,dir)]);
  const source=walk(root).filter(u=>/\.(ts|tsx)$/.test(u.pathname)).map(u=>fs.readFileSync(u,'utf8')).join('\n');
  assert.doesNotMatch(source,/window\.(alert|confirm)\s*\(|\.innerHTML\s*=/);
});
test('migración P1 incorpora concurrencia optimista y auditoría',()=>{
  const sql=read('supabase/migrations/20260720000900_p1_estabilizacion.sql');
  assert.match(sql,/p_version_esperada/); assert.match(sql,/VERSION_CONFLICT/); assert.match(sql,/registro_auditoria/);
});
test('errores de servicios se normalizan con códigos estables',()=>{
  const source=read('packages/api/src/services/errores.ts');
  assert.match(source,/conflict/); assert.match(source,/forbidden/); assert.match(source,/normalizarError/);
});
test('dashboard mueve lectura inicial al servidor',()=>{
  const page=read('apps/panel-admin/src/app/page.tsx');
  assert.match(page,/crearClienteServidor/); assert.match(page,/cargarInicial/); assert.match(page,/DashboardCliente/);
});
test('dashboard final no usa fallback demo en cliente',()=>{
  const page=read('apps/panel-admin/src/app/DashboardCliente.tsx');
  assert.doesNotMatch(page,/INDICADORES_DEMO|INCIDENCIAS_DEMO|CONDUCTORES_DEMO|puedeUsarDatosDemo|estadoConexionDatos\("demo"\)|Modo demo/);
  assert.match(page,/El dashboard final no muestra datos demo/);
  assert.match(page,/Datos no disponibles/);
});
test('dashboard muestra corte por KPI y conserva navegación accionable',()=>{
  const page=read('apps/panel-admin/src/app/DashboardCliente.tsx');
  assert.match(page,/DatoKpi etiqueta="Corte"/);
  assert.match(page,/formatoCorteIndicador/);
  assert.match(page,/href=\{indicador\.href\}/);
});
test('dashboard define indicadores para cada rol operativo',()=>{
  const roles=read('apps/panel-admin/src/lib/roles-admin.ts');
  for (const rol of ['operador','supervisor','finanzas','compliance','direccion']) {
    assert.match(roles,new RegExp(`${rol}: \\{[\\s\\S]*?indicadores: \\[[^\\]]+\\]`));
  }
});
test('indicadores dashboard provienen de consultas SQL exactas y rutas fuente',()=>{
  const service=read('packages/api/src/services/admin.ts');
  for (const clave of ['traslados_activos','inician_60_min','sin_asignacion','riesgo_sla','con_incidencia','finalizados_hoy']) {
    assert.match(service,new RegExp(`clave: "${clave}"`));
  }
  assert.match(service,/select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(service,/listarExcepcionesCriticasAdmin\(cliente\)/);
  assert.match(service,/href: "\/viajes\?filtro=activos"/);
  assert.match(service,/href: "\/alertas-sla\?categoria=sla_en_riesgo"/);
});
test('mapa operativo no usa demo ni inventa GPS por ruta',()=>{
  const page=read('apps/panel-admin/src/app/mapa/page.tsx');
  assert.doesNotMatch(page,/TRASLADOS_MAPA_DEMO|Origen demo|puedeUsarDatosDemo|Modo demo|Ruta operativa|Estimada por ruta/);
  assert.match(page,/El pin de vehículo solo aparece con GPS real/);
  assert.match(page,/puntoConductor\(t\)/);
});
test('servicio de mapa consume tracking real y audita acceso a ubicación',()=>{
  const service=read('packages/api/src/services/admin.ts');
  assert.match(service,/tracking_salud_traslado/);
  assert.match(service,/ubicaciones_traslado/);
  assert.match(service,/auditoria_admin_seguridad/);
  assert.match(service,/coordenadas_sensibles_protegidas/);
});
test('alertas SLA no usa demo ni preferencias como asignacion operacional',()=>{
  const page=read('apps/panel-admin/src/app/alertas-sla/page.tsx');
  assert.doesNotMatch(page,/EXCEPCIONES_DEMO|puedeUsarDatosDemo|Modo demo|alertas_sla\.responsables|guardarPreferenciaAdmin|obtenerPreferenciaAdmin/);
  assert.match(page,/actualizarAlertaSlaAdmin/);
  assert.match(page,/Alertas y SLA no muestra excepciones demo/);
});
test('servicio alertas SLA usa reglas y acciones persistidas en Supabase',()=>{
  const service=read('packages/api/src/services/admin.ts');
  const sql=read('supabase/migrations/20260723000700_alertas_sla_operacionales.sql');
  assert.match(service,/admin_sincroniza_alertas_sla_operacionales/);
  assert.match(service,/admin_actualiza_alerta_sla/);
  assert.match(sql,/sla_reglas_operativas/);
  assert.match(sql,/alertas_sla_historial/);
  assert.match(sql,/notificaciones_admin_operativas/);
  assert.match(sql,/dedupe_key text not null unique/);
});
test('metricas registro conductor usa formulas oficiales, segmentos y exportacion auditada',()=>{
  const page=read('apps/panel-admin/src/app/metricas-registro/page.tsx');
  const service=read('packages/api/src/services/admin.ts');
  const sql=read('supabase/migrations/20260723000900_metricas_registro_conductor_madurez.sql');
  const route=read('apps/panel-admin/src/app/api/exportaciones/metricas-registro/route.ts');
  assert.match(service,/obtener_metricas_registro_conductor_v2/);
  assert.match(page,/Detalle y fórmula oficial/);
  assert.match(page,/Segmento por zona/);
  assert.match(page,/Exportar CSV/);
  assert.match(sql,/metas_registro_conductor/);
  assert.match(sql,/eventos_duplicados/);
  assert.match(route,/admin_registrar_exportacion/);
  assert.match(route,/x-content-sha256/);
});
