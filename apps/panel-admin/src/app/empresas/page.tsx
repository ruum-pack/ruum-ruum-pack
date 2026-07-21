"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Aviso, Button } from "@ruum/ui";
import { crearEmpresaCorporativaAdmin, listarEmpresasAdmin, validarDocumentoEmpresa, type DatosEmpresasAdmin } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader, AdminPanel } from "../admin-ui";
import { AdminButton, AdminEmptyState, AdminErrorState, AdminLoadingState } from "../admin-components";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Traslado = Database["public"]["Tables"]["traslados"]["Row"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];

const TIPOS = ["Agencia automotriz", "Lote de autos", "Arrendadora", "Flotilla", "Taller", "Aseguradora", "Grupo automotriz", "Empresa general"];
const FUTURO = ["Centros de costo", "Usuarios con permisos", "Reportes mensuales", "Tarifas especiales", "Crédito corporativo", "Aprobación interna de traslados"];

const DATOS_DEMO: DatosEmpresasAdmin = {
  empresas: [],
  usuarios: [],
  traslados: []
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
  titular_nombre: "",
  titular_telefono: "",
  titular_correo: "",
  metodo_pago_registrado: false
};

const ETIQUETA_ESTADO: Record<EstadoVerificacion, string> = {
  pendiente: "Pendiente de carga",
  en_revision: "En revisión",
  verificado: "Aprobado",
  rechazado: "Rechazado"
};

function fecha(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(fechaIso));
}

function Badge({ estado }: { estado: EstadoVerificacion }) {
  const clase =
    estado === "verificado"
      ? "border-status-success/30 bg-status-success-soft text-status-success"
      : estado === "rechazado"
        ? "border-status-error/25 bg-status-error-soft text-status-error"
        : "border-status-warning/40 bg-status-warning-soft text-status-warning";
  return <span className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${clase}`}>{ETIQUETA_ESTADO[estado]}</span>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">{etiqueta}</dt>
      <dd className="mt-1 font-body text-sm font-medium">{valor || "Pendiente"}</dd>
    </div>
  );
}

function AccionesEmpresa({ empresa, onActualizado }: { empresa: Empresa; onActualizado: () => void }) {
  const [condicionesPago, setCondicionesPago] = useState(empresa.condiciones_pago ?? "");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cambiar(estado: EstadoVerificacion) {
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await validarDocumentoEmpresa(cliente, empresa.id, estado, condicionesPago);
        setMensaje("Empresa actualizada.");
        onActualizado();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo actualizar la empresa.");
      }
    });
  }

  return (
    <div className="mt-5 grid gap-3 rounded-lg border border-ink/10 px-4 py-4">
      <label className="grid gap-1.5">
        <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Condiciones de pago</span>
        <textarea
          value={condicionesPago}
          onChange={(e) => setCondicionesPago(e.target.value)}
          className="min-h-20 rounded-lg border border-ink/50 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
          placeholder="Ej. Pago por transferencia semanal, 7 días contra factura"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="quiet" onClick={() => cambiar("verificado")} disabled={pendiente}>Aprobar RFC / CFDI</Button>
        <Button variant="quiet" onClick={() => cambiar("rechazado")} disabled={pendiente}>Rechazar</Button>
        <Button variant="quiet" onClick={() => cambiar("en_revision")} disabled={pendiente}>Solicitar actualización</Button>
        {mensaje && <span className="font-body text-sm text-text-secondary">{mensaje}</span>}
      </div>
    </div>
  );
}

type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "sin_conexion" | "demo";

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
    const timer = setTimeout(() => {
      void cargar();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const usuariosPorEmpresa = useMemo(() => {
    const mapa = new Map<string, Usuario[]>();
    for (const usuario of datos.usuarios) {
      if (!usuario.empresa_id) continue;
      mapa.set(usuario.empresa_id, [...(mapa.get(usuario.empresa_id) ?? []), usuario]);
    }
    return mapa;
  }, [datos.usuarios]);

  const viajesPorEmpresa = useMemo(() => {
    const empresaPorUsuario = new Map(datos.usuarios.filter((usuario) => usuario.empresa_id).map((usuario) => [usuario.id, usuario.empresa_id as string]));
    const mapa = new Map<string, Traslado[]>();
    for (const traslado of datos.traslados) {
      const empresaId = empresaPorUsuario.get(traslado.usuario_id);
      if (!empresaId) continue;
      mapa.set(empresaId, [...(mapa.get(empresaId) ?? []), traslado]);
    }
    return mapa;
  }, [datos.traslados, datos.usuarios]);

  function actualizarCampo(campo: keyof typeof FORM_INICIAL, valor: string | boolean) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function crearEmpresa() {
    setMensaje(null);
    if (esDemo) {
      setMensaje({ tono: "atencion", texto: "El alta de empresas requiere conexión real a Supabase." });
      return;
    }

    setGuardando(true);
    try {
      await crearEmpresaCorporativaAdmin(crearClienteNavegador(), {
        empresa: {
          nombre: formulario.nombre,
          rfc: formulario.rfc,
          razon_social: formulario.razon_social,
          regimen_fiscal: formulario.regimen_fiscal,
          codigo_postal_fiscal: formulario.codigo_postal_fiscal,
          uso_cfdi: formulario.uso_cfdi,
          correo_facturacion: formulario.correo_facturacion || formulario.titular_correo,
          condiciones_pago: formulario.condiciones_pago,
          estado_verificacion: "en_revision"
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
      setMensaje({ tono: "info", texto: "Empresa corporativa creada. Ya puede usarse como solicitante en traslados masivos." });
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
        descripcion="Alta y revisión de cuentas empresariales, titulares, condiciones de pago y datos fiscales."
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

      {mensaje && (
        <div className="mt-4">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      )}

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo el módulo sin datos reales de Supabase.</Aviso>
        </div>
      )}

      {errorCarga && (
        <div className="mt-4">
          <AdminErrorState
            description={errorCarga}
            action={(
              <AdminButton variant="secondary" onClick={() => void cargar(true)}>
                Reintentar
              </AdminButton>
            )}
          />
        </div>
      )}

      <section className="mt-6">
        <AdminPanel className="p-5">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipos de empresa</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIPOS.map((tipo) => (
              <span key={tipo} className="rounded-full border border-ink/10 px-3 py-1.5 font-body text-xs font-semibold text-text-secondary">
                {tipo}
              </span>
            ))}
          </div>
        </AdminPanel>
      </section>

      {mostrarFormulario && (
        <AdminPanel className="mt-6 p-5 sm:p-6">
          <div className="grid gap-5">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Alta corporativa</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-ink">Datos fiscales y titular</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Nombre comercial</span>
                <input value={formulario.nombre} onChange={(e) => actualizarCampo("nombre", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Flotilla Norte" />
              </label>
              <label className="grid gap-1.5">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">RFC</span>
                <input value={formulario.rfc} onChange={(e) => actualizarCampo("rfc", e.target.value.toUpperCase())} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="ABC010101AB1" />
              </label>
              <label className="grid gap-1.5">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Razón social</span>
                <input value={formulario.razon_social} onChange={(e) => actualizarCampo("razon_social", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" />
              </label>
              <label className="grid gap-1.5">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Correo facturación</span>
                <input type="email" value={formulario.correo_facturacion} onChange={(e) => actualizarCampo("correo_facturacion", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" />
              </label>
              <label className="grid gap-1.5">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Régimen fiscal</span>
                <input value={formulario.regimen_fiscal} onChange={(e) => actualizarCampo("regimen_fiscal", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" />
              </label>
              <label className="grid gap-1.5">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Código postal fiscal</span>
                <input value={formulario.codigo_postal_fiscal} onChange={(e) => actualizarCampo("codigo_postal_fiscal", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" />
              </label>
              <label className="grid gap-1.5">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Uso CFDI</span>
                <input value={formulario.uso_cfdi} onChange={(e) => actualizarCampo("uso_cfdi", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="G03" />
              </label>
              <label className="grid gap-1.5">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Condiciones de pago</span>
                <input value={formulario.condiciones_pago} onChange={(e) => actualizarCampo("condiciones_pago", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="Pago semanal contra factura" />
              </label>
            </div>

            <div className="border-t border-ink/10 pt-5">
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Titular de empresa</p>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Nombre</span>
                  <input value={formulario.titular_nombre} onChange={(e) => actualizarCampo("titular_nombre", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" />
                </label>
                <label className="grid gap-1.5">
                  <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Correo</span>
                  <input type="email" value={formulario.titular_correo} onChange={(e) => actualizarCampo("titular_correo", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" />
                </label>
                <label className="grid gap-1.5">
                  <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Teléfono</span>
                  <input value={formulario.titular_telefono} onChange={(e) => actualizarCampo("titular_telefono", e.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink" placeholder="+5255..." />
                </label>
              </div>
              <label className="mt-4 flex items-center gap-2 font-body text-sm text-ink">
                <input type="checkbox" checked={formulario.metodo_pago_registrado} onChange={(e) => actualizarCampo("metodo_pago_registrado", e.target.checked)} className="size-4 rounded border-ink/30" />
                Método de pago corporativo registrado
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <AdminButton variant="quiet" onClick={() => setFormulario(FORM_INICIAL)} disabled={guardando}>Limpiar</AdminButton>
              <AdminButton onClick={crearEmpresa} loading={guardando}>Guardar empresa</AdminButton>
            </div>
          </div>
        </AdminPanel>
      )}

      {cargando ? (
        <div className="mt-6">
          <AdminLoadingState label="Cargando empresas" />
        </div>
      ) : (
        <section className="mt-6 grid gap-4">
          {datos.empresas.length === 0 ? (
            <AdminEmptyState
              title="Sin empresas"
              description="No hay empresas registradas. Crea una cuenta corporativa para usarla en traslados masivos."
              action={(
                <AdminButton onClick={() => setMostrarFormulario(true)}>
                  Crear empresa
                </AdminButton>
              )}
            />
          ) : (
            datos.empresas.map((empresa) => {
              const usuarios = usuariosPorEmpresa.get(empresa.id) ?? [];
              const viajes = viajesPorEmpresa.get(empresa.id) ?? [];
              const titular = usuarios.find((usuario) => usuario.rol === "titular_empresa");
              const autorizado = usuarios.find((usuario) => usuario.rol === "usuario_autorizado");
              return (
                <AdminPanel key={empresa.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Cuenta empresarial</p>
                      <h2 className="mt-1 font-display text-xl font-semibold">{empresa.nombre}</h2>
                      <p className="mt-1 font-body text-sm text-text-secondary">
                        {empresa.razon_social ?? empresa.nombre} · RFC {empresa.rfc ?? "pendiente"}
                      </p>
                    </div>
                    <Badge estado={empresa.estado_verificacion} />
                  </div>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Dato etiqueta="Titular" valor={titular?.nombre ?? titular?.correo_facturacion} />
                    <Dato etiqueta="Usuario autorizado" valor={autorizado?.nombre ?? autorizado?.correo_facturacion} />
                    <Dato etiqueta="Usuarios vinculados" valor={usuarios.length} />
                    <Dato etiqueta="Historial de traslados" valor={`${viajes.length} traslados`} />
                    <Dato etiqueta="Régimen fiscal" valor={empresa.regimen_fiscal} />
                    <Dato etiqueta="Código postal fiscal" valor={empresa.codigo_postal_fiscal} />
                    <Dato etiqueta="Uso de CFDI" valor={empresa.uso_cfdi} />
                    <Dato etiqueta="Correo facturación" valor={empresa.correo_facturacion ?? titular?.correo_facturacion} />
                    <Dato etiqueta="Condiciones comerciales" valor={empresa.condiciones_pago} />
                    <Dato etiqueta="Actualizado" valor={fecha(empresa.actualizado_en)} />
                  </dl>

                  {usuarios.length > 0 && (
                    <div className="mt-5 rounded-lg border border-ink/10 px-4 py-4">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Usuarios asociados</p>
                      <div className="mt-3 grid gap-2">
                        {usuarios.map((usuario) => (
                          <div key={usuario.id} className="flex flex-col justify-between gap-1 font-body text-sm sm:flex-row">
                            <span className="font-medium">{usuario.nombre ?? usuario.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-text-secondary">
                              {usuario.rol.replaceAll("_", " ")} · {usuario.telefono ?? usuario.correo_facturacion ?? "Sin contacto"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <AccionesEmpresa empresa={empresa} onActualizado={() => void cargar(true)} />
                </AdminPanel>
              );
            })
          )}
        </section>
      )}

      <div className="mt-6">
        <Aviso tono="info">Fuera del MVP: {FUTURO.join(", ")}.</Aviso>
      </div>
    </main>
  );
}
