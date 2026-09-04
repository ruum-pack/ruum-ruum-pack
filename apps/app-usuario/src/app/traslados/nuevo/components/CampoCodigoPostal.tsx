"use client";
import { Field } from "@ruum/ui";
import type { DatosCodigoPostal } from "../../../../lib/codigos-postales";

export interface CampoCodigoPostalProps {
  id?: string;
  nombre?: string;
  valor: string;
  ciudadActual: string;
  opciones: DatosCodigoPostal | null;
  sugerenciasMapbox: string[];
  consultando: boolean;
  aviso: string | null;
  error?: string;
  onCambiar: (valor: string) => void;
  onSalir: (valor: string) => void;
  onAplicarSugerencia: (ciudad: string, colonia: string) => void;
}

// Componente a nivel de módulo a propósito: antes vivía declarado dentro de
// NuevoTrasladoForm, así que React lo veía como un tipo de componente nuevo
// en cada render (nueva referencia de función) y desmontaba/remontaba el
// <input> en cada tecla — de ahí que solo se pudiera capturar un dígito del
// CP a la vez y hubiera que hacer click de nuevo para seguir escribiendo.
export function CampoCodigoPostal({
  id,
  nombre,
  valor,
  ciudadActual,
  opciones,
  sugerenciasMapbox,
  consultando,
  aviso,
  error,
  onCambiar,
  onSalir,
  onAplicarSugerencia
}: CampoCodigoPostalProps) {
  const ciudadBase = ciudadActual || opciones?.ciudades[0] || "";
  const sugerencias = opciones
    ? opciones.colonias.slice(0, 5).map((colonia) => ({
        ciudad: opciones.ciudades[0] ?? ciudadBase,
        colonia
      }))
    : [];

  return (
    <div className="grid gap-2">
      <Field
        id={id}
        name={nombre}
        etiqueta="Código Postal"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onBlur={(e) => onSalir(e.target.value)}
        inputMode="numeric"
        maxLength={5}
        ayuda={consultando ? "Consultando CP..." : aviso}
        error={error}
      />
      {(sugerenciasMapbox.length > 0 || sugerencias.length > 0) && (
        <div className="rounded-lg border border-ink/10 bg-mist px-3 py-2">
          {sugerenciasMapbox.length > 0 && (
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Referencias Mapbox</p>
              <div className="mt-1 grid gap-1">
                {sugerenciasMapbox.map((opcion) => (
                  <p
                    key={opcion}
                    className="rounded-md px-2 py-1 font-body text-xs text-ink/70"
                  >
                    {opcion}
                  </p>
                ))}
              </div>
            </div>
          )}
          {sugerencias.length > 0 && (
            <div className={sugerenciasMapbox.length ? "mt-2 border-t border-ink/10 pt-2" : ""}>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Colonias sugeridas</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {sugerencias.map((opcion) => (
                  <button
                    key={`${opcion.ciudad}-${opcion.colonia}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAplicarSugerencia(opcion.ciudad, opcion.colonia)}
                    className="rounded-full border border-ink/10 px-2.5 py-1 font-body text-xs text-ink/70 hover:border-signal/40"
                  >
                    {opcion.colonia}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
