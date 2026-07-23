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
