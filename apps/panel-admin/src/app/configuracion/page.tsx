"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  actualizarConfiguracionAdmin,
  actualizarRolColaboradorAdmin,
  concederCapacidadAdmin,
  listarConfiguracionAdmin,
  listarCatalogoCapacidades,
  listarCapacidadesAdmin,
  listarColaboradoresAdmin,
  type AdminColaborador,
  type CapacidadAdmin,
  type ConfiguracionAdmin
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { CONFIG_ROL_ADMIN, type RolAdminOperativo } from "../../lib/roles-admin";
import { AdminPageHeader } from "../admin-ui";
import {
  AdminBadge,
  AdminButton,
  AdminDialog,
  AdminErrorState,
  AdminInput,
  AdminLoadingState,
  AdminSelect,
  AdminTextarea
} from "../admin-components";

type Resultado = { tipo: "success" | "error"; mensaje: string } | null;
type AccionCapacidad = "conceder" | "revocar";
type JsonObject = Record<string, unknown>;

const CATEGORIAS: Record<string, string> = {
  operacion: "Operación",
  comunicacion: "Comunicación",
  finanzas: "Finanzas",
  seguridad: "Seguridad"
};

const ORDEN_CATEGORIAS = ["operacion", "finanzas", "comunicacion", "seguridad"] as const;

function formatearFecha(valor: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
}

function resumenValor(valor: unknown) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return "Sin parámetros";
  const cantidad = Object.keys(valor as Record<string, unknown>).length;
  return `${cantidad} ${cantidad === 1 ? "parámetro principal" : "parámetros principales"}`;
}

export default function PaginaConfiguracionAdmin() {
  const [registros, setRegistros] = useState<ConfiguracionAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<ConfiguracionAdmin | null>(null);
  const [json, setJson] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [colaboradores, setColaboradores] = useState<AdminColaborador[]>([]);
  const [colaboradorId, setColaboradorId] = useState("");
  const [capacidades, setCapacidades] = useState<CapacidadAdmin[]>([]);
  const [catalogoCapacidades, setCatalogoCapacidades] = useState<string[]>([]);
  const [cargandoRoles, setCargandoRoles] = useState(true);
  const [errorRoles, setErrorRoles] = useState<string | null>(null);
  const [rolSeleccionado, setRolSeleccionado] = useState<RolAdminOperativo>("operador");
  const [motivoRol, setMotivoRol] = useState("");
  const [guardandoRol, setGuardandoRol] = useState(false);
  const [dialogoCapacidad, setDialogoCapacidad] = useState(false);
  const [capacidadSeleccionada, setCapacidadSeleccionada] = useState("");
  const [accionCapacidad, setAccionCapacidad] = useState<AccionCapacidad>("conceder");
  const [motivoCapacidad, setMotivoCapacidad] = useState("");
  const [guardandoCapacidad, setGuardandoCapacidad] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    setCargando(true);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      setRegistros(await listarConfiguracionAdmin(cliente));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la configuración.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const cargarRolesCapacidades = useCallback(async () => {
    setErrorRoles(null);
    setCargandoRoles(true);
    if (!tieneSupabaseConfigurado()) {
      setErrorRoles("Supabase no está configurado en este entorno.");
      setCargandoRoles(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [colaboradoresData, catalogoData] = await Promise.all([
        listarColaboradoresAdmin(cliente),
        listarCatalogoCapacidades(cliente)
      ]);
      setColaboradores(colaboradoresData);
      setCatalogoCapacidades(catalogoData);
      setColaboradorId((actual) => actual || colaboradoresData[0]?.id || "");
    } catch (e) {
      setErrorRoles(e instanceof Error ? e.message : "No se pudo cargar roles y capacidades.");
      setColaboradores([]);
      setCatalogoCapacidades([]);
    } finally {
      setCargandoRoles(false);
    }
  }, []);

  const cargarCapacidades = useCallback(async (adminId: string) => {
    if (!adminId || !tieneSupabaseConfigurado()) {
      setCapacidades([]);
      return;
    }
    try {
      setCapacidades(await listarCapacidadesAdmin(crearClienteNavegador(), adminId));
    } catch (e) {
      setErrorRoles(e instanceof Error ? e.message : "No se pudieron cargar las capacidades efectivas.");
      setCapacidades([]);
    }
  }, []);

  useEffect(() => { void cargarRolesCapacidades(); }, [cargarRolesCapacidades]);

  useEffect(() => {
    const colaborador = colaboradores.find((item) => item.id === colaboradorId);
    if (colaborador) setRolSeleccionado(colaborador.rol_operativo);
    setMotivoRol("");
    void cargarCapacidades(colaboradorId);
  }, [colaboradorId, colaboradores, cargarCapacidades]);

  const agrupados = useMemo(() => {
    return registros.reduce<Record<string, ConfiguracionAdmin[]>>((acc, registro) => {
      (acc[registro.categoria] ??= []).push(registro);
      return acc;
    }, {});
  }, [registros]);
  const colaboradorSeleccionado = colaboradores.find((item) => item.id === colaboradorId) ?? null;
  const rolBase = CONFIG_ROL_ADMIN[rolSeleccionado];
  const capacidadesCatalogoFiltradas = catalogoCapacidades.filter((capacidad) => capacidad !== "capacidades:administrar");

  function abrirEditor(registro: ConfiguracionAdmin) {
    setEditando(registro);
    setJson(JSON.stringify(registro.valor, null, 2));
    setMotivo("");
    setJsonError(null);
    setResultado(null);
  }

  async function guardar() {
    if (!editando) return;
    let valor: unknown;
    try {
      valor = JSON.parse(json);
      if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        throw new Error("El valor raíz debe ser un objeto JSON.");
      }
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "JSON inválido.");
      return;
    }
    if (motivo.trim().length < 10) return;

    setGuardando(true);
    try {
      const actualizado = await actualizarConfiguracionAdmin(
        crearClienteNavegador(), editando.clave, valor, motivo.trim(), editando.version
      );
      setRegistros((actuales) => actuales.map((r) => r.clave === actualizado.clave ? actualizado : r));
      setEditando(null);
      setResultado({ tipo: "success", mensaje: `${actualizado.nombre} se actualizó y quedó registrada en auditoría.` });
    } catch (e) {
      setResultado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo guardar la configuración." });
    } finally {
      setGuardando(false);
    }
  }

  async function guardarRolColaborador() {
    if (!colaboradorId || motivoRol.trim().length < 10) return;
    setGuardandoRol(true);
    setResultado(null);
    try {
      const actualizado = await actualizarRolColaboradorAdmin(crearClienteNavegador(), colaboradorId, rolSeleccionado, motivoRol.trim());
      setColaboradores((actuales) => actuales.map((item) => item.id === actualizado.id ? actualizado : item));
      setMotivoRol("");
      setResultado({ tipo: "success", mensaje: `Rol operativo actualizado para ${actualizado.nombre}.` });
      await cargarCapacidades(actualizado.id);
    } catch (e) {
      setResultado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo actualizar el rol operativo." });
    } finally {
      setGuardandoRol(false);
    }
  }

  function abrirDialogoCapacidad(capacidad = "", accion: AccionCapacidad = "conceder") {
    setCapacidadSeleccionada(capacidad);
    setAccionCapacidad(accion);
    setMotivoCapacidad("");
    setDialogoCapacidad(true);
  }

  async function guardarCapacidad() {
    if (!colaboradorId || !capacidadSeleccionada || motivoCapacidad.trim().length < 10) return;
    setGuardandoCapacidad(true);
    setResultado(null);
    try {
      await concederCapacidadAdmin(
        crearClienteNavegador(),
        colaboradorId,
        capacidadSeleccionada,
        accionCapacidad === "conceder",
        motivoCapacidad.trim()
      );
      setDialogoCapacidad(false);
      setResultado({ tipo: "success", mensaje: accionCapacidad === "conceder" ? "Capacidad concedida." : "Capacidad revocada." });
      await cargarCapacidades(colaboradorId);
    } catch (e) {
      setResultado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo configurar la capacidad." });
    } finally {
      setGuardandoCapacidad(false);
    }
  }

  if (cargando) return <main className="admin-page-shell"><AdminLoadingState label="Cargando configuración operativa" /></main>;
  if (error) return <main className="admin-page-shell"><AdminErrorState title={error} action={<AdminButton onClick={cargar}>Reintentar</AdminButton>} /></main>;

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Administración"
        titulo="Configuración"
        descripcion="Parámetros efectivos de operación, comunicación, finanzas y seguridad. Cada cambio se versiona y audita."
      />

      {resultado && (
        <div role={resultado.tipo === "error" ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 font-body text-sm ${resultado.tipo === "error" ? "border-status-error/30 bg-status-error-soft text-status-error" : "border-status-success/30 bg-status-success-soft text-status-success"}`}>
          {resultado.mensaje}
        </div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Gobierno de configuración">
        <a href="#roles-capacidades-direccion" className="rounded-2xl border border-border-default bg-surface-primary p-5 transition hover:border-signal focus:outline-none focus:ring-2 focus:ring-focus-default">
          <AdminBadge tone="warning">Acceso crítico</AdminBadge>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Roles y capacidades</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">Configura colaboradores, rol base y permisos efectivos con motivo obligatorio.</p>
        </a>
        <a href="#normativa-operativa" className="rounded-2xl border border-border-default bg-surface-primary p-5 transition hover:border-signal focus:outline-none focus:ring-2 focus:ring-focus-default">
          <AdminBadge tone="success">Cerebro normativo</AdminBadge>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Operación, finanzas, comunicación y seguridad</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">Edita políticas reales de plataforma con formularios controlados, versionado y auditoría.</p>
        </a>
      </section>

      <section className="mt-8 rounded-2xl border border-border-default bg-surface-primary p-5" aria-labelledby="roles-capacidades-direccion">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <AdminBadge tone="warning">Solo Dirección</AdminBadge>
            <h2 id="roles-capacidades-direccion" className="mt-3 font-display text-xl font-semibold text-ink">Roles y capacidades por colaborador</h2>
            <p className="mt-1 max-w-3xl font-body text-sm text-text-secondary">
              Configura el rol operativo base y los permisos efectivos de un colaborador de Torre de Control. Cada cambio exige motivo y se ejecuta por RPC auditado.
            </p>
          </div>
          <AdminButton variant="secondary" onClick={() => void cargarRolesCapacidades()} disabled={cargandoRoles}>
            Actualizar
          </AdminButton>
        </div>

        {cargandoRoles ? (
          <div className="mt-5"><AdminLoadingState label="Cargando roles y capacidades" /></div>
        ) : errorRoles ? (
          <div className="mt-5">
            <AdminErrorState title="Roles no disponibles" description={errorRoles} action={<AdminButton onClick={() => void cargarRolesCapacidades()}>Reintentar</AdminButton>} />
          </div>
        ) : (
          <div className="mt-5 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <AdminSelect
                label="Colaborador"
                description="Administrador registrado en Torre de Control."
                value={colaboradorId}
                onChange={(e) => setColaboradorId(e.target.value)}
              >
                <option value="">Seleccionar colaborador</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>{colaborador.nombre} ({colaborador.rol_operativo})</option>
                ))}
              </AdminSelect>

              {colaboradorSeleccionado && (
                <div className="rounded-xl border border-border-default bg-surface-secondary p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{colaboradorSeleccionado.nombre}</h3>
                      <p className="mt-1 font-body text-xs text-text-tertiary">Alta {formatearFecha(colaboradorSeleccionado.creado_en)}</p>
                    </div>
                    <AdminBadge tone={colaboradorSeleccionado.rol_operativo === "direccion" ? "warning" : "neutral"}>{colaboradorSeleccionado.rol_operativo}</AdminBadge>
                  </div>
                </div>
              )}

              <AdminSelect
                label="Rol operativo base"
                description="Define dashboard, navegación y permisos base."
                value={rolSeleccionado}
                onChange={(e) => setRolSeleccionado(e.target.value as RolAdminOperativo)}
                disabled={!colaboradorSeleccionado}
              >
                {Object.entries(CONFIG_ROL_ADMIN).map(([clave, rol]) => (
                  <option key={clave} value={clave}>{rol.etiqueta}</option>
                ))}
              </AdminSelect>

              <AdminTextarea
                label="Motivo del cambio de rol"
                description="Mínimo 10 caracteres; queda en auditoría de seguridad."
                value={motivoRol}
                onChange={(e) => setMotivoRol(e.target.value)}
                error={motivoRol.length > 0 && motivoRol.trim().length < 10 ? "Escribe al menos 10 caracteres." : undefined}
                rows={3}
              />

              <AdminButton
                onClick={guardarRolColaborador}
                loading={guardandoRol}
                disabled={!colaboradorSeleccionado || rolSeleccionado === colaboradorSeleccionado.rol_operativo || motivoRol.trim().length < 10}
              >
                Guardar rol
              </AdminButton>

              <div className="rounded-xl border border-border-default p-4">
                <h3 className="font-body text-sm font-semibold text-ink">Rol seleccionado</h3>
                <p className="mt-1 font-body text-sm text-text-secondary">{rolBase.descripcion}</p>
                <p className="mt-3 font-body text-xs text-text-tertiary">{rolBase.rutasPermitidas.length} rutas base · {rolBase.indicadores.length} indicadores visibles</p>
              </div>
            </aside>

            <section>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">Capacidades efectivas</h3>
                  <p className="mt-1 font-body text-sm text-text-secondary">El origen indica si la capacidad viene del rol base o de un override individual.</p>
                </div>
                <AdminButton variant="secondary" onClick={() => abrirDialogoCapacidad()} disabled={!colaboradorSeleccionado}>
                  Configurar capacidad
                </AdminButton>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] font-body text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
                      <th className="px-3 py-3">Capacidad</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3">Origen</th>
                      <th className="px-3 py-3">Motivo</th>
                      <th className="px-3 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capacidades.map((capacidad) => (
                      <tr key={capacidad.capacidad} className="border-b border-ink/5 align-top">
                        <td className="px-3 py-3 font-mono-ruum text-xs font-semibold text-ink">{capacidad.capacidad}</td>
                        <td className="px-3 py-3"><AdminBadge tone={capacidad.concedida ? "success" : "danger"}>{capacidad.concedida ? "Concedida" : "Revocada"}</AdminBadge></td>
                        <td className="px-3 py-3 text-text-secondary">{capacidad.origen === "override" ? "Override individual" : "Rol base"}</td>
                        <td className="px-3 py-3 text-text-secondary">{capacidad.motivo ?? "Sin motivo individual"}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => abrirDialogoCapacidad(capacidad.capacidad, capacidad.concedida ? "revocar" : "conceder")}
                            className="font-body text-xs font-semibold text-status-info hover:underline"
                          >
                            {capacidad.concedida ? "Revocar" : "Conceder"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {capacidades.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-text-secondary">Selecciona un colaborador para revisar sus capacidades.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>

      <div id="normativa-operativa" className="scroll-mt-24">
      {ORDEN_CATEGORIAS.filter((categoria) => agrupados[categoria]?.length).map((categoria) => (
        <section key={categoria} className="mt-8" aria-labelledby={`categoria-${categoria}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono-ruum text-admin-secundario uppercase tracking-wide text-text-tertiary">Normativa activa</p>
              <h2 id={`categoria-${categoria}`} className="font-display text-xl font-semibold text-ink">{CATEGORIAS[categoria] ?? categoria}</h2>
            </div>
            <AdminBadge tone="success">Operativo</AdminBadge>
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {(agrupados[categoria] ?? []).map((registro) => (
              <article key={registro.clave} className="rounded-2xl border border-border-default bg-surface-primary p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">{registro.nombre}</h3>
                    <p className="mt-1 font-body text-sm text-text-secondary">{registro.descripcion}</p>
                  </div>
                  <AdminBadge tone="neutral">v{registro.version}</AdminBadge>
                </div>
                <div className="mt-4 rounded-xl bg-surface-secondary px-4 py-3">
                  <ResumenNormativo claveConfig={registro.clave} valor={registro.valor} />
                  <p className="mt-1 font-body text-xs text-text-tertiary">Actualizado {formatearFecha(registro.actualizada_en)}</p>
                </div>
                <div className="mt-4 flex justify-end">
                  <AdminButton variant="secondary" onClick={() => abrirEditor(registro)}>Editar norma</AdminButton>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      </div>

      <section className="mt-8 rounded-2xl border border-border-default bg-surface-primary p-5">
        <h2 className="font-display text-xl font-semibold text-ink">Matriz efectiva de roles</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">Esta vista se genera desde la misma definición de roles que controla la navegación del panel.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(CONFIG_ROL_ADMIN).map(([clave, rol]) => (
            <article key={clave} className="rounded-xl border border-border-default p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-body text-sm font-semibold text-ink">{rol.etiqueta}</h3>
                <AdminBadge tone={clave === "direccion" ? "warning" : "neutral"}>{clave}</AdminBadge>
              </div>
              <p className="mt-2 font-body text-sm text-text-secondary">{rol.descripcion}</p>
              <p className="mt-3 font-body text-xs text-text-tertiary">{rol.rutasPermitidas.length} rutas base habilitadas</p>
            </article>
          ))}
        </div>
      </section>

      <AdminDialog
        open={dialogoCapacidad}
        title={accionCapacidad === "conceder" ? "Conceder capacidad" : "Revocar capacidad"}
        description={`${accionCapacidad === "conceder" ? "Concede" : "Revoca"} una capacidad efectiva a ${colaboradorSeleccionado?.nombre ?? "el colaborador seleccionado"}.`}
        onOpenChange={(abierto) => { if (!abierto && !guardandoCapacidad) setDialogoCapacidad(false); }}
        footer={<>
          <AdminButton variant="secondary" onClick={() => setDialogoCapacidad(false)} disabled={guardandoCapacidad}>Cancelar</AdminButton>
          <AdminButton
            onClick={guardarCapacidad}
            loading={guardandoCapacidad}
            disabled={!capacidadSeleccionada || motivoCapacidad.trim().length < 10}
            variant={accionCapacidad === "revocar" ? "danger" : "primary"}
          >
            {accionCapacidad === "conceder" ? "Confirmar concesión" : "Confirmar revocación"}
          </AdminButton>
        </>}
      >
        <div className="space-y-4">
          <AdminSelect
            label="Capacidad"
            value={capacidadSeleccionada}
            onChange={(e) => setCapacidadSeleccionada(e.target.value)}
          >
            <option value="">Seleccionar capacidad</option>
            {capacidadesCatalogoFiltradas.map((capacidad) => (
              <option key={capacidad} value={capacidad}>{capacidad}</option>
            ))}
            <option value="capacidades:administrar" disabled>capacidades:administrar (no auto-asignable)</option>
          </AdminSelect>
          <div>
            <span className="block font-body text-sm font-medium text-ink">Acción</span>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 font-body text-sm text-ink">
                <input type="radio" checked={accionCapacidad === "conceder"} onChange={() => setAccionCapacidad("conceder")} className="accent-signal" />
                Conceder
              </label>
              <label className="inline-flex items-center gap-2 font-body text-sm text-ink">
                <input type="radio" checked={accionCapacidad === "revocar"} onChange={() => setAccionCapacidad("revocar")} className="accent-signal" />
                Revocar
              </label>
            </div>
          </div>
          <AdminTextarea
            label="Motivo"
            description="Mínimo 10 caracteres; se almacena como evidencia del override."
            value={motivoCapacidad}
            onChange={(e) => setMotivoCapacidad(e.target.value)}
            error={motivoCapacidad.length > 0 && motivoCapacidad.trim().length < 10 ? "Escribe al menos 10 caracteres." : undefined}
            rows={3}
          />
        </div>
      </AdminDialog>

      <AdminDialog
        open={Boolean(editando)}
        title={editando ? `Editar ${editando.nombre}` : "Editar configuración"}
        description="El cambio se guarda en configuración normativa, con motivo obligatorio, control de versión y auditoría."
        onOpenChange={(abierto) => { if (!abierto && !guardando) setEditando(null); }}
        footer={<>
          <AdminButton variant="secondary" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</AdminButton>
          <AdminButton onClick={guardar} loading={guardando} disabled={motivo.trim().length < 10 || Boolean(jsonError)}>Guardar cambio</AdminButton>
        </>}
      >
        <div className="space-y-4">
          {editando && (
            <EditorNormativo
              registro={editando}
              json={json}
              onChange={(siguiente) => { setJson(siguiente); setJsonError(null); }}
              error={jsonError}
            />
          )}
          <AdminTextarea
            label="Motivo del cambio"
            description="Mínimo 10 caracteres; se almacenará en auditoría de seguridad."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            error={motivo.length > 0 && motivo.trim().length < 10 ? "Escribe al menos 10 caracteres." : undefined}
            rows={3}
          />
        </div>
      </AdminDialog>
    </main>
  );
}

function ResumenNormativo({ claveConfig, valor }: { claveConfig: string; valor: unknown }) {
  const config = objeto(valor);
  if (claveConfig === "metodos_pago") {
    return <p className="font-body text-sm font-semibold text-ink">{lista(config.habilitados).length} métodos activos · Pasarela {texto(config.proveedor_pasarela, "sin proveedor")}</p>;
  }
  if (claveConfig === "datos_fiscales") {
    const ruum = objeto(config.ruum);
    const requisitos = objeto(config.requisitos_cliente);
    return <p className="font-body text-sm font-semibold text-ink">Emisor {texto(ruum.rfc, "pendiente")} · {Object.keys(requisitos).length || 1} reglas fiscales de cliente</p>;
  }
  if (claveConfig === "seguridad") {
    return <p className="font-body text-sm font-semibold text-ink">Sesión {numero(config.sesion_minutos, 60)} min · Motivo mínimo {numero(config.motivo_minimo_caracteres, 10)} caracteres</p>;
  }
  if (claveConfig === "plantillas_notificacion") {
    return <p className="font-body text-sm font-semibold text-ink">{lista(config.canales).join(", ") || "Sin canales"} · Recordatorio {numero(config.recordatorio_minutos_antes, 60)} min</p>;
  }
  if (claveConfig === "zonas_operacion") {
    return <p className="font-body text-sm font-semibold text-ink">{zonas(config).length} zona(s) · Fuera de cobertura {booleano(config.permitir_fuera_cobertura) ? "permitido" : "bloqueado"}</p>;
  }
  if (claveConfig === "tipos_servicio_vehiculo") {
    return <p className="font-body text-sm font-semibold text-ink">{lista(config.servicios).length} servicios · {lista(config.vehiculos).length} tipos de vehículo</p>;
  }
  if (claveConfig === "reglas_evidencia") {
    const inicio = objeto(config.inicio);
    const entrega = objeto(config.entrega);
    return <p className="font-body text-sm font-semibold text-ink">Inicio {numero(inicio.fotos_minimas, 0)} fotos · Entrega {numero(entrega.fotos_minimas, 0)} fotos</p>;
  }
  return <p className="font-body text-sm font-semibold text-ink">{resumenValor(valor)}</p>;
}

function EditorNormativo({ registro, json, onChange, error }: {
  registro: ConfiguracionAdmin;
  json: string;
  onChange: (siguiente: string) => void;
  error: string | null;
}) {
  const config = parsearConfig(json);
  if (!config) {
    return (
      <AdminTextarea
        label="Parámetros JSON"
        description="El JSON actual no se puede interpretar; corrígelo para continuar."
        value={json}
        onChange={(e) => onChange(e.target.value)}
        error={error ?? "JSON inválido."}
        rows={14}
        spellCheck={false}
        controlClassName="font-mono-ruum text-xs"
      />
    );
  }

  const cambiar = (siguiente: JsonObject) => onChange(JSON.stringify(siguiente, null, 2));
  const setCampo = (campo: string, valor: unknown) => cambiar({ ...config, [campo]: valor });
  const setObjeto = (campo: string, subcampo: string, valor: unknown) => {
    const base = objeto(config[campo]);
    cambiar({ ...config, [campo]: { ...base, [subcampo]: valor } });
  };

  if (registro.clave === "zonas_operacion") {
    return (
      <div className="space-y-4">
        <AdminTextarea
          label="Zonas de operación"
          description="Una zona por línea: codigo | nombre | activa"
          value={zonas(config).map((zona) => `${zona.codigo} | ${zona.nombre} | ${zona.activa ? "activa" : "inactiva"}`).join("\n")}
          onChange={(e) => setCampo("zonas", parsearZonas(e.target.value))}
          rows={5}
        />
        <CheckNormativo label="Permitir solicitudes fuera de cobertura" checked={booleano(config.permitir_fuera_cobertura)} onChange={(valor) => setCampo("permitir_fuera_cobertura", valor)} />
      </div>
    );
  }

  if (registro.clave === "tipos_servicio_vehiculo") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextarea label="Servicios habilitados" description="Uno por línea." value={lista(config.servicios).join("\n")} onChange={(e) => setCampo("servicios", lineas(e.target.value))} rows={6} />
        <AdminTextarea label="Tipos de vehículo" description="Uno por línea." value={lista(config.vehiculos).join("\n")} onChange={(e) => setCampo("vehiculos", lineas(e.target.value))} rows={6} />
      </div>
    );
  }

  if (registro.clave === "reglas_evidencia") {
    const inicio = objeto(config.inicio);
    const entrega = objeto(config.entrega);
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="rounded-xl border border-border-default p-4">
          <legend className="px-1 font-body text-sm font-semibold text-ink">Inicio de traslado</legend>
          <AdminInput label="Fotos mínimas" type="number" min={0} value={numero(inicio.fotos_minimas, 4)} onChange={(e) => setObjeto("inicio", "fotos_minimas", Number(e.target.value))} />
          <CheckNormativo label="Requiere odómetro" checked={booleano(inicio.requiere_odometro)} onChange={(valor) => setObjeto("inicio", "requiere_odometro", valor)} />
        </fieldset>
        <fieldset className="rounded-xl border border-border-default p-4">
          <legend className="px-1 font-body text-sm font-semibold text-ink">Entrega</legend>
          <AdminInput label="Fotos mínimas" type="number" min={0} value={numero(entrega.fotos_minimas, 4)} onChange={(e) => setObjeto("entrega", "fotos_minimas", Number(e.target.value))} />
          <CheckNormativo label="Requiere firma" checked={booleano(entrega.requiere_firma)} onChange={(valor) => setObjeto("entrega", "requiere_firma", valor)} />
        </fieldset>
      </div>
    );
  }

  if (registro.clave === "estados_traslado") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <CheckNormativo label="Cancelación especial requiere supervisor" checked={booleano(config.cancelacion_especial_requiere_supervisor)} onChange={(valor) => setCampo("cancelacion_especial_requiere_supervisor", valor)} />
        <CheckNormativo label="Cierre con incidencia requiere aprobación" checked={booleano(config.cierre_con_incidencia_requiere_aprobacion)} onChange={(valor) => setCampo("cierre_con_incidencia_requiere_aprobacion", valor)} />
        <CheckNormativo label="Reasignación de conductor requiere motivo" checked={booleano(config.reasignacion_conductor_requiere_motivo, true)} onChange={(valor) => setCampo("reasignacion_conductor_requiere_motivo", valor)} />
        <CheckNormativo label="Bloquear cierre sin evidencias" checked={booleano(config.bloquear_cierre_sin_evidencias, true)} onChange={(valor) => setCampo("bloquear_cierre_sin_evidencias", valor)} />
      </div>
    );
  }

  if (registro.clave === "plantillas_notificacion") {
    return (
      <div className="space-y-4">
        <OpcionesChecklist label="Canales transaccionales" opciones={["push", "email", "sms", "whatsapp"]} seleccionadas={lista(config.canales)} onChange={(valor) => setCampo("canales", valor)} />
        <AdminInput label="Recordatorio antes del traslado (minutos)" type="number" min={0} value={numero(config.recordatorio_minutos_antes, 60)} onChange={(e) => setCampo("recordatorio_minutos_antes", Number(e.target.value))} />
        <CheckNormativo label="Notificar cancelaciones" checked={booleano(config.notificar_cancelacion, true)} onChange={(valor) => setCampo("notificar_cancelacion", valor)} />
        <CheckNormativo label="Notificar incidencias críticas" checked={booleano(config.notificar_incidencia_critica, true)} onChange={(valor) => setCampo("notificar_incidencia_critica", valor)} />
      </div>
    );
  }

  if (registro.clave === "metodos_pago") {
    return (
      <div className="space-y-4">
        <OpcionesChecklist
          label="Métodos aceptados"
          opciones={["tarjeta_credito", "tarjeta_debito", "transferencia", "spei", "paypal", "mercado_pago", "credito_corporativo"]}
          seleccionadas={lista(config.habilitados)}
          onChange={(valor) => setCampo("habilitados", valor)}
        />
        <AdminSelect label="Pasarela principal" value={texto(config.proveedor_pasarela, "stripe")} onChange={(e) => setCampo("proveedor_pasarela", e.target.value)}>
          <option value="stripe">Stripe</option>
          <option value="mercado_pago">Mercado Pago</option>
          <option value="paypal">PayPal</option>
          <option value="manual">Manual / Banco</option>
        </AdminSelect>
        <div className="grid gap-3 md:grid-cols-2">
          <CheckNormativo label="Requiere referencia" checked={booleano(config.requiere_referencia, true)} onChange={(valor) => setCampo("requiere_referencia", valor)} />
          <CheckNormativo label="Conciliación automática" checked={booleano(config.conciliacion_automatica)} onChange={(valor) => setCampo("conciliacion_automatica", valor)} />
          <CheckNormativo label="Permitir crédito corporativo" checked={booleano(config.permitir_credito_corporativo, true)} onChange={(valor) => setCampo("permitir_credito_corporativo", valor)} />
          <CheckNormativo label="Bloquear traslado sin pago confirmado" checked={booleano(config.bloquear_sin_pago_confirmado)} onChange={(valor) => setCampo("bloquear_sin_pago_confirmado", valor)} />
        </div>
      </div>
    );
  }

  if (registro.clave === "datos_fiscales") {
    const ruum = objeto(config.ruum);
    const requisitos = objeto(config.requisitos_cliente);
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="space-y-3 rounded-xl border border-border-default p-4">
          <legend className="px-1 font-body text-sm font-semibold text-ink">Datos fiscales de Ruum Ruum</legend>
          <AdminInput label="RFC emisor" value={texto(ruum.rfc)} onChange={(e) => setObjeto("ruum", "rfc", e.target.value.toUpperCase())} />
          <AdminInput label="Razón social" value={texto(ruum.razon_social)} onChange={(e) => setObjeto("ruum", "razon_social", e.target.value)} />
          <AdminInput label="Régimen fiscal" value={texto(ruum.regimen_fiscal)} onChange={(e) => setObjeto("ruum", "regimen_fiscal", e.target.value)} />
          <AdminInput label="Código postal fiscal" value={texto(ruum.codigo_postal_fiscal)} onChange={(e) => setObjeto("ruum", "codigo_postal_fiscal", e.target.value)} />
          <AdminInput label="Correo de facturación" type="email" value={texto(ruum.correo_facturacion)} onChange={(e) => setObjeto("ruum", "correo_facturacion", e.target.value)} />
        </fieldset>
        <fieldset className="space-y-3 rounded-xl border border-border-default p-4">
          <legend className="px-1 font-body text-sm font-semibold text-ink">Requisitos fiscales para clientes</legend>
          <CheckNormativo label="Persona física: RFC obligatorio" checked={booleano(objeto(requisitos.persona_fisica).rfc_obligatorio, true)} onChange={(valor) => setObjetoAnidado(config, cambiar, ["requisitos_cliente", "persona_fisica", "rfc_obligatorio"], valor)} />
          <CheckNormativo label="Persona física: constancia fiscal" checked={booleano(objeto(requisitos.persona_fisica).constancia_obligatoria)} onChange={(valor) => setObjetoAnidado(config, cambiar, ["requisitos_cliente", "persona_fisica", "constancia_obligatoria"], valor)} />
          <CheckNormativo label="Persona moral: razón social obligatoria" checked={booleano(objeto(requisitos.persona_moral).razon_social_obligatoria, true)} onChange={(valor) => setObjetoAnidado(config, cambiar, ["requisitos_cliente", "persona_moral", "razon_social_obligatoria"], valor)} />
          <CheckNormativo label="Persona moral: constancia fiscal" checked={booleano(objeto(requisitos.persona_moral).constancia_obligatoria, true)} onChange={(valor) => setObjetoAnidado(config, cambiar, ["requisitos_cliente", "persona_moral", "constancia_obligatoria"], valor)} />
          <CheckNormativo label="Bloquear facturación si faltan datos" checked={booleano(config.bloquear_facturacion_sin_datos, true)} onChange={(valor) => setCampo("bloquear_facturacion_sin_datos", valor)} />
        </fieldset>
      </div>
    );
  }

  if (registro.clave === "seguridad") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <AdminInput label="Duración de sesión admin (minutos)" type="number" min={15} value={numero(config.sesion_minutos, 60)} onChange={(e) => setCampo("sesion_minutos", Number(e.target.value))} />
        <AdminInput label="Motivo mínimo (caracteres)" type="number" min={10} value={numero(config.motivo_minimo_caracteres, 10)} onChange={(e) => setCampo("motivo_minimo_caracteres", Number(e.target.value))} />
        <AdminInput label="Intentos fallidos máximos" type="number" min={1} value={numero(config.intentos_fallidos_maximos, 5)} onChange={(e) => setCampo("intentos_fallidos_maximos", Number(e.target.value))} />
        <AdminInput label="Reautenticación cambios críticos (min)" type="number" min={1} value={numero(config.reautenticacion_cambios_criticos_minutos, 15)} onChange={(e) => setCampo("reautenticacion_cambios_criticos_minutos", Number(e.target.value))} />
        <CheckNormativo label="Aprobación dual para cambios críticos" checked={booleano(config.aprobacion_dual_cambios_criticos, true)} onChange={(valor) => setCampo("aprobacion_dual_cambios_criticos", valor)} />
        <CheckNormativo label="MFA requerido para Dirección" checked={booleano(config.mfa_requerido_direccion, true)} onChange={(valor) => setCampo("mfa_requerido_direccion", valor)} />
      </div>
    );
  }

  return (
    <AdminTextarea
      label="Parámetros JSON"
      description="Esta clave aún no tiene editor especializado; conserva un objeto JSON válido."
      value={json}
      onChange={(e) => onChange(e.target.value)}
      error={error ?? undefined}
      rows={14}
      spellCheck={false}
      controlClassName="font-mono-ruum text-xs"
    />
  );
}

function CheckNormativo({ label, checked, onChange }: { label: string; checked: boolean; onChange: (valor: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-border-default bg-surface-primary px-3 py-2 font-body text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-signal" />
      <span>{label}</span>
    </label>
  );
}

function OpcionesChecklist({ label, opciones, seleccionadas, onChange }: { label: string; opciones: string[]; seleccionadas: string[]; onChange: (valor: string[]) => void }) {
  const actuales = new Set(seleccionadas);
  return (
    <fieldset className="rounded-xl border border-border-default p-4">
      <legend className="px-1 font-body text-sm font-semibold text-ink">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {opciones.map((opcion) => (
          <CheckNormativo
            key={opcion}
            label={opcion.replace(/_/g, " ")}
            checked={actuales.has(opcion)}
            onChange={(activo) => {
              const siguiente = new Set(actuales);
              if (activo) siguiente.add(opcion);
              else siguiente.delete(opcion);
              onChange(Array.from(siguiente));
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function parsearConfig(json: string): JsonObject | null {
  try {
    const valor = JSON.parse(json) as unknown;
    return objeto(valor);
  } catch {
    return null;
  }
}

function objeto(valor: unknown): JsonObject {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as JsonObject : {};
}

function texto(valor: unknown, fallback = "") {
  return typeof valor === "string" ? valor : fallback;
}

function numero(valor: unknown, fallback: number) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : fallback;
}

function booleano(valor: unknown, fallback = false) {
  return typeof valor === "boolean" ? valor : fallback;
}

function lista(valor: unknown) {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : [];
}

function lineas(valor: string) {
  return valor.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function zonas(config: JsonObject) {
  const valor = config.zonas;
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => {
    const zona = objeto(item);
    return {
      codigo: texto(zona.codigo),
      nombre: texto(zona.nombre),
      activa: booleano(zona.activa, true)
    };
  }).filter((zona) => zona.codigo && zona.nombre);
}

function parsearZonas(valor: string) {
  return valor.split(/\r?\n/).map((linea) => {
    const [codigo = "", nombre = "", estado = "activa"] = linea.split("|").map((parte) => parte.trim());
    return { codigo, nombre, activa: !/^inactiva|false|0$/i.test(estado) };
  }).filter((zona) => zona.codigo && zona.nombre);
}

function setObjetoAnidado(base: JsonObject, cambiar: (siguiente: JsonObject) => void, ruta: string[], valor: unknown) {
  const [primero, segundo, tercero] = ruta;
  if (!primero || !segundo || !tercero) return;
  const nivel1 = objeto(base[primero]);
  const nivel2 = objeto(nivel1[segundo]);
  cambiar({ ...base, [primero]: { ...nivel1, [segundo]: { ...nivel2, [tercero]: valor } } });
}
