import { z } from "zod";
import { fortalezaPassword } from "../utils/fortaleza-password";

/**
 * Fase 4 — Fuente única de reglas y mensajes del registro de conductor.
 * Antes estas validaciones vivían duplicadas como regex sueltas dentro de
 * apps/app-conductor/registro; ahora el wizard, cualquier otra app y el
 * backend (edge functions / validación de metadata) consumen el mismo esquema.
 *
 * Nota: los mensajes están en español mexicano y en el mismo tono de la app;
 * cambiarlos aquí los cambia en todos los consumidores.
 */

const REGEX_CURP = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
const REGEX_TELEFONO_NACIONAL = /^\d{10}$/;
const REGEX_EMAIL = /^\S+@\S+\.\S+$/;
const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
export const DIAS_ADVERTENCIA_VIGENCIA_LICENCIA = 30;
export type EstadoVigenciaLicencia = "sin_vigencia" | "vigente" | "por_vencer" | "vencida";

/** Días entre hoy (medianoche local) y una fecha ISO `YYYY-MM-DD`. Negativo = ya venció. */
export function diasParaVencerLicencia(fechaIso: string, referencia = new Date()) {
  const hoy = new Date(referencia);
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = new Date(`${fechaIso}T00:00:00`);
  return Math.round((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export function tipoDocumentoUsaVigenciaLicencia(tipoDocumento: string) {
  return tipoDocumento === "licencia_frente" || tipoDocumento === "licencia_reverso";
}

export function vencimientoDocumentoDesdeLicencia(tipoDocumento: string, vigenciaLicencia: string | null | undefined) {
  return tipoDocumentoUsaVigenciaLicencia(tipoDocumento) ? vigenciaLicencia ?? null : null;
}

export function estadoVigenciaLicencia(fechaIso: string | null | undefined, referencia = new Date()): EstadoVigenciaLicencia {
  if (!fechaIso) return "sin_vigencia";
  const dias = diasParaVencerLicencia(fechaIso, referencia);
  if (dias < 0) return "vencida";
  if (dias <= DIAS_ADVERTENCIA_VIGENCIA_LICENCIA) return "por_vencer";
  return "vigente";
}

function esFechaIsoValida(fechaIso: string) {
  if (!REGEX_FECHA_ISO.test(fechaIso)) return false;
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const fecha = new Date(`${fechaIso}T00:00:00`);
  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia
  );
}

function textoRequerido(mensaje: string, min = 2) {
  return z
    .string()
    .transform((valor) => valor.trim().replace(/\s+/g, " "))
    .refine((valor) => valor.length >= min, mensaje);
}

export const esquemaRegistroConductor = z.object({
  nombre: textoRequerido("Escribe tu nombre como aparece en tu identificación oficial"),
  apellidos: textoRequerido("Escribe tus apellidos como aparecen en tu identificación oficial"),
  curp: z.string().trim().regex(REGEX_CURP, "Escribe una CURP válida de 18 caracteres"),
  telefono: z.string().regex(REGEX_TELEFONO_NACIONAL, "Escribe un teléfono nacional de 10 dígitos"),
  email: z.string().trim().regex(REGEX_EMAIL, "Escribe un correo electrónico válido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    // Mismo criterio que app-usuario/registro y ambas pantallas nueva-password.
    .refine((valor) => fortalezaPassword(valor).nivel >= 2, "Refuérzala: agrega un número o una mayúscula."),
  codigoPostal: textoRequerido("Escribe tu código postal", 5),
  estado: textoRequerido("Escribe tu estado"),
  ciudad: textoRequerido("Escribe tu ciudad o municipio"),
  colonia: textoRequerido("Escribe tu colonia"),
  calle: textoRequerido("Escribe tu calle"),
  numero: textoRequerido("Escribe el número de tu domicilio", 1),
  referencias: textoRequerido("Agrega una referencia breve"),
  numeroLicencia: textoRequerido("Escribe tu número de licencia"),
  tipoLicencia: textoRequerido("Selecciona o escribe el tipo de licencia"),
  vigenciaLicencia: z
    .string()
    .min(1, "Indica la vigencia de tu licencia")
    .refine(esFechaIsoValida, "Escribe la vigencia en formato AAAA-MM-DD")
    .refine(
      (valor) => diasParaVencerLicencia(valor) >= 0,
      "Tu licencia está vencida. Necesitas una licencia vigente para registrarte."
    ),
  contactoEmergenciaNombre: textoRequerido("Escribe el nombre del contacto"),
  contactoEmergenciaTelefono: z
    .string()
    .regex(REGEX_TELEFONO_NACIONAL, "Escribe un teléfono nacional de 10 dígitos")
});

export type DatosRegistroConductor = z.infer<typeof esquemaRegistroConductor>;
export type CampoRegistroConductor = keyof typeof esquemaRegistroConductor.shape;

/**
 * Valida un solo campo y devuelve el mensaje de error o cadena vacía si es válido.
 * Pensado para validación campo-por-campo (onBlur) en formularios.
 */
export function validarCampoRegistroConductor(campo: CampoRegistroConductor, valor: string): string {
  const resultado = esquemaRegistroConductor.shape[campo].safeParse(valor);
  if (resultado.success) return "";
  return resultado.error.issues[0]?.message ?? "Revisa este campo";
}

/**
 * Valida el formulario completo. Devuelve un mapa campo → mensaje solo con
 * los campos inválidos (vacío si todo es válido).
 */
export function validarRegistroConductor(datos: Record<CampoRegistroConductor, string>) {
  const resultado = esquemaRegistroConductor.safeParse(datos);
  if (resultado.success) return {} as Partial<Record<CampoRegistroConductor, string>>;

  const errores: Partial<Record<CampoRegistroConductor, string>> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as CampoRegistroConductor | undefined;
    if (campo && !errores[campo]) errores[campo] = issue.message;
  }
  return errores;
}
