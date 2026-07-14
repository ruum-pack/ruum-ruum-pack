import { z } from "zod";

export const ANTICIPACION_MINIMA_HORAS = 2;
const anioMaximo = new Date().getFullYear() + 1;
const requerido = (mensaje = "Completa este campo.") => z.string().trim().min(1, mensaje);

export const esquemaSolicitudTraslado = z.object({
  vehiculoSeleccionadoId: z.string(),
  vehiculosUsuarioIds: z.array(z.string().uuid()),
  marca: requerido(), modelo: requerido(), color: requerido(), placas: requerido(), vin: requerido(),
  anio: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1980 && Number(v) <= anioMaximo,
    `Usa un año entre 1980 y ${anioMaximo}.`),
  transmision: z.enum(["manual", "automatica", "electrica"], { message: "Selecciona una transmisión válida." }),
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
  aceptaPoliticas: z.literal(true, { errorMap: () => ({ message: "Debes aceptar las políticas de pago y cancelación." }) })
}).superRefine((d, ctx) => {
  if (d.vehiculoSeleccionadoId && !d.vehiculosUsuarioIds.includes(d.vehiculoSeleccionadoId)) {
    ctx.addIssue({ code: "custom", path: ["vehiculoSeleccionadoId"], message: "El vehículo guardado no pertenece al usuario." });
  }
  const origen = [d.origenCodigoPostal, d.origenEstado, d.origenCiudad, d.origenColonia, d.origenCalle, d.origenNumero].map((v) => v.trim().toLowerCase()).join("|");
  const destino = [d.destinoCodigoPostal, d.destinoEstado, d.destinoCiudad, d.destinoColonia, d.destinoCalle, d.destinoNumero].map((v) => v.trim().toLowerCase()).join("|");
  if (origen === destino) ctx.addIssue({ code: "custom", path: ["destinoCalle"], message: "El destino debe ser diferente del origen." });
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
