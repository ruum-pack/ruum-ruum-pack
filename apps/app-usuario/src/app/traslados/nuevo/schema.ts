import { z } from "zod";

export const ANTICIPACION_MINIMA_HORAS = 2;
const anioMaximo = new Date().getFullYear() + 1;
const requerido = (mensaje = "Completa este campo.") => z.string().trim().min(1, mensaje);

export const esquemaParada = z.object({
  id: z.string(),
  tipo: z.enum(["escala", "tarea"]),
  calle: z.string().trim().min(1, "Completa la calle."),
  numero: z.string().trim().min(1, "Completa el número."),
  colonia: z.string().trim().min(1, "Completa la colonia."),
  codigoPostal: z.string().regex(/^\d{5}$/, "El Código Postal debe tener 5 dígitos."),
  estado: z.string().trim().min(1, "Completa el estado."),
  ciudad: z.string().trim().min(1, "Completa la ciudad."),
  referencias: z.string().max(300).optional().default(""),
  lat: z.number().optional(),
  lng: z.number().optional(),
  tipoTarea: z.enum(["entrega_parcial", "recoleccion", "tramite", "inspeccion", "carga_descarga", "otro"]).optional(),
  contactoNombre: z.string().optional(),
  contactoTelefono: z.string().optional(),
  instrucciones: z.string().max(500, "Máximo 500 caracteres.").optional().default(""),
  requiereEvidencia: z.boolean().optional().default(false),
  tiempoEsperaMin: z.string().optional().default("")
}).superRefine((d, ctx) => {
  if (d.tipo === "tarea") {
    if (!d.tipoTarea) ctx.addIssue({ code: "custom", path: ["tipoTarea"], message: "Selecciona el tipo de tarea." });
    if (!d.contactoNombre || !d.contactoNombre.trim()) ctx.addIssue({ code: "custom", path: ["contactoNombre"], message: "Completa el contacto de la tarea." });
    if (!d.contactoTelefono || !/^\d{10}$/.test(d.contactoTelefono)) ctx.addIssue({ code: "custom", path: ["contactoTelefono"], message: "Captura 10 dígitos." });
  }
  if (d.tiempoEsperaMin && d.tiempoEsperaMin.trim() && !/^\d+$/.test(d.tiempoEsperaMin.trim())) {
    ctx.addIssue({ code: "custom", path: ["tiempoEsperaMin"], message: "Minutos inválidos." });
  }
});

export const esquemaSolicitudTraslado = z.object({
  vehiculoSeleccionadoId: z.string(),
  vehiculosUsuarioIds: z.array(z.string().uuid()),
  marca: requerido(), modelo: requerido(), color: requerido(), placas: requerido(), vin: requerido(),
  anio: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1980 && Number(v) <= anioMaximo,
    `Usa un año entre 1980 y ${anioMaximo}.`),
  transmision: z.enum(["manual", "automatica", "electrica"], { message: "Selecciona una transmisión válida." }),
  condicion: z.enum(["nueva", "seminueva", "rescate_mecanico"], { message: "Selecciona la condición del vehículo." }),
  estadoGeneral: z.enum(["Excelente, sin daños visibles", "Buen estado, desgaste normal", "Detalles estéticos menores", "Rayones o golpes visibles"], { message: "Selecciona un estado general válido." }),
  tieneTarjeta: z.literal(true, { errorMap: () => ({ message: "Se requiere tarjeta de circulación vigente." }) }),
  tieneVerificacion: z.literal(true, { errorMap: () => ({ message: "Se requiere verificación vigente." }) }),
  tienePlacas: z.literal(true, { errorMap: () => ({ message: "Se requieren ambas placas instaladas." }) }),
  puedeCircular: z.literal(true, { errorMap: () => ({ message: "El vehículo debe encender y circular rodando." }) }),
  origenCodigoPostal: z.string().regex(/^\d{5}$/, "El Código Postal debe tener 5 dígitos."),
  origenEstado: requerido(), origenCiudad: requerido(), origenColonia: requerido(), origenCalle: requerido(), origenNumero: requerido(),
  destinoCodigoPostal: z.string().regex(/^\d{5}$/, "El Código Postal debe tener 5 dígitos."),
  destinoEstado: requerido(), destinoCiudad: requerido(), destinoColonia: requerido(), destinoCalle: requerido(), destinoNumero: requerido(),
  entregaNombre: requerido(), entregaApellido: requerido(), recepcionNombre: requerido(), recepcionApellido: requerido(),
  entregaTelefono: z.string().regex(/^\d{10}$/, "Captura 10 dígitos; el prefijo +52 ya está aplicado."),
  recepcionTelefono: z.string().regex(/^\d{10}$/, "Captura 10 dígitos; el prefijo +52 ya está aplicado."),
  modalidadProgramacion: z.enum(["lo_antes_posible", "programado"]),
  fechaHoraProgramada: z.string(),
  zonaHoraria: requerido("No se pudo determinar la zona horaria."),
  tipoRuta: z.enum(["local", "foraneo"]),
  tipoServicio: z.enum(["personal", "empresarial", "agencia", "lote", "flotilla"]),
  motivoServicio: z.enum(["entrega_cliente", "recuperacion", "traslado_especial"]),
  aceptaPoliticas: z.literal(true, { errorMap: () => ({ message: "Debes aceptar las políticas de pago y cancelación." }) }),
  paradas: z.array(esquemaParada).max(8, "Máximo 8 escalas/tareas.").default([])
}).superRefine((d, ctx) => {
  if (d.vehiculoSeleccionadoId && !d.vehiculosUsuarioIds.includes(d.vehiculoSeleccionadoId)) {
    ctx.addIssue({ code: "custom", path: ["vehiculoSeleccionadoId"], message: "El vehículo guardado no pertenece al usuario." });
  }
  if (d.paradas.length > 8) ctx.addIssue({ code: "custom", path: ["paradas"], message: "Máximo 8 escalas/tareas." });
  const origen = [d.origenCodigoPostal, d.origenEstado, d.origenCiudad, d.origenColonia, d.origenCalle, d.origenNumero].map((v) => v.trim().toLowerCase()).join("|");
  const destino = [d.destinoCodigoPostal, d.destinoEstado, d.destinoCiudad, d.destinoColonia, d.destinoCalle, d.destinoNumero].map((v) => v.trim().toLowerCase()).join("|");
  if (origen === destino) ctx.addIssue({ code: "custom", path: ["destinoCalle"], message: "El destino debe ser diferente del origen." });
  // validar que paradas no dupliquen origen/destino ni entre sí
  const seen = new Set<string>([origen, destino]);
  d.paradas.forEach((p, idx) => {
    const key = [p.codigoPostal, p.estado, p.ciudad, p.colonia, p.calle, p.numero].map((v) => (v || "").trim().toLowerCase()).join("|");
    if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["paradas", idx, "calle"], message: "Esta parada duplica origen, destino u otra parada." });
    else seen.add(key);
  });
  if (d.modalidadProgramacion === "programado") {
    if (!d.fechaHoraProgramada) ctx.addIssue({ code: "custom", path: ["fechaHoraProgramada"], message: "La fecha programada es obligatoria." });
    else if (new Date(d.fechaHoraProgramada).getTime() < Date.now() + ANTICIPACION_MINIMA_HORAS * 60 * 60 * 1000)
      ctx.addIssue({ code: "custom", path: ["fechaHoraProgramada"], message: `Programa con al menos ${ANTICIPACION_MINIMA_HORAS} horas de anticipación.` });
  } else if (d.fechaHoraProgramada) {
    ctx.addIssue({ code: "custom", path: ["fechaHoraProgramada"], message: "La modalidad inmediata no admite fecha programada." });
  }
});

export function erroresFormulario(resultado: ReturnType<typeof esquemaSolicitudTraslado.safeParse>) {
  if (resultado.success) return {};
  return Object.fromEntries(resultado.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}
