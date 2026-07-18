import { useCallback, useEffect, useState } from "react";
import type { InspeccionEvidencia } from "./evidence-requirements";
import { INSPECCION_INICIAL } from "./evidence-requirements";
import { crearClienteNavegador } from "../../../../lib/supabase-browser";

export interface EvidenciaComparada {
  inicial: InspeccionEvidencia | null;
  final: InspeccionEvidencia | null;
  estaCargando: boolean;
  error: string | null;
}

export interface ResultadosComparacion {
  kilometraje: {
    inicial: number | null;
    final: number | null;
    diferencia: number | null;
    valido: boolean;
    mensaje: string | null;
  };
  llaves: {
    inicial: string | null;
    final: string | null;
    coincide: boolean;
    mensaje: string | null;
  };
  combustible: {
    inicial: string | null;
    final: string | null;
    coincide: boolean;
    mensaje: string | null;
  };
  documentos: {
    inicial: Record<string, boolean>;
    final: Record<string, boolean>;
    faltantes: string[];
  };
  alertas: Array<{ tipo: "critico" | "advertencia" | "info"; mensaje: string }>;
}

const OPCIONES_COMBUSTIBLE = ["R", "1/8", "1/4", "3/8", "1/2", "3/4", "1/1"];

function parsearCombustibleValor(valor: string | null): number {
  if (!valor) return 0;
  const index = OPCIONES_COMBUSTIBLE.indexOf(valor);
  return index >= 0 ? index / OPCIONES_COMBUSTIBLE.length : 0;
}

function obtenerIndiceCombustible(valor: string | null): number {
  if (!valor) return -1;
  return OPCIONES_COMBUSTIBLE.indexOf(valor);
}

export function useEvidenceComparison(trasladoId: string): EvidenciaComparada & { resultados: ResultadosComparacion | null } {
  const [inicial, setInicial] = useState<InspeccionEvidencia | null>(null);
  const [final, setFinal] = useState<InspeccionEvidencia | null>(null);
  const [estaCargando, setEstaCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadosComparacion | null>(null);

  const cargarEvidencias = useCallback(async () => {
    setEstaCargando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();

      const [inicialData, finalData] = await Promise.all([
        cliente
          .from("evidencia_inspecciones")
          .select("*")
          .eq("traslado_id", trasladoId)
          .eq("tipo", "inicial")
          .maybeSingle(),
        cliente
          .from("evidencia_inspecciones")
          .select("*")
          .eq("traslado_id", trasladoId)
          .eq("tipo", "final")
          .maybeSingle()
      ]);

      // Parsear datos de la base de datos a InspeccionEvidencia
      const parsearEvidencia = (data: any | null): InspeccionEvidencia => {
        if (!data) return INSPECCION_INICIAL;

        return {
          combustible: data.combustible ?? "",
          kilometraje: data.kilometraje !== null && data.kilometraje !== undefined ? String(data.kilometraje) : "",
          llavesRecibidas: data.llaves_recibidas ?? "",
          hologramaVerificacion: data.holograma_verificacion === null || data.holograma_verificacion === undefined
            ? ""
            : data.holograma_verificacion
              ? "si"
              : "no",
          talonVerificacion: data.talon_verificacion ?? "",
          tarjetaCirculacion: data.tarjeta_circulacion ?? "",
          placaDelantera: data.placa_delantera ?? "",
          placaTrasera: data.placa_trasera ?? "",
          notas: data.notas ?? ""
        };
      };

      const evidenciaInicial = dataToInspeccion(inicialData);
      const evidenciaFinal = dataToInspeccion(finalData);

      setInicial(evidenciaInicial);
      setFinal(evidenciaFinal);

      // Calcular resultados de comparación
      const nuevosResultados = calcularComparacion(evidenciaInicial, evidenciaFinal);
      setResultados(nuevosResultados);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar evidencias");
      setResultados(null);
    } finally {
      setEstaCargando(false);
    }
  }, [trasladoId]);

  // Helper para parsear datos de BD a InspeccionEvidencia
  function dataToInspeccion(data: any | null): InspeccionEvidencia | null {
    if (!data) return null;

    return {
      combustible: data.combustible ?? "",
      kilometraje: data.kilometraje !== null && data.kilometraje !== undefined ? String(data.kilometraje) : "",
      llavesRecibidas: data.llaves_recibidas ?? "",
      hologramaVerificacion:
        data.holograma_verificacion === null || data.holograma_verificacion === undefined
          ? ""
          : data.holograma_verificacion
            ? "si"
            : "no",
      talonVerificacion: data.talon_verificacion ?? "",
      tarjetaCirculacion: data.tarjeta_circulacion ?? "",
      placaDelantera: data.placa_delantera ?? "",
      placaTrasera: data.placa_trasera ?? "",
      notas: data.notas ?? ""
    };
  }

  // Función para calcular la comparación
  function calcularComparacion(inicial: InspeccionEvidencia | null, final: InspeccionEvidencia | null): ResultadosComparacion {
    const alertas: Array<{ tipo: "critico" | "advertencia" | "info"; mensaje: string }> = [];

    // Kilometraje
    const kmInicial = inicial?.kilometraje ? parseFloat(inicial.kilometraje) : null;
    const kmFinal = final?.kilometraje ? parseFloat(final.kilometraje) : null;
    const kmDiferencia = kmInicial !== null && kmFinal !== null ? kmFinal - kmInicial : null;
    const kmValido = kmDiferencia === null || kmDiferencia >= 0;
    
    let kmMensaje: string | null = null;
    if (kmInicial !== null && kmFinal !== null && kmFinal < kmInicial) {
      kmMensaje = `Kilometraje final (${kmFinal}) menor al inicial (${kmInicial})`;
      alertas.push({ tipo: "critico", mensaje: kmMensaje });
    } else if (kmDiferencia !== null && kmDiferencia > 1000) {
      kmMensaje = `Kilometraje recorrido alto: ${kmDiferencia} km`;
      alertas.push({ tipo: "advertencia", mensaje: kmMensaje });
    } else if (kmDiferencia !== null && kmDiferencia === 0 && kmFinal !== null && kmFinal > 0) {
      kmMensaje = `Kilometraje sin cambios: ${kmFinal} km`;
      alertas.push({ tipo: "info", mensaje: kmMensaje });
    }

    // Llaves
    const llavesInicial = inicial?.llavesRecibidas || "";
    const llavesFinal = final?.llavesRecibidas || "";
    const llavesCoincide = llavesInicial === llavesFinal;
    let llavesMensaje: string | null = null;
    
    if (llavesInicial && llavesFinal && !llavesCoincide) {
      llavesMensaje = `Número de llaves no coincide: inicial (${llavesInicial}), final (${llavesFinal})`;
      alertas.push({ tipo: "critico", mensaje: llavesMensaje });
    }

    // Combustible
    const combInicial = inicial?.combustible || "";
    const combFinal = final?.combustible || "";
    const combCoincide = combInicial === combFinal;
    const combIndiceInicial = obtenerIndiceCombustible(combInicial);
    const combIndiceFinal = obtenerIndiceCombustible(combFinal);
    let combMensaje: string | null = null;
    
    if (combIndiceInicial >= 0 && combIndiceFinal >= 0 && combIndiceFinal < combIndiceInicial) {
      combMensaje = `Combustible disminuyó: de ${combInicial} a ${combFinal}`;
      alertas.push({ tipo: "advertencia", mensaje: combMensaje });
    }

    // Documentos
    const documentosClave = [
      { campo: "hologramaVerificacion", nombre: "Holograma de verificación" },
      { campo: "talonVerificacion", nombre: "Talón de verificación" },
      { campo: "tarjetaCirculacion", nombre: "Tarjeta de circulación" },
      { campo: "placaDelantera", nombre: "Placa delantera" },
      { campo: "placaTrasera", nombre: "Placa trasera" }
    ];

    const documentosInicial: Record<string, boolean> = {};
    const documentosFinal: Record<string, boolean> = {};
    
    documentosClave.forEach(({ campo, nombre }) => {
      const valorInicial = inicial?.[campo as keyof InspeccionEvidencia] as string;
      const valorFinal = final?.[campo as keyof InspeccionEvidencia] as string;
      
      documentosInicial[nombre] = valorInicial === "si";
      documentosFinal[nombre] = valorFinal === "si";
    });

    const documentosFaltantes = documentosClave
      .filter(({ nombre }) => documentosInicial[nombre] && !documentosFinal[nombre])
      .map(({ nombre }) => nombre);

    documentosFaltantes.forEach(doc => {
      alertas.push({ tipo: "advertencia", mensaje: `Documento ${doc} estaba presente al inicio pero no al final` });
    });

    return {
      kilometraje: {
        inicial: kmInicial,
        final: kmFinal,
        diferencia: kmDiferencia,
        valido: kmValido,
        mensaje: kmMensaje
      },
      llaves: {
        inicial: llavesInicial || null,
        final: llavesFinal || null,
        coincide: llavesCoincide,
        mensaje: llavesMensaje
      },
      combustible: {
        inicial: combInicial || null,
        final: combFinal || null,
        coincide: combCoincide,
        mensaje: combMensaje
      },
      documentos: {
        inicial: documentosInicial,
        final: documentosFinal,
        faltantes: documentosFaltantes
      },
      alertas
    };
  }

  // Cargar evidencias al montar o cambiar trasladoId
  useEffect(() => {
    if (trasladoId) {
      void cargarEvidencias();
    }
  }, [trasladoId, cargarEvidencias]);

  return {
    inicial,
    final,
    estaCargando,
    error,
    resultados
  };
}
