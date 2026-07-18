"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@ruum/ui";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import type { InspeccionEvidencia } from "./evidencia/evidence-requirements";
import { EvidenceComparisonDisplay } from "./evidencia/EvidenceComparisonDisplay";
import type { ResultadosComparacion } from "./evidencia/useEvidenceComparison";

interface TripEvidenceComparisonProps {
  trasladoId: string;
}

const OPCIONES_COMBUSTIBLE = ["R", "1/8", "1/4", "3/8", "1/2", "3/4", "1/1"];

function obtenerIndiceCombustible(valor: string | null): number {
  if (!valor) return -1;
  return OPCIONES_COMBUSTIBLE.indexOf(valor);
}

function calcularComparacion(inicial: InspeccionEvidencia | null, final: InspeccionEvidencia | null): ResultadosComparacion {
  const alertas: Array<{ tipo: "critico" | "advertencia" | "info"; mensaje: string }> = [];

  // Kilometraje
  const kmInicial = inicial?.kilometraje ? parseFloat(inicial.kilometraje) : null;
  const kmFinal = final?.kilometraje ? parseFloat(final.kilometraje) : null;
  const kmDiferencia = kmInicial !== null && kmFinal !== null ? kmFinal - kmInicial : null;
  const kmValido = kmDiferencia === null || kmDiferencia >= 0;
  
  let kmMensaje: string | null = null;
  if (kmInicial !== null && kmFinal !== null && kmFinal < kmInicial) {
    kmMensaje = `Kilometraje final (${kmFinal.toLocaleString()}) menor al inicial (${kmInicial.toLocaleString()})`;
    alertas.push({ tipo: "critico", mensaje: kmMensaje });
  } else if (kmDiferencia !== null && kmDiferencia > 1000) {
    kmMensaje = `Kilometraje recorrido alto: ${kmDiferencia.toLocaleString()} km`;
    alertas.push({ tipo: "advertencia", mensaje: kmMensaje });
  } else if (kmDiferencia !== null && kmDiferencia === 0 && kmFinal !== null && kmFinal > 0) {
    kmMensaje = `Kilometraje sin cambios: ${kmFinal.toLocaleString()} km`;
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
    { nombre: "Holograma de verificación", campo: "hologramaVerificacion" as const },
    { nombre: "Talón de verificación", campo: "talonVerificacion" as const },
    { nombre: "Tarjeta de circulación", campo: "tarjetaCirculacion" as const },
    { nombre: "Placa delantera", campo: "placaDelantera" as const },
    { nombre: "Placa trasera", campo: "placaTrasera" as const }
  ];

  const documentosInicial: Record<string, boolean> = {};
  const documentosFinal: Record<string, boolean> = {};
  
  documentosClave.forEach(({ campo, nombre }) => {
    const valorInicial = inicial?.[campo] as string;
    const valorFinal = final?.[campo] as string;
    
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

export function TripEvidenceComparison({ trasladoId }: TripEvidenceComparisonProps) {
  const [inicial, setInicial] = useState<InspeccionEvidencia | null>(null);
  const [final, setFinal] = useState<InspeccionEvidencia | null>(null);
  const [estaCargando, setEstaCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadosComparacion | null>(null);

  useEffect(() => {
    async function cargarEvidencias() {
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

        const evidenciaInicial = dataToInspeccion(inicialData);
        const evidenciaFinal = dataToInspeccion(finalData);

        setInicial(evidenciaInicial);
        setFinal(evidenciaFinal);

        if (evidenciaInicial || evidenciaFinal) {
          const nuevosResultados = calcularComparacion(evidenciaInicial, evidenciaFinal);
          setResultados(nuevosResultados);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar comparacion de evidencias");
      } finally {
        setEstaCargando(false);
      }
    }

    void cargarEvidencias();
  }, [trasladoId]);

  // No mostrar nada si no hay datos
  if (estaCargando) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4" aria-busy="true">
        <p className="font-body text-sm text-text-secondary">Cargando comparación...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-warning bg-warn-soft p-4">
        <Aviso tono="atencion">{error}</Aviso>
      </div>
    );
  }

  // Mostrar solo si hay al menos evidencia inicial
  if (!inicial && !final) {
    return null;
  }

  return (
    <EvidenceComparisonDisplay 
      resultados={resultados} 
      estaCargando={estaCargando} 
      error={error}
    />
  );
}
