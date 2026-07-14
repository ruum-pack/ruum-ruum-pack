/**
 * Sprint 4 (2026-07-11) — mismo patrón que
 * app-conductor/src/lib/borrador-registro.ts (Fase 4 + auditoría H-3):
 * borrador NO sensible del wizard de traslados/nuevo, con vigencia de 24h,
 * para retomarlo si la app se cierra a medio llenar. Ninguna otra pantalla
 * de app-usuario tenía este patrón todavía — el wizard de traslado es el
 * único formulario largo (2 pasos, ~25 campos) sin persistencia.
 *
 * Excluido a propósito, por lo mismo que excluye borrador-registro.ts:
 *  - Domicilio preciso (calle, número, lat/lng): son domicilio real de
 *    origen/destino, no deben vivir en el almacenamiento del dispositivo.
 *  - Teléfonos de contacto de entrega/recepción: casi siempre son de un
 *    TERCERO (no de quien usa la app), no de quien llena el formulario.
 *  - VIN y placas: identifican un vehículo real de forma única.
 *  - Instrucciones especiales: texto libre que en la práctica suele traer
 *    referencias de domicilio o códigos de acceso.
 *  - vehiculoSeleccionadoId: si se restaura, mejor que la persona vuelva a
 *    elegir de su lista (ya cargada por sesión) que arrastrar un id viejo.
 */

const CLAVE_ACTUAL = "ruumruum.traslados-nuevo.borrador.v2";
const VERSION_ESQUEMA = 2;
const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const LONGITUD_MAXIMA_CAMPO = 180;

export interface BorradorTrasladoLocal {
  versionEsquema: 2;
  claveIdempotencia: string;
  guardadoEn: string;
  expiraEn: string;
  paso: number;
  tipo: string;
  transmision: string;
  marca: string;
  modelo: string;
  anio: string;
  color: string;
  condicion: string;
  estadoGeneral: string;
  tieneTarjeta: boolean;
  tieneVerificacion: boolean;
  tienePlacas: boolean;
  puedeCircular: boolean;
  origenCodigoPostal: string;
  origenEstado: string;
  origenCiudad: string;
  origenColonia: string;
  destinoCodigoPostal: string;
  destinoEstado: string;
  destinoCiudad: string;
  destinoColonia: string;
  entregaNombre: string;
  entregaApellido: string;
  recepcionNombre: string;
  recepcionApellido: string;
  modalidadProgramacion: string;
  fechaHoraProgramada: string;
  tipoRuta: string;
  ventanaRecoleccion: string;
  ventanaEntrega: string;
  tipoServicio: string;
  motivoServicio: string;
}

const CAMPOS_TEXTO = [
  "tipo", "transmision", "marca", "modelo", "anio", "color", "condicion", "estadoGeneral",
  "origenCodigoPostal", "origenEstado", "origenCiudad", "origenColonia",
  "destinoCodigoPostal", "destinoEstado", "destinoCiudad", "destinoColonia",
  "entregaNombre", "entregaApellido", "recepcionNombre", "recepcionApellido",
  "modalidadProgramacion", "fechaHoraProgramada", "tipoRuta",
  "ventanaRecoleccion", "ventanaEntrega", "tipoServicio", "motivoServicio"
] as const;

const CAMPOS_BOOLEANOS = ["tieneTarjeta", "tieneVerificacion", "tienePlacas", "puedeCircular"] as const;

export function limpiarBorradorTrasladoLocal() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLAVE_ACTUAL);
  } catch {
    // localStorage no está disponible; no queda nada más que limpiar.
  }
}

export function leerBorradorTrasladoLocal(): BorradorTrasladoLocal | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(CLAVE_ACTUAL);
    if (!crudo) return null;
    const valor = JSON.parse(crudo) as unknown;
    if (!valor || typeof valor !== "object") throw new Error("esquema inválido");
    const dato = valor as Record<string, unknown>;
    if (dato.versionEsquema !== VERSION_ESQUEMA || typeof dato.guardadoEn !== "string" || typeof dato.expiraEn !== "string") {
      throw new Error("versión inválida");
    }
    const expira = new Date(dato.expiraEn).getTime();
    const guardado = new Date(dato.guardadoEn).getTime();
    if (!Number.isFinite(expira) || !Number.isFinite(guardado) || expira <= Date.now() || expira - guardado > VIGENCIA_MS) {
      throw new Error("borrador vencido");
    }

    const borrador: BorradorTrasladoLocal = {
      versionEsquema: 2,
      claveIdempotencia: typeof dato.claveIdempotencia === "string" && /^[0-9a-f-]{36}$/i.test(dato.claveIdempotencia)
        ? dato.claveIdempotencia
        : crypto.randomUUID(),
      guardadoEn: dato.guardadoEn,
      expiraEn: dato.expiraEn,
      paso: typeof dato.paso === "number" && Number.isInteger(dato.paso) && dato.paso >= 0 && dato.paso <= 1 ? dato.paso : 0,
      tipo: "", transmision: "", marca: "", modelo: "", anio: "", color: "", condicion: "", estadoGeneral: "",
      tieneTarjeta: false, tieneVerificacion: false, tienePlacas: false, puedeCircular: false,
      origenCodigoPostal: "", origenEstado: "", origenCiudad: "", origenColonia: "",
      destinoCodigoPostal: "", destinoEstado: "", destinoCiudad: "", destinoColonia: "",
      entregaNombre: "", entregaApellido: "", recepcionNombre: "", recepcionApellido: "",
      modalidadProgramacion: "", fechaHoraProgramada: "", tipoRuta: "",
      ventanaRecoleccion: "", ventanaEntrega: "", tipoServicio: "", motivoServicio: ""
    };

    for (const campo of CAMPOS_TEXTO) {
      const contenido = dato[campo];
      if (typeof contenido !== "string" || contenido.length > LONGITUD_MAXIMA_CAMPO) {
        throw new Error(`campo inválido: ${campo}`);
      }
      borrador[campo] = contenido;
    }
    for (const campo of CAMPOS_BOOLEANOS) {
      borrador[campo] = Boolean(dato[campo]);
    }

    const hayContenido = CAMPOS_TEXTO.some((campo) => borrador[campo].trim());
    return hayContenido ? borrador : null;
  } catch {
    limpiarBorradorTrasladoLocal();
    return null;
  }
}

export function guardarBorradorTrasladoLocal(
  datos: Omit<BorradorTrasladoLocal, "versionEsquema" | "guardadoEn" | "expiraEn">
) {
  if (typeof window === "undefined") return;
  const ahora = Date.now();
  const borrador: BorradorTrasladoLocal = {
    ...datos,
    versionEsquema: VERSION_ESQUEMA,
    guardadoEn: new Date(ahora).toISOString(),
    expiraEn: new Date(ahora + VIGENCIA_MS).toISOString()
  };
  try {
    window.localStorage.setItem(CLAVE_ACTUAL, JSON.stringify(borrador));
  } catch {
    // El wizard funciona sin persistencia local.
  }
}
