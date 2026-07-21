"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import { AdminPageHeader } from "../admin-ui";
import { ConfirmacionModal } from "../../components/ConfirmacionModal";
import {
  actualizarConfigTarifas,
  actualizarPoliticaTarifariaNormativa,
  obtenerConfiguracionTarifas,
  simularTarifaNormativa,
  type ActualizacionPoliticaTarifariaNormativa,
  type ConfiguracionTarifas
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

const ETIQUETA_CATEGORIA: Record<string, string> = {
  ligero_a: "Ligero A",
  ligero_b: "Ligero B",
  mediano: "Mediano",
  camion: "Camión"
};

const ETIQUETA_RANGO: Record<string, string> = {
  rango_1: "Rango 1 · hasta 15 km",
  rango_2: "Rango 2 · 16-45 km",
  rango_3: "Rango 3 · 46-75 km",
  rango_4: "Rango 4 · más de 75 km"
};

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "Borrador",
  vigente: "Vigente",
  archivada: "Archivada"
};

const SECCIONES_TARIFAS = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "base", etiqueta: "Tarifas base" },
  { id: "factores", etiqueta: "Factores" },
  { id: "simulador", etiqueta: "Simulador" },
  { id: "versiones", etiqueta: "Versiones" },
  { id: "auditoria", etiqueta: "Auditoría" }
] as const;

type SeccionTarifas = (typeof SECCIONES_TARIFAS)[number]["id"];
type SeccionParametrosTarifa = Extract<SeccionTarifas, "base" | "factores">;

const VACIO: ConfiguracionTarifas = {
  vehiculo: [],
  gama: [],
  condicion: [],
  horario: [],
  dia: [],
  config: null,
  certificacionPago: [],
  adminActualizacion: null
};

type CategoriaTarifa = ConfiguracionTarifas["vehiculo"][number]["categoria"];
type GamaTarifa = ConfiguracionTarifas["gama"][number]["gama"];
type CondicionTarifa = ConfiguracionTarifas["condicion"][number]["condicion"];
type HorarioTarifa = ConfiguracionTarifas["horario"][number]["horario"];
type DiaTarifa = ConfiguracionTarifas["dia"][number]["dia"];
type TarifaVehiculoRow = ConfiguracionTarifas["vehiculo"][number];
type TarifaConfigRow = NonNullable<ConfiguracionTarifas["config"]>;

function formatoFecha(valor?: string | null) {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
}

function fechaParaInput(valor?: string | null) {
  if (!valor) return "";
  const fecha = new Date(valor);
  const offset = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha.getTime() - offset).toISOString().slice(0, 16);
}

function fechaInputAIso(valor: string) {
  return new Date(valor).toISOString();
}

function claseEstado(estado: string) {
  if (estado === "vigente") return "border-status-success/30 bg-status-success-soft text-status-success";
  if (estado === "borrador") return "border-focus-default/30 bg-status-info-soft text-status-info";
  return "border-ink/15 bg-ink/5 text-text-secondary";
}

function CampoBorrador({
  etiqueta,
  valor,
  sufijo,
  onCambiar
}: {
  etiqueta: string;
  valor: string;
  sufijo?: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <label className="block min-w-0 font-body text-sm font-medium text-text-main">
      <span className="block">{etiqueta}</span>
      <span className="relative mt-1.5 block">
        <input
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          inputMode="decimal"
          className="block w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 pr-16 font-body text-sm text-ink shadow-sm transition-colors hover:border-ink/35 focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        />
        {sufijo && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center border-l border-ink/10 pl-3 font-mono-ruum text-xs font-medium text-text-tertiary">
            {sufijo}
          </span>
        )}
      </span>
    </label>
  );
}

function ConfirmacionImpacto({
  abierto,
  onCancelar,
  onConfirmar,
  accionLabel = "Publicar versión"
}: {
  abierto: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
  accionLabel?: string;
}) {
  const dialogoRef = useRef<HTMLDivElement | null>(null);
  const focoPrevioRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;
    focoPrevioRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialogo = dialogoRef.current;
    const primerControl = dialogo?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    window.requestAnimationFrame(() => primerControl?.focus());

    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCancelar();
    }

    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("keydown", cerrarConEscape);
      window.requestAnimationFrame(() => focoPrevioRef.current?.focus());
    };
  }, [abierto, onCancelar]);

  if (!abierto) return null;
  return (
    <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirmacion-impacto-titulo">
      <div ref={dialogoRef} className="w-full max-w-md overflow-hidden rounded-2xl border border-ink/20 bg-surface-primary shadow-[var(--ruum-shadow-4)]">
        <div className="border-b border-status-warning/20 bg-status-warning-soft px-6 py-5">
          <p className="font-mono-ruum text-xs font-medium uppercase tracking-wide text-status-warning">Publicación financiera</p>
          <h2 id="confirmacion-impacto-titulo" className="mt-1 font-display text-xl font-semibold text-ink">{accionLabel}</h2>
        </div>
        <div className="px-6 py-5">
          <p className="font-body text-sm leading-6 text-text-secondary">
            Esta acción reemplaza la versión vigente para cálculos futuros. Los traslados con precio ya cotizado conservarán su tarifa original y la publicación debe quedar registrada en auditoría con responsable, fecha y posibilidad de reversión según reglas.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="quiet" onClick={onCancelar}>Cancelar</Button>
            <Button onClick={onConfirmar}>{accionLabel}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaginaTarifasAdmin() {
  const [datos, setDatos] = useState<ConfiguracionTarifas>(VACIO);
  const [configVista, setConfigVista] = useState<TarifaConfigRow | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seccionActiva, setSeccionActiva] = useState<SeccionTarifas>("resumen");
  const [hayCambiosSinGuardar, setHayCambiosSinGuardar] = useState(false);
  const [seccionPendiente, setSeccionPendiente] = useState<SeccionTarifas | null>(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(null);

  async function cargar() {
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const configuracion = await obtenerConfiguracionTarifas(cliente);
      setDatos(configuracion);
      setConfigVista(configuracion.config);
      setUltimaSincronizacion(new Date());
      setError(configuracion.vehiculo.length === 0
        ? "No se encontró configuración de tarifas. Si no eres admin, este módulo no te mostrará datos (RLS admin-only)."
        : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la política tarifaria.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hayCambiosSinGuardar) return;
    function confirmarSalida(evento: BeforeUnloadEvent) {
      evento.preventDefault();
      evento.returnValue = "";
    }
    window.addEventListener("beforeunload", confirmarSalida);
    return () => window.removeEventListener("beforeunload", confirmarSalida);
  }, [hayCambiosSinGuardar]);

  function cambiarSeccion(siguiente: SeccionTarifas) {
    if (siguiente === seccionActiva) return;
    if (hayCambiosSinGuardar) { setSeccionPendiente(siguiente); return; }
    setSeccionActiva(siguiente);
  }

  function confirmarCambioSeccion() {
    if (!seccionPendiente) return;
    setHayCambiosSinGuardar(false);
    setSeccionActiva(seccionPendiente);
    setSeccionPendiente(null);
  }

  const cliente = tieneSupabaseConfigurado() ? crearClienteNavegador() : null;
  const datosFormula = useMemo(() => ({ ...datos, config: configVista ?? datos.config }), [configVista, datos]);
  const modoActual = seccionActiva === "base" || seccionActiva === "factores" || seccionActiva === "versiones" ? "Editando" : "Consultando";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <ConfirmacionModal abierto={seccionPendiente !== null} titulo="Descartar cambios sin guardar" confirmar={confirmarCambioSeccion} cancelar={() => setSeccionPendiente(null)} destructiva>
        Hay modificaciones sin guardar. Al cambiar de sección se descartará el borrador actual.
      </ConfirmacionModal>
      <AdminPageHeader
        etiqueta="Administración"
        titulo="Tarifas"
        descripcion="Políticas aprobadas, fórmula auditable y simulación del precio aplicable a cada traslado."
        breadcrumb={[{ label: "Administración" }, { label: "Tarifas" }]}
        estadoConexion={error ? "sin_conexion" : cargando ? "actualizando" : "conectado"}
        ultimaActualizacion={ultimaSincronizacion}
        contadorResultados={datos.vehiculo.length + datos.gama.length + datos.condicion.length + datos.horario.length + datos.dia.length}
      />

      {error && (
        <div className="mt-4">
          <Aviso tono="atencion">{error}</Aviso>
        </div>
      )}

      {cargando ? (
        <div className="mt-6 grid gap-6" aria-label="Cargando política tarifaria" aria-busy="true">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-card border border-ink/10 bg-surface-primary p-6">
              <div className="h-5 w-48 animate-pulse rounded bg-ink/10" />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((campo) => <div key={campo} className="h-12 animate-pulse rounded-lg bg-ink/5" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          <ResumenVigente datos={datos} modo={modoActual} hayCambios={hayCambiosSinGuardar} />
          <nav className="sticky top-0 z-30 -mx-2 rounded-lg border border-border-default bg-surface-primary/95 px-2 py-2 shadow-[var(--ruum-shadow-2)] backdrop-blur" aria-label="Secciones de tarifas">
            <div className="flex gap-1 overflow-x-auto">
              {SECCIONES_TARIFAS.map((seccion) => (
                <button
                  key={seccion.id}
                  type="button"
                  onClick={() => cambiarSeccion(seccion.id)}
                  aria-current={seccionActiva === seccion.id ? "page" : undefined}
                  className={[
                    "shrink-0 rounded-lg px-4 py-2.5 font-body text-sm font-semibold transition-colors",
                    seccionActiva === seccion.id ? "bg-signal text-ink" : "text-text-secondary hover:bg-surface-secondary hover:text-ink"
                  ].join(" ")}
                >
                  {seccion.etiqueta}
                </button>
              ))}
            </div>
          </nav>

          {seccionActiva === "resumen" && (
            <>
              <PrincipiosTarifarios />
              <FormulaVigente datos={datosFormula} />
            </>
          )}
          {seccionActiva === "base" && (
            <ParametrosNormativos
              key={`base-${datos.config?.actualizado_en ?? "sin-config"}`}
              seccion="base"
              datos={datos}
              cliente={cliente}
              onGuardado={cargar}
              onConfigVista={setConfigVista}
              onDirtyChange={setHayCambiosSinGuardar}
            />
          )}
          {seccionActiva === "factores" && (
            <ParametrosNormativos
              key={`factores-${datos.config?.actualizado_en ?? "sin-config"}`}
              seccion="factores"
              datos={datos}
              cliente={cliente}
              onGuardado={cargar}
              onConfigVista={setConfigVista}
              onDirtyChange={setHayCambiosSinGuardar}
            />
          )}
          {seccionActiva === "simulador" && <SimuladorNormativo datos={datos} />}
          {seccionActiva === "versiones" && (
            <PoliticaVigente
              key={datos.config?.actualizado_en ?? "sin-config"}
              datos={datos}
              cliente={cliente}
              onGuardado={cargar}
              onDirtyChange={setHayCambiosSinGuardar}
            />
          )}
          {seccionActiva === "auditoria" && <AuditoriaTarifaria datos={datos} />}
        </div>
      )}
    </main>
  );
}

function ResumenVigente({ datos, modo, hayCambios }: { datos: ConfiguracionTarifas; modo: string; hayCambios: boolean }) {
  const config = datos.config;
  return (
    <section className="sticky top-16 z-20 rounded-card border border-focus-default/25 bg-surface-primary/95 p-4 shadow-[var(--ruum-shadow-2)] backdrop-blur" aria-label="Versión vigente y modo actual">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Versión vigente siempre visible</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">{config?.nombre_version ?? "Sin versión configurada"}</h2>
          <div className="mt-2 flex flex-wrap gap-2 font-body text-xs">
            <span className={`rounded-full border px-3 py-1 font-semibold ${claseEstado(config?.estado ?? "borrador")}`}>
              {ETIQUETA_ESTADO[config?.estado ?? "borrador"] ?? config?.estado ?? "Sin estado"}
            </span>
            <span className="rounded-full border border-ink/10 bg-surface-primary px-3 py-1 text-text-secondary">
              Vigente desde {formatoFecha(config?.vigente_desde)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Modo</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{modo}</p>
          {hayCambios && <p className="mt-1 font-body text-xs font-semibold text-status-warning">Cambios sin guardar</p>}
        </div>
      </div>
    </section>
  );
}

function PrincipiosTarifarios() {
  return (
    <PassportCard acento>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Principio rector</p>
          <h2 className="mt-1 font-display text-xl font-semibold">La operación aplica tarifas; no las negocia.</h2>
          <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
            Todo precio debe salir de una política tarifaria vigente, aprobada y trazable. Si existe un acuerdo extraordinario, se convierte en regla, convenio o política con vigencia.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            "Fórmula configurable y auditable",
            "Convenios corporativos como reglas",
            "Sin precios libres en operación",
            "Historial visible para dirección"
          ].map((texto) => (
            <div key={texto} className="rounded-lg border border-ink/10 bg-ink/[0.03] px-4 py-3 font-body text-sm text-text-secondary">
              {texto}
            </div>
          ))}
        </div>
      </div>
    </PassportCard>
  );
}

function PoliticaVigente({
  datos,
  cliente,
  onGuardado,
  onDirtyChange
}: {
  datos: ConfiguracionTarifas;
  cliente: ReturnType<typeof crearClienteNavegador> | null;
  onGuardado: () => Promise<void>;
  onDirtyChange: (hayCambios: boolean) => void;
}) {
  const config = datos.config;
  const [nombre, setNombre] = useState(config?.nombre_version ?? "");
  const [estado, setEstado] = useState(config?.estado ?? "borrador");
  const [vigenteDesde, setVigenteDesde] = useState(fechaParaInput(config?.vigente_desde));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const hayCambios = Boolean(config) && (
    nombre !== (config?.nombre_version ?? "") ||
    estado !== (config?.estado ?? "borrador") ||
    vigenteDesde !== fechaParaInput(config?.vigente_desde)
  );

  useEffect(() => {
    onDirtyChange(hayCambios);
    return () => onDirtyChange(false);
  }, [hayCambios, onDirtyChange]);

  function guardar() {
    if (!cliente || !config) return;
    if (config.estado === "vigente") {
      setConfirmando(true);
      return;
    }
    guardarConfirmado();
  }

  function guardarConfirmado() {
    if (!cliente || !config) return;
    setMensaje(null);
    startTransition(async () => {
      try {
        await actualizarConfigTarifas(cliente, {
          tarifa_hora: config.tarifa_hora,
          tope_factor_variable: config.tope_factor_variable,
          nombre_version: nombre,
          estado,
          vigente_desde: fechaInputAIso(vigenteDesde),
          notas: config.notas
        });
        await onGuardado();
        onDirtyChange(false);
        setMensaje("Política actualizada.");
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo guardar la política.");
      }
    });
  }

  if (!config) {
    return (
      <PassportCard>
        <Aviso tono="atencion">No existe la fila única de configuración tarifaria.</Aviso>
      </PassportCard>
    );
  }

  return (
    <PassportCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">{config.nombre_version}</h2>
          <div className="mt-3 flex flex-wrap gap-2 font-body text-xs">
            <span className={`rounded-full border px-3 py-1 font-semibold ${claseEstado(config.estado)}`}>
              {ETIQUETA_ESTADO[config.estado]}
            </span>
            <span className="rounded-full border border-ink/10 bg-surface-primary px-3 py-1 text-text-secondary">
              Vigente desde {formatoFecha(config.vigente_desde)}
            </span>
            <span className="rounded-full border border-ink/10 bg-surface-primary px-3 py-1 text-text-secondary">
              Última modificación: {datos.adminActualizacion?.nombre ?? "Admin no identificado"} · {formatoFecha(config.actualizado_en)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_180px_220px]">
        <label className="font-body text-sm font-medium text-text-main">
          Nombre de versión
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded-lg border border-ink/25 bg-surface-primary px-3 py-2 text-sm" />
        </label>
        <label className="font-body text-sm font-medium text-text-main">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className="mt-1 w-full rounded-lg border border-ink/25 bg-surface-primary px-3 py-2 text-sm">
            <option value="borrador">Borrador</option>
            <option value="vigente">Vigente</option>
            <option value="archivada">Archivada</option>
          </select>
        </label>
        <label className="font-body text-sm font-medium text-text-main">
          Fecha de vigencia
          <input type="datetime-local" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} className="mt-1 w-full rounded-lg border border-ink/25 bg-surface-primary px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={guardar} disabled={pendiente || !hayCambios}>Guardar política</Button>
        {mensaje && <span className="font-body text-xs text-text-secondary">{mensaje}</span>}
      </div>
      <ConfirmacionImpacto
        abierto={confirmando}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          setConfirmando(false);
          guardarConfirmado();
        }}
        accionLabel={`Publicar versión ${datos.config?.nombre_version ?? "tarifaria"}`}
      />
    </PassportCard>
  );
}

function PasoFormula({
  numero,
  etiqueta,
  children
}: {
  numero: string;
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-ink/10 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex shrink-0 items-center gap-2 sm:w-40">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-info font-body text-xs font-semibold text-background-main">
          {numero}
        </span>
        <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-secondary">{etiqueta}</span>
      </div>
      <code className="font-mono-ruum text-sm leading-7 text-ink sm:text-[0.95rem]">{children}</code>
    </div>
  );
}

function Var({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-status-info">{children}</span>;
}

function Op({ children }: { children: ReactNode }) {
  return <span className="text-text-tertiary">{children}</span>;
}

function FormulaVigente({ datos }: { datos: ConfiguracionTarifas }) {
  return (
    <PassportCard>
      <h2 className="font-display text-xl font-semibold">Fórmula vigente</h2>
      <p className="mt-1 font-body text-sm text-text-secondary">Así se calcula la tarifa final que ve el usuario, paso por paso.</p>
      <div className="mt-4 overflow-hidden rounded-lg border border-ink/10 bg-surface-secondary">
        <PasoFormula numero="1" etiqueta="Base por categoría">
          <Var>Base_categoría</Var> <Op>=</Op> BaseVehículo(rango) <Op>×</Op> <Var>F_gama</Var>
        </PasoFormula>
        <PasoFormula numero="2" etiqueta="Subtotal">
          <Var>Subtotal</Var> <Op>=</Op> Base_categoría <Op>+</Op> (Distancia_km <Op>×</Op> $/km_vehículo) <Op>+</Op> (Tiempo_horas <Op>×</Op> <Var>${datos.config?.tarifa_hora ?? "—"}</Var>)
        </PasoFormula>
        <PasoFormula numero="3" etiqueta="Factor variable">
          <Var>Factor_variable</Var> <Op>=</Op> MIN( F_condición <Op>×</Op> F_horario <Op>×</Op> F_día , <Var>{datos.config?.tope_factor_variable ?? "—"}</Var> )
        </PasoFormula>
        <PasoFormula numero="4" etiqueta="Tarifa final">
          <Var>Tarifa_final</Var> <Op>=</Op> Subtotal <Op>×</Op> Factor_variable
        </PasoFormula>
      </div>
    </PassportCard>
  );
}

type BorradorTarifas = {
  vehiculo: Record<string, { base: string; porKm: string }>;
  gama: Record<string, string>;
  condicion: Record<string, string>;
  horario: Record<string, string>;
  dia: Record<string, string>;
  certificacion: Record<string, string>;
  config: { tarifaHora: string; topeFactorVariable: string };
};

function crearBorradorTarifas(datos: ConfiguracionTarifas): BorradorTarifas {
  return {
    vehiculo: Object.fromEntries(datos.vehiculo.map((fila) => [fila.id, { base: String(fila.base), porKm: String(fila.por_km) }])),
    gama: Object.fromEntries(datos.gama.map((fila) => [fila.gama, String(fila.factor)])),
    condicion: Object.fromEntries(datos.condicion.map((fila) => [fila.condicion, String(fila.factor)])),
    horario: Object.fromEntries(datos.horario.map((fila) => [fila.horario, String(fila.factor)])),
    dia: Object.fromEntries(datos.dia.map((fila) => [fila.dia, String(fila.factor)])),
    certificacion: Object.fromEntries(datos.certificacionPago.map((fila) => [fila.certificacion, String(fila.porcentaje)])),
    config: {
      tarifaHora: String(datos.config?.tarifa_hora ?? ""),
      topeFactorVariable: String(datos.config?.tope_factor_variable ?? "")
    }
  };
}

function numeroBorrador(valor: string, etiqueta: string) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) throw new Error(`${etiqueta} tiene un valor inválido.`);
  return numero;
}

function ParametrosNormativos({
  seccion,
  datos,
  cliente,
  onGuardado,
  onConfigVista,
  onDirtyChange
}: {
  seccion: SeccionParametrosTarifa;
  datos: ConfiguracionTarifas;
  cliente: ReturnType<typeof crearClienteNavegador> | null;
  onGuardado: () => Promise<void>;
  onConfigVista: (config: TarifaConfigRow | null) => void;
  onDirtyChange: (hayCambios: boolean) => void;
}) {
  const requiereConfirmacion = datos.config?.estado === "vigente";
  const [borrador, setBorrador] = useState<BorradorTarifas>(() => crearBorradorTarifas(datos));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [borradorCreadoEn] = useState(() => new Date().toISOString());
  const [guardando, startGuardado] = useTransition();

  function cambiarVehiculo(id: string, campo: "base" | "porKm", valor: string) {
    setBorrador((actual) => ({
      ...actual,
      vehiculo: { ...actual.vehiculo, [id]: { ...actual.vehiculo[id], [campo]: valor } }
    }));
  }

  function cambiarGrupo<K extends keyof Pick<BorradorTarifas, "gama" | "condicion" | "horario" | "dia" | "certificacion">>(
    grupo: K,
    clave: string,
    valor: string
  ) {
    setBorrador((actual) => ({ ...actual, [grupo]: { ...actual[grupo], [clave]: valor } }));
  }

  function cambiarConfig(campo: keyof BorradorTarifas["config"], valor: string) {
    setBorrador((actual) => ({ ...actual, config: { ...actual.config, [campo]: valor } }));
    if (!datos.config) return;
    const siguiente = {
      ...datos.config,
      tarifa_hora: campo === "tarifaHora" && Number.isFinite(Number(valor)) ? Number(valor) : Number(borrador.config.tarifaHora),
      tope_factor_variable: campo === "topeFactorVariable" && Number.isFinite(Number(valor)) ? Number(valor) : Number(borrador.config.topeFactorVariable)
    };
    if (Number.isFinite(siguiente.tarifa_hora) && Number.isFinite(siguiente.tope_factor_variable)) {
      onConfigVista(siguiente);
    }
  }

  const hayCambios = useMemo(() => {
    const original = crearBorradorTarifas(datos);
    return JSON.stringify(original) !== JSON.stringify(borrador);
  }, [borrador, datos]);

  useEffect(() => {
    onDirtyChange(hayCambios);
    return () => onDirtyChange(false);
  }, [hayCambios, onDirtyChange]);

  function guardar() {
    if (!hayCambios) return;
    if (requiereConfirmacion) {
      setConfirmando(true);
      return;
    }
    guardarConfirmado();
  }

  function crearBorradorDesdeVigente() {
    setBorrador(crearBorradorTarifas(datos));
    setMensaje("Borrador creado desde la versión vigente. Edita valores, simula, compara y publica cuando esté revisado.");
  }

  function guardarConfirmado() {
    startGuardado(async () => {
      try {
        if (!cliente) throw new Error("Sin cliente Supabase.");
        if (!datos.config) throw new Error("No existe la configuración general de tarifas.");
        setMensaje(null);

        const payload: ActualizacionPoliticaTarifariaNormativa = {};

        for (const fila of datos.vehiculo) {
          const valor = borrador.vehiculo[fila.id];
          const base = numeroBorrador(valor.base, `Base ${ETIQUETA_CATEGORIA[fila.categoria] ?? fila.categoria}`);
          const porKm = numeroBorrador(valor.porKm, `$ / km ${ETIQUETA_CATEGORIA[fila.categoria] ?? fila.categoria}`);
          if (base !== fila.base || porKm !== fila.por_km) {
            payload.vehiculo = [...(payload.vehiculo ?? []), { id: fila.id, base, por_km: porKm }];
          }
        }

        for (const fila of datos.gama) {
          const factor = numeroBorrador(borrador.gama[fila.gama], `Gama ${fila.gama}`);
          if (factor !== fila.factor) payload.gama = [...(payload.gama ?? []), { gama: fila.gama, factor }];
        }

        for (const fila of datos.condicion) {
          const factor = numeroBorrador(borrador.condicion[fila.condicion], `Condición ${fila.condicion}`);
          if (factor !== fila.factor) payload.condicion = [...(payload.condicion ?? []), { condicion: fila.condicion, factor }];
        }

        for (const fila of datos.horario) {
          const factor = numeroBorrador(borrador.horario[fila.horario], `Horario ${fila.horario}`);
          if (factor !== fila.factor) payload.horario = [...(payload.horario ?? []), { horario: fila.horario, factor }];
        }

        for (const fila of datos.dia) {
          const factor = numeroBorrador(borrador.dia[fila.dia], `Día ${fila.dia}`);
          if (factor !== fila.factor) payload.dia = [...(payload.dia ?? []), { dia: fila.dia, factor }];
        }

        for (const fila of datos.certificacionPago) {
          const porcentaje = numeroBorrador(borrador.certificacion[fila.certificacion], `Pago ${fila.certificacion}`);
          if (porcentaje !== fila.porcentaje) {
            payload.certificacion_pago = [...(payload.certificacion_pago ?? []), { certificacion: fila.certificacion, porcentaje }];
          }
        }

        const tarifaHora = numeroBorrador(borrador.config.tarifaHora, "Tarifa por hora");
        const topeFactorVariable = numeroBorrador(borrador.config.topeFactorVariable, "Tope del factor variable");
        if (tarifaHora !== datos.config.tarifa_hora || topeFactorVariable !== datos.config.tope_factor_variable) {
          payload.config = { tarifa_hora: tarifaHora, tope_factor_variable: topeFactorVariable };
        }

        const actualizadas = await actualizarPoliticaTarifariaNormativa(cliente, payload);
        await onGuardado();
        onDirtyChange(false);
        setMensaje(`Versión publicada. Cambios aplicados: ${actualizadas}.`);
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo publicar la versión.");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="sticky top-3 z-20 -mx-2 rounded-lg border border-focus-default/20 bg-surface-primary/95 px-4 py-3 shadow-[var(--ruum-shadow-2)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-body text-sm font-semibold text-ink">Borrador tarifario</p>
            <p className="mt-1 font-body text-xs text-text-secondary">
              Autor: admin actual · Creado: {formatoFecha(borradorCreadoEn)} · Estado: {hayCambios ? "En edición" : "Sin cambios"}
            </p>
            {mensaje && <p className="mt-1 font-body text-xs text-text-secondary">{mensaje}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={crearBorradorDesdeVigente}>Crear borrador</Button>
            <Button onClick={guardar} disabled={!hayCambios || guardando}>
              {datos.config?.nombre_version ? `Publicar versión ${datos.config.nombre_version}` : "Publicar versión"}
            </Button>
          </div>
        </div>
      </div>

      {seccion === "base" && <TarifasBaseFijas datos={datos} borrador={borrador} onCambiar={cambiarVehiculo} />}

      {seccion === "factores" && (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <GrupoFactor titulo="Factor de gama" filas={datos.gama.map((f) => ({ clave: f.gama, etiqueta: f.gama, valor: borrador.gama[f.gama] ?? "" }))} onCambiar={(clave, valor) => cambiarGrupo("gama", clave, valor)} />
            <GrupoFactor titulo="Factor de condición" filas={datos.condicion.map((f) => ({ clave: f.condicion, etiqueta: f.condicion.replaceAll("_", " "), valor: borrador.condicion[f.condicion] ?? "" }))} onCambiar={(clave, valor) => cambiarGrupo("condicion", clave, valor)} />
            <GrupoFactor titulo="Factor horario" filas={datos.horario.map((f) => ({ clave: f.horario, etiqueta: f.horario, valor: borrador.horario[f.horario] ?? "" }))} onCambiar={(clave, valor) => cambiarGrupo("horario", clave, valor)} />
            <GrupoFactor titulo="Factor día" filas={datos.dia.map((f) => ({ clave: f.dia, etiqueta: f.dia.replaceAll("_", " "), valor: borrador.dia[f.dia] ?? "" }))} onCambiar={(clave, valor) => cambiarGrupo("dia", clave, valor)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <PassportCard>
              <h2 className="font-display text-xl font-semibold">Configuración general</h2>
              {datos.config && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CampoBorrador etiqueta="Tarifa por hora" valor={borrador.config.tarifaHora} sufijo="$/hora" onCambiar={(valor) => cambiarConfig("tarifaHora", valor)} />
                  <CampoBorrador etiqueta="Tope del factor variable" valor={borrador.config.topeFactorVariable} sufijo="x" onCambiar={(valor) => cambiarConfig("topeFactorVariable", valor)} />
                </div>
              )}
            </PassportCard>
            <GrupoFactor
              titulo="Pago al conductor por certificación"
              filas={datos.certificacionPago.map((f) => ({ clave: f.certificacion, etiqueta: f.certificacion.replaceAll("_", " "), valor: borrador.certificacion[f.certificacion] ?? "", sufijo: "%" }))}
              onCambiar={(clave, valor) => cambiarGrupo("certificacion", clave, valor)}
            />
          </div>
        </>
      )}

      <ComparadorVersiones datos={datos} borrador={borrador} />
      <ImpactoTarifario datos={datos} borrador={borrador} />
      <ConfirmacionImpacto
        abierto={confirmando}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          setConfirmando(false);
          guardarConfirmado();
        }}
        accionLabel={`Publicar versión ${datos.config?.nombre_version ?? "tarifaria"}`}
      />
    </div>
  );
}

function GrupoFactor({
  titulo,
  filas,
  onCambiar
}: {
  titulo: string;
  filas: Array<{ clave: string; etiqueta: string; valor: string; sufijo?: string }>;
  onCambiar: (clave: string, valor: string) => void;
}) {
  return (
    <PassportCard>
      <h2 className="font-display text-xl font-semibold">{titulo}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filas.map((fila) => (
          <CampoBorrador
            key={fila.clave}
            etiqueta={fila.etiqueta}
            valor={fila.valor}
            sufijo={fila.sufijo}
            onCambiar={(valor) => onCambiar(fila.clave, valor)}
          />
        ))}
      </div>
    </PassportCard>
  );
}

function configuracionDesdeBorrador(datos: ConfiguracionTarifas, borrador: BorradorTarifas): ConfiguracionTarifas {
  return {
    ...datos,
    vehiculo: datos.vehiculo.map((fila) => ({
      ...fila,
      base: Number(borrador.vehiculo[fila.id]?.base ?? fila.base),
      por_km: Number(borrador.vehiculo[fila.id]?.porKm ?? fila.por_km)
    })),
    gama: datos.gama.map((fila) => ({ ...fila, factor: Number(borrador.gama[fila.gama] ?? fila.factor) })),
    condicion: datos.condicion.map((fila) => ({ ...fila, factor: Number(borrador.condicion[fila.condicion] ?? fila.factor) })),
    horario: datos.horario.map((fila) => ({ ...fila, factor: Number(borrador.horario[fila.horario] ?? fila.factor) })),
    dia: datos.dia.map((fila) => ({ ...fila, factor: Number(borrador.dia[fila.dia] ?? fila.factor) })),
    certificacionPago: datos.certificacionPago.map((fila) => ({ ...fila, porcentaje: Number(borrador.certificacion[fila.certificacion] ?? fila.porcentaje) })),
    config: datos.config ? {
      ...datos.config,
      tarifa_hora: Number(borrador.config.tarifaHora),
      tope_factor_variable: Number(borrador.config.topeFactorVariable)
    } : datos.config
  };
}

function cambiosVersion(datos: ConfiguracionTarifas, borrador: BorradorTarifas) {
  const cambios: Array<{ entidad: string; campo: string; vigente: number; propuesto: number; delta: number; porcentaje: number }> = [];
  const agregar = (entidad: string, campo: string, vigente: number, propuesto: number) => {
    if (!Number.isFinite(propuesto) || vigente === propuesto) return;
    cambios.push({
      entidad,
      campo,
      vigente,
      propuesto,
      delta: propuesto - vigente,
      porcentaje: vigente === 0 ? 0 : ((propuesto - vigente) / vigente) * 100
    });
  };

  for (const fila of datos.vehiculo) {
    agregar(`${ETIQUETA_CATEGORIA[fila.categoria] ?? fila.categoria} / ${ETIQUETA_RANGO[fila.rango] ?? fila.rango}`, "Base", fila.base, Number(borrador.vehiculo[fila.id]?.base));
    agregar(`${ETIQUETA_CATEGORIA[fila.categoria] ?? fila.categoria} / ${ETIQUETA_RANGO[fila.rango] ?? fila.rango}`, "$/km", fila.por_km, Number(borrador.vehiculo[fila.id]?.porKm));
  }
  for (const fila of datos.gama) agregar(`Gama ${fila.gama}`, "Factor", fila.factor, Number(borrador.gama[fila.gama]));
  for (const fila of datos.condicion) agregar(`Condición ${fila.condicion.replaceAll("_", " ")}`, "Factor", fila.factor, Number(borrador.condicion[fila.condicion]));
  for (const fila of datos.horario) agregar(`Horario ${fila.horario}`, "Factor", fila.factor, Number(borrador.horario[fila.horario]));
  for (const fila of datos.dia) agregar(`Día ${fila.dia.replaceAll("_", " ")}`, "Factor", fila.factor, Number(borrador.dia[fila.dia]));
  for (const fila of datos.certificacionPago) agregar(`Certificación ${fila.certificacion.replaceAll("_", " ")}`, "Pago conductor", fila.porcentaje, Number(borrador.certificacion[fila.certificacion]));
  if (datos.config) {
    agregar("Configuración general", "Tarifa por hora", datos.config.tarifa_hora, Number(borrador.config.tarifaHora));
    agregar("Configuración general", "Tope factor variable", datos.config.tope_factor_variable, Number(borrador.config.topeFactorVariable));
  }
  return cambios;
}

function ComparadorVersiones({ datos, borrador }: { datos: ConfiguracionTarifas; borrador: BorradorTarifas }) {
  const cambios = cambiosVersion(datos, borrador);
  function descargarResumen() {
    const resumen = {
      version_vigente: datos.config?.nombre_version ?? null,
      fecha_entrada_en_vigor: datos.config?.vigente_desde ?? null,
      entidades_afectadas: cambios.length,
      cambios
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(resumen, null, 2)], { type: "application/json" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `comparacion-tarifas-${datos.config?.nombre_version ?? "borrador"}.json`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PassportCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Comparador de versiones</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">Revisión previa: vigente contra propuesto, variación absoluta y variación porcentual.</p>
        </div>
        <Button variant="quiet" onClick={descargarResumen} disabled={cambios.length === 0}>Descargar resumen</Button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left font-body text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-text-tertiary">
            <tr>
              <th className="px-3 py-2">Entidad afectada</th>
              <th className="px-3 py-2">Vigente</th>
              <th className="px-3 py-2">Propuesto</th>
              <th className="px-3 py-2">Variación</th>
              <th className="px-3 py-2">Entrada en vigor</th>
            </tr>
          </thead>
          <tbody>
            {cambios.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-text-tertiary">Crea un borrador o modifica valores para comparar versiones.</td></tr>
            ) : cambios.map((cambio) => (
              <tr key={`${cambio.entidad}-${cambio.campo}`} className="border-b border-ink/10">
                <td className="px-3 py-3"><span className="font-semibold text-ink">{cambio.entidad}</span><span className="block text-xs text-text-tertiary">{cambio.campo}</span></td>
                <td className="px-3 py-3 font-mono-ruum">{cambio.vigente.toLocaleString("es-MX")}</td>
                <td className="px-3 py-3 font-mono-ruum">{cambio.propuesto.toLocaleString("es-MX")}</td>
                <td className={`px-3 py-3 font-mono-ruum font-semibold ${cambio.delta >= 0 ? "text-status-warning" : "text-status-success"}`}>
                  {cambio.delta >= 0 ? "+" : ""}{cambio.delta.toLocaleString("es-MX")} · {cambio.porcentaje.toFixed(1)}%
                </td>
                <td className="px-3 py-3 text-text-secondary">{formatoFecha(datos.config?.vigente_desde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PassportCard>
  );
}

function ImpactoTarifario({ datos, borrador }: { datos: ConfiguracionTarifas; borrador: BorradorTarifas }) {
  const propuesta = configuracionDesdeBorrador(datos, borrador);
  const escenarios = [
    { nombre: "Traslado individual", categoria: "ligero_a", gama: "entrada", condicion: "seminueva", horario: "diurno", dia: "entre_semana", distanciaKm: 18, tiempoHoras: 0.8 },
    { nombre: "Ruta específica", categoria: "mediano", gama: "media", condicion: "rescate_mecanico", horario: "nocturno", dia: "fin_semana", distanciaKm: 76, tiempoHoras: 2.2 },
    { nombre: "Empresa", categoria: "ligero_b", gama: "alta", condicion: "seminueva", horario: "diurno", dia: "entre_semana", distanciaKm: 42, tiempoHoras: 1.4 },
    { nombre: "Muestra histórica", categoria: "camion", gama: "media", condicion: "rescate_mecanico", horario: "diurno", dia: "entre_semana", distanciaKm: 120, tiempoHoras: 3.5 },
    { nombre: "Solicitudes pendientes", categoria: "ligero_a", gama: "entrada", condicion: "seminueva", horario: "nocturno", dia: "fin_semana", distanciaKm: 12, tiempoHoras: 0.6 }
  ] as const;
  const filas = escenarios.map((escenario) => {
    try {
      const vigente = simularTarifaNormativa(datos, escenario).tarifa;
      const propuesto = simularTarifaNormativa(propuesta, escenario).tarifa;
      return { ...escenario, vigente, propuesto, delta: propuesto - vigente };
    } catch {
      return { ...escenario, vigente: null, propuesto: null, delta: null };
    }
  });
  return (
    <PassportCard>
      <h2 className="font-display text-xl font-semibold">Simulación de impacto</h2>
      <p className="mt-1 font-body text-sm text-text-secondary">Estimación sin modificar datos reales. Los traslados ya cotizados conservan su tarifa original.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {filas.map((fila) => (
          <div key={fila.nombre} className="rounded-lg border border-ink/10 bg-surface-secondary px-4 py-3">
            <p className="font-body text-sm font-semibold text-ink">{fila.nombre}</p>
            <p className="mt-1 font-body text-xs text-text-tertiary">{ETIQUETA_CATEGORIA[fila.categoria] ?? fila.categoria} · {fila.distanciaKm} km · {fila.tiempoHoras} h</p>
            {fila.vigente == null ? (
              <p className="mt-3 text-sm text-status-warning">No hay datos suficientes para estimar este escenario.</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <DatoSim etiqueta="Vigente" valor={`$${fila.vigente.toLocaleString("es-MX")}`} />
                <DatoSim etiqueta="Estimado" valor={`$${fila.propuesto!.toLocaleString("es-MX")}`} />
                <DatoSim etiqueta="Diferencia" valor={`${fila.delta! >= 0 ? "+" : ""}$${fila.delta!.toLocaleString("es-MX")}`} />
              </div>
            )}
          </div>
        ))}
      </div>
    </PassportCard>
  );
}

function AuditoriaTarifaria({ datos }: { datos: ConfiguracionTarifas }) {
  const config = datos.config;
  const eventos = [
    {
      titulo: "Versión vigente",
      detalle: config?.nombre_version ?? "Sin versión configurada",
      fecha: config?.vigente_desde,
      responsable: datos.adminActualizacion?.nombre ?? "Admin no identificado",
      estado: config?.estado ?? "borrador"
    },
    {
      titulo: "Última modificación registrada",
      detalle: "Actualización de política tarifaria normativa",
      fecha: config?.actualizado_en,
      responsable: datos.adminActualizacion?.nombre ?? "Admin no identificado",
      estado: "registro"
    }
  ];

  return (
    <PassportCard>
      <h2 className="font-display text-xl font-semibold">Auditoría</h2>
      <p className="mt-1 font-body text-sm text-text-secondary">
        Historial operativo disponible desde la configuración actual. El registro inmutable completo requiere persistencia de versiones en backend antes de considerar cerrado ADM-UX-32.
      </p>
      <div className="mt-4 divide-y divide-ink/10 rounded-lg border border-ink/10">
        {eventos.map((evento) => (
          <div key={`${evento.titulo}-${evento.fecha ?? "sin-fecha"}`} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_180px_180px_120px] md:items-center">
            <div>
              <p className="font-body text-sm font-semibold text-ink">{evento.titulo}</p>
              <p className="font-body text-xs text-text-tertiary">{evento.detalle}</p>
            </div>
            <p className="font-body text-sm text-text-secondary">{formatoFecha(evento.fecha)}</p>
            <p className="font-body text-sm text-text-secondary">{evento.responsable}</p>
            <span className={`w-fit rounded-full border px-3 py-1 font-body text-xs font-semibold ${claseEstado(evento.estado)}`}>
              {ETIQUETA_ESTADO[evento.estado] ?? evento.estado}
            </span>
          </div>
        ))}
      </div>
      <Aviso tono="atencion">
        La publicación usa permisos de administrador vía RLS/RPC. Para historial inmutable, rollback real y programación persistente falta agregar tablas/RPC de versiones tarifarias.
      </Aviso>
      <div className="mt-4">
        <Button variant="quiet" disabled>Revertir versión no disponible con el modelo actual</Button>
      </div>
    </PassportCard>
  );
}

function TarifasBaseFijas({
  datos,
  borrador,
  onCambiar
}: {
  datos: ConfiguracionTarifas;
  borrador: BorradorTarifas;
  onCambiar: (id: string, campo: "base" | "porKm", valor: string) => void;
}) {
  const porCategoria = useMemo(() => {
    const grupos = new Map<CategoriaTarifa, TarifaVehiculoRow[]>();
    for (const fila of datos.vehiculo) {
      const lista = grupos.get(fila.categoria) ?? [];
      lista.push(fila);
      grupos.set(fila.categoria, lista);
    }
    return grupos;
  }, [datos.vehiculo]);

  return (
    <PassportCard acento>
      <h2 className="font-display text-xl font-semibold">Tarifas base fijas</h2>
      <p className="mt-1 font-body text-sm text-text-secondary">Importes de partida y costo por kilómetro según categoría y rango.</p>
      <div className="mt-5 grid gap-x-6 gap-y-8 xl:grid-cols-2">
        {Array.from(porCategoria.entries()).map(([categoria, filas]) => (
          <section key={categoria}>
            <div className="flex items-center gap-2 border-b border-signal/30 pb-2">
              <span className="size-2 rounded-full bg-signal" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-ink">{ETIQUETA_CATEGORIA[categoria] ?? categoria}</h3>
            </div>
            <div className="divide-y divide-ink/10">
              {filas.map((fila) => (
                <div key={fila.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(150px,1fr)_minmax(120px,150px)_minmax(120px,150px)]">
                  <p className="self-center font-body text-sm font-medium leading-5 text-text-secondary">{ETIQUETA_RANGO[fila.rango] ?? fila.rango}</p>
                  <CampoBorrador
                    etiqueta="Base"
                    valor={borrador.vehiculo[fila.id]?.base ?? ""}
                    sufijo="$"
                    onCambiar={(valor) => onCambiar(fila.id, "base", valor)}
                  />
                  <CampoBorrador
                    etiqueta="Kilómetro"
                    valor={borrador.vehiculo[fila.id]?.porKm ?? ""}
                    sufijo="$/km"
                    onCambiar={(valor) => onCambiar(fila.id, "porKm", valor)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PassportCard>
  );
}

function SimuladorNormativo({ datos }: { datos: ConfiguracionTarifas }) {
  const [categoria, setCategoria] = useState<CategoriaTarifa>("ligero_a");
  const [gama, setGama] = useState<GamaTarifa>("entrada");
  const [condicion, setCondicion] = useState<CondicionTarifa>("seminueva");
  const [horario, setHorario] = useState<HorarioTarifa>("diurno");
  const [dia, setDia] = useState<DiaTarifa>("entre_semana");
  const [distanciaKm, setDistanciaKm] = useState("196");
  const [tiempoHoras, setTiempoHoras] = useState("2.33");

  const resultado = useMemo(() => {
    try {
      return {
        ok: true as const,
        valor: simularTarifaNormativa(datos, {
          categoria,
          gama,
          condicion,
          horario,
          dia,
          distanciaKm: Number(distanciaKm),
          tiempoHoras: Number(tiempoHoras)
        })
      };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "No se pudo simular." };
    }
  }, [categoria, condicion, datos, dia, distanciaKm, gama, horario, tiempoHoras]);

  return (
    <PassportCard acento>
      <h2 className="font-display text-xl font-semibold">Simulador normativo</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectSim<CategoriaTarifa> etiqueta="Categoría" valor={categoria} onChange={setCategoria} opciones={datos.vehiculo.map((v) => v.categoria)} etiquetas={ETIQUETA_CATEGORIA} />
        <SelectSim<GamaTarifa> etiqueta="Gama" valor={gama} onChange={setGama} opciones={datos.gama.map((v) => v.gama)} />
        <SelectSim<CondicionTarifa> etiqueta="Condición" valor={condicion} onChange={setCondicion} opciones={datos.condicion.map((v) => v.condicion)} />
        <SelectSim<HorarioTarifa> etiqueta="Horario" valor={horario} onChange={setHorario} opciones={datos.horario.map((v) => v.horario)} />
        <SelectSim<DiaTarifa> etiqueta="Día" valor={dia} onChange={setDia} opciones={datos.dia.map((v) => v.dia)} />
        <label className="font-body text-sm font-medium text-text-main">
          Distancia km
          <input value={distanciaKm} onChange={(e) => setDistanciaKm(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-ink/25 bg-surface-primary px-3 py-2 text-sm" />
        </label>
        <label className="font-body text-sm font-medium text-text-main">
          Tiempo horas
          <input value={tiempoHoras} onChange={(e) => setTiempoHoras(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-ink/25 bg-surface-primary px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border border-focus-default/20 bg-status-info-soft/40 px-4 py-4">
        {resultado.ok ? (
          <div className="grid gap-2 font-body text-sm text-text-secondary sm:grid-cols-4">
            <DatoSim etiqueta="Rango" valor={ETIQUETA_RANGO[resultado.valor.rango] ?? resultado.valor.rango} />
            <DatoSim etiqueta="Base categoría" valor={`$${resultado.valor.baseCategoria.toLocaleString("es-MX")}`} />
            <DatoSim etiqueta="Subtotal" valor={`$${resultado.valor.subtotal.toLocaleString("es-MX")}`} />
            <DatoSim etiqueta="Factor variable" valor={`${resultado.valor.factorVariable.toFixed(2)}x`} />
            <div className="sm:col-span-4">
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tarifa final normativa</p>
              <p className="mt-1 font-display text-3xl font-semibold text-ink">${resultado.valor.tarifa.toLocaleString("es-MX")}</p>
            </div>
          </div>
        ) : (
          <Aviso tono="atencion">{resultado.error}</Aviso>
        )}
      </div>
    </PassportCard>
  );
}

function SelectSim<T extends string>({
  etiqueta,
  valor,
  opciones,
  etiquetas,
  onChange
}: {
  etiqueta: string;
  valor: T;
  opciones: T[];
  etiquetas?: Record<string, string>;
  onChange: (valor: T) => void;
}) {
  const unicas = [...new Set(opciones)];
  return (
    <label className="font-body text-sm font-medium text-text-main">
      {etiqueta}
      <select value={valor} onChange={(e) => onChange(e.target.value as T)} className="mt-1 w-full rounded-lg border border-ink/25 bg-surface-primary px-3 py-2 text-sm">
        {unicas.map((opcion) => <option key={opcion} value={opcion}>{etiquetas?.[opcion] ?? opcion.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function DatoSim({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">{etiqueta}</p>
      <p className="mt-1 font-semibold text-ink">{valor}</p>
    </div>
  );
}
