import { z } from "zod";

/**
 * Fuente única de reglas y validaciones para solicitudes de traslados.
 * Centraliza las reglas de cliente (wizard app-usuario), API services y base de datos (RPCs).
 */

export const ANTICIPACION_MINIMA_HORAS = 2;
export const ANIO_MINIMO_VEHICULO = 1980;
export const MAX_PARADAS_TRASLADO = 8;
export const REGEX_CODIGO_POSTAL = /^\d{5}$/;
export const REGEX_TELEFONO_10_DIGITOS = /^\d{10}$/;
export const REGEX_TELEFONO_E164_MX = /^\+52\d{10}$/;

export function obtenerAnioMaximoVehiculo(): number {
  return new Date().getFullYear() + 1;
}

const requerido = (mensaje = "Completa este campo.") => z.string().trim().min(1, mensaje);

export const esquemaParada = z.object({
  id: z.string(),
  tipo: z.enum(["escala", "tarea"]),
  calle: z.string().trim().min(1, "Completa la calle."),
  numero: z.string().trim().min(1, "Completa el número."),
  colonia: z.string().trim().min(1, "Completa la colonia."),
  codigoPostal: z.string().regex(REGEX_CODIGO_POSTAL, "El Código Postal debe tener 5 dígitos."),
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
    if (!d.contactoTelefono || !REGEX_TELEFONO_10_DIGITOS.test(d.contactoTelefono)) {
      ctx.addIssue({ code: "custom", path: ["contactoTelefono"], message: "Captura 10 dígitos." });
    }
  }
  if (d.tiempoEsperaMin && d.tiempoEsperaMin.trim() && !/^\d+$/.test(d.tiempoEsperaMin.trim())) {
    ctx.addIssue({ code: "custom", path: ["tiempoEsperaMin"], message: "Minutos inválidos." });
  }
});

export type ParadaValidada = z.infer<typeof esquemaParada>;

export const esquemaSolicitudTraslado = z.object({
  vehiculoSeleccionadoId: z.string(),
  vehiculosUsuarioIds: z.array(z.string().uuid()),
  marca: requerido(),
  modelo: requerido(),
  color: requerido(),
  placas: requerido(),
  vin: requerido(),
  anio: z.string().refine((v) => {
    const num = Number(v);
    return Number.isInteger(num) && num >= ANIO_MINIMO_VEHICULO && num <= obtenerAnioMaximoVehiculo();
  }, () => ({ message: `Usa un año entre ${ANIO_MINIMO_VEHICULO} y ${obtenerAnioMaximoVehiculo()}.` })),
  transmision: z.enum(["manual", "automatica", "electrica"], { message: "Selecciona una transmisión válida." }),
  condicion: z.enum(["nueva", "seminueva", "rescate_mecanico"], { message: "Selecciona la condición del vehículo." }),
  estadoGeneral: z.enum(
    [
      "Excelente, sin daños visibles",
      "Buen estado, desgaste normal",
      "Detalles estéticos menores",
      "Rayones o golpes visibles"
    ],
    { message: "Selecciona un estado general válido." }
  ),
  tieneTarjeta: z.literal(true, { errorMap: () => ({ message: "Se requiere tarjeta de circulación vigente." }) }),
  tieneVerificacion: z.literal(true, { errorMap: () => ({ message: "Se requiere verificación vigente." }) }),
  tienePlacas: z.literal(true, { errorMap: () => ({ message: "Se requieren ambas placas instaladas." }) }),
  // R10: rescate_mecanico permite traslado sin rodar (grúa/plataforma). Validación condicional en superRefine.
  puedeCircular: z.boolean(),
  origenCodigoPostal: z.string().regex(REGEX_CODIGO_POSTAL, "El Código Postal debe tener 5 dígitos."),
  origenEstado: requerido(),
  origenCiudad: requerido(),
  origenColonia: requerido(),
  origenCalle: requerido(),
  origenNumero: requerido(),
  destinoCodigoPostal: z.string().regex(REGEX_CODIGO_POSTAL, "El Código Postal debe tener 5 dígitos."),
  destinoEstado: requerido(),
  destinoCiudad: requerido(),
  destinoColonia: requerido(),
  destinoCalle: requerido(),
  destinoNumero: requerido(),
  entregaNombre: requerido(),
  entregaApellido: requerido(),
  recepcionNombre: requerido(),
  recepcionApellido: requerido(),
  entregaTelefono: z.string().regex(REGEX_TELEFONO_10_DIGITOS, "Captura 10 dígitos; el prefijo +52 ya está aplicado."),
  recepcionTelefono: z.string().regex(REGEX_TELEFONO_10_DIGITOS, "Captura 10 dígitos; el prefijo +52 ya está aplicado."),
  modalidadProgramacion: z.enum(["lo_antes_posible", "programado"]),
  fechaHoraProgramada: z.string(),
  zonaHoraria: requerido("No se pudo determinar la zona horaria."),
  tipoRuta: z.enum(["local", "foraneo"]),
  tipoServicio: z.enum(["personal", "empresarial", "agencia", "lote", "flotilla"]),
  motivoServicio: z.enum(["entrega_cliente", "recuperacion", "traslado_especial"]),
  aceptaPoliticas: z.literal(true, { errorMap: () => ({ message: "Debes aceptar las políticas de pago y cancelación." }) }),
  paradas: z.array(esquemaParada).max(MAX_PARADAS_TRASLADO, `Máximo ${MAX_PARADAS_TRASLADO} escalas/tareas.`).default([])
}).superRefine((d, ctx) => {
  // R10: puedeCircular false solo es válido para rescate_mecanico (vehículo no rodante)
  if (!d.puedeCircular && d.condicion !== "rescate_mecanico") {
    ctx.addIssue({
      code: "custom",
      path: ["puedeCircular"],
      message: "El vehículo debe encender y circular rodando. Para rescate mecánico desactiva este requisito y se asignará grúa/plataforma."
    });
  }
  if (d.vehiculoSeleccionadoId && !d.vehiculosUsuarioIds.includes(d.vehiculoSeleccionadoId)) {
    ctx.addIssue({ code: "custom", path: ["vehiculoSeleccionadoId"], message: "El vehículo guardado no pertenece al usuario." });
  }
  if (d.paradas.length > MAX_PARADAS_TRASLADO) {
    ctx.addIssue({ code: "custom", path: ["paradas"], message: `Máximo ${MAX_PARADAS_TRASLADO} escalas/tareas.` });
  }
  const origen = [d.origenCodigoPostal, d.origenEstado, d.origenCiudad, d.origenColonia, d.origenCalle, d.origenNumero]
    .map((v) => v.trim().toLowerCase())
    .join("|");
  const destino = [d.destinoCodigoPostal, d.destinoEstado, d.destinoCiudad, d.destinoColonia, d.destinoCalle, d.destinoNumero]
    .map((v) => v.trim().toLowerCase())
    .join("|");
  if (origen === destino) {
    ctx.addIssue({ code: "custom", path: ["destinoCalle"], message: "El destino debe ser diferente del origen." });
  }
  // validar que paradas no dupliquen origen/destino ni entre sí
  const seen = new Set<string>([origen, destino]);
  d.paradas.forEach((p, idx) => {
    const key = [p.codigoPostal, p.estado, p.ciudad, p.colonia, p.calle, p.numero]
      .map((v) => (v || "").trim().toLowerCase())
      .join("|");
    if (seen.has(key)) {
      ctx.addIssue({ code: "custom", path: ["paradas", idx, "calle"], message: "Esta parada duplica origen, destino u otra parada." });
    } else {
      seen.add(key);
    }
  });
  if (d.modalidadProgramacion === "programado") {
    if (!d.fechaHoraProgramada) {
      ctx.addIssue({ code: "custom", path: ["fechaHoraProgramada"], message: "La fecha programada es obligatoria." });
    } else if (new Date(d.fechaHoraProgramada).getTime() < Date.now() + ANTICIPACION_MINIMA_HORAS * 60 * 60 * 1000) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaHoraProgramada"],
        message: `Programa con al menos ${ANTICIPACION_MINIMA_HORAS} horas de anticipación.`
      });
    }
  } else if (d.fechaHoraProgramada) {
    ctx.addIssue({ code: "custom", path: ["fechaHoraProgramada"], message: "La modalidad inmediata no admite fecha programada." });
  }
});

export type SolicitudTrasladoValidada = z.infer<typeof esquemaSolicitudTraslado>;

export function erroresFormulario(resultado: ReturnType<typeof esquemaSolicitudTraslado.safeParse>) {
  if (resultado.success) return {};
  return Object.fromEntries(resultado.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

/**
 * Esquema para payload del servicio crearTraslado de la capa API.
 * Sincronizado con las restricciones de la RPC usuario_crea_traslado.
 */
export const esquemaPayloadCrearTraslado = z.object({
  claveIdempotencia: z.string().uuid("La clave de idempotencia debe ser un UUID válido."),
  vehiculo: z.union([
    z.object({
      vehiculoId: z.string().uuid("El ID de vehículo guardado debe ser un UUID.")
    }),
    z.object({
      vehiculo: z.object({
        tipo: z.string().min(1, "Tipo de vehículo requerido."),
        transmision: z.enum(["manual", "automatica", "electrica"]),
        marca: z.string().min(1, "Marca requerida."),
        modelo: z.string().min(1, "Modelo requerido."),
        anio: z.number().int().min(ANIO_MINIMO_VEHICULO).refine((a) => a <= obtenerAnioMaximoVehiculo(), {
          message: `El año no puede exceder ${obtenerAnioMaximoVehiculo()}.`
        }),
        color: z.string().min(1, "Color requerido."),
        placas: z.string().min(1, "Placas requeridas."),
        vin: z.string().min(1, "VIN requerido."),
        condicion: z.enum(["nueva", "seminueva", "rescate_mecanico"]).optional(),
        estado_general_declarado: z.string().min(1, "Estado general requerido."),
        tiene_tarjeta_circulacion: z.boolean(),
        tiene_verificacion: z.boolean(),
        tiene_placas: z.boolean(),
        puede_circular_rodando: z.boolean()
      })
    })
  ]),
  traslado: z.object({
    contacto_entrega_nombre: z.string().min(1, "Nombre de entrega requerido."),
    contacto_entrega_telefono: z.string().min(1, "Teléfono de entrega requerido."),
    contacto_recepcion_nombre: z.string().min(1, "Nombre de recepción requerido."),
    contacto_recepcion_telefono: z.string().min(1, "Teléfono de recepción requerido."),
    origen_direccion: z.string().min(1, "Dirección de origen requerida."),
    origen_ciudad: z.string().min(1, "Ciudad de origen requerida."),
    destino_direccion: z.string().min(1, "Dirección de destino requerida."),
    destino_ciudad: z.string().min(1, "Ciudad de destino requerida."),
    modalidad_programacion: z.enum(["lo_antes_posible", "programado"]).optional().nullable(),
    fecha_hora_programada: z.string().optional().nullable(),
    distancia_km: z.number().min(0).max(20000).optional().nullable(),
    tiempo_estimado_horas: z.number().min(0).max(720).optional().nullable()
  }).superRefine((t, ctx) => {
    if (t.modalidad_programacion === "programado") {
      if (!t.fecha_hora_programada) {
        ctx.addIssue({ code: "custom", path: ["fecha_hora_programada"], message: "La fecha programada es obligatoria." });
      } else {
        const fecha = new Date(t.fecha_hora_programada);
        if (Number.isNaN(fecha.getTime()) || fecha.getTime() < Date.now() + ANTICIPACION_MINIMA_HORAS * 60 * 60 * 1000) {
          ctx.addIssue({
            code: "custom",
            path: ["fecha_hora_programada"],
            message: `La fecha programada debe tener al menos ${ANTICIPACION_MINIMA_HORAS} horas de anticipación.`
          });
        }
      }
    }
  }),
  paradas: z.array(z.object({
    tipo: z.enum(["escala", "tarea"]),
    calle: z.string().trim().min(1, "Calle requerida en parada."),
    numero: z.string().trim().min(1, "Número requerido en parada."),
    colonia: z.string().trim().min(1, "Colonia requerida en parada."),
    codigo_postal: z.string().regex(REGEX_CODIGO_POSTAL, "Código postal inválido en parada."),
    estado: z.string().trim().min(1, "Estado requerido en parada."),
    ciudad: z.string().trim().min(1, "Ciudad requerida en parada."),
    tipo_tarea: z.string().optional().nullable(),
    contacto_nombre: z.string().optional().nullable(),
    contacto_telefono: z.string().optional().nullable(),
    requiere_evidencia: z.boolean(),
    tiempo_espera_min: z.number().optional().nullable()
  })).max(MAX_PARADAS_TRASLADO, `Máximo ${MAX_PARADAS_TRASLADO} paradas permitidas.`).default([])
});
