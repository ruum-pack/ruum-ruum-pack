"use client";

import { useEffect, useState, useTransition } from "react";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import {
  obtenerConfiguracionTarifas,
  actualizarTarifaVehiculo,
  actualizarFactorGama,
  actualizarFactorCondicion,
  actualizarFactorHorario,
  actualizarFactorDia,
  actualizarConfigTarifas,
  actualizarPagoConductorPorCertificacion,
  type ConfiguracionTarifas
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

const ETIQUETA_CATEGORIA: Record<string, string> = {
  ligero_a: "Ligero A",
  ligero_b: "Ligero B",
  mediano: "Mediano",
  camion: "Camión"
};

const ETIQUETA_RANGO: Record<string, string> = {
  rango_1: "Rango 1 · hasta 15 km",
  rango_2: "Rango 2 · 16-45 km",
  rango_3: "Rango 3 · 46-75 km",
  rango_4: "Rango 4 · más de 75 km"
};

const VACIO: ConfiguracionTarifas = { vehiculo: [], gama: [], condicion: [], horario: [], dia: [], config: null, certificacionPago: [] };

function FilaEditable({
  etiqueta,
  valorInicial,
  sufijo,
  onGuardar
}: {
  etiqueta: string;
  valorInicial: number;
  sufijo?: string;
  onGuardar: (valor: number) => Promise<void>;
}) {
  const [valor, setValor] = useState(String(valorInicial));
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  function guardar() {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
      setMensaje("Valor inválido.");
      return;
    }
    setMensaje(null);
    startTransition(async () => {
      try {
        await onGuardar(numero);
        setMensaje("Guardado.");
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-ink/10 py-3 last:border-b-0">
      <span className="min-w-40 font-body text-sm font-medium text-ink/75">{etiqueta}</span>
      <div className="flex items-center gap-2">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          className="w-28 rounded-lg border border-ink/30 bg-mist px-3 py-1.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
        />
        {sufijo && <span className="font-body text-xs text-ink/45">{sufijo}</span>}
      </div>
      <Button variant="fantasma" onClick={guardar} disabled={pendiente}>Guardar</Button>
      {mensaje && <span className="font-body text-xs text-ink/55">{mensaje}</span>}
    </div>
  );
}

export default function PaginaTarifasAdmin() {
  const [datos, setDatos] = useState<ConfiguracionTarifas>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const configuracion = await obtenerConfiguracionTarifas(cliente);
      setDatos(configuracion);
      if (configuracion.vehiculo.length === 0) {
        setError("No se encontró configuración de tarifas. Si no eres admin, este módulo no te mostrará datos (RLS admin-only).");
      } else {
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la configuración de tarifas.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, []);

  const cliente = tieneSupabaseConfigurado() ? crearClienteNavegador() : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tarifas</h1>
          <p className="mt-1 font-body text-sm text-ink/55">
            Fórmula RT-12: Base_categoria (por vehículo y rango) × gama, + $/km + $/hora, × factor variable (condición × horario × día,
            con tope). Solo el admin puede crear, modificar o actualizar esta configuración — RLS lo aplica a nivel de base de datos.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tono="atencion">{error}</Aviso>
        </div>
      )}

      {cargando ? (
        <p className="mt-8 font-body text-sm text-ink/50">Cargando configuración de tarifas...</p>
      ) : (
        <div className="mt-6 grid gap-6">
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Base y $/km por vehículo</h2>
            <p className="mt-1 font-body text-sm text-ink/55">Cada tipo de vehículo tiene su propia base y $/km — ya no comparten un multiplicador único.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] font-body text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink/45">
                    <th className="border-b border-ink/10 px-3 py-2">Categoría</th>
                    <th className="border-b border-ink/10 px-3 py-2">Rango</th>
                    <th className="border-b border-ink/10 px-3 py-2">Base</th>
                    <th className="border-b border-ink/10 px-3 py-2">$/km</th>
                    <th className="border-b border-ink/10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {datos.vehiculo.map((fila) => (
                    <FilaVehiculo key={fila.id} fila={fila} cliente={cliente} onGuardado={cargar} />
                  ))}
                </tbody>
              </table>
            </div>
          </PassportCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <PassportCard>
              <h2 className="font-display text-xl font-semibold">Factor de gama</h2>
              {datos.gama.map((f) => (
                <FilaEditable
                  key={f.gama}
                  etiqueta={f.gama}
                  valorInicial={f.factor}
                  onGuardar={async (valor) => {
                    if (!cliente) throw new Error("Sin cliente Supabase.");
                    await actualizarFactorGama(cliente, f.gama, valor);
                    await cargar();
                  }}
                />
              ))}
            </PassportCard>

            <PassportCard>
              <h2 className="font-display text-xl font-semibold">Factor de condición</h2>
              {datos.condicion.map((f) => (
                <FilaEditable
                  key={f.condicion}
                  etiqueta={f.condicion.replaceAll("_", " ")}
                  valorInicial={f.factor}
                  onGuardar={async (valor) => {
                    if (!cliente) throw new Error("Sin cliente Supabase.");
                    await actualizarFactorCondicion(cliente, f.condicion, valor);
                    await cargar();
                  }}
                />
              ))}
            </PassportCard>

            <PassportCard>
              <h2 className="font-display text-xl font-semibold">Factor de horario</h2>
              {datos.horario.map((f) => (
                <FilaEditable
                  key={f.horario}
                  etiqueta={f.horario}
                  valorInicial={f.factor}
                  onGuardar={async (valor) => {
                    if (!cliente) throw new Error("Sin cliente Supabase.");
                    await actualizarFactorHorario(cliente, f.horario, valor);
                    await cargar();
                  }}
                />
              ))}
            </PassportCard>

            <PassportCard>
              <h2 className="font-display text-xl font-semibold">Factor de día</h2>
              {datos.dia.map((f) => (
                <FilaEditable
                  key={f.dia}
                  etiqueta={f.dia.replaceAll("_", " ")}
                  valorInicial={f.factor}
                  onGuardar={async (valor) => {
                    if (!cliente) throw new Error("Sin cliente Supabase.");
                    await actualizarFactorDia(cliente, f.dia, valor);
                    await cargar();
                  }}
                />
              ))}
            </PassportCard>
          </div>

          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Configuración general</h2>
            {datos.config && (
              <>
                <FilaEditable
                  etiqueta="Tarifa por hora"
                  valorInicial={datos.config.tarifa_hora}
                  sufijo="$/hora"
                  onGuardar={async (valor) => {
                    if (!cliente || !datos.config) throw new Error("Sin cliente Supabase.");
                    await actualizarConfigTarifas(cliente, { tarifa_hora: valor, tope_factor_variable: datos.config.tope_factor_variable });
                    await cargar();
                  }}
                />
                <FilaEditable
                  etiqueta="Tope del factor variable"
                  valorInicial={datos.config.tope_factor_variable}
                  sufijo="máximo condición × horario × día"
                  onGuardar={async (valor) => {
                    if (!cliente || !datos.config) throw new Error("Sin cliente Supabase.");
                    await actualizarConfigTarifas(cliente, { tarifa_hora: datos.config.tarifa_hora, tope_factor_variable: valor });
                    await cargar();
                  }}
                />
              </>
            )}
          </PassportCard>

          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Pago al conductor por certificación</h2>
            <p className="mt-1 font-body text-sm text-ink/55">
              La certificación ya no afecta el precio al usuario — solo el porcentaje que recibe el conductor.
            </p>
            {datos.certificacionPago.map((f) => (
              <FilaEditable
                key={f.certificacion}
                etiqueta={f.certificacion.replaceAll("_", " ")}
                valorInicial={f.porcentaje}
                sufijo="%"
                onGuardar={async (valor) => {
                  if (!cliente) throw new Error("Sin cliente Supabase.");
                  await actualizarPagoConductorPorCertificacion(cliente, f.certificacion, valor);
                  await cargar();
                }}
              />
            ))}
          </PassportCard>
        </div>
      )}
    </main>
  );
}

function FilaVehiculo({
  fila,
  cliente,
  onGuardado
}: {
  fila: ConfiguracionTarifas["vehiculo"][number];
  cliente: ReturnType<typeof crearClienteNavegador> | null;
  onGuardado: () => Promise<void>;
}) {
  const [base, setBase] = useState(String(fila.base));
  const [porKm, setPorKm] = useState(String(fila.por_km));
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  function guardar() {
    const baseNum = Number(base);
    const porKmNum = Number(porKm);
    if (!Number.isFinite(baseNum) || !Number.isFinite(porKmNum)) {
      setMensaje("Valores inválidos.");
      return;
    }
    setMensaje(null);
    startTransition(async () => {
      try {
        if (!cliente) throw new Error("Sin cliente Supabase.");
        await actualizarTarifaVehiculo(cliente, fila.id, { base: baseNum, por_km: porKmNum });
        setMensaje("Guardado.");
        await onGuardado();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <tr>
      <td className="border-b border-ink/10 px-3 py-2 font-medium">{ETIQUETA_CATEGORIA[fila.categoria] ?? fila.categoria}</td>
      <td className="border-b border-ink/10 px-3 py-2 text-ink/60">{ETIQUETA_RANGO[fila.rango] ?? fila.rango}</td>
      <td className="border-b border-ink/10 px-3 py-2">
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          inputMode="decimal"
          className="w-24 rounded-lg border border-ink/30 bg-mist px-2 py-1 font-body text-sm text-ink"
        />
      </td>
      <td className="border-b border-ink/10 px-3 py-2">
        <input
          value={porKm}
          onChange={(e) => setPorKm(e.target.value)}
          inputMode="decimal"
          className="w-20 rounded-lg border border-ink/30 bg-mist px-2 py-1 font-body text-sm text-ink"
        />
      </td>
      <td className="border-b border-ink/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="fantasma" onClick={guardar} disabled={pendiente}>Guardar</Button>
          {mensaje && <span className="font-body text-xs text-ink/55">{mensaje}</span>}
        </div>
      </td>
    </tr>
  );
}
