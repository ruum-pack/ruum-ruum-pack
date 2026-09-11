"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@ruum/ui";
import {
  crearCargaMasivaOperacion,
  listarCargasDeOperacion,
  obtenerProgresoCarga,
  obtenerResumenOperacionMasiva,
  previsualizarCargaOperacion,
  procesarCargaTrasladosMasivosAdmin,
  type PreviewCargaMasiva,
  type ProgresoCarga,
  type ResumenOperacionMasiva
} from "@ruum/api/transfers";
import {
  getOperation,
  listarSucursales,
  removeTransferFromOperation
} from "@ruum/api/services";
import { listarUsuariosAdmin } from "@ruum/api/identity";
import type { Database, Operacion, SucursalEmpresa } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { AdminPageHeader } from "../../../admin-ui";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "../../../admin-components";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

function parsearCsvSimple(contenido: string): Array<Record<string, string>> {
  const lineas = contenido.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return [];
  const Cabeza = (lineas[0] ?? "").split(",").map((h) => h.trim());
  return lineas.slice(1).map((linea) => {
    const celdas = linea.split(",");
    const fila: Record<string, string> = {};
    Cabeza.forEach((h, i) => {
      fila[h] = (celdas[i] ?? "").trim();
    });
    return fila;
  });
}

async function sha256Hex(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PaginaOperacionMasiva() {
  const { id } = useParams<{ id: string }>();
  const [operacion, setOperacion] = useState<Operacion | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [sucursales, setSucursales] = useState<SucursalEmpresa[]>([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [sucursalOrigenDefecto, setSucursalOrigenDefecto] = useState("");
  const [sucursalDestinoDefecto, setSucursalDestinoDefecto] = useState("");
  const [archivoNombre, setArchivoNombre] = useState("");
  const [archivoTexto, setArchivoTexto] = useState("");
  const [preview, setPreview] = useState<PreviewCargaMasiva | null>(null);
  const [progreso, setProgreso] = useState<ProgresoCarga | null>(null);
  const [resumen, setResumen] = useState<ResumenOperacionMasiva | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const cargarContexto = useCallback(async () => {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const op = await getOperation(cliente, id);
      if (!op) throw new Error("Operación no encontrada.");
      setOperacion(op);
      const [todos, sucs, res] = await Promise.all([
        listarUsuariosAdmin(cliente),
        op.empresa_id ? listarSucursales(cliente, op.empresa_id) : Promise.resolve([]),
        obtenerResumenOperacionMasiva(cliente, id)
      ]);
      setUsuarios(todos.filter((u) => !op.empresa_id || u.empresa_id === op.empresa_id));
      setSucursales(sucs);
      setResumen(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la operación.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void cargarContexto(), 0);
    return () => clearTimeout(timer);
  }, [cargarContexto]);

  async function leerArchivo(archivo: File) {
    setArchivoNombre(archivo.name);
    setArchivoTexto(await archivo.text());
    setPreview(null);
    setProgreso(null);
    setMensaje(null);
  }

  function filasConCentros(): Array<Record<string, string>> {
    return parsearCsvSimple(archivoTexto).map((fila) => ({
      ...fila,
      ...(fila["sucursal_origen_id"] || sucursalOrigenDefecto
        ? { sucursal_origen_id: fila["sucursal_origen_id"] || sucursalOrigenDefecto }
        : {}),
      ...(fila["sucursal_destino_id"] || sucursalDestinoDefecto
        ? { sucursal_destino_id: fila["sucursal_destino_id"] || sucursalDestinoDefecto }
        : {})
    }));
  }

  function previsualizar() {
    if (!operacion?.empresa_id || !usuarioId || !archivoTexto) return;
    setError(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        setPreview(
          await previsualizarCargaOperacion(cliente, {
            empresaId: operacion.empresa_id as string,
            usuarioId,
            filas: filasConCentros()
          })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo previsualizar.");
      }
    });
  }

  function confirmarYProcesar() {
    if (!operacion?.empresa_id || !usuarioId || !archivoTexto || !preview) return;
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        const filas = filasConCentros();
        const creada = await crearCargaMasivaOperacion(cliente, {
          operacionId: id,
          empresaId: operacion.empresa_id as string,
          usuarioId,
          nombreArchivo: archivoNombre || "carga-operacion.csv",
          filas,
          hashArchivo: await sha256Hex(archivoTexto),
          tamanoBytes: new Blob([archivoTexto]).size,
          mimeType: "text/csv"
        });
        setMensaje(
          `Carga ${creada.reutilizada ? "reutilizada" : "creada"}: ${creada.filas_creadas ?? creada.total_filas} filas listas. Procesando…`
        );
        let estado = "";
        let rondas = 0;
        while (estado !== "procesada" && estado !== "procesada_con_errores" && estado !== "rechazada" && rondas < 20) {
          const proc = await procesarCargaTrasladosMasivosAdmin(cliente, creada.carga_id, 100);
          estado = proc.estado;
          rondas += 1;
          setProgreso(await obtenerProgresoCarga(cliente, creada.carga_id));
          if ((proc.procesadas_en_esta_corrida ?? 1) === 0) break;
        }
        setResumen(await obtenerResumenOperacionMasiva(cliente, id));
        setMensaje("Carga procesada. Revisa el resumen.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo procesar la carga.");
      }
    });
  }

  function retirarTraslado(trasladoId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await removeTransferFromOperation(cliente, trasladoId);
        setMensaje("Vehículo retirado de la operación (el traslado se conserva).");
        setResumen(await obtenerResumenOperacionMasiva(cliente, id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo retirar.");
      }
    });
  }

  if (cargando) return <AdminLoadingState label="Cargando operación masiva…" />;
  if (error && !operacion) {
    return <AdminErrorState description={error} action={<Button onClick={() => void cargarContexto()}>Reintentar</Button>} />;
  }
  if (!operacion) return <AdminEmptyState title="Sin operación" description="La operación no existe." />;

  const puedeCargar = ["borrador", "planificada", "en_curso", "pausada"].includes(operacion.estado);

  return (
    <div>
      <AdminPageHeader
        titulo={`Carga masiva — ${operacion.folio}`}
        descripcion={`${operacion.nombre} · Estado ${operacion.estado} · Flujo: validar → previsualizar → procesar → resumir.`}
        accion={<Link href={`/operaciones/${id}`}>Volver a la operación</Link>}
      />

      {mensaje ? <p role="status">{mensaje}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {resumen ? (
        <section aria-label="Resumen de la operación">
          <h2>Resumen ({resumen.cargas} cargas · {resumen.traslados} traslados · {resumen.vehiculos} vehículos)</h2>
          <p>
            Filas: {resumen.filas_totales} totales · {resumen.filas_creadas} creadas · {resumen.filas_error} con error.
          </p>
          <ul>
            {Object.entries(resumen.traslados_por_estado).map(([estado, n]) => (
              <li key={estado}>{estado}: {n}</li>
            ))}
          </ul>
          {resumen.traslados_recientes.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Traslado</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {resumen.traslados_recientes.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/viajes/${t.id}`}>{t.id.slice(0, 8)}…</Link></td>
                    <td>{t.estado}</td>
                    <td>
                      <Button onClick={() => retirarTraslado(t.id)} disabled={pendiente}>
                        Retirar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {!puedeCargar ? (
        <AdminEmptyState title="Operación cerrada" description="Esta operación ya no admite más cargas. Crea una nueva para seguir agregando vehículos." />
      ) : (
        <>
          <section aria-label="Configurar carga">
            <h2>1. Configurar</h2>
            <label>
              Solicitante (usuario de la empresa)
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                <option value="">Seleccionar…</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre ?? u.id.slice(0, 8)}</option>
                ))}
              </select>
            </label>
            <label>
              Centro origen por defecto
              <select value={sucursalOrigenDefecto} onChange={(e) => setSucursalOrigenDefecto(e.target.value)}>
                <option value="">Ninguno</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Centro destino por defecto
              <select value={sucursalDestinoDefecto} onChange={(e) => setSucursalDestinoDefecto(e.target.value)}>
                <option value="">Ninguno</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Archivo CSV (plantilla v2)
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) void leerArchivo(archivo);
                }}
              />
            </label>
            <p>
              <Link href="/api/plantillas/traslados-masivos">Descargar plantilla v2</Link>
              {" "}(incluye sucursal_origen_id y sucursal_destino_id opcionales).
            </p>
            <Button onClick={previsualizar} disabled={pendiente || !usuarioId || !archivoTexto}>
              {pendiente ? "Validando…" : "2. Previsualizar"}
            </Button>
          </section>

          {preview ? (
            <section aria-label="Previsualización">
              <h2>
                Preview: {preview.validas}/{preview.total_filas} válidas · {preview.con_error} con error ·{" "}
                {preview.duplicadas} duplicadas
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Referencia</th>
                    <th>Estado</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.filas.map((fila) => (
                    <tr key={fila.numero}>
                      <td>{fila.numero}</td>
                      <td>{fila.referencia_externa ?? "—"}</td>
                      <td>{fila.valida ? "válida" : "error"}</td>
                      <td>{[...fila.errores, ...fila.advertencias].join(" | ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button onClick={confirmarYProcesar} disabled={pendiente || preview.validas === 0}>
                {pendiente ? "Procesando…" : "3. Confirmar y procesar"}
              </Button>
            </section>
          ) : null}

          {progreso ? (
            <section aria-label="Progreso">
              <h2>Progreso: {progreso.avance_pct}% ({progreso.estado})</h2>
              <progress value={progreso.avance_pct} max={100} aria-label="Avance de la carga" />
              <p>
                {progreso.creadas} creadas · {progreso.con_error} con error · {progreso.pendientes} pendientes de{" "}
                {progreso.total_filas} totales.
              </p>
              {progreso.filas_con_error.length > 0 ? (
                <ul>
                  {progreso.filas_con_error.map((fila) => (
                    <li key={fila.numero_fila}>
                      Fila {fila.numero_fila} ({fila.referencia_externa ?? "sin referencia"}): {fila.errores.join(" | ")}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
