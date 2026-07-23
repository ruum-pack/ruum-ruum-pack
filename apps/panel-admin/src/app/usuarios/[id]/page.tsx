"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import {
  obtenerUsuarioAdmin, actualizarUsuarioAdmin,
  suspenderUsuarioAdmin, reactivarUsuarioAdmin, cerrarCuentaUsuarioAdmin,
  listarSesionesUsuario, revocarSesionUsuario,
  listarPagosDeUsuario, listarIncidenciasDeUsuario, listarEmpresasDeUsuario,
  obtenerAuditoriaUsuario
} from "@ruum/api/services";
import { listarTrasladosDeUsuario } from "@ruum/api/services";
import { AccionesVerificacion } from "../AccionesVerificacion";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type PagosRow = Database["public"]["Tables"]["pagos"]["Row"];
type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type EmpresaRow = Database["public"]["Tables"]["empresas"]["Row"];

type Tab = "datos" | "viajes" | "pagos" | "incidencias" | "sesiones" | "privacidad" | "auditoria";

const ETIQUETA_VERIFICACION: Record<string, string> = {
  pendiente: "Pendiente", en_revision: "En revision", verificado: "Verificado", rechazado: "Rechazado"
};
const ETIQUETA_ESTADO_CUENTA: Record<string, string> = {
  activa: "Activa", suspendida: "Suspendida", cerrada: "Cerrada"
};
const TAB_ETIQUETAS: Record<Tab, string> = {
  datos: "Datos", viajes: "Viajes", pagos: "Pagos",
  incidencias: "Incidencias", sesiones: "Sesiones", privacidad: "Privacidad", auditoria: "Auditoria"
};

export default function PaginaDetalleUsuario() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("datos");
  const [usuario, setUsuario] = useState<UsuarioRow | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!tieneSupabaseConfigurado()) { setCargando(false); return; }
    try {
      const cliente = crearClienteNavegador();
      setUsuario(await obtenerUsuarioAdmin(cliente, id));
    } catch { setUsuario(null); }
    finally { setCargando(false); }
  }, [id]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) return <main className="mx-auto max-w-5xl px-6 py-8"><p className="font-body text-text-tertiary">Cargando...</p></main>;
  if (!usuario) return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Aviso tono="danger">No se encontro el usuario.</Aviso>
      <Link href="/usuarios" className="mt-4 inline-block font-body text-sm text-focus-default hover:underline">Volver a usuarios</Link>
    </main>
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center gap-3">
        <Link href="/usuarios" className="font-body text-sm text-text-tertiary hover:text-ink">&larr; Usuarios</Link>
      </div>

      {aviso && <div className="mt-4"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}

      <div className="mt-6">
        <h1 className="font-display text-2xl font-semibold">{usuario.nombre ?? "Sin nombre"}</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">{usuario.correo_facturacion ?? "Sin correo registrado"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-ink/10 px-3 py-1 font-body text-xs capitalize">{usuario.tipo_cuenta}</span>
          <span className="rounded-full bg-ink/10 px-3 py-1 font-body text-xs capitalize">{usuario.rol.replaceAll("_", " ")}</span>
          <span className={`rounded-full px-3 py-1 font-body text-xs ${
            usuario.estado_verificacion === "verificado" ? "bg-status-success/20 text-status-success" :
            usuario.estado_verificacion === "rechazado" ? "bg-status-error/20 text-status-error" :
            "bg-status-warning/20 text-status-warning"
          }`}>{ETIQUETA_VERIFICACION[usuario.estado_verificacion]}</span>
          <span className={`rounded-full px-3 py-1 font-body text-xs ${
            usuario.estado_cuenta === "suspendida" ? "bg-status-error/20 text-status-error" :
            usuario.estado_cuenta === "cerrada" ? "bg-ink/20 text-text-tertiary" :
            "bg-status-success/20 text-status-success"
          }`}>{ETIQUETA_ESTADO_CUENTA[usuario.estado_cuenta ?? "activa"]}</span>
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-ink/10">
        {(Object.keys(TAB_ETIQUETAS) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 font-body text-sm font-medium transition-colors ${
              tab === t ? "border-b-2 border-ink text-ink" : "text-text-tertiary hover:text-ink"
            }`}
          >{TAB_ETIQUETAS[t]}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "datos" && <TabDatos usuario={usuario} onActualizado={(u) => setUsuario(u)} onAviso={setAviso} />}
        {tab === "viajes" && <TabViajes usuarioId={usuario.id} />}
        {tab === "pagos" && <TabPagos usuarioId={usuario.id} />}
        {tab === "incidencias" && <TabIncidencias usuarioId={usuario.id} />}
        {tab === "sesiones" && <TabSesiones usuarioId={usuario.id} />}
        {tab === "privacidad" && <TabPrivacidad usuario={usuario} onActualizado={() => void cargar()} />}
        {tab === "auditoria" && <TabAuditoria usuarioId={usuario.id} />}
      </div>
    </main>
  );
}

function TabDatos({ usuario, onActualizado, onAviso }: { usuario: UsuarioRow; onActualizado: (u: UsuarioRow) => void; onAviso: (a: { tono: "info" | "danger"; texto: string }) => void }) {
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <Seccion titulo="Datos personales">
          <Dato etiqueta="Nombre" valor={usuario.nombre} />
          <Dato etiqueta="Telefono" valor={usuario.telefono} />
          <Dato etiqueta="Correo de facturacion" valor={usuario.correo_facturacion} />
          <Dato etiqueta="Tipo de cuenta" valor={usuario.tipo_cuenta} />
          <Dato etiqueta="Rol" valor={usuario.rol.replaceAll("_", " ")} />
          <Dato etiqueta="RFC" valor={usuario.rfc} />
          <Dato etiqueta="Razon social" valor={usuario.razon_social} />
        </Seccion>
        <Seccion titulo="Direccion">
          <Dato etiqueta="Calle" valor={usuario.calle} />
          <Dato etiqueta="Numero" valor={usuario.numero} />
          <Dato etiqueta="Colonia" valor={usuario.colonia} />
          <Dato etiqueta="Ciudad" valor={usuario.ciudad} />
          <Dato etiqueta="Estado" valor={usuario.estado} />
          <Dato etiqueta="Pais" valor={usuario.pais} />
          <Dato etiqueta="Codigo postal" valor={usuario.codigo_postal} />
        </Seccion>
        <Seccion titulo="Estados">
          <Dato etiqueta="Verificacion" valor={ETIQUETA_VERIFICACION[usuario.estado_verificacion]} />
          <Dato etiqueta="Estado de cuenta" valor={ETIQUETA_ESTADO_CUENTA[usuario.estado_cuenta ?? "activa"]} />
          <Dato etiqueta="Metodo de pago" valor={usuario.metodo_pago_registrado ? "Registrado" : "Sin registrar"} />
          <Dato etiqueta="Traslados sin incidencia" valor={String(usuario.traslados_completados_sin_incidencia)} />
        </Seccion>
        <Seccion titulo="Fechas">
          <Dato etiqueta="Registrado" valor={new Date(usuario.creado_en).toLocaleString("es-MX")} />
          <Dato etiqueta="Actualizado" valor={usuario.actualizado_en ? new Date(usuario.actualizado_en).toLocaleString("es-MX") : "-"} />
          <Dato etiqueta="Terminos aceptados" valor={usuario.terminos_aceptados_en ? new Date(usuario.terminos_aceptados_en).toLocaleString("es-MX") : "No aceptados"} />
        </Seccion>
      </div>

      <div className="mt-10">
        <EditarUsuario usuario={usuario} onActualizado={(u) => { onActualizado(u); onAviso({ tono: "info", texto: "Usuario actualizado." }); }} />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold">Verificacion y documentos</h2>
        <div className="mt-3 rounded-card border border-ink/10 bg-surface-primary p-4">
          <AccionesVerificacion usuario={usuario} onActualizado={() => window.location.reload()} />
        </div>
      </div>

      <div className="mt-10 border-t border-ink/10 pt-8">
        <h2 className="font-display text-lg font-semibold text-status-error">Zona de riesgo</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">Estas acciones afectan la cuenta del usuario de forma permanente o temporal.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {(usuario.estado_cuenta ?? "activa") !== "suspendida" && (
            <SuspenderCuenta usuarioId={usuario.id} onCompletado={() => { window.location.reload(); }} />
          )}
          {(usuario.estado_cuenta ?? "activa") !== "activa" && (
            <ReactivarCuenta usuarioId={usuario.id} onCompletado={() => { window.location.reload(); }} />
          )}
          {(usuario.estado_cuenta ?? "activa") !== "cerrada" && (
            <CerrarCuenta usuarioId={usuario.id} onCompletado={() => { window.location.reload(); }} />
          )}
        </div>
      </div>
    </>
  );
}

function TabViajes({ usuarioId }: { usuarioId: string }) {
  const [viajes, setViajes] = useState<Array<{ traslado_id: string; estado: string; origen: string | null; destino: string | null; creado_en: string }> | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const cliente = crearClienteNavegador();
    listarTrasladosDeUsuario(cliente, usuarioId).then((d) => setViajes(d as never)).catch(() => setViajes([])).finally(() => setCargando(false));
  }, [usuarioId]);

  if (cargando) return <p className="font-body text-text-tertiary">Cargando viajes...</p>;
  if (!viajes?.length) return <p className="font-body text-text-tertiary">Sin viajes registrados.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Folio</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3">Origen</th>
          <th className="px-4 py-3">Destino</th>
          <th className="px-4 py-3">Fecha</th>
        </tr></thead>
        <tbody>
          {viajes.map((v) => (
            <tr key={v.traslado_id} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 font-mono-ruum">
                <Link href={`/viajes/${v.traslado_id}`} className="hover:text-focus-default hover:underline">{v.traslado_id?.slice(0, 8)}</Link>
              </td>
              <td className="px-4 py-3 capitalize">{v.estado?.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 text-text-secondary">{v.origen ?? "-"}</td>
              <td className="px-4 py-3 text-text-secondary">{v.destino ?? "-"}</td>
              <td className="px-4 py-3 text-text-secondary">{new Date(v.creado_en).toLocaleDateString("es-MX")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabPagos({ usuarioId }: { usuarioId: string }) {
  const [pagos, setPagos] = useState<PagosRow[] | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const cliente = crearClienteNavegador();
    listarPagosDeUsuario(cliente, usuarioId).then(setPagos).catch(() => setPagos([])).finally(() => setCargando(false));
  }, [usuarioId]);

  if (cargando) return <p className="font-body text-text-tertiary">Cargando pagos...</p>;
  if (!pagos?.length) return <p className="font-body text-text-tertiary">Sin pagos registrados.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Monto</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3">Metodo</th>
          <th className="px-4 py-3">Fecha</th>
        </tr></thead>
        <tbody>
          {pagos.map((p) => (
            <tr key={p.id} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 font-mono-ruum">${(p.monto ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3 capitalize">{p.estado?.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 text-text-secondary">{p.metodo ?? "-"}</td>
              <td className="px-4 py-3 text-text-secondary">{new Date(p.registrado_en).toLocaleDateString("es-MX")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabIncidencias({ usuarioId }: { usuarioId: string }) {
  const [incidencias, setIncidencias] = useState<IncidenciaRow[] | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const cliente = crearClienteNavegador();
    listarIncidenciasDeUsuario(cliente, usuarioId).then(setIncidencias).catch(() => setIncidencias([])).finally(() => setCargando(false));
  }, [usuarioId]);

  if (cargando) return <p className="font-body text-text-tertiary">Cargando incidencias...</p>;
  if (!incidencias?.length) return <p className="font-body text-text-tertiary">Sin incidencias registradas.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Tipo</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3">Fecha</th>
        </tr></thead>
        <tbody>
          {incidencias.map((inc) => (
            <tr key={inc.id} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 capitalize">{inc.tipo?.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 capitalize">{inc.resuelta ? "Resuelta" : "Abierta"}</td>
              <td className="px-4 py-3 text-text-secondary">{new Date(inc.creada_en).toLocaleDateString("es-MX")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabSesiones({ usuarioId }: { usuarioId: string }) {
  const [sesiones, setSesiones] = useState<Array<{ id: string; creada_en: string; ultimo_acceso: string | null; agente_usuario: string | null; direccion_ip: string | null; activa: boolean }> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [revocando, setRevocando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const cliente = crearClienteNavegador();
    listarSesionesUsuario(cliente, usuarioId).then(setSesiones).catch(() => setSesiones([])).finally(() => setCargando(false));
  }, [usuarioId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function revocar(sesionId: string) {
    setRevocando(sesionId);
    try {
      const cliente = crearClienteNavegador();
      await revocarSesionUsuario(cliente, sesionId);
      void cargar();
    } catch { /* ignore */ }
    finally { setRevocando(null); }
  }

  if (cargando) return <p className="font-body text-text-tertiary">Cargando sesiones...</p>;
  if (!sesiones?.length) return <p className="font-body text-text-tertiary">Sin sesiones activas.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Dispositivo</th>
          <th className="px-4 py-3">IP</th>
          <th className="px-4 py-3">Ultimo acceso</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3">Accion</th>
        </tr></thead>
        <tbody>
          {sesiones.map((s) => (
            <tr key={s.id} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 font-body text-sm">{s.agente_usuario?.slice(0, 60) ?? "-"}</td>
              <td className="px-4 py-3 font-mono-ruum text-xs">{s.direccion_ip ?? "-"}</td>
              <td className="px-4 py-3 text-text-secondary">{s.ultimo_acceso ? new Date(s.ultimo_acceso).toLocaleString("es-MX") : "-"}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs ${s.activa ? "bg-status-success/20 text-status-success" : "bg-ink/10 text-text-tertiary"}`}>
                  {s.activa ? "Activa" : "Revocada"}
                </span>
              </td>
              <td className="px-4 py-3">
                {s.activa && (
                  <button onClick={() => revocar(s.id)} disabled={revocando === s.id}
                    className="rounded-md border border-status-error/40 px-3 py-1 font-body text-xs text-status-error hover:bg-status-error/10 disabled:opacity-50"
                  >{revocando === s.id ? "Revocando..." : "Revocar"}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabPrivacidad({ usuario, onActualizado }: { usuario: UsuarioRow; onActualizado: () => void }) {
  const [anonimizando, setAnonimizando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function anonimizarDatos() {
    if (!confirm("¿Esta seguro de anonimizar los datos personales de este usuario? Esta accion no se puede deshacer.")) return;
    setAnonimizando(true);
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      await actualizarUsuarioAdmin(cliente, usuario.id, {
        nombre: "[anonimizado]",
        telefono: null,
        correo_facturacion: null,
        calle: null, numero: null, colonia: null, ciudad: null, estado: null, pais: null, codigo_postal: null,
        direccion_principal: null, foto_url: null
      });
      setAviso("Datos anonimizados correctamente.");
      onActualizado();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Error al anonimizar.");
    } finally { setAnonimizando(false); }
  }

  async function exportarDatos() {
    setExportando(true);
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      const [viajes, pagos] = await Promise.all([
        listarTrasladosDeUsuario(cliente, usuario.id),
        listarPagosDeUsuario(cliente, usuario.id)
      ]);
      const blob = new Blob([JSON.stringify({ usuario, viajes, pagos }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `datos-usuario-${usuario.id}.json`; a.click();
      URL.revokeObjectURL(url);
      setAviso("Exportacion completada.");
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Error al exportar.");
    } finally { setExportando(false); }
  }

  return (
    <div className="space-y-6">
      {aviso && <Aviso tono="info">{aviso}</Aviso>}

      <div className="rounded-card border border-ink/10 bg-surface-primary p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-text-tertiary">Exportar datos</h3>
        <p className="mt-1 font-body text-sm text-text-secondary">Descarga un archivo JSON con los datos del usuario, viajes y pagos.</p>
        <button onClick={exportarDatos} disabled={exportando}
          className="mt-3 rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5 disabled:opacity-50"
        >{exportando ? "Exportando..." : "Exportar datos"}</button>
      </div>

      <div className="rounded-card border border-status-warning/30 bg-status-warning-soft/10 p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-status-warning">Anonimizar datos personales</h3>
        <p className="mt-1 font-body text-sm text-text-secondary">Reemplaza los datos personales del usuario con valores anonimizados. Los viajes e historial se conservan para referencia operativa.</p>
        <button onClick={anonimizarDatos} disabled={anonimizando}
          className="mt-3 rounded-lg border border-status-warning/40 px-4 py-2 font-body text-sm font-medium text-status-warning hover:bg-status-warning/10 disabled:opacity-50"
        >{anonimizando ? "Anonimizando..." : "Anonimizar datos"}</button>
      </div>

      <div className="rounded-card border border-ink/10 bg-surface-primary p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-text-tertiary">Minimizacion de datos</h3>
        <p className="mt-1 font-body text-sm text-text-secondary">El sistema solo conserva los datos estrictamente necesarios para la operacion. Los documentos de identidad antiguos se eliminan automaticamente tras 90 dias.</p>
        <ul className="mt-3 list-inside list-disc font-body text-sm text-text-secondary">
          <li>Datos personales basicos (nombre, telefono, correo)</li>
          <li>Direccion fiscal para facturacion</li>
          <li>Historial de viajes (conservado por obligacion fiscal)</li>
          <li>Documento de identidad (eliminado tras 90 dias de la verificacion)</li>
        </ul>
      </div>
    </div>
  );
}

function TabAuditoria({ usuarioId }: { usuarioId: string }) {
  const [eventos, setEventos] = useState<Array<{ evento: string; creado_en: string; datos: Record<string, unknown> | null }> | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const cliente = crearClienteNavegador();
    obtenerAuditoriaUsuario(cliente, usuarioId).then(setEventos).catch(() => setEventos([])).finally(() => setCargando(false));
  }, [usuarioId]);

  if (cargando) return <p className="font-body text-text-tertiary">Cargando auditoria...</p>;
  if (!eventos?.length) return <p className="font-body text-text-tertiary">Sin eventos de auditoria.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Evento</th>
          <th className="px-4 py-3">Fecha</th>
          <th className="px-4 py-3">Detalle</th>
        </tr></thead>
        <tbody>
          {eventos.map((e, i) => (
            <tr key={i} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 font-medium capitalize">{e.evento.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 text-text-secondary">{new Date(e.creado_en).toLocaleString("es-MX")}</td>
              <td className="px-4 py-3 font-mono-ruum text-xs text-text-tertiary">{e.datos ? JSON.stringify(e.datos).slice(0, 120) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-ink/10 bg-surface-primary p-4">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-text-tertiary">{titulo}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2 font-body text-sm">
      <span className="text-text-secondary">{etiqueta}</span>
      <span className="text-right font-medium text-ink">{valor ?? <span className="text-text-tertiary">-</span>}</span>
    </div>
  );
}

function EditarUsuario({ usuario, onActualizado }: { usuario: UsuarioRow; onActualizado: (u: UsuarioRow) => void }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(usuario.nombre ?? "");
  const [telefono, setTelefono] = useState(usuario.telefono ?? "");
  const [correoFacturacion, setCorreoFacturacion] = useState(usuario.correo_facturacion ?? "");
  const [calle, setCalle] = useState(usuario.calle ?? "");
  const [numero, setNumero] = useState(usuario.numero ?? "");
  const [colonia, setColonia] = useState(usuario.colonia ?? "");
  const [ciudad, setCiudad] = useState(usuario.ciudad ?? "");
  const [estado, setEstado] = useState(usuario.estado ?? "");
  const [pais, setPais] = useState(usuario.pais ?? "");
  const [codigoPostal, setCodigoPostal] = useState(usuario.codigo_postal ?? "");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editando) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold">Editar datos</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">Modifica la informacion del usuario.</p>
        <button onClick={() => setEditando(true)} className="mt-3 rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Editar</button>
      </div>
    );
  }

  async function guardar() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const actualizado = await actualizarUsuarioAdmin(cliente, usuario.id, {
        nombre: nombre.trim() || null,
        telefono: telefono.trim() || null,
        correo_facturacion: correoFacturacion.trim() || null,
        calle: calle.trim() || null,
        numero: numero.trim() || null,
        colonia: colonia.trim() || null,
        ciudad: ciudad.trim() || null,
        estado: estado.trim() || null,
        pais: pais.trim() || null,
        codigo_postal: codigoPostal.trim() || null
      });
      onActualizado(actualizado);
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Editar datos</h2>
      {error && <div className="mt-2"><Aviso tono="danger">{error}</Aviso></div>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" value={nombre} onChange={setNombre} />
        <Campo label="Telefono" value={telefono} onChange={setTelefono} />
        <Campo label="Correo de facturacion" value={correoFacturacion} onChange={setCorreoFacturacion} />
        <Campo label="Calle" value={calle} onChange={setCalle} />
        <Campo label="Numero" value={numero} onChange={setNumero} />
        <Campo label="Colonia" value={colonia} onChange={setColonia} />
        <Campo label="Ciudad" value={ciudad} onChange={setCiudad} />
        <Campo label="Estado" value={estado} onChange={setEstado} />
        <Campo label="Pais" value={pais} onChange={setPais} />
        <Campo label="Codigo postal" value={codigoPostal} onChange={setCodigoPostal} />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={guardar} disabled={procesando} className="rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-surface-primary hover:bg-ink/90 disabled:opacity-50">
          {procesando ? "Guardando..." : "Guardar cambios"}
        </button>
        <button onClick={() => setEditando(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Cancelar</button>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-xs font-medium text-text-secondary">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
    </label>
  );
}

function SuspenderCuenta({ usuarioId, onCompletado }: { usuarioId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!abierto) return <button onClick={() => setAbierto(true)} className="rounded-lg border border-status-error/40 bg-status-error/10 px-4 py-2 font-body text-sm font-medium text-status-error hover:bg-status-error/20">Suspender cuenta</button>;
  async function ejecutar() {
    if (!motivo.trim()) return;
    setProcesando(true); setError(null);
    try { const cliente = crearClienteNavegador(); await suspenderUsuarioAdmin(cliente, usuarioId, motivo.trim()); setAbierto(false); onCompletado(); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo suspender."); }
    finally { setProcesando(false); }
  }
  return (
    <div className="rounded-lg border border-status-error/30 bg-status-error-soft/20 p-4">
      <p className="font-body text-sm font-semibold text-status-error">Suspender cuenta</p>
      <p className="mt-1 font-body text-xs text-text-secondary">El usuario no podra acceder hasta que se reactive.</p>
      {error && <div className="mt-2"><Aviso tono="danger">{error}</Aviso></div>}
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la suspension" className="mt-3 w-full rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={2} />
      <div className="mt-3 flex gap-2">
        <button onClick={ejecutar} disabled={procesando || !motivo.trim()} className="rounded-lg bg-status-error px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Suspendiendo..." : "Confirmar suspension"}</button>
        <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}

function ReactivarCuenta({ usuarioId, onCompletado }: { usuarioId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  if (!abierto) return <button onClick={() => setAbierto(true)} className="rounded-lg border border-status-success/40 bg-status-success/10 px-4 py-2 font-body text-sm font-medium text-status-success hover:bg-status-success/20">Reactivar cuenta</button>;
  async function ejecutar() {
    if (!motivo.trim()) return; setProcesando(true);
    try { const cliente = crearClienteNavegador(); await reactivarUsuarioAdmin(cliente, usuarioId, motivo.trim()); setAbierto(false); onCompletado(); } catch { /* */ }
    finally { setProcesando(false); }
  }
  return (
    <div className="rounded-lg border border-status-success/30 bg-status-success-soft/20 p-4">
      <p className="font-body text-sm font-semibold text-status-success">Reactivar cuenta</p>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la reactivacion" className="mt-3 w-full rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={2} />
      <div className="mt-3 flex gap-2">
        <button onClick={ejecutar} disabled={procesando || !motivo.trim()} className="rounded-lg bg-status-success px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Reactivando..." : "Confirmar reactivacion"}</button>
        <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}

function CerrarCuenta({ usuarioId, onCompletado }: { usuarioId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [procesando, setProcesando] = useState(false);
  if (!abierto) return <button onClick={() => setAbierto(true)} className="rounded-lg border border-ink/40 bg-ink/10 px-4 py-2 font-body text-sm font-medium text-ink hover:bg-ink/20">Cerrar cuenta</button>;
  async function ejecutar() {
    if (!motivo.trim() || confirmacion !== "CERRAR") return; setProcesando(true);
    try { const cliente = crearClienteNavegador(); await cerrarCuentaUsuarioAdmin(cliente, usuarioId, motivo.trim()); setAbierto(false); onCompletado(); } catch { /* */ }
    finally { setProcesando(false); }
  }
  return (
    <div className="rounded-lg border border-ink/30 bg-ink/5 p-4">
      <p className="font-body text-sm font-semibold">Cerrar cuenta permanentemente</p>
      <p className="mt-1 font-body text-xs text-text-secondary">Esta accion no se puede deshacer.</p>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del cierre" className="mt-3 w-full rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={2} />
      <label className="mt-3 flex flex-col gap-1">
        <span className="font-body text-xs font-medium text-text-secondary">Escribe CERRAR para confirmar</span>
        <input type="text" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" />
      </label>
      <div className="mt-3 flex gap-2">
        <button onClick={ejecutar} disabled={procesando || !motivo.trim() || confirmacion !== "CERRAR"} className="rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Cerrando..." : "Cerrar cuenta definitivamente"}</button>
        <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}
