export const PASOS_REGISTRO = [
  {
    titulo: "Cuenta",
    shortTitle: "Cuenta",
    icono: "👤",
    objetivo: "Crea tu cuenta para poder iniciar sesión.",
    tiempo: "2 min"
  },
  {
    titulo: "Identidad y domicilio",
    shortTitle: "Identidad",
    icono: "🪪",
    objetivo: "Deja que verifiquemos tu identidad y domicilio.",
    tiempo: "4 min"
  },
  {
    titulo: "Licencia",
    shortTitle: "Licencia",
    icono: "🚗",
    objetivo: "Registra tu licencia vigente.",
    tiempo: "3 min"
  },
  {
    titulo: "Documentos",
    shortTitle: "Documentos",
    icono: "📄",
    objetivo: "Carga tus archivos.",
    tiempo: "3 min"
  },
  {
    titulo: "Revisión y envío",
    shortTitle: "Revisión",
    icono: "📋",
    objetivo: "Revisa tus datos antes de enviarlo",
    tiempo: "2 min"
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

export interface CatalogoLicenciaItem {
  entidad: string;
  tipo: string;
  nombre: string;
}

export const ETIQUETAS_ENTIDAD_LICENCIA: Record<string, string> = {
  CDMX: "Ciudad de México (CDMX)",
  MEX: "Estado de México (MEX)",
  QRO: "Querétaro (QRO)",
  GRO: "Guerrero (GRO)",
  MOR: "Morelos (MOR)",
  HGO: "Hidalgo (HGO)"
};

export const CATALOGO_LICENCIAS: readonly CatalogoLicenciaItem[] = [
  { entidad: "CDMX", tipo: "A", nombre: "Automóvil particular" },
  { entidad: "CDMX", tipo: "A1", nombre: "Motocicleta" },
  { entidad: "CDMX", tipo: "A2", nombre: "Automóvil + motocicleta" },
  { entidad: "CDMX", tipo: "B", nombre: "Taxi" },
  { entidad: "CDMX", tipo: "C", nombre: "Transporte público de pasajeros" },
  { entidad: "CDMX", tipo: "D", nombre: "Transporte de carga" },
  { entidad: "CDMX", tipo: "E", nombre: "Transporte especializado" },
  { entidad: "CDMX", tipo: "E1", nombre: "Servicios por aplicación/plataforma" },
  { entidad: "MEX", tipo: "A", nombre: "Automovilista" },
  { entidad: "MEX", tipo: "C", nombre: "Motociclista" },
  { entidad: "MEX", tipo: "E", nombre: "Chofer servicio particular" },
  { entidad: "MEX", tipo: "SP-A", nombre: "Chofer servicio público - discrecional" },
  { entidad: "MEX", tipo: "SP-B", nombre: "Chofer servicio público - colectivo" },
  { entidad: "MEX", tipo: "SP-C", nombre: "Chofer servicio público - especializado" },
  { entidad: "MEX", tipo: "SP-D", nombre: "Chofer servicio público - comunidad" },
  { entidad: "QRO", tipo: "A", nombre: "Automovilista" },
  { entidad: "QRO", tipo: "B", nombre: "Chofer" },
  { entidad: "QRO", tipo: "C-Ct", nombre: "Chofer servicio público - taxi" },
  { entidad: "QRO", tipo: "C-Co", nombre: "Chofer servicio público - colectivo" },
  { entidad: "QRO", tipo: "C-Cc", nombre: "Chofer servicio público - carga" },
  { entidad: "QRO", tipo: "D", nombre: "Motociclista" },
  { entidad: "GRO", tipo: "AUT", nombre: "Automovilista" },
  { entidad: "GRO", tipo: "MOT", nombre: "Motociclista" },
  { entidad: "GRO", tipo: "CHP", nombre: "Chofer servicio público local" },
  { entidad: "MOR", tipo: "AUT", nombre: "Automovilista" },
  { entidad: "MOR", tipo: "MOT", nombre: "Motociclista" },
  { entidad: "MOR", tipo: "CHO", nombre: "Chofer" },
  { entidad: "HGO", tipo: "A", nombre: "Chofer" },
  { entidad: "HGO", tipo: "B", nombre: "Automovilista" },
  { entidad: "HGO", tipo: "C", nombre: "Motociclista" }
] as const;

export const OPCIONES_LICENCIA_SELECT = CATALOGO_LICENCIAS.map((item) => ({
  valor: `${item.entidad} — Tipo ${item.tipo} (${item.nombre})`,
  etiqueta: `Tipo ${item.tipo} — ${item.nombre}`,
  grupo: ETIQUETAS_ENTIDAD_LICENCIA[item.entidad] ?? item.entidad
}));

export const TIPOS_LICENCIA: readonly string[] = OPCIONES_LICENCIA_SELECT.map((o) => o.valor);

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
