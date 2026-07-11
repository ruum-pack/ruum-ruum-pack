const REGLAS: Array<[RegExp,string]> = [
  [/conductor_duplicado:curp|solicitudes_conductor_curp|conductores_curp|\bcurp\b.*(duplicate|duplicad)/i,"Este CURP ya está asociado a otra solicitud."],
  [/conductor_duplicado:telefono|telefono.*(duplicate|duplicad)/i,"Este teléfono ya está asociado a otra cuenta."],
  [/conductor_duplicado:licencia|licencia.*(duplicate|duplicad)/i,"Este número de licencia ya está asociado a otra solicitud."],
  [/licencia (está )?vencida|vigencia.*(vencid|expired)/i,"Tu licencia está vencida. Actualiza la vigencia para continuar."],
  [/jwt expired|token.*expired|refresh token|auth session missing|invalid jwt|sesión inválida|session.*expir/i,"Tu sesión expiró; vuelve a verificar tu cuenta."],
  [/failed to fetch|network request|networkerror|fetch failed|sin conexi[oó]n/i,"Sin conexión. Conservamos tus cambios y volveremos a intentarlo."],
  [/documento|storage|bucket|archivo/i,"No pudimos registrar uno de tus documentos. Revisa el archivo e intenta nuevamente."],
  [/duplicate key value|unique constraint|violates.*constraint/i,"Ya existe un registro con esos datos. Revisa la información capturada."],
  [/permission denied|row-level security|rls/i,"Tu sesión no permite realizar esta acción. Vuelve a iniciar sesión."],
];

export function traducirErrorOperativo(error:unknown,respaldo="No pudimos guardar los cambios. Intenta nuevamente.") {
  const mensaje=typeof error==="string"?error:error&&typeof error==="object"&&"message" in error&&typeof error.message==="string"?error.message:"";
  return REGLAS.find(([patron])=>patron.test(mensaje))?.[1]??respaldo;
}
