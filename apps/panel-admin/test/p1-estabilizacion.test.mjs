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
test('listas operativas no usan refresco automático que mueva tablas',()=>{
  for (const ruta of [
    'apps/panel-admin/src/app/viajes/page.tsx',
    'apps/panel-admin/src/app/conductores/page.tsx',
    'apps/panel-admin/src/app/conductores/activos/page.tsx',
    'apps/panel-admin/src/app/usuarios/page.tsx'
  ]) {
    const source=read(ruta);
    assert.doesNotMatch(source,/setInterval\(/);
    assert.doesNotMatch(source,/visibilitychange/);
  }
});
test('viajes usa experiencia premium con acciones compactas y vistas operativas',()=>{
  const page=read('apps/panel-admin/src/app/viajes/page.tsx');
  const table=read('apps/panel-admin/src/app/AdminDataTable.tsx');
  assert.match(page,/KpiOperativo/);
  assert.match(page,/FiltroInteligente/);
  assert.match(page,/ModoVistaOperativa = "lista" \| "kanban" \| "mapa"/);
  assert.match(page,/VistaKanbanTraslados/);
  assert.match(page,/VistaMapaTraslados/);
  assert.match(page,/font-mono-ruum text-xs font-semibold text-status-info/);
  assert.match(table,/⋮/);
  assert.match(table,/selectedRows\.length\.toLocaleString/);
  assert.doesNotMatch(page,/Vista rápida", onClick:[\s\S]*"Abrir", href:[\s\S]*"Asignar", href/);
});
test('traslados masivos usa orden operativa simple y enriquecimiento automatico',()=>{
  const page=read('apps/panel-admin/src/app/masivos/page.tsx');
  const plantilla=read('apps/panel-admin/src/app/api/plantillas/traslados-masivos/route.ts');
  const sql=read('supabase/migrations/20260723000600_traslados_masivos_endurecimiento.sql');
  assert.match(page,/Orden operativa CSV/);
  assert.match(page,/enriquecerFila/);
  assert.match(page,/consultarCodigoPostalMx/);
  assert.match(page,/geocodificarDireccionMasiva/);
  assert.match(page,/tipoSugeridoParaVehiculo/);
  assert.match(plantilla,/centro_costo/);
  assert.match(plantilla,/origen_calle/);
  assert.doesNotMatch(plantilla,/"categoria_tarifa"/);
  assert.doesNotMatch(plantilla,/"origen_lat"/);
  const requeridas=page.match(/const COLUMNAS_REQUERIDAS = \[[\s\S]*?\] as const;/)?.[0] ?? '';
  assert.doesNotMatch(requeridas,/origen_lat|destino_lat|categoria_tarifa|gama/);
  assert.doesNotMatch(sql,/coordenadas de origen requeridas|coordenadas de destino requeridas/);
  assert.match(sql,/nullif\(v_datos->>'origen_lat', ''\).*::numeric/);
});
test('didit separa inicio con CORS y webhook firmado',()=>{
  const iniciar=read('supabase/functions/iniciar-verificacion-didit/index.ts');
  const webhook=read('supabase/functions/webhook-didit/index.ts');
  const conductores=read('packages/api/src/services/conductores.ts');
  const nextConfigConductor=read('apps/app-conductor/next.config.ts');
  const middlewareConductor=read('apps/app-conductor/src/middleware.ts');

  assert.match(conductores,/functions\.invoke\("iniciar-verificacion-didit"/);
  assert.match(iniciar,/Access-Control-Allow-Origin/);
  assert.match(iniciar,/req\.method === "OPTIONS"/);
  assert.match(iniciar,/verification\.didit\.me\/v3\/session/);
  assert.match(iniciar,/DIDIT_CALLBACK_URL/);
  assert.doesNotMatch(iniciar,/DIDIT_WEBHOOK_SECRET|firmaValida|aprobar_solicitud_conductor_sistema/);
  assert.match(webhook,/DIDIT_WEBHOOK_SECRET/);
  assert.match(webhook,/validarFirmaWebhookDidit/);
  assert.match(webhook,/aprobar_solicitud_conductor_sistema/);
  assert.doesNotMatch(webhook,/verification\.didit\.me\/v2\/session/);

  // Verificación CSP frame-src y Permissions-Policy para iframe de Didit
  assert.match(nextConfigConductor,/frame-src 'self' https:\/\/verify\.didit\.me/);
  assert.match(middlewareConductor,/frame-src 'self' https:\/\/verify\.didit\.me/);
  assert.match(nextConfigConductor,/Permissions-Policy.*https:\/\/verify\.didit\.me/);

  // Verificación de migración de estados y robustez de webhook/sesión
  const migrationDidit=read('supabase/migrations/20260823000300_fix_verificaciones_identidad_didit_estados.sql');
  assert.match(migrationDidit,/check \(estado in \('pendiente', 'en_revision', 'aprobado', 'rechazado', 'error', 'expirado', 'cancelado'\)\)/);
  assert.match(iniciar,/session_url/);
  assert.match(webhook,/x-signature-v2/);
});
test('documentos usa tarjetas operativas con badges tooltip y recordatorios',()=>{
  const page=read('apps/panel-admin/src/app/documentos/page.tsx');
  const acciones=read('apps/panel-admin/src/app/usuarios/AccionesVerificacion.tsx');
  assert.match(page,/BadgeEstadoDocumento/);
  assert.match(page,/ChipFiltro/);
  assert.match(page,/Por vencer/);
  assert.match(page,/Usuarios por validar/);
  assert.match(page,/Enviar recordatorio a todos/);
  assert.match(page,/No hay conductores con documentos pendientes/);
  assert.match(page,/Ver todos los conductores/);
  assert.match(page,/font-mono-ruum/);
  assert.match(page,/border-white\/\[0\.08\]/);
  assert.match(acciones,/AdminTooltip/);
  assert.doesNotMatch(acciones,/El botón &quot;Aprobar cuenta&quot; permanece deshabilitado/);
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
test('mapa operativo usa layout map-first con filtros, clusters y jerarquia secundaria',()=>{
  const page=read('apps/panel-admin/src/app/mapa/page.tsx');
  const rutas=read('apps/panel-admin/src/lib/mapbox-rutas.ts');
  assert.match(page,/Toolbar de busqueda y filtros del mapa operativo/);
  assert.match(page,/filtrosMapa/);
  assert.match(page,/Configurar jerarquía de alertas/);
  assert.match(page,/panelActivosAbierto/);
  assert.match(page,/vehiculos-operativos-cluster/);
  assert.match(page,/clusters-vehiculos-conteo/);
  assert.match(page,/htmlPopoverVehiculo/);
  assert.match(page,/"line-dasharray": degradada \? \[1\.2, 1\.2\] : \[1, 0\]/);
  assert.match(page,/Ruta aproximada/);
  assert.match(page,/Llamar conductor/);
  assert.match(rutas,/degradada: true/);
});
test('servicio de mapa consume tracking real y audita acceso a ubicación',()=>{
  const service=read('packages/api/src/services/admin.ts');
  assert.match(service,/tracking_salud_traslado/);
  assert.match(service,/ubicaciones_traslado/);
  assert.match(service,/auditoria_admin_seguridad/);
  assert.match(service,/coordenadas_sensibles_protegidas/);
});
test('pasaporte empresarial consolida control real por empresa',()=>{
  const list=read('apps/panel-admin/src/app/empresas/page.tsx');
  const passport=read('apps/panel-admin/src/app/empresas/[id]/page.tsx');
  assert.match(list,/href=\{`\/empresas\/\$\{empresa\.id\}`\}/);
  assert.match(passport,/Pasaporte Empresarial/);
  assert.match(passport,/listarEmpresasAdmin/);
  assert.match(passport,/vehiculos\.filter/);
  assert.match(passport,/conductores\.filter/);
  assert.match(passport,/traslados\s*=\s*datos\.traslados/);
  assert.match(passport,/agruparLugares\(traslados, "origen"\)/);
  assert.match(passport,/agruparLugares\(traslados, "destino"\)/);
  assert.match(passport,/Sin coordenadas/);
});
test('configuracion permite a direccion administrar roles y capacidades por RPC auditado',()=>{
  const page=read('apps/panel-admin/src/app/configuracion/page.tsx');
  const service=read('packages/api/src/services/admin-capacidades.ts');
  const sql=read('supabase/migrations/20260728000200_admin_configura_roles_colaboradores.sql');
  const route=read('apps/panel-admin/src/app/api/admin-auth/invitar-admin/route.ts');
  assert.match(page,/Roles y capacidades por colaborador/);
  assert.match(page,/actualizarRolColaboradorAdmin/);
  assert.match(page,/concederCapacidadAdmin/);
  assert.match(page,/Dar de alta usuario del panel/);
  assert.match(page,/\/api\/admin-auth\/invitar-admin/);
  assert.match(service,/admin_actualizar_rol_colaborador/);
  assert.match(service,/assertAdminPermission\(cliente, "capacidades:administrar"\)/);
  assert.match(sql,/public.admin_tiene_permiso\('capacidades:administrar'\)/);
  assert.match(sql,/NO_AUTO_DEGRADACION_DIRECCION/);
  assert.match(sql,/auditoria_admin_seguridad/);
  assert.match(route,/createUser/);
  assert.match(route,/generarPasswordTemporal/);
  assert.match(route,/enviarCorreoPasswordTemporal/);
  assert.match(route,/p_permiso: "capacidades:administrar"/);
  assert.match(route,/from\("admins"\)/);
  assert.match(route,/auditoria_admin_seguridad/);
  assert.match(route,/auth_user_id: "\[REDACTED\]"/);
});
test('configuracion es cerebro normativo con editores y validacion por clave',()=>{
  const page=read('apps/panel-admin/src/app/configuracion/page.tsx');
  const sql=read('supabase/migrations/20260728000300_configuracion_cerebro_normativo.sql');
  assert.doesNotMatch(page,/href="\/tarifas"|Bitácora de cambios|Política tarifaria/);
  assert.match(page,/EditorNormativo/);
  for (const clave of ['zonas_operacion','tipos_servicio_vehiculo','reglas_evidencia','estados_traslado','plantillas_notificacion','metodos_pago','datos_fiscales','seguridad']) {
    assert.match(page,new RegExp(`registro\\.clave === "${clave}"`));
  }
  assert.match(page,/Datos fiscales de Ruum Ruum/);
  assert.match(page,/Requisitos fiscales para clientes/);
  assert.match(page,/Métodos aceptados/);
  assert.match(sql,/admin_validar_configuracion_normativa/);
  assert.match(sql,/METODOS_PAGO_INVALIDOS/);
  assert.match(sql,/DATOS_FISCALES_INVALIDOS/);
  assert.match(sql,/SEGURIDAD_INVALIDA/);
});
test('configuracion separa roles normativa y exige motivos criticos',()=>{
  const page=read('apps/panel-admin/src/app/configuracion/page.tsx');
  assert.match(page,/AdminTabs/);
  assert.match(page,/Roles y capacidades/);
  assert.match(page,/Normativa activa/);
  assert.match(page,/busquedaCapacidad/);
  assert.match(page,/CATEGORIAS_CAPACIDAD/);
  assert.match(page,/Cambio crítico/);
  assert.match(page,/Confirmar cambio crítico de rol/);
  assert.match(page,/motivoRol\.trim\(\)\.length < 10/);
  assert.match(page,/Override individual/);
  assert.match(page,/Rol base/);
  assert.match(page,/Historial reciente/);
  assert.match(page,/Ver auditoría/);
  assert.match(page,/Matriz efectiva de roles/);
  assert.match(page,/style=\{\{ width: `\$\{porcentaje\}%` \}\}/);
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
test('incidencias usa bandeja operativa sin filtro duplicado',()=>{
  const page=read('apps/panel-admin/src/app/incidencias/page.tsx');
  const dashboard=read('apps/panel-admin/src/app/DashboardCliente.tsx');
  assert.doesNotMatch(page,/AdminFiltroActivo|Filtro activo/);
  assert.match(page,/ChipFiltroIncidencia/);
  assert.match(page,/KpiIncidencia/);
  assert.match(page,/Actualizado:/);
  assert.match(page,/FILTROS_ORIGEN/);
  assert.match(page,/FILTROS_RESPONSABLE/);
  assert.match(page,/FILTROS_GRAVEDAD/);
  assert.match(page,/No hay incidencias abiertas bajo este criterio/);
  assert.match(page,/slaIncidencia/);
  assert.match(page,/Vista previa evidencia/);
  assert.match(page,/Ver origen/);
  assert.match(dashboard,/Incidencias abiertas:/);
  assert.match(dashboard,/incidenciasPorTipo/);
  assert.match(dashboard,/href=\{`\/incidencias\?tipo=\$\{tipo\}`\}/);
});
test('P1 storage evidencia nunca persiste signed URLs en datos operativos',()=>{
  const navbar=read('apps/app-conductor/src/app/viajes/[id]/SecondaryTripNavBar.tsx');
  const incidencia=read('apps/app-conductor/src/app/viajes/[id]/ReportarIncidencia.tsx');
  const cierre=read('apps/app-conductor/src/app/viajes/[id]/CierreTrasladoDetails.tsx');
  const servicio=read('packages/api/src/services/evidencia.ts');
  const migration=read('supabase/migrations/20260823000100_p1_sanear_signed_urls_datos_operativos.sql');

  assert.match(navbar,/extraerRutaComprobante/);
  assert.match(navbar,/comprobante_ruta/);
  assert.doesNotMatch(navbar,/createSignedUrl\(/);
  assert.doesNotMatch(navbar,/\[COMPROBANTE: http/);

  assert.match(incidencia,/Evidencia adjunta:/);
  assert.match(incidencia,/Ruta:/);
  assert.doesNotMatch(incidencia,/URL temporal:/);
  assert.doesNotMatch(incidencia,/createSignedUrl\(/);

  assert.match(cierre,/extraerRutaComprobante/);
  assert.match(cierre,/comprobante_ruta/);

  assert.match(servicio,/extraerRutaComprobante/);
  assert.match(servicio,/extraerRutaIncidencia/);
  assert.match(servicio,/resolverUrlEvidencia/);

  assert.match(migration,/comprobante_ruta/);
  assert.match(migration,/public\.gastos_traslado/);
  assert.match(migration,/public\.incidencias/);
});
test('P1 evidencia offline cifra la cola en Preferences y previene texto claro',()=>{
  const cola=read('apps/app-conductor/src/lib/cola-offline.ts');
  const seguro=read('apps/app-conductor/src/lib/almacenamiento-seguro-local.ts');

  assert.match(cola,/guardarJsonLocalSeguro/);
  assert.match(cola,/leerJsonLocalSeguro/);
  assert.match(cola,/eliminarJsonLocalSeguro/);
  assert.match(cola,/TTL_COLA_EVIDENCIA_MS/);
  assert.match(cola,/MAX_REINTENTOS_EVIDENCIA/);
  assert.doesNotMatch(cola,/Preferences\.set\(\{\s*key:\s*CLAVE_COLA/);

  assert.match(seguro,/ruum:v1:/);
  assert.match(seguro,/crypto_subtle_unavailable_secure_storage_required/);
  assert.match(seguro,/AES-GCM/);
  assert.match(seguro,/PBKDF2/);
});
test('P2 tracking nativo previene arranque tardío tras cleanup o cambio de viaje',()=>{
  const tracking=read('apps/app-conductor/src/app/useDriverLocationTracking.ts');

  assert.match(tracking,/let cancelado = false;/);
  assert.match(tracking,/await detenerTrackingNativo\(\)\.catch/);
  assert.match(tracking,/if \(cancelado\) return;/);
  assert.match(tracking,/solicitarUbicacionSegundoPlanoNativa/);
  assert.match(tracking,/iniciarTrackingNativo/);
  assert.match(tracking,/return \(\) => \{\s*cancelado = true;\s*void detenerTrackingNativo/);
});
test('H1 datos bancarios nunca almacena PAN completo en texto plano',()=>{
  const migration=read('supabase/migrations/20260823000200_h1_sanitizar_pan_datos_bancarios.sql');
  const service=read('packages/api/src/services/conductores.ts');
  const ui=read('apps/app-conductor/src/app/cuenta/datos-bancarios/page.tsx');

  assert.match(migration,/numero_tarjeta is null or numero_tarjeta ~ '\^\[0-9\*\]\{4,19\}\$'/);
  assert.match(migration,/repeat\('\*',/);
  assert.match(service,/numeroTarjeta\?: string \| null/);
  assert.match(service,/p_numero_tarjeta:/);
  assert.match(ui,/Número de tarjeta de débito \(opcional/);
  assert.match(ui,/enmascararUltimos/);
});
test('H2 higiene de repositorio no contiene scripts de debug con service role en apps',()=>{
  assert.strictEqual(fs.existsSync(new URL('../../../apps/app-conductor/debug_save_evidence.js', import.meta.url)), false);
  assert.strictEqual(fs.existsSync(new URL('../../../scripts/dev-only/README.md', import.meta.url)), true);
  assert.strictEqual(fs.existsSync(new URL('../../../scripts/dev-only/.gitignore', import.meta.url)), true);
});
test('H3 almacenamiento seguro se enlaza a Android Keystore y documenta modelo de amenazas',()=>{
  const seguro=read('apps/app-conductor/src/lib/almacenamiento-seguro-local.ts');
  const plugin=read('apps/app-conductor/android/app/src/main/java/com/moviliax/ruumruum/conductor/tracking/BackgroundTrackingPlugin.java');
  const tracking=read('apps/app-conductor/src/lib/background-tracking.ts');

  assert.match(seguro,/obtenerSecretoKeystoreNativo/);
  assert.match(seguro,/ARQUITECTURA DE ALMACENAMIENTO SEGURO LOCAL \(H3\)/);
  assert.match(seguro,/Hardware-Backed Keystore/);
  assert.match(plugin,/getSecureInstallationSecret/);
  assert.match(plugin,/SecureTrackingPreferences\.get/);
  assert.match(tracking,/getSecureInstallationSecret/);
});
test('H4 umbral de cobertura y pruebas de sincronización offline',()=>{
  const vitestConfig=read('apps/app-conductor/vitest.config.ts');
  assert.match(vitestConfig,/Hoja de ruta de escalamiento de cobertura \(H4\)/);
  assert.match(vitestConfig,/lines:\s*(?:[5-9]|[1-9]\d)/);
  assert.strictEqual(fs.existsSync(new URL('../../../apps/app-conductor/test/orquestador-sync-offline.test.ts', import.meta.url)), true);
  assert.strictEqual(fs.existsSync(new URL('../../../apps/app-conductor/test/session-cleanup.test.ts', import.meta.url)), true);
  assert.strictEqual(fs.existsSync(new URL('../../../apps/app-conductor/test/cola-telemetria-offline.test.ts', import.meta.url)), true);
  assert.strictEqual(fs.existsSync(new URL('../../../apps/app-conductor/test/borrador-registro.test.ts', import.meta.url)), true);
});
test('H5 tipado seguro y visibilidad con ESLint',()=>{
  const eslint=read('apps/app-conductor/eslint.config.mjs');
  const notificaciones=read('apps/app-conductor/src/app/notificaciones/page.tsx');
  const gastos=read('apps/app-conductor/src/app/viajes/[id]/SecondaryTripNavBar.tsx');
  const push=read('apps/app-conductor/src/lib/push-notifications.ts');
  const tabs=read('apps/app-conductor/src/app/viajes/[id]/detalles/TripDetailsTabs.tsx');

  assert.match(eslint,/@typescript-eslint\/no-explicit-any/);
  assert.doesNotMatch(notificaciones,/await\s*\(cliente\s*as\s*any\)/);
  assert.doesNotMatch(gastos,/\.from\("gastos_traslado"\)[^;]*as any/);
  assert.doesNotMatch(push,/\(cliente\s*as\s*any\)\.rpc/);
  assert.doesNotMatch(tabs,/@ts-ignore\s*supabase\s*any/);
});
test('H6 login honra parámetro next con protección anti open-redirect',()=>{
  const loginConductor=read('apps/app-conductor/src/app/login/page.tsx');
  const loginAdmin=read('apps/panel-admin/src/app/login/page.tsx');
  const util=read('packages/shared/src/utils/validar-destino-seguro.ts');

  assert.match(loginConductor,/validarDestinoSeguro\(searchParams\.get\("next"\)/);
  assert.match(loginAdmin,/validarDestinoSeguro\(searchParams\.get\("next"\)/);
  assert.match(util,/!limpio\.startsWith\("\/\/"\)/);
  assert.match(util,/!limpio\.includes\("\\\\"\)/);
});
test('H7 higiene de repositorio ignora y excluye work/ y logs',()=>{
  const gitignore=read('.gitignore');
  assert.match(gitignore,/work\//);
  assert.match(gitignore,/\*\.log/);
  assert.strictEqual(fs.existsSync(new URL('../../../work', import.meta.url)), false);
});
