"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { AdminButton, AdminEmptyState, AdminErrorState, AdminLoadingState } from "../admin-components";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];
type CambioSensible = Database["public"]["Tables"]["empresas_cambios_sensibles"]["Row"];

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

const RFC_MEXICO = /^([A-Z&Ñ]{3}|[A-Z&Ñ]{4})\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/;

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

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">{etiqueta}</dt>
      <dd className="mt-1 font-body text-sm font-medium text-ink">{valor || "Pendiente"}</dd>
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
  cambiosPendientes,
  onActualizado
}: {
  empresa: Empresa;
  cambiosPendientes: CambioSensible[];
  onActualizado: () => void;
}) {
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

  return (
    <div className="mt-5 grid gap-4 border-t border-ink/10 pt-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Edición y cambios sensibles</p>
            <Badge estado={rfcValido ? "verificado" : "rechazado"} texto={rfcValido ? "RFC formal válido" : "RFC inválido"} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Nombre comercial" />
            <input value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="RFC" />
            <input value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Razón social" />
            <input value={form.correo_facturacion} onChange={(e) => setForm({ ...form, correo_facturacion: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Correo facturación" />
            <input value={form.regimen_fiscal} onChange={(e) => setForm({ ...form, regimen_fiscal: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Régimen fiscal" />
            <input value={form.codigo_postal_fiscal} onChange={(e) => setForm({ ...form, codigo_postal_fiscal: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="CP fiscal" />
            <input value={form.uso_cfdi} onChange={(e) => setForm({ ...form, uso_cfdi: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Uso CFDI" />
            <input value={form.condiciones_pago} onChange={(e) => setForm({ ...form, condiciones_pago: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Condiciones de pago" />
            <input type="number" min="0" value={form.limite_credito_mxn} onChange={(e) => setForm({ ...form, limite_credito_mxn: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Límite crédito" />
            <input type="number" min="0" value={form.dias_credito} onChange={(e) => setForm({ ...form, dias_credito: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Días crédito" />
          </div>
          <label className="flex items-center gap-2 font-body text-sm">
            <input type="checkbox" checked={form.requiere_orden_compra} onChange={(e) => setForm({ ...form, requiere_orden_compra: e.target.checked })} className="size-4 rounded border-ink/30" />
            Requiere orden de compra
          </label>
          <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Motivo del cambio" />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="quiet"
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

        <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Suspensión y reactivación</p>
          <textarea value={motivoEstado} onChange={(e) => setMotivoEstado(e.target.value)} className="min-h-20 rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Motivo obligatorio" />
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" disabled={pendiente} onClick={() => ejecutar(() => cambiarEstadoEmpresaAdmin(crearClienteNavegador(), empresa.id, "suspendida", motivoEstado).then(() => undefined), "Empresa suspendida.")}>Suspender</Button>
            <Button variant="quiet" disabled={pendiente} onClick={() => ejecutar(() => cambiarEstadoEmpresaAdmin(crearClienteNavegador(), empresa.id, "activa", motivoEstado).then(() => undefined), "Empresa reactivada.")}>Reactivar</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Usuarios, titulares y permisos</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={usuario.rol} onChange={(e) => setUsuario({ ...usuario, rol: e.target.value as "titular_empresa" | "usuario_autorizado" })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
              <option value="titular_empresa">Titular</option>
              <option value="usuario_autorizado">Usuario autorizado</option>
            </select>
            <input value={usuario.nombre} onChange={(e) => setUsuario({ ...usuario, nombre: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Nombre" />
            <input value={usuario.correo_facturacion} onChange={(e) => setUsuario({ ...usuario, correo_facturacion: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Correo" />
            <input value={usuario.telefono} onChange={(e) => setUsuario({ ...usuario, telefono: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Teléfono" />
          </div>
          <label className="flex items-center gap-2 font-body text-sm">
            <input type="checkbox" checked={usuario.metodo_pago_registrado} onChange={(e) => setUsuario({ ...usuario, metodo_pago_registrado: e.target.checked })} className="size-4 rounded border-ink/30" />
            Puede operar pago corporativo
          </label>
          <Button variant="quiet" disabled={pendiente} onClick={() => ejecutar(() => guardarUsuarioEmpresaAdmin(crearClienteNavegador(), empresa.id, usuario).then(() => undefined), "Usuario empresarial guardado.")}>Guardar usuario</Button>
        </div>

        <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Contratos y documentos con vigencia</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={documento.tipo} onChange={(e) => setDocumento({ ...documento, tipo: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Tipo" />
            <input value={documento.nombre} onChange={(e) => setDocumento({ ...documento, nombre: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Nombre" />
            <input value={documento.folio} onChange={(e) => setDocumento({ ...documento, folio: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Folio" />
            <input value={documento.url} onChange={(e) => setDocumento({ ...documento, url: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="URL privada" />
            <input type="date" value={documento.vigente_desde} onChange={(e) => setDocumento({ ...documento, vigente_desde: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
            <input type="date" value={documento.vigente_hasta} onChange={(e) => setDocumento({ ...documento, vigente_hasta: e.target.value })} className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
          </div>
          <Button variant="quiet" disabled={pendiente} onClick={() => ejecutar(() => guardarDocumentoEmpresaAdmin(crearClienteNavegador(), empresa.id, documento).then(() => undefined), "Documento registrado.")}>Registrar documento</Button>
        </div>
      </div>

      {cambiosPendientes.length > 0 && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning-soft p-4">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-status-warning">Aprobaciones pendientes</p>
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
  const [formulario, setFormulario] = useState(FORM_INICIAL);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "danger" | "atencion"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  async function cargar(manual = false) {
    if (manual) setActualizandoManual(true);
    else setCargando(true);

    if (!tieneSupabaseConfigurado()) {
      setDatos(DATOS_DEMO);
      setEsDemo(true);
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
      setDatos(await listarEmpresasAdmin(cliente));
      setEsDemo(false);
      setEstadoConexion("datos_en_vivo");
      setUltimaActualizacion(new Date());
    } catch {
      if (puedeUsarDatosDemo()) {
        setDatos(DATOS_DEMO);
        setEsDemo(true);
        setErrorCarga(null);
        setEstadoConexion("demo");
        setUltimaActualizacion(new Date());
      } else {
        setDatos(DATOS_DEMO);
        setEsDemo(false);
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

  function actualizarCampo(campo: keyof typeof FORM_INICIAL, valor: string | boolean) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function crearEmpresa() {
    setMensaje(null);
    const rfc = formulario.rfc.trim().toUpperCase();
    if (!RFC_MEXICO.test(rfc)) {
      setMensaje({ tono: "danger", texto: "Captura un RFC mexicano formalmente válido." });
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

    setGuardando(true);
    try {
      await crearEmpresaCorporativaAdmin(crearClienteNavegador(), {
        empresa: {
          nombre: formulario.nombre,
          rfc,
          razon_social: formulario.razon_social,
          regimen_fiscal: formulario.regimen_fiscal,
          codigo_postal_fiscal: formulario.codigo_postal_fiscal,
          uso_cfdi: formulario.uso_cfdi,
          correo_facturacion: formulario.correo_facturacion || formulario.titular_correo,
          condiciones_pago: formulario.condiciones_pago,
          estado_verificacion: "en_revision",
          limite_credito_mxn: Number(formulario.limite_credito_mxn || 0),
          credito_disponible_mxn: Number(formulario.credito_disponible_mxn || formulario.limite_credito_mxn || 0),
          dias_credito: Number(formulario.dias_credito || 0),
          requiere_orden_compra: formulario.requiere_orden_compra
        },
        titular: {
          nombre: formulario.titular_nombre,
          telefono: formulario.titular_telefono,
          correo_facturacion: formulario.titular_correo,
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
            <AdminButton onClick={() => setMostrarFormulario((actual) => !actual)}>
              {mostrarFormulario ? "Cerrar alta" : "Crear empresa"}
            </AdminButton>
          </div>
        )}
      />

      {mensaje && <div className="mt-4"><Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso></div>}
      {esDemo && <div className="mt-4"><Aviso tono="info">Estás viendo el módulo sin datos reales de Supabase. No se muestran fixtures demo.</Aviso></div>}
      {errorCarga && <div className="mt-4"><AdminErrorState description={errorCarga} action={<AdminButton variant="secondary" onClick={() => void cargar(true)}>Reintentar</AdminButton>} /></div>}

      {mostrarFormulario && (
        <AdminPanel className="mt-6 p-5 sm:p-6">
          <div className="grid gap-5">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Alta corporativa</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-ink">Datos fiscales, titular y crédito real</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input value={formulario.nombre} onChange={(e) => actualizarCampo("nombre", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Nombre comercial" />
              <input value={formulario.rfc} onChange={(e) => actualizarCampo("rfc", e.target.value.toUpperCase())} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="RFC" />
              <input value={formulario.razon_social} onChange={(e) => actualizarCampo("razon_social", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Razón social" />
              <input type="email" value={formulario.correo_facturacion} onChange={(e) => actualizarCampo("correo_facturacion", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Correo facturación" />
              <input value={formulario.regimen_fiscal} onChange={(e) => actualizarCampo("regimen_fiscal", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Régimen fiscal" />
              <input value={formulario.codigo_postal_fiscal} onChange={(e) => actualizarCampo("codigo_postal_fiscal", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="CP fiscal" />
              <input value={formulario.uso_cfdi} onChange={(e) => actualizarCampo("uso_cfdi", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Uso CFDI" />
              <input value={formulario.condiciones_pago} onChange={(e) => actualizarCampo("condiciones_pago", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Condiciones de pago" />
              <input type="number" min="0" value={formulario.limite_credito_mxn} onChange={(e) => actualizarCampo("limite_credito_mxn", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Límite crédito" />
              <input type="number" min="0" value={formulario.dias_credito} onChange={(e) => actualizarCampo("dias_credito", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Días crédito" />
            </div>

            <div className="grid gap-4 border-t border-ink/10 pt-5 md:grid-cols-3">
              <input value={formulario.titular_nombre} onChange={(e) => actualizarCampo("titular_nombre", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Titular" />
              <input type="email" value={formulario.titular_correo} onChange={(e) => actualizarCampo("titular_correo", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Correo titular" />
              <input value={formulario.titular_telefono} onChange={(e) => actualizarCampo("titular_telefono", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Teléfono titular" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input type="checkbox" checked={formulario.requiere_orden_compra} onChange={(e) => actualizarCampo("requiere_orden_compra", e.target.checked)} className="size-4 rounded border-ink/30" />
                Requiere orden de compra
              </label>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="quiet" onClick={() => setFormulario(FORM_INICIAL)} disabled={guardando}>Limpiar</AdminButton>
                <AdminButton onClick={crearEmpresa} loading={guardando} disabled={rfcDuplicado}>Guardar empresa</AdminButton>
              </div>
            </div>
          </div>
        </AdminPanel>
      )}

      {cargando ? (
        <div className="mt-6"><AdminLoadingState label="Cargando empresas" /></div>
      ) : (
        <section className="mt-6 grid gap-4">
          {datos.empresas.length === 0 ? (
            <AdminEmptyState title="Sin empresas" description="No hay empresas registradas en la fuente real." action={<AdminButton onClick={() => setMostrarFormulario(true)}>Crear empresa</AdminButton>} />
          ) : (
            datos.empresas.map((empresa) => {
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
              const autorizado = usuarios.find((usuario) => usuario.rol === "usuario_autorizado");
              return (
                <AdminPanel key={empresa.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Cuenta empresarial</p>
                      <h2 className="mt-1 font-display text-xl font-semibold">{empresa.nombre}</h2>
                      <p className="mt-1 font-body text-sm text-text-secondary">{empresa.razon_social ?? empresa.nombre} · RFC {empresa.rfc ?? "pendiente"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge estado={empresa.estado_verificacion} />
                      <Badge estado={empresa.estado_operativo} texto={empresa.estado_operativo === "suspendida" ? "Suspendida" : "Activa"} />
                      {cambiosPendientes.length > 0 && <Badge estado="pendiente" texto={`${cambiosPendientes.length} por aprobar`} />}
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Dato etiqueta="Titular" valor={titular?.nombre ?? titular?.correo_facturacion} />
                    <Dato etiqueta="Usuario autorizado" valor={autorizado?.nombre ?? autorizado?.correo_facturacion} />
                    <Dato etiqueta="Flota" valor={`${vehiculos.length} vehículos`} />
                    <Dato etiqueta="Conductores" valor={`${conductores.length} conductores`} />
                    <Dato etiqueta="Traslados" valor={`${viajes.length} traslados`} />
                    <Dato etiqueta="Límite crédito" valor={moneda(empresa.limite_credito_mxn)} />
                    <Dato etiqueta="Crédito disponible" valor={moneda(empresa.credito_disponible_mxn)} />
                    <Dato etiqueta="Pago real" valor={`${empresa.dias_credito ?? 0} días · ${empresa.requiere_orden_compra ? "con OC" : "sin OC"}`} />
                    <Dato etiqueta="Tarifas" valor={versionesCondiciones.length > 0 ? "Condiciones versionadas" : "Tarifa normativa"} />
                    <Dato etiqueta="Facturación" valor={empresa.correo_facturacion ?? titular?.correo_facturacion} />
                  </dl>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-lg border border-ink/10 p-4">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Documentos vigentes</p>
                      <div className="mt-3 grid gap-2 font-body text-sm">
                        {documentos.length === 0 ? <span className="text-text-secondary">Sin documentos registrados</span> : documentos.slice(0, 3).map((doc) => (
                          <span key={doc.id}>{doc.nombre} · vence {fecha(doc.vigente_hasta)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-ink/10 p-4">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Versiones fiscales</p>
                      <div className="mt-3 grid gap-2 font-body text-sm">
                        {versionesFiscales.length === 0 ? <span className="text-text-secondary">Sin versiones</span> : versionesFiscales.slice(0, 3).map((version) => (
                          <span key={version.id}>v{version.version} · {version.rfc} · desde {fecha(version.vigente_desde)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-ink/10 p-4">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Historial sensible</p>
                      <div className="mt-3 grid gap-2 font-body text-sm">
                        {cambios.length === 0 ? <span className="text-text-secondary">Sin cambios sensibles</span> : cambios.slice(0, 3).map((cambio) => (
                          <span key={cambio.id}>{cambio.tipo.replaceAll("_", " ")} · {cambio.estado} · {fecha(cambio.solicitado_en)}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <AccionesEmpresa empresa={empresa} cambiosPendientes={cambiosPendientes} onActualizado={() => void cargar(true)} />
                </AdminPanel>
              );
            })
          )}
        </section>
      )}
    </main>
  );
}
