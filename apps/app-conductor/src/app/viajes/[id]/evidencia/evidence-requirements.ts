import type { Database } from "@ruum/shared/types";
import type { AnguloEvidencia, FotoEvidencia, TipoEvidencia } from "@ruum/shared/types";

export type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
export type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export type EvidenceRequirement = {
  angulo: AnguloEvidencia;
  titulo: string;
  instruccion: string;
  guia: string;
  obligatorio: boolean;
  permiteNoAplica: boolean;
};

export interface InspeccionEvidencia {
  combustible: string;
  kilometraje: string;
  llavesRecibidas: string;
  hologramaVerificacion: "" | "si" | "no";
  talonVerificacion: string;
  tarjetaCirculacion: string;
  placaDelantera: string;
  placaTrasera: string;
  notas: string;
}

export const INSPECCION_INICIAL: InspeccionEvidencia = {
  combustible: "",
  kilometraje: "",
  llavesRecibidas: "",
  hologramaVerificacion: "",
  talonVerificacion: "",
  tarjetaCirculacion: "",
  placaDelantera: "",
  placaTrasera: "",
  notas: ""
};

export const OPCIONES_COMBUSTIBLE = ["R", "1/8", "1/4", "3/8", "1/2", "3/4", "1/1"];
export const OPCIONES_LLAVES = ["1", "2", "3"];
export const OPCIONES_SI_NO = [
  { valor: "si", etiqueta: "Sí" },
  { valor: "no", etiqueta: "No" }
];

export const ETIQUETA_ANGULO: Record<AnguloEvidencia, string> = {
  frente: "Frente",
  lado_piloto: "Lado piloto",
  lado_copiloto: "Lado copiloto",
  trasera: "Trasera",
  tablero: "Tablero",
  dano_previo: "Daño previo",
  adicional: "Adicional"
};

export function listaEvidenciaObligatoria(tipo: TipoEvidencia): EvidenceRequirement[] {
  const prefijo = tipo === "inicial" ? "antes de moverlo" : "antes de entregar";
  return [
    {
      angulo: "frente",
      titulo: "Frente",
      instruccion: `Toma el vehículo completo de frente ${prefijo}. Incluye placas y defensa.`,
      guia: "Alinea la defensa dentro del marco.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "lado_piloto",
      titulo: "Lado piloto",
      instruccion: "Captura todo el costado del conductor, de espejo a defensa trasera.",
      guia: "Coloca el vehículo horizontal dentro de la silueta.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "lado_copiloto",
      titulo: "Lado copiloto",
      instruccion: "Captura todo el costado del copiloto, sin cortar defensas ni llantas.",
      guia: "Deja aire alrededor de las cuatro llantas.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "trasera",
      titulo: "Trasera",
      instruccion: "Toma la parte trasera completa. Incluye placas, cajuela y defensa.",
      guia: "Centra la placa y la defensa.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "tablero",
      titulo: "Tablero",
      instruccion: "Captura el tablero con kilometraje visible y sin reflejos fuertes.",
      guia: "El odómetro debe quedar legible.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "dano_previo",
      titulo: tipo === "inicial" ? "Daños preexistentes" : "Daños visibles",
      instruccion:
        tipo === "inicial"
          ? "Registra golpes, rayones o piezas dañadas antes de iniciar el traslado."
          : "Registra cualquier cambio visible detectado al llegar al destino.",
      guia: "Acércate al daño y toma una foto clara.",
      obligatorio: false,
      permiteNoAplica: true
    }
  ];
}

export function fotoSrc(foto?: FotoEvidencia) {
  return foto?.local_path || foto?.url || null;
}

// PRD §4.4 - tipo de evidencia según en qué punto del flujo está el viaje.
export function tipoEvidenciaPorEstado(estado: EstadoTraslado): TipoEvidencia | null {
  if (estado === "verificacion_vehiculo_en_proceso" || estado === "evidencia_inicial_en_proceso") return "inicial";
  if (estado === "llegada_a_destino" || estado === "evidencia_final_en_proceso") return "final";
  return null;
}
