import { createLogger, errorCode } from "@ruum/shared/utils";

const CLAVE_ACTUAL = "ruumruum.registro-conductor.borrador.v2";
const CLAVES_ANTERIORES = ["ruumruum.registro-conductor.borrador.v1"];
const VERSION_ESQUEMA = 2;
const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const logger = createLogger("registration");

export interface BorradorRegistroLocal {
  versionEsquema: 2;
  guardadoEn: string;
  expiraEn: string;
  paso: number;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  codigoPostal: string;
  estado: string;
  ciudad: string;
  colonia: string;
  tipoLicencia: string;
  vigenciaLicencia: string;
}

const CAMPOS = [
  "nombre","apellidos","telefono","email","codigoPostal","estado","ciudad","colonia","tipoLicencia","vigenciaLicencia"
] as const;

export function limpiarBorradorRegistroLocal() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLAVE_ACTUAL);
    for (const clave of CLAVES_ANTERIORES) window.localStorage.removeItem(clave);
  } catch {
    // localStorage no está disponible; no queda nada más que limpiar.
  }
}

export function leerBorradorRegistroLocal(): BorradorRegistroLocal | null {
  if (typeof window === "undefined") return null;
  try {
    for (const clave of CLAVES_ANTERIORES) window.localStorage.removeItem(clave);
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
    const borrador: BorradorRegistroLocal = {
      versionEsquema: 2,
      guardadoEn: dato.guardadoEn,
      expiraEn: dato.expiraEn,
      paso: typeof dato.paso === "number" && Number.isInteger(dato.paso) && dato.paso >= 0 && dato.paso <= 4 ? dato.paso : 0,
      nombre:"",apellidos:"",telefono:"",email:"",codigoPostal:"",estado:"",ciudad:"",colonia:"",tipoLicencia:"",vigenciaLicencia:""
    };
    for (const campo of CAMPOS) {
      const contenido = dato[campo];
      if (typeof contenido !== "string" || contenido.length > 180) throw new Error(`campo inválido: ${campo}`);
      borrador[campo] = contenido;
    }
    return CAMPOS.some((campo)=>borrador[campo].trim()) ? borrador : null;
  } catch (error) {
    logger.warn(
      "registration_draft_restore_failed",
      {
        errorCode: errorCode(error),
        schemaVersion: VERSION_ESQUEMA
      },
      "user_expected"
    );
    limpiarBorradorRegistroLocal();
    return null;
  }
}

export function guardarBorradorRegistroLocal(datos: Omit<BorradorRegistroLocal,"versionEsquema"|"guardadoEn"|"expiraEn">) {
  if (typeof window === "undefined") return;
  const ahora = Date.now();
  const borrador:BorradorRegistroLocal={
    ...datos,versionEsquema:2,guardadoEn:new Date(ahora).toISOString(),expiraEn:new Date(ahora+VIGENCIA_MS).toISOString()
  };
  try { window.localStorage.setItem(CLAVE_ACTUAL,JSON.stringify(borrador)); }
  catch { /* El registro funciona sin persistencia local. */ }
}
