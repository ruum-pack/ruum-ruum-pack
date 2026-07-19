export const PASOS_REGISTRO = [
  {
    titulo: "Cuenta",
    objetivo: "",
    tiempo: "2 min"
  },
  {
    titulo: "Licencia y experiencia",
    objetivo: "Registra tu licencia vigente",
    tiempo: "3 min"
  },
  {
    titulo: "Documentos",
    objetivo: "Carga tus archivos cuando tu cuenta esté verificada.",
    tiempo: "3 min"
  },
  {
    titulo: "Revisión y envío",
    objetivo: "Revisa tus datos antes de enviarlo",  tiempo: "2 min"
  }
];

export const TIPOS_DOCUMENTO = {
  licenciaFrente: "licencia_frente",
  licenciaReverso: "licencia_reverso",
  identificacionOficial: "identificacion_oficial"
} as const;

export const ETIQUETA_DOCUMENTO: Record<DocumentoKey, string> = {
  licenciaFrente: "licencia (frente)",
  licenciaReverso: "licencia (reverso)",
  identificacionOficial: "identificación oficial"
};

export const TIPOS_LICENCIA = [
  "Tipo A - Automovilista",
  "Tipo B - Chofer",
  "Tipo C - Carga",
  "Tipo D - Motociclista",
  "Tipo E - Transporte especializado",
  "Licencia federal de conductor"
];

export const TIPOS_ARCHIVO_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export type DocumentoKey = keyof typeof TIPOS_DOCUMENTO;
export type EstadoDocumento = "pendiente" | "listo" | "subiendo" | "subido" | "error";
export type EstadoGuardadoRemoto = "inactivo" | "guardando" | "guardado" | "sin_conexion" | "error";

export const TEXTO_GUARDADO_REMOTO: Record<EstadoGuardadoRemoto, string> = {
  inactivo: "",
  guardando: "Guardando…",
  guardado: "Guardado",
  sin_conexion: "Sin conexión",
  error: "Error al guardar"
};

export function estadoInicialDocumentos(): Record<DocumentoKey, EstadoDocumento> {
  return {
    licenciaFrente: "pendiente",
    licenciaReverso: "pendiente",
    identificacionOficial: "pendiente"
  };
}
