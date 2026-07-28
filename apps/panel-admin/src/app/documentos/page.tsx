"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { listarConductoresAdmin, listarUsuariosAdmin, validarDocumentoConductor } from "@ruum/api/services";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AccionesVerificacion } from "../usuarios/AccionesVerificacion";
import { AdminPageHeader, limpiarParamsFiltroUrl } from "../admin-ui";
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState, AdminTooltip } from "../admin-components";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Conductor = Database["public"]["Tables"]["conductores"]["Row"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];
type FiltroDocumentos = "todos" | "por_vencer" | "pendientes" | "usuarios";
type TonoBadge = "neutral" | "info" | "success" | "warning" | "danger";
type ItemDocumental =
  | { tipo: "conductor"; id: string; nombre: string; documento: string; telefono: string | null; empresa: string; folio: string; actualizadoEn: string | null; estado: EstadoVisual; conductor: Conductor }
  | { tipo: "usuario"; id: string; nombre: string; documento: string; telefono: string | null; empresa: string; folio: string; actualizadoEn: string | null; estado: EstadoVisual; usuario: Usuario };

type EstadoVisual = {
  etiqueta: "Pendiente de carga" | "En revisión" | "Aprobado" | "Rechazado" | "Vencido";
  tono: TonoBadge;
  motivo: string;
};

const USUARIOS_DEMO: Usuario[] = [];
const CONDUCTORES_DEMO: Conductor[] = [];

function estadoUsuario(usuario: Usuario): EstadoVisual {
  const etiquetas: Record<EstadoVerificacion, EstadoVisual> = {
    pendiente: { etiqueta: "Pendiente de carga", tono: "warning", motivo: usuario.doc_identidad_url ? "falta revisión inicial" : "falta identificación" },
    en_revision: { etiqueta: "En revisión", tono: "info", motivo: usuario.terminos_aceptados_en ? "identidad por validar" : "falta aceptación de términos" },
    verificado: { etiqueta: "Aprobado", tono: "success", motivo: "cuenta verificada" },
    rechazado: { etiqueta: "Rechazado", tono: "danger", motivo: "requiere corrección documental" }
  };
  return etiquetas[usuario.estado_verificacion];
}

function estadoConductor(conductor: Conductor): EstadoVisual {
  if (conductor.documentos_vigentes) return { etiqueta: "Aprobado", tono: "success", motivo: "expediente vigente" };
  return { etiqueta: "Vencido", tono: "danger", motivo: "documentos incompletos o vencidos" };
}

function formatearTelefono(valor: string | null | undefined) {
  const digitos = (valor ?? "").replace(/\D/g, "");
  const nacional = digitos.length >= 10 ? digitos.slice(-10) : digitos;
  if (nacional.length !== 10) return valor || "Sin teléfono";
  return `+52 ${nacional.slice(0, 2)} ${nacional.slice(2, 6)} ${nacional.slice(6)}`;
}

function fechaRelativa(valor: string | null) {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
}

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "RR";
}

function BadgeEstadoDocumento({ estado }: { estado: EstadoVisual }) {
  const dot = {
    warning: "bg-status-warning",
    info: "bg-status-info",
    success: "bg-status-success",
    danger: "bg-status-error",
    neutral: "bg-text-tertiary"
  }[estado.tono];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminBadge tone={estado.tono} className="gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
        {estado.etiqueta}
      </AdminBadge>
      <span className="font-body text-admin-secundario text-text-tertiary">- {estado.motivo}</span>
    </div>
  );
}

function ChipFiltro({ activo, etiqueta, total, onClick }: { activo: boolean; etiqueta: string; total: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-body text-admin-secundario font-semibold transition-colors ${
        activo
          ? "border-signal/50 bg-signal/10 text-ink"
          : "border-border-default bg-surface-primary text-text-secondary hover:border-signal/35 hover:text-ink"
      }`}
    >
      {etiqueta} <span className="font-mono-ruum">{total.toLocaleString("es-MX")}</span>
    </button>
  );
}

function DocumentoCard({
  item,
  seleccionado,
  onSeleccionar,
  onActualizado,
  onRecordatorio
}: {
  item: ItemDocumental;
  seleccionado: boolean;
  onSeleccionar: (checked: boolean) => void;
  onActualizado: () => void;
  onRecordatorio: () => void;
}) {
  return (
    <article className="rounded-lg border border-white/[0.08] bg-surface-primary px-4 py-4 transition-opacity">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <input
            type="checkbox"
            checked={seleccionado}
            onChange={(event) => onSeleccionar(event.target.checked)}
            className="mt-3 h-4 w-4 rounded border-border-default text-signal focus:ring-signal/30"
            aria-label={`Seleccionar ${item.nombre}`}
          />
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-default bg-surface-secondary font-mono-ruum text-sm font-semibold text-ink">
            {iniciales(item.nombre)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-body text-sm font-semibold text-ink">{item.nombre}</h3>
              <span className="font-mono-ruum text-admin-secundario text-text-tertiary">{item.folio}</span>
            </div>
            <p className="mt-1 font-body text-sm text-text-secondary">Documento: {item.documento}</p>
            <div className="mt-2">
              <BadgeEstadoDocumento estado={item.estado} />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 font-body text-admin-secundario text-text-tertiary">
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">Tel.</span><span className="font-mono-ruum text-text-secondary">{formatearTelefono(item.telefono)}</span></span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">Cuenta</span><span className="text-text-secondary">{item.empresa}</span></span>
              <span>Actualizado {fechaRelativa(item.actualizadoEn)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <Button variant="secondary" onClick={onRecordatorio}>Enviar recordatorio</Button>
          {item.tipo === "conductor" ? (
            <AccionesConductor conductor={item.conductor} onActualizado={onActualizado} />
          ) : (
            <AccionesVerificacion usuario={item.usuario} onActualizado={onActualizado} />
          )}
        </div>
      </div>
    </article>
  );
}

function AccionesConductor({ conductor, onActualizado }: { conductor: Conductor; onActualizado: () => void }) {
  const [pendiente, startTransition] = useTransition();

  function cambiar(aprobado: boolean) {
    startTransition(async () => {
      const cliente = crearClienteNavegador();
      await validarDocumentoConductor(cliente, conductor.id, aprobado);
      onActualizado();
    });
  }

  const boton = (
    <span>
      <Button variant="quiet" onClick={() => cambiar(true)} disabled={pendiente}>
        {pendiente ? "Procesando..." : "Aprobar documentos"}
      </Button>
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pendiente ? <AdminTooltip label="La validación está en proceso.">{boton}</AdminTooltip> : boton}
      <Button variant="quiet" onClick={() => cambiar(false)} disabled={pendiente}>Rechazar</Button>
    </div>
  );
}

function EstadoVacioDocumentos({ tipo }: { tipo: "conductores" | "usuarios" }) {
  return (
    <AdminEmptyState
      title={tipo === "conductores" ? "No hay conductores con documentos pendientes" : "No hay usuarios con documentos pendientes"}
      description={tipo === "conductores" ? "Los expedientes pendientes o vencidos aparecerán aquí cuando requieran intervención." : "Las cuentas por validar aparecerán aquí cuando haya documentos nuevos."}
      action={
        <a href={tipo === "conductores" ? "/conductores" : "/usuarios"} className="rounded-lg border border-border-default px-3 py-2 font-body text-sm font-semibold text-text-secondary hover:border-signal/40 hover:text-ink">
          {tipo === "conductores" ? "Ver todos los conductores" : "Ver todos los usuarios"}
        </a>
      }
    />
  );
}

export default function PaginaDocumentosAdmin() {
  const [filtro, setFiltro] = useState<FiltroDocumentos>("todos");
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_DEMO);
  const [conductores, setConductores] = useState<Conductor[]>(CONDUCTORES_DEMO);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<{ tono: "info" | "danger" | "atencion"; texto: string } | null>(null);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setUsuarios(USUARIOS_DEMO);
      setConductores(CONDUCTORES_DEMO);
      setEsDemo(true);
      setCargando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      const [usuariosReales, conductoresReales] = await Promise.all([
        listarUsuariosAdmin(cliente),
        listarConductoresAdmin(cliente)
      ]);
      setUsuarios(usuariosReales);
      setConductores(conductoresReales);
      setEsDemo(false);
    } catch {
      if (puedeUsarDatosDemo()) {
        setUsuarios(USUARIOS_DEMO);
        setConductores(CONDUCTORES_DEMO);
        setEsDemo(true);
      } else {
        setUsuarios([]);
        setConductores([]);
        setError("No pudimos cargar los datos documentales.");
        setEsDemo(false);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void cargar(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const filtroUrl = new URLSearchParams(window.location.search).get("filtro");
    if (filtroUrl === "por_vencer") setFiltro("por_vencer");
  }, []);

  const items = useMemo<ItemDocumental[]>(() => [
    ...conductores.map((conductor) => ({
      tipo: "conductor" as const,
      id: conductor.id,
      nombre: conductor.nombre,
      documento: "Licencia, identificación, domicilio y constancia fiscal",
      telefono: conductor.telefono,
      empresa: "Conductor independiente",
      folio: `COND-${conductor.id.slice(0, 8).toUpperCase()}`,
      actualizadoEn: conductor.actualizado_en,
      estado: estadoConductor(conductor),
      conductor
    })),
    ...usuarios.map((usuario) => ({
      tipo: "usuario" as const,
      id: usuario.id,
      nombre: usuario.nombre ?? usuario.id.slice(0, 8).toUpperCase(),
      documento: usuario.tipo_cuenta === "empresa" ? "Constancia fiscal y datos de facturación" : "Identificación oficial",
      telefono: usuario.telefono,
      empresa: usuario.tipo_cuenta === "empresa" ? `Empresa - ${usuario.rol.replaceAll("_", " ")}` : `Usuario - ${usuario.rol.replaceAll("_", " ")}`,
      folio: `USR-${usuario.id.slice(0, 8).toUpperCase()}`,
      actualizadoEn: usuario.actualizado_en,
      estado: estadoUsuario(usuario),
      usuario
    }))
  ], [conductores, usuarios]);

  const conteos = {
    todos: items.length,
    porVencer: items.filter((item) => item.estado.etiqueta === "Vencido").length,
    pendientes: items.filter((item) => item.estado.etiqueta === "Pendiente de carga" || item.estado.etiqueta === "En revisión").length,
    usuarios: items.filter((item) => item.tipo === "usuario" && item.estado.etiqueta !== "Aprobado").length
  };

  const itemsVisibles = items.filter((item) => {
    if (filtro === "por_vencer") return item.estado.etiqueta === "Vencido";
    if (filtro === "pendientes") return item.estado.etiqueta === "Pendiente de carga" || item.estado.etiqueta === "En revisión";
    if (filtro === "usuarios") return item.tipo === "usuario" && item.estado.etiqueta !== "Aprobado";
    return true;
  });

  function cambiarFiltro(siguiente: FiltroDocumentos) {
    setFiltro(siguiente);
    if (siguiente !== "por_vencer") limpiarParamsFiltroUrl(["filtro"]);
    setSeleccionados(new Set());
  }

  function seleccionar(id: string, checked: boolean) {
    setSeleccionados((actual) => {
      const siguiente = new Set(actual);
      if (checked) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  function recordatorio(total = 1) {
    setAviso({ tono: "info", texto: total === 1 ? "Recordatorio preparado para el contacto documental." : `Recordatorio preparado para ${total.toLocaleString("es-MX")} contactos documentales.` });
  }

  if (cargando) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando documentos" />
      </main>
    );
  }

  if (error && !esDemo && conductores.length === 0 && usuarios.length === 0) {
    return (
      <main className="admin-page-shell">
        <AdminErrorState title={error} action={<Button onClick={cargar}>Reintentar</Button>} />
      </main>
    );
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Administración"
        titulo="Documentos"
        descripcion="Validación documental de conductores, usuarios y empresas."
        estadoConexion={esDemo ? "demo" : "datos_en_vivo"}
        contadorResultados={itemsVisibles.length}
      />

      {aviso && (
        <div className="mt-4">
          <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
        </div>
      )}

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="atencion">No se pudieron cargar datos reales de Supabase.</Aviso>
        </div>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <ChipFiltro activo={filtro === "todos"} etiqueta="Todos" total={conteos.todos} onClick={() => cambiarFiltro("todos")} />
            <ChipFiltro activo={filtro === "por_vencer"} etiqueta="Por vencer" total={conteos.porVencer} onClick={() => cambiarFiltro("por_vencer")} />
            <ChipFiltro activo={filtro === "pendientes"} etiqueta="Pendientes" total={conteos.pendientes} onClick={() => cambiarFiltro("pendientes")} />
            <ChipFiltro activo={filtro === "usuarios"} etiqueta="Usuarios por validar" total={conteos.usuarios} onClick={() => cambiarFiltro("usuarios")} />
          </div>
          {seleccionados.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-border-default bg-surface-primary px-3 py-2 shadow-[var(--ruum-shadow-2)]">
              <span className="font-mono-ruum text-admin-secundario text-ink">{seleccionados.size.toLocaleString("es-MX")} seleccionados</span>
              <Button variant="secondary" onClick={() => recordatorio(seleccionados.size)}>Enviar recordatorio a todos</Button>
            </div>
          )}
        </div>

        <PassportCard className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Expedientes documentales</h2>
            <p className="font-body text-admin-secundario text-text-tertiary">Folio, teléfono y datos operativos usan lectura compacta.</p>
          </div>
          <div className="mt-4 grid gap-3">
            {itemsVisibles.length === 0 ? (
              filtro === "usuarios" ? <EstadoVacioDocumentos tipo="usuarios" /> : <EstadoVacioDocumentos tipo="conductores" />
            ) : (
              itemsVisibles.map((item) => (
                <DocumentoCard
                  key={`${item.tipo}-${item.id}`}
                  item={item}
                  seleccionado={seleccionados.has(`${item.tipo}-${item.id}`)}
                  onSeleccionar={(checked) => seleccionar(`${item.tipo}-${item.id}`, checked)}
                  onActualizado={() => { setAviso({ tono: "info", texto: "Documento actualizado." }); void cargar(); }}
                  onRecordatorio={() => recordatorio()}
                />
              ))
            )}
          </div>
        </PassportCard>
      </section>
    </main>
  );
}
