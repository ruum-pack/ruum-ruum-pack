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
  assert.match(source,/CONFLICT/); assert.match(source,/FORBIDDEN/); assert.match(source,/normalizarError/);
});
test('dashboard mueve lectura inicial al servidor',()=>{
  const page=read('apps/panel-admin/src/app/page.tsx');
  assert.match(page,/crearClienteServidor/); assert.match(page,/cargarInicial/); assert.match(page,/DashboardCliente/);
});
