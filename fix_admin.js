const fs = require('fs');
let c = fs.readFileSync('packages/api/src/services/admin.ts', 'utf8');
const lines = c.split('\n');
lines.splice(1680, 13, 
'},',
'',
'/**',
' * Obtiene vehículos asignados al conductor.',
' */',
'export async function obtenerVehiculosDeConductorAdmin(',
'  cliente: Cliente,',
'  conductorId: string',
'): Promise<Database["public"]["Tables"]["vehiculos"]["Row"][]> {',
'  await assertAdminPermission(cliente, "conductores:leer");',
'  const { data, error } = await cliente',
'    .from("vehiculos")',
'    .select("*")',
'    .eq("conductor_id", conductorId)',
'    .order("creado_en", { ascending: false });',
'  if (error) throw error;',
'  return data ?? [];',
'}',
'',
'/**',
' * Obtiene la empresa vinculada al conductor (si tiene).'
);
fs.writeFileSync('packages/api/src/services/admin.ts', lines.join('\n'));
console.log('Fixed!');