"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@ruum/ui";
import {
  calcularEta,
  listarUbicacionesRecientes,
  obtenerDestinoTraslado,
  obtenerSaludTracking,
  type EstimacionLlegada,
  type PuntoTracking,
  type SaludTracking
} from "@ruum/api/tracking";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { AdminPageHeader } from "../../../admin-ui";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "../../../admin-components";

function fechaCorta(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-MX");
}

export default function PaginaTrackingTraslado() {
  const { id } = useParams<{ id: string }>();
  const [salud, setSalud] = useState<SaludTracking | null>(null);
  const [puntos, setPuntos] = useState<PuntoTracking[]>([]);
  const [eta, setEta] = useState<EstimacionLlegada | null>(null);
  const [destinoCiudad, setDestinoCiudad] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [s, lista, destino] = await Promise.all([
        obtenerSaludTracking(cliente, id),
        listarUbicacionesRecientes(cliente, id, 20),
        obtenerDestinoTraslado(cliente, id)
      ]);
      setSalud(s);
      setPuntos(lista);
      setDestinoCiudad(destino?.ciudad ?? null);
      const ultimo = lista[0] ?? null;
      setEta(
        calcularEta(
          ultimo ? { lat: ultimo.lat, lng: ultimo.lng } : null,
          destino ? { lat: destino.lat, lng: destino.lng } : null,
          lista
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el tracking.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  if (cargando) return <AdminLoadingState label="Cargando tracking…" />;
  if (error && !salud) {
    return <AdminErrorState description={error} action={<Button onClick={() => void cargar()}>Reintentar</Button>} />;
  }
  if (!salud) return <AdminEmptyState title="Sin señal" description="No hay sesión de tracking para este traslado." />;

  return (
    <div>
      <AdminPageHeader
        titulo="Tracking GPS"
        descripcion={`Traslado ${id.slice(0, 8)}… · Salud ${salud.estado}${
          salud.detenido ? " · Vehículo detenido" : ""
        }`}
        accion={<Link href={`/viajes/${id}`}>Volver al traslado</Link>}
      />

      {error ? <p role="alert">{error}</p> : null}

      <section aria-label="Salud de señal">
        <h2>Salud: {salud.estado}</h2>
        <p>{salud.motivo}</p>
        <p>
          {salud.detenido ? (
            <strong>● Vehículo detenido (hay señal, no hay movimiento).</strong>
          ) : salud.estado === "HEALTHY" ? (
            "○ En movimiento con señal."
          ) : (
            <strong>○ Conductor sin señal: no se sabe si está detenido o en movimiento.</strong>
          )}
        </p>
        <dl>
          <dt>Último envío</dt>
          <dd>{fechaCorta(salud.ultimo_envio_en)}</dd>
        </dl>
      </section>

      <section aria-label="Llegada estimada">
        <h2>Llegada estimada{destinoCiudad ? ` — ${destinoCiudad}` : ""}</h2>
        {eta && eta.eta_min != null ? (
          <p>
            {eta.distancia_km} km restantes · {eta.velocidad_kmh} km/h ({eta.base === "gps" ? "GPS" : "estimado"}) ·
            ETA {eta.eta_min} min · {fechaCorta(eta.llegada_estimada_en)}
          </p>
        ) : (
          <p>Sin datos suficientes para estimar (falta destino o puntos).</p>
        )}
      </section>

      <section aria-label="Puntos recientes">
        <h2>Puntos recientes ({puntos.length})</h2>
        {puntos.length === 0 ? (
          <p>Sin puntos registrados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Lat/Lng</th>
                <th>Vel.</th>
                <th>Batería</th>
                <th>Precisión</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((p, indice) => (
                <tr key={`${p.registrado_en}-${indice}`}>
                  <td>{fechaCorta(p.registrado_en)}</td>
                  <td>
                    {p.lat}, {p.lng}
                  </td>
                  <td>{p.velocidad_mps != null ? `${Math.round(p.velocidad_mps * 3.6)} km/h` : "—"}</td>
                  <td>{p.bateria_pct != null ? `${p.bateria_pct}%` : "—"}</td>
                  <td>{p.precision_m != null ? `±${p.precision_m} m` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p>
        <Link href={`/viajes/${id}/custodia`}>Ver cadena de custodia</Link>
      </p>
    </div>
  );
}
