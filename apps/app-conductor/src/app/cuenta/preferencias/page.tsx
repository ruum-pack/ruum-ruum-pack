"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Aviso, Button, Card } from "@ruum/ui";
import { guardarPreferenciasConductor, obtenerConfiguracionConductor } from "@ruum/api/services";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { cargarConductorCuenta, type ConductorCuenta } from "../cuenta-utils";

type Preferencias = Database["public"]["Tables"]["preferencias_conductor"]["Row"];

const PREFS_DEFAULT = {
  notificaciones_push: true,
  modo_no_molestar: false,
  alertas_viaje: true,
  alertas_pago: true,
  alertas_documentos: true,
  alertas_admin: false,
  viajes_locales: true,
  viajes_foraneos: true,
  viajes_nocturnos: false,
  viajes_empresariales: true,
  viajes_personales: true
};

export default function PaginaPreferenciasCuenta() {
  const [conductor, setConductor] = useState<ConductorCuenta | null>(null);
  const [prefs, setPrefs] = useState(PREFS_DEFAULT);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    async function cargar() {
      const actual = await cargarConductorCuenta();
      setConductor(actual);
      if (actual) {
        const cliente = crearClienteNavegador();
        const datos = await obtenerConfiguracionConductor(cliente, actual.id);
        setPrefs({ ...PREFS_DEFAULT, ...((datos.preferencias as Preferencias | null) ?? {}) });
      }
      setCargando(false);
    }
    void cargar();
  }, []);

  const preferenciasActivas = useMemo(
    () => [
      prefs.viajes_locales && "Viajes locales",
      prefs.viajes_foraneos && "Viajes foráneos",
      prefs.viajes_nocturnos && "Nocturnos con autorización",
      prefs.viajes_empresariales && "Empresariales",
      prefs.viajes_personales && "Personales"
    ].filter(Boolean) as string[],
    [prefs]
  );

  function guardar() {
    if (!conductor) return;
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await guardarPreferenciasConductor(cliente, conductor.id, prefs);
        setMensaje("Preferencias guardadas.");
      } catch (error) {
        setMensaje(traducirErrorOperativo(error, "No se pudieron guardar las preferencias."));
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Preferencias" descripcion="Configura notificaciones y tipos de viaje que quieres recibir." />
      {mensaje && <div className="mt-5"><Aviso tono="info">{mensaje}</Aviso></div>}
      {cargando ? <p className="mt-6 font-body text-sm text-text-secondary">Cargando preferencias...</p> : (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Notificaciones</p>
            <div className="mt-5 grid gap-3">
              {[
                ["Push", "notificaciones_push"],
                ["Modo no molestar 22:00 - 07:00", "modo_no_molestar"],
                ["Alertas de nuevos viajes", "alertas_viaje"],
                ["Pagos", "alertas_pago"],
                ["Documentos", "alertas_documentos"],
                ["Administrativas", "alertas_admin"]
              ].map(([label, clave]) => (
                <label key={clave} className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                  <span className="font-body text-sm font-medium">{label}</span>
                  <input type="checkbox" checked={Boolean(prefs[clave as keyof typeof prefs])} onChange={(event) => setPrefs({ ...prefs, [clave]: event.target.checked })} className="h-5 w-5 accent-signal" />
                </label>
              ))}
            </div>
          </Card>
          <Card>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipos de viaje</p>
            <div className="mt-5 grid gap-3">
              {[
                ["Viajes locales", "viajes_locales"],
                ["Viajes foráneos", "viajes_foraneos"],
                ["Nocturnos", "viajes_nocturnos"],
                ["Empresariales", "viajes_empresariales"],
                ["Personales", "viajes_personales"]
              ].map(([label, clave]) => (
                <label key={clave} className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                  <span className="font-body text-sm font-medium">{label}</span>
                  <input type="checkbox" checked={Boolean(prefs[clave as keyof typeof prefs])} onChange={(event) => setPrefs({ ...prefs, [clave]: event.target.checked })} className="h-5 w-5 accent-signal" />
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {preferenciasActivas.map((preferencia) => <span key={preferencia} className="rounded-full border border-border bg-surface-elevated px-3 py-1.5 font-body text-xs font-medium text-text-secondary">{preferencia}</span>)}
            </div>
          </Card>
          <div className="lg:col-span-2">
            <Button variant="secondary" onClick={guardar} disabled={!conductor || pendiente}>{pendiente ? "Guardando..." : "Guardar preferencias"}</Button>
          </div>
        </section>
      )}
    </div>
  );
}
