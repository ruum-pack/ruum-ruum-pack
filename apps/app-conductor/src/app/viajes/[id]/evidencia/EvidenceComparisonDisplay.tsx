import { Aviso, Button } from "@ruum/ui";
import type { ResultadosComparacion } from "./useEvidenceComparison";

export interface EvidenceComparisonDisplayProps {
  resultados: ResultadosComparacion | null;
  estaCargando: boolean;
  error: string | null;
  onRefresh?: () => void;
}

const ICONO_ALERTA = {
  critico: "⚠️",
  advertencia: "⚠️",
  info: "ℹ️"
};

const COLOR_ALERTA = {
  critico: "danger",
  advertencia: "atencion",
  info: "info"
} as const;

export function EvidenceComparisonDisplay({
  resultados,
  estaCargando,
  error,
  onRefresh
}: EvidenceComparisonDisplayProps) {
  if (estaCargando) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4" aria-busy="true">
        <p className="font-body text-sm text-text-secondary">Cargando comparación de evidencia...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-warning bg-warn-soft p-4">
        <Aviso tono="atencion">{error}</Aviso>
        {onRefresh && (
          <Button variant="quiet" onClick={onRefresh} className="mt-3">
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  if (!resultados) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="font-body text-sm text-text-secondary">No hay datos de comparación disponibles.</p>
      </div>
    );
  }

  const { kilometraje, llaves, combustible, documentos, alertas } = resultados;

  // Si no hay evidencia final, mostrar solo los valores iniciales como referencia
  const soloInicial = kilometraje.final === null && kilometraje.inicial !== null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4" aria-labelledby="comparacion-evidencia-titulo">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="comparacion-evidencia-titulo" className="font-body text-sm font-semibold text-text-primary">
            {soloInicial ? "Datos de referencia (inicial)" : "Comparación: Inicial vs Final"}
          </h2>
          <p className="mt-1 font-body text-xs text-text-secondary">
            {soloInicial 
              ? "Estos son los valores capturados al inicio del traslado"
              : "Valores capturados al inicio y final del traslado"
            }
          </p>
        </div>
      </div>

      {/* Alertas de discrepancias */}
      {alertas.length > 0 && (
        <div className="mt-4 grid gap-2">
          {alertas.map((alerta, index) => (
            <div key={index} className="flex items-start gap-2">
              <Aviso tono={COLOR_ALERTA[alerta.tipo]}>
                <span className="flex items-start gap-2">
                  <span aria-hidden="true">{ICONO_ALERTA[alerta.tipo]}</span>
                  <span>{alerta.mensaje}</span>
                </span>
              </Aviso>
            </div>
          ))}
        </div>
      )}

      {/* Tabla de comparación */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[400px] table-fixed border-collapse font-body text-sm">
          <thead>
            <tr className="border-b border-border/22">
              <th className="w-1/3 px-2 py-2 text-left font-semibold text-text-tertiary"></th>
              <th className="w-1/3 px-2 py-2 text-center font-semibold text-text-tertiary">Inicial</th>
              <th className="w-1/3 px-2 py-2 text-center font-semibold text-text-tertiary">Final</th>
            </tr>
          </thead>
          <tbody>
            {/* Kilometraje */}
            <tr className="border-b border-border/22">
              <td className="px-2 py-2 font-body text-text-primary">Kilometraje</td>
              <td className="px-2 py-2 text-center text-text-primary">
                {kilometraje.inicial !== null ? `${kilometraje.inicial.toLocaleString()} km` : "-"}
              </td>
              <td className={`px-2 py-2 text-center ${kilometraje.valido ? "text-text-primary" : "text-danger font-semibold"}`}>
                {kilometraje.final !== null ? `${kilometraje.final.toLocaleString()} km` : "-"}
              </td>
            </tr>
            
            {/* Diferencia de kilometraje */}
            {kilometraje.diferencia !== null && (
              <tr className="border-b border-border/22">
                <td className="px-2 py-2 font-body text-text-secondary" colSpan={1}>Diferencia</td>
                <td className="px-2 py-2 text-center text-text-secondary" colSpan={2}>
                  {kilometraje.diferencia >= 0 ? `+${kilometraje.diferencia.toLocaleString()}` : `${kilometraje.diferencia.toLocaleString()}`} km
                </td>
              </tr>
            )}

            {/* Llaves */}
            <tr className="border-b border-border/22">
              <td className="px-2 py-2 font-body text-text-primary">Llaves</td>
              <td className="px-2 py-2 text-center text-text-primary">
                {llaves.inicial ?? "-"}
              </td>
              <td className={`px-2 py-2 text-center ${llaves.coincide ? "text-text-primary" : "text-danger font-semibold"}`}>
                {llaves.final ?? "-"}
              </td>
            </tr>

            {/* Combustible */}
            <tr className="border-b border-border/22">
              <td className="px-2 py-2 font-body text-text-primary">Combustible</td>
              <td className="px-2 py-2 text-center text-text-primary">
                {combustible.inicial ?? "-"}
              </td>
              <td className={`px-2 py-2 text-center ${combustible.coincide ? "text-text-primary" : "text-warning font-semibold"}`}>
                {combustible.final ?? "-"}
              </td>
            </tr>

            {/* Documentos */}
            {documentosClave.map((doc) => {
              const tieneInicial = documentos.inicial[doc];
              const tieneFinal = documentos.final[doc];
              const hayCambio = tieneInicial !== tieneFinal;
              
              return (
                <tr key={doc} className="border-b border-border/22">
                  <td className="px-2 py-2 font-body text-text-primary">{doc}</td>
                  <td className="px-2 py-2 text-center text-text-primary">
                    {tieneInicial ? "✓" : "✗"}
                  </td>
                  <td className={`px-2 py-2 text-center ${hayCambio ? "text-danger font-semibold" : "text-text-primary"}`}>
                    {tieneFinal ? "✓" : "✗"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Nota sobre la evidencia */}
      <p className="mt-4 text-xs text-text-tertiary">
        {soloInicial 
          ? "* Los valores finales se mostrarán una vez capturados"
          : "* Comparación generada automáticamente al completar ambos registros"
        }
      </p>
    </section>
  );
}

const documentosClave = [
  "Holograma de verificación",
  "Talón de verificación",
  "Tarjeta de circulación",
  "Placa delantera",
  "Placa trasera"
];
