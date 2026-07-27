"use client";
import { Fragment, useEffect, useMemo, useState, useTransition, type InputHTMLAttributes, type ReactNode } from "react";
import { Aviso, Button } from "@ruum/ui";
import {
  actualizarEmpresaCorporativaAdmin,
  cambiarEstadoEmpresaAdmin,
  crearEmpresaCorporativaAdmin,
  guardarDocumentoEmpresaAdmin,
  guardarUsuarioEmpresaAdmin,
  listarEmpresasAdmin,
  resolverCambioEmpresaAdmin,
  validarDocumentoEmpresa,
  type DatosEmpresasAdmin
} from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader, AdminPanel } from "../admin-ui";
import { AdminButton, AdminDialog, AdminEmptyState, AdminErrorState, AdminLoadingState } from "../admin-components";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];
type CambioSensible = Database["public"]["Tables"]["empresas_cambios_sensibles"]["Row"];
type TabEmpresa = "resumen" | "fiscal" | "usuarios" | "documentos" | "riesgo";

const DATOS_DEMO: DatosEmpresasAdmin = {
  empresas: [],
  usuarios: [],
  traslados: [],
  vehiculos: [],
  conductores: [],
  documentos: [],
  versionesFiscales: [],
  versionesCondiciones: [],
  cambiosSensibles: []
};

const FORM_INICIAL = {
  nombre: "",
  rfc: "",
  razon_social: "",
  regimen_fiscal: "",
  codigo_postal_fiscal: "",
  uso_cfdi: "",
  correo_facturacion: "",
  condiciones_pago: "",
  limite_credito_mxn: "0",
  credito_disponible_mxn: "0",
  dias_credito: "0",
  requiere_orden_compra: false,
  titular_nombre: "",
  titular_telefono: "",
  titular_correo: "",
  metodo_pago_registrado: false
};

const DOCUMENTO_INICIAL = {
  tipo: "contrato",
  nombre: "",
  folio: "",
  url: "",
  vigente_desde: "",
  vigente_hasta: "",
  notas: ""
};

type UsuarioEmpresaForm = {
  rol: "titular_empresa" | "usuario_autorizado";
  nombre: string;
  telefono: string;
  correo_facturacion: string;
  metodo_pago_registrado: boolean;
};

const USUARIO_INICIAL: UsuarioEmpresaForm = {
  rol: "usuario_autorizado",
  nombre: "",
  telefono: "",
  correo_facturacion: "",
  metodo_pago_registrado: false
};

const ETIQUETA_ESTADO: Record<EstadoVerificacion, string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  verificado: "Aprobado",
  rechazado: "Rechazado"
};

const TABS_EMPRESA: Array<{ id: TabEmpresa; etiqueta: string }> = [
  { id: "resumen", etiqueta: "Resumen y KPIs" },
  { id: "fiscal", etiqueta: "Fiscal y facturación" },
  { id: "usuarios", etiqueta: "Usuarios y permisos" },
  { id: "documentos", etiqueta: "Contratos y documentos" },
  { id: "riesgo", etiqueta: "Configuración de riesgo" }
];

const RFC_MEXICO = /^([A-Z&Ñ]{3}|[A-Z&Ñ]{4})\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/;
const CORREO_BASICO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGIMENES_FISCALES = [
  "601 - General de Ley Personas Morales",
  "603 - Personas Morales con Fines no Lucrativos",
  "605 - Sueldos y Salarios e Ingresos Asimilados",
  "606 - Arrendamiento",
  "612 - Personas Físicas con Actividades Empresariales",
  "616 - Sin obligaciones fiscales",
  "626 - Régimen Simplificado de Confianza"
];
const USOS_CFDI = [
  "G01 - Adquisición de mercancías",
  "G03 - Gastos en general",
  "I03 - Equipo de transporte",
  "P01 - Por definir"
];
const CONDICIONES_PAGO = [
  "Contado",
  "Crédito 7 días",
  "Crédito 15 días",
  "Crédito 30 días",
  "Orden de compra"
];

function soloNumeros(valor: string, max?: number) {
  const limpio = valor.replace(/\D/g, "");
  return typeof max === "number" ? limpio.slice(0, max) : limpio;
}

function normalizarRfc(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, "").slice(0, 13);
}

function formatearTelefono(valor: string) {
  const digitos = soloNumeros(valor, 10);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 3)}) ${digitos.slice(3)}`;
  return `(${digitos.slice(0, 3)}) ${digitos.slice(3, 6)}-${digitos.slice(6)}`;
}

function fecha(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(fechaIso));
}

function moneda(valor: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(valor ?? 0);
}

function badgeEstado(estado: EstadoVerificacion | string) {
  if (estado === "verificado" || estado === "activa" || estado === "aprobado") return "border-status-success/30 bg-status-success-soft text-status-success";
  if (estado === "rechazado" || estado === "suspendida") return "border-status-error/25 bg-status-error-soft text-status-error";
  return "border-status-warning/40 bg-status-warning-soft text-status-warning";
}

function Badge({ estado, texto }: { estado: EstadoVerificacion | string; texto?: string }) {
  return <span className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${badgeEstado(estado)}`}>{texto ?? ETIQUETA_ESTADO[estado as EstadoVerificacion] ?? estado}</span>;
}

function textoEstadoOperativo(estado: string | null | undefined) {
  return estado === "suspendida" ? "Suspendida" : "Activa";
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-secondary/55 px-3 py-3">
      <dt className="font-body text-xs font-medium text-text-tertiary">{etiqueta}</dt>
      <dd className="mt-1 truncate font-body text-sm font-semibold text-ink" title={typeof valor === "string" ? valor : undefined}>{valor || "No registrado"}</dd>
    </div>
  );
}

function CampoTexto({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "number" | "date";
  min?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-body text-xs font-semibold text-text-secondary">{label}</span>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm text-ink focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        placeholder={placeholder}
      />
    </label>
  );
}

function SeccionAlta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border-default bg-surface-secondary/35 p-4">
      <h3 className="font-body text-xs font-semibold uppercase tracking-wide text-text-secondary">{titulo}</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-6">{children}</div>
    </section>
  );
}

function CampoAlta({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "md:col-span-3",
  inputMode,
  autoComplete,
  list,
  ayuda,
  error
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "number" | "tel";
  className?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  list?: string;
  ayuda?: string;
  error?: string | null;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="font-body text-xs font-semibold text-text-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        list={list}
        placeholder={placeholder}
        className="h-10 rounded-lg border border-ink/30 bg-surface-primary px-3 font-body text-sm text-ink placeholder:text-text-secondary/80 focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/35"
      />
      {(error || ayuda) && <span className={`font-body text-[11px] ${error ? "text-status-error" : "text-text-tertiary"}`}>{error ?? ayuda}</span>}
    </label>
  );
}

function KpiEmpresa({ icono, etiqueta, valor, detalle }: { icono: string; etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-surface-secondary/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-ink/10 font-body text-sm font-bold text-text-secondary" aria-hidden="true">{icono}</span>
        <span className="font-mono-ruum text-xl font-semibold text-ink">{valor}</span>
      </div>
      <p className="mt-2 font-body text-xs font-semibold text-text-secondary">{etiqueta}</p>
      {detalle && <p className="mt-1 truncate font-body text-[11px] text-text-tertiary">{detalle}</p>}
    </div>
  );
}

function agruparPor<T extends { empresa_id: string | null }>(filas: T[]) {
  const mapa = new Map<string, T[]>();
  for (const fila of filas) {
    if (!fila.empresa_id) continue;
    mapa.set(fila.empresa_id, [...(mapa.get(fila.empresa_id) ?? []), fila]);
  }
  return mapa;
}

type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "sin_conexion" | "demo";

function AccionesEmpresa({
  empresa,
  usuarios,
  vehiculos,
  conductores,
  documentos,
  viajes,
  versionesFiscales,
  versionesCondiciones,
  cambiosPendientes,
  onActualizado
}: {
  empresa: Empresa;
  usuarios: Usuario[];
  vehiculos: DatosEmpresasAdmin["vehiculos"];
  conductores: DatosEmpresasAdmin["conductores"];
  documentos: DatosEmpresasAdmin["documentos"];
  viajes: DatosEmpresasAdmin["traslados"];
  versionesFiscales: DatosEmpresasAdmin["versionesFiscales"];
  versionesCondiciones: DatosEmpresasAdmin["versionesCondiciones"];
  cambiosPendientes: CambioSensible[];
  onActualizado: () => void;
}) {
  const [tab, setTab] = useState<TabEmpresa>("resumen");
  const [form, setForm] = useState({
    nombre: empresa.nombre,
    rfc: empresa.rfc ?? "",
    razon_social: empresa.razon_social ?? "",
    regimen_fiscal: empresa.regimen_fiscal ?? "",
    codigo_postal_fiscal: empresa.codigo_postal_fiscal ?? "",
    uso_cfdi: empresa.uso_cfdi ?? "",
    correo_facturacion: empresa.correo_facturacion ?? "",
    condiciones_pago: empresa.condiciones_pago ?? "",
    limite_credito_mxn: String(empresa.limite_credito_mxn ?? 0),
    credito_disponible_mxn: String(empresa.credito_disponible_mxn ?? 0),
    dias_credito: String(empresa.dias_credito ?? 0),
    requiere_orden_compra: empresa.requiere_orden_compra ?? false,
    motivo: "Actualización administrativa de empresa"
  });
  const [usuario, setUsuario] = useState(USUARIO_INICIAL);
  const [documento, setDocumento] = useState(DOCUMENTO_INICIAL);
  const [motivoEstado, setMotivoEstado] = useState("");
  const [accionRiesgo, setAccionRiesgo] = useState<"suspender" | "reactivar" | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<void>, ok: string) {
    setMensaje(null);
    startTransition(async () => {
      try {
        await accion();
        setMensaje(ok);
        onActualizado();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo completar la acción.");
      }
    });
  }

  const rfcValido = RFC_MEXICO.test(form.rfc.trim().toUpperCase());
  const titular = usuarios.find((item) => item.rol === "titular_empresa");
  const autorizado = usuarios.find((item) => item.rol === "usuario_autorizado");

  function ejecutarCambioEstado() {
    if (!accionRiesgo || !motivoEstado.trim()) return;
    const estado = accionRiesgo === "suspender" ? "suspendida" : "activa";
    ejecutar(
      () => cambiarEstadoEmpresaAdmin(crearClienteNavegador(), empresa.id, estado, motivoEstado).then(() => undefined),
      accionRiesgo === "suspender" ? "Empresa suspendida." : "Empresa reactivada."
    );
    setAccionRiesgo(null);
  }

  return (
    <div className="mt-5 border-t border-ink/10 pt-5">
      <div className="flex gap-1 overflow-x-auto border-b border-ink/10">
        {TABS_EMPRESA.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 font-body text-sm font-semibold transition-colors ${tab === item.id ? "border-b-2 border-signal bg-surface-primary text-ink shadow-sm" : "text-text-tertiary hover:bg-surface-primary/70 hover:text-ink"}`}
          >
            {item.etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "resumen" && (
          <div className="grid gap-4">
            {cambiosPendientes.length > 0 && (
              <div className="rounded-lg border border-status-warning/35 bg-status-warning-soft p-4">
                <p className="font-body text-sm font-semibold text-status-warning">Cambios pendientes de aprobación</p>
                <p className="mt-1 font-body text-sm text-text-secondary">La empresa está activa, pero tiene ajustes fiscales o comerciales esperando revisión.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KpiEmpresa icono="T" etiqueta="Titular" valor={titular?.nombre ?? "No registrado"} detalle={titular?.correo_facturacion ?? undefined} />
              <KpiEmpresa icono="V" etiqueta="Flota" valor={String(vehiculos.length)} detalle="vehículos" />
              <KpiEmpresa icono="C" etiqueta="Conductores" valor={String(conductores.length)} detalle="asignados" />
              <KpiEmpresa icono="R" etiqueta="Traslados" valor={String(viajes.length)} detalle="histórico corporativo" />
              <KpiEmpresa icono="$" etiqueta="Límite crédito" valor={moneda(empresa.limite_credito_mxn)} detalle={`${empresa.dias_credito ?? 0} días`} />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Dato etiqueta="Nombre comercial" valor={empresa.nombre} />
              <Dato etiqueta="Razón social" valor={empresa.razon_social} />
              <Dato etiqueta="RFC" valor={empresa.rfc} />
              <Dato etiqueta="Correo de facturación" valor={empresa.correo_facturacion} />
              <Dato etiqueta="Crédito disponible" valor={moneda(empresa.credito_disponible_mxn)} />
              <Dato etiqueta="Condiciones" valor={empresa.condiciones_pago} />
            </dl>
          </div>
        )}

        {tab === "fiscal" && (
          <div className="grid gap-4">
            {cambiosPendientes.length > 0 && (
              <div className="rounded-lg border border-status-warning/30 bg-status-warning-soft p-4">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-status-warning">Revisión fiscal pendiente</p>
                <div className="mt-3 grid gap-2">
                  {cambiosPendientes.map((cambio) => (
                    <div key={cambio.id} className="flex flex-col gap-2 rounded-lg bg-surface-primary p-3 font-body text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span>{cambio.tipo.replaceAll("_", " ")} · {cambio.motivo}</span>
                      <span className="flex flex-wrap gap-2">
                        <Button variant="quiet" disabled={pendiente} onClick={() => ejecutar(() => resolverCambioEmpresaAdmin(crearClienteNavegador(), cambio.id, true, "Aprobado desde Empresas").then(() => undefined), "Cambio sensible aprobado.")}>Aprobar</Button>
                        <Button variant="quiet" disabled={pendiente} onClick={() => ejecutar(() => resolverCambioEmpresaAdmin(crearClienteNavegador(), cambio.id, false, "Rechazado desde Empresas").then(() => undefined), "Cambio sensible rechazado.")}>Rechazar</Button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Edición fiscal y facturación</p>
                <Badge estado={rfcValido ? "verificado" : "rechazado"} texto={rfcValido ? "RFC formal válido" : "RFC inválido"} />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <CampoTexto label="Nombre comercial" value={form.nombre} onChange={(valor) => setForm({ ...form, nombre: valor })} placeholder="Nombre visible" />
                <CampoTexto label="RFC" value={form.rfc} onChange={(valor) => setForm({ ...form, rfc: valor.toUpperCase() })} placeholder="RFC de la empresa" />
                <CampoTexto label="Razón social" value={form.razon_social} onChange={(valor) => setForm({ ...form, razon_social: valor })} placeholder="Razón social completa" />
                <CampoTexto label="Correo de facturación" value={form.correo_facturacion} onChange={(valor) => setForm({ ...form, correo_facturacion: valor })} placeholder="facturacion@empresa.com" type="email" />
                <CampoTexto label="Régimen fiscal" value={form.regimen_fiscal} onChange={(valor) => setForm({ ...form, regimen_fiscal: valor })} placeholder="Ej. 601" />
                <CampoTexto label="Código postal fiscal" value={form.codigo_postal_fiscal} onChange={(valor) => setForm({ ...form, codigo_postal_fiscal: valor })} placeholder="5 dígitos" />
                <CampoTexto label="Uso CFDI" value={form.uso_cfdi} onChange={(valor) => setForm({ ...form, uso_cfdi: valor })} placeholder="Ej. G03" />
                <CampoTexto label="Condiciones de pago" value={form.condiciones_pago} onChange={(valor) => setForm({ ...form, condiciones_pago: valor })} placeholder="Crédito / contado / OC" />
                <CampoTexto label="Límite de crédito" value={form.limite_credito_mxn} onChange={(valor) => setForm({ ...form, limite_credito_mxn: valor })} type="number" min="0" />
                <CampoTexto label="Crédito disponible" value={form.credito_disponible_mxn} onChange={(valor) => setForm({ ...form, credito_disponible_mxn: valor })} type="number" min="0" />
                <CampoTexto label="Días de crédito" value={form.dias_credito} onChange={(valor) => setForm({ ...form, dias_credito: valor })} type="number" min="0" />
              </div>
              <label className="flex items-center gap-2 font-body text-sm">
                <input type="checkbox" checked={form.requiere_orden_compra} onChange={(e) => setForm({ ...form, requiere_orden_compra: e.target.checked })} className="size-4 rounded border-ink/30" />
                Requiere orden de compra
              </label>
              <CampoTexto label="Motivo del cambio" value={form.motivo} onChange={(valor) => setForm({ ...form, motivo: valor })} placeholder="Justificación para auditoría" />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pendiente || !rfcValido}
                  onClick={() => ejecutar(
                    () => actualizarEmpresaCorporativaAdmin(crearClienteNavegador(), empresa.id, {
                      nombre: form.nombre,
                      rfc: form.rfc,
                      razon_social: form.razon_social,
                      regimen_fiscal: form.regimen_fiscal,
                      codigo_postal_fiscal: form.codigo_postal_fiscal,
                      uso_cfdi: form.uso_cfdi,
                      correo_facturacion: form.correo_facturacion,
                      condiciones_pago: form.condiciones_pago,
                      limite_credito_mxn: Number(form.limite_credito_mxn || 0),
                      credito_disponible_mxn: Number(form.credito_disponible_mxn || form.limite_credito_mxn || 0),
                      dias_credito: Number(form.dias_credito || 0),
                      requiere_orden_compra: form.requiere_orden_compra
                    }, form.motivo).then(() => undefined),
                    "Actualización enviada. Los cambios sensibles quedan pendientes de aprobación."
                  )}
                >
                  Guardar / solicitar aprobación
                </Button>
                <Button variant="quiet" disabled={pendiente} onClick={() => ejecutar(() => validarDocumentoEmpresa(crearClienteNavegador(), empresa.id, "verificado", "").then(() => undefined), "Empresa aprobada.")}>Aprobar RFC / CFDI</Button>
                <Button variant="quiet" disabled={pendiente} onClick={() => ejecutar(() => validarDocumentoEmpresa(crearClienteNavegador(), empresa.id, "rechazado", "").then(() => undefined), "Empresa rechazada.")}>Rechazar</Button>
              </div>
            </div>
            <div className="rounded-lg border border-ink/10 p-4">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Versiones fiscales</p>
              <div className="mt-3 grid gap-2 font-body text-sm">
                {versionesFiscales.length === 0 ? <span className="text-text-secondary">Sin versiones registradas</span> : versionesFiscales.map((version) => (
                  <span key={version.id}>v{version.version} · {version.rfc} · desde {fecha(version.vigente_desde)}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "usuarios" && (
          <div className="grid gap-4">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {usuarios.length === 0 ? (
                <Dato etiqueta="Usuarios" valor="No registrados" />
              ) : usuarios.map((item) => (
                <Dato key={item.id} etiqueta={item.rol === "titular_empresa" ? "Titular" : "Usuario autorizado"} valor={item.nombre ?? item.correo_facturacion} />
              ))}
            </dl>
            <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Agregar o actualizar usuario empresarial</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-xs font-semibold text-text-secondary">Rol</span>
                  <select value={usuario.rol} onChange={(e) => setUsuario({ ...usuario, rol: e.target.value as "titular_empresa" | "usuario_autorizado" })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
                    <option value="titular_empresa">Titular empresa</option>
                    <option value="usuario_autorizado">Usuario autorizado</option>
                  </select>
                </label>
                <CampoTexto label="Nombre completo" value={usuario.nombre} onChange={(valor) => setUsuario({ ...usuario, nombre: valor })} placeholder="Nombre y apellidos" />
                <CampoTexto label="Correo" value={usuario.correo_facturacion} onChange={(valor) => setUsuario({ ...usuario, correo_facturacion: valor })} placeholder="correo@empresa.com" type="email" />
                <CampoTexto label="Teléfono" value={usuario.telefono} onChange={(valor) => setUsuario({ ...usuario, telefono: valor })} placeholder="10 dígitos" />
              </div>
              <label className="flex items-center gap-2 font-body text-sm">
                <input type="checkbox" checked={usuario.metodo_pago_registrado} onChange={(e) => setUsuario({ ...usuario, metodo_pago_registrado: e.target.checked })} className="size-4 rounded border-ink/30" />
                Puede operar pago corporativo
              </label>
              <Button disabled={pendiente} onClick={() => ejecutar(() => guardarUsuarioEmpresaAdmin(crearClienteNavegador(), empresa.id, usuario).then(() => undefined), "Usuario empresarial guardado.")}>Guardar usuario</Button>
            </div>
          </div>
        )}

        {tab === "documentos" && (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {documentos.length === 0 ? (
                <Dato etiqueta="Documentos" valor="No registrados" />
              ) : documentos.map((doc) => (
                <Dato key={doc.id} etiqueta={doc.tipo} valor={`${doc.nombre} · vence ${fecha(doc.vigente_hasta)}`} />
              ))}
            </div>
            <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Registrar contrato o documento</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <CampoTexto label="Tipo de documento" value={documento.tipo} onChange={(valor) => setDocumento({ ...documento, tipo: valor })} placeholder="Contrato, NDA, anexo" />
                <CampoTexto label="Nombre del documento" value={documento.nombre} onChange={(valor) => setDocumento({ ...documento, nombre: valor })} placeholder="Contrato marco" />
                <CampoTexto label="Folio del contrato" value={documento.folio} onChange={(valor) => setDocumento({ ...documento, folio: valor })} placeholder="Folio interno" />
                <CampoTexto label="URL privada" value={documento.url} onChange={(valor) => setDocumento({ ...documento, url: valor })} placeholder="Ruta segura del archivo" />
                <CampoTexto label="Fecha de inicio" value={documento.vigente_desde} onChange={(valor) => setDocumento({ ...documento, vigente_desde: valor })} type="date" />
                <CampoTexto label="Fecha de vencimiento" value={documento.vigente_hasta} onChange={(valor) => setDocumento({ ...documento, vigente_hasta: valor })} type="date" />
              </div>
              <Button disabled={pendiente} onClick={() => ejecutar(() => guardarDocumentoEmpresaAdmin(crearClienteNavegador(), empresa.id, documento).then(() => undefined), "Documento registrado.")}>Registrar documento</Button>
            </div>
          </div>
        )}

        {tab === "riesgo" && (
          <div className="rounded-lg border border-status-error/35 bg-status-error-soft/25 p-4">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-status-error">Suspensión y reactivación</p>
            <p className="mt-1 font-body text-sm text-text-secondary">Acciones críticas para detener o reactivar la operación corporativa. Requieren motivo y confirmación.</p>
            <label className="mt-4 flex flex-col gap-1.5">
              <span className="font-body text-xs font-semibold text-text-secondary">Motivo obligatorio</span>
              <textarea value={motivoEstado} onChange={(e) => setMotivoEstado(e.target.value)} className="min-h-24 rounded-lg border border-status-error/25 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Describe la razón operativa o de cumplimiento." />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="quiet" disabled={pendiente || !motivoEstado.trim()} onClick={() => setAccionRiesgo("suspender")}>Suspender empresa</Button>
              <Button variant="quiet" disabled={pendiente || !motivoEstado.trim()} onClick={() => setAccionRiesgo("reactivar")}>Reactivar empresa</Button>
            </div>
          </div>
        )}
      </div>

      <AdminDialog
        open={Boolean(accionRiesgo)}
        title={accionRiesgo === "suspender" ? "Confirmar suspensión" : "Confirmar reactivación"}
        description="Esta acción modifica el estado operativo de la cuenta empresarial y quedará registrada para auditoría."
        onOpenChange={(open) => { if (!pendiente && !open) setAccionRiesgo(null); }}
        footer={
          <>
            <Button variant="quiet" disabled={pendiente} onClick={() => setAccionRiesgo(null)}>Cancelar</Button>
            <Button disabled={pendiente || !motivoEstado.trim()} onClick={ejecutarCambioEstado}>
              {accionRiesgo === "suspender" ? "Confirmar suspensión" : "Confirmar reactivación"}
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-status-error/25 bg-status-error-soft/35 p-3 font-body text-sm text-text-secondary">
          <p className="font-semibold text-status-error">Motivo registrado</p>
          <p className="mt-1">{motivoEstado || "Sin motivo capturado."}</p>
        </div>
      </AdminDialog>

      {mensaje && <p className="font-body text-sm text-text-secondary">{mensaje}</p>}
    </div>
  );
}

export default function PaginaEmpresasAdmin() {
  const [datos, setDatos] = useState<DatosEmpresasAdmin>(DATOS_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [empresaAbiertaId, setEmpresaAbiertaId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState(FORM_INICIAL);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "danger" | "atencion"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [puedeGestionarEmpresas, setPuedeGestionarEmpresas] = useState(false);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  async function cargar(manual = false) {
    if (manual) setActualizandoManual(true);
    else setCargando(true);

    if (!tieneSupabaseConfigurado()) {
      setDatos(DATOS_DEMO);
      setEsDemo(true);
      setPuedeGestionarEmpresas(false);
      setErrorCarga(null);
      setEstadoConexion("demo");
      setUltimaActualizacion(new Date());
      setCargando(false);
      setActualizandoManual(false);
      return;
    }

    try {
      setErrorCarga(null);
      const cliente = crearClienteNavegador();
      const [datosEmpresas, permisoGestionar] = await Promise.all([
        listarEmpresasAdmin(cliente),
        cliente.rpc("admin_tiene_permiso", { p_permiso: "empresas:gestionar" })
      ]);
      if (permisoGestionar.error) throw permisoGestionar.error;
      setDatos(datosEmpresas);
      setPuedeGestionarEmpresas(permisoGestionar.data === true);
      setEsDemo(false);
      setEstadoConexion("datos_en_vivo");
      setUltimaActualizacion(new Date());
    } catch {
      if (puedeUsarDatosDemo()) {
        setDatos(DATOS_DEMO);
        setEsDemo(true);
        setPuedeGestionarEmpresas(false);
        setErrorCarga(null);
        setEstadoConexion("demo");
        setUltimaActualizacion(new Date());
      } else {
        setDatos(DATOS_DEMO);
        setEsDemo(false);
        setPuedeGestionarEmpresas(false);
        setErrorCarga("No pudimos cargar las empresas corporativas.");
        setEstadoConexion("sin_conexion");
      }
    } finally {
      setCargando(false);
      setActualizandoManual(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const usuariosPorEmpresa = useMemo(() => agruparPor(datos.usuarios), [datos.usuarios]);
  const vehiculosPorEmpresa = useMemo(() => agruparPor(datos.vehiculos), [datos.vehiculos]);
  const conductoresPorEmpresa = useMemo(() => agruparPor(datos.conductores), [datos.conductores]);
  const documentosPorEmpresa = useMemo(() => agruparPor(datos.documentos), [datos.documentos]);
  const fiscalPorEmpresa = useMemo(() => agruparPor(datos.versionesFiscales), [datos.versionesFiscales]);
  const condicionesPorEmpresa = useMemo(() => agruparPor(datos.versionesCondiciones), [datos.versionesCondiciones]);
  const cambiosPorEmpresa = useMemo(() => agruparPor(datos.cambiosSensibles), [datos.cambiosSensibles]);

  const viajesPorEmpresa = useMemo(() => {
    const empresaPorUsuario = new Map(datos.usuarios.filter((usuario) => usuario.empresa_id).map((usuario) => [usuario.id, usuario.empresa_id as string]));
    const mapa = new Map<string, Database["public"]["Tables"]["traslados"]["Row"][]>();
    for (const traslado of datos.traslados) {
      const empresaId = empresaPorUsuario.get(traslado.usuario_id);
      if (!empresaId) continue;
      mapa.set(empresaId, [...(mapa.get(empresaId) ?? []), traslado]);
    }
    return mapa;
  }, [datos.traslados, datos.usuarios]);

  const rfcDuplicado = useMemo(() => {
    const rfc = formulario.rfc.trim().toUpperCase();
    return Boolean(rfc && datos.empresas.some((empresa) => empresa.rfc?.toUpperCase() === rfc));
  }, [datos.empresas, formulario.rfc]);
  const formularioIncompleto = !formulario.nombre.trim() || !formulario.rfc.trim() || !formulario.titular_nombre.trim() || !formulario.titular_correo.trim();

  function actualizarCampo(campo: keyof typeof FORM_INICIAL, valor: string | boolean) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function crearEmpresa() {
    setMensaje(null);
    const rfc = formulario.rfc.trim().toUpperCase();
    const nombre = formulario.nombre.trim();
    const titularNombre = formulario.titular_nombre.trim();
    const titularCorreo = formulario.titular_correo.trim().toLowerCase();
    const correoFacturacion = (formulario.correo_facturacion || titularCorreo).trim().toLowerCase();
    const limiteCredito = Number(formulario.limite_credito_mxn || 0);
    const creditoDisponible = Number(formulario.credito_disponible_mxn || formulario.limite_credito_mxn || 0);
    const diasCredito = Number(formulario.dias_credito || 0);
    if (!nombre) {
      setMensaje({ tono: "danger", texto: "Captura el nombre comercial de la empresa." });
      return;
    }
    if (!RFC_MEXICO.test(rfc)) {
      setMensaje({ tono: "danger", texto: "Captura un RFC mexicano formalmente válido." });
      return;
    }
    if (!titularNombre) {
      setMensaje({ tono: "danger", texto: "Captura el nombre del titular." });
      return;
    }
    if (!CORREO_BASICO.test(titularCorreo)) {
      setMensaje({ tono: "danger", texto: "Captura un correo válido para el titular." });
      return;
    }
    if (correoFacturacion && !CORREO_BASICO.test(correoFacturacion)) {
      setMensaje({ tono: "danger", texto: "Captura un correo de facturación válido." });
      return;
    }
    if (![limiteCredito, creditoDisponible, diasCredito].every((valor) => Number.isFinite(valor) && valor >= 0)) {
      setMensaje({ tono: "danger", texto: "Crédito y días de pago deben ser números mayores o iguales a cero." });
      return;
    }
    if (rfcDuplicado) {
      setMensaje({ tono: "danger", texto: "Ya existe una empresa con ese RFC." });
      return;
    }
    if (esDemo) {
      setMensaje({ tono: "atencion", texto: "El alta de empresas requiere conexión real a Supabase." });
      return;
    }
    if (!puedeGestionarEmpresas) {
      setMensaje({ tono: "danger", texto: "Tu rol puede consultar empresas, pero no tiene permiso para crear empresas corporativas." });
      return;
    }

    setGuardando(true);
    try {
      await crearEmpresaCorporativaAdmin(crearClienteNavegador(), {
        empresa: {
          nombre,
          rfc,
          razon_social: formulario.razon_social.trim(),
          regimen_fiscal: formulario.regimen_fiscal.trim(),
          codigo_postal_fiscal: formulario.codigo_postal_fiscal.trim(),
          uso_cfdi: formulario.uso_cfdi.trim(),
          correo_facturacion: correoFacturacion,
          condiciones_pago: formulario.condiciones_pago.trim(),
          estado_verificacion: "en_revision",
          limite_credito_mxn: limiteCredito,
          credito_disponible_mxn: creditoDisponible,
          dias_credito: diasCredito,
          requiere_orden_compra: formulario.requiere_orden_compra
        },
        titular: {
          nombre: titularNombre,
          telefono: formulario.titular_telefono.trim(),
          correo_facturacion: titularCorreo,
          estado_verificacion: "verificado",
          metodo_pago_registrado: formulario.metodo_pago_registrado
        }
      });
      setFormulario(FORM_INICIAL);
      setMostrarFormulario(false);
      setMensaje({ tono: "info", texto: "Empresa corporativa creada con fiscal, titular, crédito y condiciones versionadas." });
      await cargar();
    } catch (error) {
      setMensaje({ tono: "danger", texto: error instanceof Error ? error.message : "No se pudo crear la empresa." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Gestión"
        titulo="Empresas"
        descripcion="Operación corporativa con RFC único, titulares, permisos, flota, conductores, condiciones comerciales, documentos, crédito y aprobaciones."
        estadoConexion={estadoConexion}
        ultimaActualizacion={ultimaActualizacion}
        tipoDatos="administrativos"
        contadorResultados={datos.empresas.length}
        accion={(
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="secondary" loading={actualizandoManual} onClick={() => void cargar(true)}>
              Actualizar
            </AdminButton>
            <AdminButton
              variant={mostrarFormulario ? "secondary" : undefined}
              disabled={!puedeGestionarEmpresas}
              onClick={() => setMostrarFormulario((actual) => !actual)}
            >
              {mostrarFormulario ? "Cerrar alta" : "Crear empresa"}
            </AdminButton>
          </div>
        )}
      />

      {mensaje && <div className="mt-4"><Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso></div>}
      {esDemo && <div className="mt-4"><Aviso tono="info">Estás viendo el módulo sin datos reales de Supabase. No se muestran fixtures demo.</Aviso></div>}
      {!esDemo && !cargando && !puedeGestionarEmpresas && (
        <div className="mt-4">
          <Aviso tono="atencion">Tu rol puede consultar empresas, pero el alta requiere permiso empresas:gestionar.</Aviso>
        </div>
      )}
      {errorCarga && <div className="mt-4"><AdminErrorState description={errorCarga} action={<AdminButton variant="secondary" onClick={() => void cargar(true)}>Reintentar</AdminButton>} /></div>}

      {mostrarFormulario && (
        <AdminPanel className="mt-6 p-5 sm:p-6">
          <div className="grid gap-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Alta corporativa</p>
                <h2 className="mt-1 font-display text-lg font-semibold text-ink">Crear empresa</h2>
                <p className="mt-1 max-w-3xl font-body text-sm text-text-secondary">
                  Captura fiscal controlada para evitar errores administrativos antes de solicitar aprobación.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="quiet" onClick={() => setFormulario(FORM_INICIAL)} disabled={guardando}>Limpiar</AdminButton>
                <AdminButton variant="secondary" onClick={() => setMostrarFormulario(false)} disabled={guardando}>Cerrar alta</AdminButton>
                <AdminButton onClick={crearEmpresa} loading={guardando} disabled={rfcDuplicado || formularioIncompleto || esDemo || !puedeGestionarEmpresas}>Guardar empresa</AdminButton>
              </div>
            </div>

            <datalist id="regimenes-fiscales-empresa">
              {REGIMENES_FISCALES.map((opcion) => <option key={opcion} value={opcion} />)}
            </datalist>
            <datalist id="usos-cfdi-empresa">
              {USOS_CFDI.map((opcion) => <option key={opcion} value={opcion} />)}
            </datalist>
            <datalist id="condiciones-pago-empresa">
              {CONDICIONES_PAGO.map((opcion) => <option key={opcion} value={opcion} />)}
            </datalist>

            <SeccionAlta titulo="Información de la empresa">
              <CampoAlta label="Nombre comercial" value={formulario.nombre} onChange={(valor) => actualizarCampo("nombre", valor)} placeholder="Ruum corporativo" className="md:col-span-3" autoComplete="organization" />
              <CampoAlta label="Razón social" value={formulario.razon_social} onChange={(valor) => actualizarCampo("razon_social", valor)} placeholder="Razón social completa" className="md:col-span-3" />
            </SeccionAlta>

            <SeccionAlta titulo="Datos fiscales">
              <CampoAlta
                label="RFC"
                value={formulario.rfc}
                onChange={(valor) => actualizarCampo("rfc", normalizarRfc(valor))}
                placeholder="ABC010203AB1"
                className="md:col-span-2"
                ayuda={`${formulario.rfc.length}/13 caracteres`}
                error={formulario.rfc && formulario.rfc.length !== 12 && formulario.rfc.length !== 13 ? "Debe tener 12 o 13 caracteres." : rfcDuplicado ? "Ya existe una empresa con este RFC." : null}
              />
              <CampoAlta label="Régimen fiscal" value={formulario.regimen_fiscal} onChange={(valor) => actualizarCampo("regimen_fiscal", valor)} placeholder="Buscar régimen" className="md:col-span-4" list="regimenes-fiscales-empresa" />
              <CampoAlta label="CP fiscal" value={formulario.codigo_postal_fiscal} onChange={(valor) => actualizarCampo("codigo_postal_fiscal", soloNumeros(valor, 5))} placeholder="00000" className="md:col-span-2" inputMode="numeric" />
              <CampoAlta label="Uso CFDI" value={formulario.uso_cfdi} onChange={(valor) => actualizarCampo("uso_cfdi", valor)} placeholder="Buscar uso CFDI" className="md:col-span-2" list="usos-cfdi-empresa" />
              <CampoAlta label="Condiciones de pago" value={formulario.condiciones_pago} onChange={(valor) => actualizarCampo("condiciones_pago", valor)} placeholder="Seleccionar condición" className="md:col-span-2" list="condiciones-pago-empresa" />
              <CampoAlta label="Límite de crédito" value={formulario.limite_credito_mxn} onChange={(valor) => actualizarCampo("limite_credito_mxn", soloNumeros(valor))} placeholder="0" className="md:col-span-2" inputMode="numeric" />
              <CampoAlta label="Días de crédito" value={formulario.dias_credito} onChange={(valor) => actualizarCampo("dias_credito", soloNumeros(valor, 3))} placeholder="0" className="md:col-span-2" inputMode="numeric" />
            </SeccionAlta>

            <SeccionAlta titulo="Contacto y titular">
              <CampoAlta label="Nombre del titular" value={formulario.titular_nombre} onChange={(valor) => actualizarCampo("titular_nombre", valor)} placeholder="Nombre completo" className="md:col-span-2" autoComplete="name" />
              <CampoAlta label="Correo titular" type="email" value={formulario.titular_correo} onChange={(valor) => actualizarCampo("titular_correo", valor)} placeholder="titular@empresa.com" className="md:col-span-2" autoComplete="email" />
              <CampoAlta label="Teléfono titular" type="tel" value={formulario.titular_telefono} onChange={(valor) => actualizarCampo("titular_telefono", formatearTelefono(valor))} placeholder="(123) 456-7890" className="md:col-span-2" inputMode="tel" autoComplete="tel" />
              <CampoAlta label="Correo facturación" type="email" value={formulario.correo_facturacion} onChange={(valor) => actualizarCampo("correo_facturacion", valor)} placeholder="facturacion@empresa.com" className="md:col-span-3" autoComplete="email" ayuda="Si queda vacío se usará el correo del titular." />
            </SeccionAlta>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input type="checkbox" checked={formulario.requiere_orden_compra} onChange={(e) => actualizarCampo("requiere_orden_compra", e.target.checked)} className="size-4 rounded border-ink/30" />
                Requiere orden de compra
              </label>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="quiet" onClick={() => setFormulario(FORM_INICIAL)} disabled={guardando}>Limpiar</AdminButton>
                <AdminButton variant="secondary" onClick={() => setMostrarFormulario(false)} disabled={guardando}>Cerrar alta</AdminButton>
                <AdminButton onClick={crearEmpresa} loading={guardando} disabled={rfcDuplicado || formularioIncompleto || esDemo || !puedeGestionarEmpresas}>Guardar empresa</AdminButton>
              </div>
            </div>
          </div>
        </AdminPanel>
      )}

      {cargando ? (
        <div className="mt-6"><AdminLoadingState label="Cargando empresas" /></div>
      ) : (
        <section className="mt-6">
          {datos.empresas.length === 0 ? (
            <AdminEmptyState title="Sin empresas" description="No hay empresas registradas en la fuente real." action={<AdminButton onClick={() => setMostrarFormulario(true)}>Crear empresa</AdminButton>} />
          ) : (
            <div className="admin-table-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] font-body text-sm">
                  <caption className="sr-only">Lista de empresas registradas</caption>
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
                      <th className="left-0 z-10 bg-surface-primary px-4 py-3 sm:sticky">Empresa</th>
                      <th className="px-4 py-3">RFC</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Titular</th>
                      <th className="px-4 py-3 text-center">Usuarios</th>
                      <th className="px-4 py-3 text-center">Flota</th>
                      <th className="px-4 py-3 text-center">Conductores</th>
                      <th className="px-4 py-3 text-right">Traslados</th>
                      <th className="px-4 py-3 text-right">Crédito</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.empresas.map((empresa, indice) => {
                      const usuarios = usuariosPorEmpresa.get(empresa.id) ?? [];
                      const vehiculos = vehiculosPorEmpresa.get(empresa.id) ?? [];
                      const conductores = conductoresPorEmpresa.get(empresa.id) ?? [];
                      const documentos = documentosPorEmpresa.get(empresa.id) ?? [];
                      const viajes = viajesPorEmpresa.get(empresa.id) ?? [];
                      const versionesFiscales = fiscalPorEmpresa.get(empresa.id) ?? [];
                      const versionesCondiciones = condicionesPorEmpresa.get(empresa.id) ?? [];
                      const cambios = cambiosPorEmpresa.get(empresa.id) ?? [];
                      const cambiosPendientes = cambios.filter((cambio) => cambio.estado === "pendiente");
                      const titular = usuarios.find((usuario) => usuario.rol === "titular_empresa");
                      const abierta = empresaAbiertaId === empresa.id;
                      const fondoFila = indice % 2 === 1 ? "bg-surface-secondary/45" : "bg-surface-primary";
                      const fondoSticky = indice % 2 === 1 ? "bg-surface-secondary" : "bg-surface-primary";
                      return (
                        <Fragment key={empresa.id}>
                          <tr className={`border-b border-ink/5 ${fondoFila}`}>
                            <td data-label="Empresa" className={`left-0 z-[1] px-4 py-4 sm:sticky ${fondoSticky}`}>
                              <button
                                type="button"
                                onClick={() => setEmpresaAbiertaId((actual) => actual === empresa.id ? null : empresa.id)}
                                className="text-left font-semibold text-ink hover:text-focus-default hover:underline"
                              >
                                {empresa.nombre}
                              </button>
                              <p className="mt-1 max-w-[280px] truncate text-xs text-text-secondary" title={empresa.razon_social ?? empresa.nombre}>{empresa.razon_social ?? "Sin razón social"}</p>
                            </td>
                            <td data-label="RFC" className="px-4 py-4 font-mono-ruum text-xs text-text-secondary">{empresa.rfc ?? "Pendiente"}</td>
                            <td data-label="Estado" className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <Badge estado={empresa.estado_operativo} texto={textoEstadoOperativo(empresa.estado_operativo)} />
                                {cambiosPendientes.length > 0 ? (
                                  <Badge estado="pendiente" texto="Cambios pendientes" />
                                ) : (
                                  <Badge estado={empresa.estado_verificacion} />
                                )}
                              </div>
                            </td>
                            <td data-label="Titular" className="px-4 py-4">
                              <p className="font-medium text-ink">{titular?.nombre ?? "No registrado"}</p>
                              <p className="mt-1 max-w-[220px] truncate text-xs text-text-secondary" title={titular?.correo_facturacion ?? undefined}>{titular?.correo_facturacion ?? "Sin correo"}</p>
                            </td>
                            <td data-label="Usuarios" className="px-4 py-4 text-center font-mono-ruum">{usuarios.length}</td>
                            <td data-label="Flota" className="px-4 py-4 text-center font-mono-ruum">{vehiculos.length}</td>
                            <td data-label="Conductores" className="px-4 py-4 text-center font-mono-ruum">{conductores.length}</td>
                            <td data-label="Traslados" className="px-4 py-4 text-right font-mono-ruum">{viajes.length}</td>
                            <td data-label="Crédito" className="px-4 py-4 text-right">
                              <p className="font-mono-ruum font-semibold">{moneda(empresa.limite_credito_mxn)}</p>
                              <p className="mt-1 text-xs text-text-tertiary">{empresa.dias_credito ?? 0} días</p>
                            </td>
                            <td data-label="Acciones" className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEmpresaAbiertaId((actual) => actual === empresa.id ? null : empresa.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-ink/20 px-3 py-1.5 font-body text-xs font-semibold text-ink hover:bg-ink/5"
                                  aria-expanded={abierta}
                                  aria-controls={`detalle-empresa-${empresa.id}`}
                                >
                                  <span aria-hidden="true">✎</span> {abierta ? "Ocultar" : "Gestionar"}
                                </button>
                                <button type="button" className="rounded-md border border-ink/20 px-2.5 py-1.5 font-body text-xs font-semibold text-text-secondary opacity-60" aria-label={`Acciones rápidas para ${empresa.nombre}`}>...</button>
                              </div>
                            </td>
                          </tr>
                          {abierta && (
                            <tr className="border-b border-ink/10 bg-surface-primary">
                              <td colSpan={10} className="px-4 py-5">
                                <div id={`detalle-empresa-${empresa.id}`} className="rounded-lg border border-border-default bg-surface-primary p-5">
                                  {cambiosPendientes.length > 0 && (
                                    <div className="mb-4 rounded-lg border border-status-warning/35 bg-status-warning-soft px-4 py-3">
                                      <p className="font-body text-sm font-semibold text-status-warning">Cambios pendientes de aprobación</p>
                                      <p className="mt-1 font-body text-sm text-text-secondary">Estado operativo principal: {textoEstadoOperativo(empresa.estado_operativo)}. Los cambios fiscales se revisan en la pestaña Fiscal y facturación.</p>
                                    </div>
                                  )}
                                  <AccionesEmpresa
                                    empresa={empresa}
                                    usuarios={usuarios}
                                    vehiculos={vehiculos}
                                    conductores={conductores}
                                    documentos={documentos}
                                    viajes={viajes}
                                    versionesFiscales={versionesFiscales}
                                    versionesCondiciones={versionesCondiciones}
                                    cambiosPendientes={cambiosPendientes}
                                    onActualizado={() => void cargar(true)}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
