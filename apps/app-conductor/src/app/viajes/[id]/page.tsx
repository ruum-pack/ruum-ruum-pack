import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import { obtenerPasaporteDigital } from "@ruum/api/services";
import { Aviso, EstadoBadge, EstadoStepper, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { resumenClasificacionVehiculo } from "@ruum/shared/catalogos";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { AccionesViaje } from "./AccionesViaje";
import { ChatViaje } from "./ChatViaje";
import { ReportarIncidencia } from "./ReportarIncidencia";
import { Emergencia911 } from "./Emergencia911";
import { AbrirDisputaConductor } from "./AbrirDisputa";
import { RegistroViajeActivo } from "../../ViajeActivoContext";
import { EstadoError } from "../../EstadoError";

function calcularHorasDesdeCierre(actualizadoEn: string) {
  return (Date.now() - new Date(actualizadoEn).getTime()) / (1000 * 60 * 60);
}

async function obtenerDatos(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { pasaporte: null };
  }

  // Bug real encontrado en producción (2026-06-29): un cliente anónimo (sin
  // cookies, sin sesión) sí podía ver viajes disponibles sin asignar
  // (política RLS abierta por estado), pero en cuanto el conductor acepta
  // uno, solo aplica "conductor_ve_sus_traslados_asignados" — que exige
  // auth.uid() real. Sin sesión, esa consulta nunca encontraba la fila, y
  // la pantalla mostraba "No encontramos ese viaje" justo después de
  // aceptar. Se usa el cliente de servidor con cookies (sesión real) en su
  // lugar, mismo patrón que ya usan las acciones de aceptar/evidencia.
  const cliente = await crearClienteServidor();
  const pasaporte = await obtenerPasaporteDigital(cliente, id);
  return { pasaporte };
}

export default async function PaginaDetalleViaje({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pasaporte } = await obtenerDatos(id);

  if (!pasaporte) {
    return (
      <EstadoError
        titulo="No encontramos ese viaje"
        descripcion="Revisa el enlace o vuelve a tu lista de viajes para continuar."
        acciones={[
          { etiqueta: "Ver mis viajes", href: "/viajes", variant: "primario" },
          { etiqueta: "Volver al panel", href: "/", variant: "fantasma" }
        ]}
      />
    );
  }

  const horasDesdeCierre = calcularHorasDesdeCierre(pasaporte.actualizado_en);
  const puedeAbrirDisputa =
    ["servicio_cerrado", "reclamo_resuelto", "cierre_operativo_con_incidencia_abierta"].includes(pasaporte.estado) &&
    horasDesdeCierre <= 72;
  const fotosCompletadas =
    pasaporte.estado === "evidencia_final_en_proceso"
      ? pasaporte.evidencia_final_fotos_sincronizadas
      : pasaporte.evidencia_inicial_fotos_sincronizadas;
  const clasificacionCatalogo = resumenClasificacionVehiculo(
    pasaporte.vehiculo_marca ?? "",
    pasaporte.vehiculo_modelo ?? "",
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <RegistroViajeActivo
        viaje={{
          trasladoId: pasaporte.traslado_id,
          estado: pasaporte.estado
        }}
      />
      <PassportCard folio={pasaporte.traslado_id.slice(0, 8).toUpperCase()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Detalle del viaje</p>
            <h1 className="mt-1 font-display text-xl font-semibold">
              {pasaporte.vehiculo_marca} {pasaporte.vehiculo_modelo} {pasaporte.vehiculo_anio}
              {pasaporte.vehiculo_tipo && (
                <span className="ml-2 font-body text-sm font-normal text-ink/50">
                  · {ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo]}
                </span>
              )}
            </h1>
            {clasificacionCatalogo && (
              <p className="mt-1 font-body text-xs text-ink/45">{clasificacionCatalogo}</p>
            )}
          </div>
          <EstadoBadge estado={pasaporte.estado} />
        </div>

        <div className="mt-8">
          <EstadoStepper estado={pasaporte.estado} />
        </div>

        {pasaporte.tiene_incidencia_abierta && (
          <div className="mt-6">
            <Aviso tono="atencion">Este viaje tiene una incidencia abierta.</Aviso>
          </div>
        )}

        <dl className="mt-8 grid grid-cols-1 gap-4 border-t sm:grid-cols-2 border-ink/10 pt-6 font-body text-sm">
          <div>
            <dt className="text-ink/45">Monto estimado</dt>
            <dd className="mt-0.5 font-mono-ruum">${pasaporte.precio_cotizado?.toLocaleString("es-MX") ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/45">Momento de pago</dt>
            <dd className="mt-0.5 font-medium capitalize">{pasaporte.tipo_pago?.replaceAll("_", " ") ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/45">Evidencia inicial</dt>
            <dd className="mt-0.5 font-mono-ruum">{pasaporte.evidencia_inicial_fotos_sincronizadas} / 5 fotos</dd>
          </div>
          <div>
            <dt className="text-ink/45">Evidencia final</dt>
            <dd className="mt-0.5 font-mono-ruum">{pasaporte.evidencia_final_fotos_sincronizadas} / 5 fotos</dd>
          </div>
        </dl>

        <AccionesViaje
          trasladoId={pasaporte.traslado_id}
          estado={pasaporte.estado}
          fotosCompletadas={fotosCompletadas}
          origenDireccion={pasaporte.origen_direccion}
          origenCiudad={pasaporte.origen_ciudad}
          origenReferencias={pasaporte.origen_referencias}
          origenLat={pasaporte.origen_lat}
          origenLng={pasaporte.origen_lng}
          contactoEntregaNombre={pasaporte.contacto_entrega_nombre}
          contactoEntregaTelefono={pasaporte.contacto_entrega_telefono}
          vehiculoMarca={pasaporte.vehiculo_marca}
          vehiculoModelo={pasaporte.vehiculo_modelo}
          vehiculoAnio={pasaporte.vehiculo_anio}
          vehiculoColor={pasaporte.vehiculo_color}
          vehiculoPlacas={pasaporte.vehiculo_placas}
          vehiculoVin={pasaporte.vehiculo_vin}
        />
        <ReportarIncidencia trasladoId={pasaporte.traslado_id} />
        <AbrirDisputaConductor trasladoId={pasaporte.traslado_id} disponible={puedeAbrirDisputa} />
        <Emergencia911 trasladoId={pasaporte.traslado_id} />
      </PassportCard>

      <ChatViaje trasladoId={pasaporte.traslado_id} estado={pasaporte.estado} />
    </div>
  );
}
