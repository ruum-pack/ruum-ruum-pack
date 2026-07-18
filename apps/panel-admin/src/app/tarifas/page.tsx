"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Aviso, Button, PassportCard } from "@ruum/ui";
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
  onConfirmar
}: {
  abierto: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  if (!abierto) return null;
  return (
    <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirmacion-impacto-titulo">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-ink/20 bg-surface-primary shadow-[var(--ruum-shadow-4)]">
        <div className="border-b border-status-warning/20 bg-status-warning-soft px-6 py-5">
          <p className="font-mono-ruum text-xs font-medium uppercase tracking-wide text-status-warning">Cambio de alto impacto</p>
          <h2 id="confirmacion-impacto-titulo" className="mt-1 font-display text-xl font-semibold text-ink">Confirmar cambio vigente</h2>
        </div>
        <div className="px-6 py-5">
          <p className="font-body text-sm leading-6 text-text-secondary">
            Esta acción modifica una política tarifaria normativa. Afectará únicamente cálculos futuros y quedará registrada para auditoría.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="quiet" onClick={onCancelar}>Cancelar</Button>
            <Button onClick={onConfirmar}>Sí, continuar</Button>
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

  const cliente = tieneSupabaseConfigurado() ? crearClienteNavegador() : null;
  const datosFormula = useMemo(() => ({ ...datos, config: configVista ?? datos.config }), [configVista, datos]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="relative min-h-32 overflow-hidden rounded-card border border-ink/10">
        <Image
          src="/imagenes/torre-control-flota.webp"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 1152px"
          className="scale-105 object-cover object-[60%_38%]"
        />
        <div className="admin-hero-token-overlay absolute inset-0" />
        <div className="relative flex min-h-32 items-end px-6 py-6 sm:px-8">
          <div>
            <p className="font-mono-ruum text-xs font-medium uppercase tracking-wide text-status-info">Apartado normativo rector</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-text-main">Tarifas</h1>
            <p className="mt-1 font-body text-sm text-text-secondary">Políticas aprobadas, fórmula auditable y simulación del precio aplicable a cada traslado.</p>
          </div>
        </div>
      </div>

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
          <PrincipiosTarifarios />
          <PoliticaVigente key={datos.config?.actualizado_en ?? "sin-config"} datos={datos} cliente={cliente} onGuardado={cargar} />
          <FormulaVigente datos={datosFormula} />
          <ParametrosNormativos datos={datos} cliente={cliente} onGuardado={cargar} onConfigVista={setConfigVista} />
          <SimuladorNormativo datos={datos} />
        </div>
      )}
    </main>
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
  onGuardado
}: {
  datos: ConfiguracionTarifas;
  cliente: ReturnType<typeof crearClienteNavegador> | null;
  onGuardado: () => Promise<void>;
}) {
  const config = datos.config;
  const [nombre, setNombre] = useState(config?.nombre_version ?? "");
  const [estado, setEstado] = useState(config?.estado ?? "borrador");
  const [vigenteDesde, setVigenteDesde] = useState(fechaParaInput(config?.vigente_desde));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

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
        <Button onClick={guardar} disabled={pendiente}>Guardar política</Button>
        {mensaje && <span className="font-body text-xs text-text-secondary">{mensaje}</span>}
      </div>
      <ConfirmacionImpacto
        abierto={confirmando}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          setConfirmando(false);
          guardarConfirmado();
        }}
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
  datos,
  cliente,
  onGuardado,
  onConfigVista
}: {
  datos: ConfiguracionTarifas;
  cliente: ReturnType<typeof crearClienteNavegador> | null;
  onGuardado: () => Promise<void>;
  onConfigVista: (config: TarifaConfigRow | null) => void;
}) {
  const requiereConfirmacion = datos.config?.estado === "vigente";
  const [borrador, setBorrador] = useState<BorradorTarifas>(() => crearBorradorTarifas(datos));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
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

  function guardar() {
    if (!hayCambios) return;
    if (requiereConfirmacion) {
      setConfirmando(true);
      return;
    }
    guardarConfirmado();
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
        setMensaje(`Cambios guardados: ${actualizadas}.`);
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="sticky top-3 z-20 -mx-2 rounded-lg border border-focus-default/20 bg-surface-primary/95 px-4 py-3 shadow-[var(--ruum-shadow-2)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-body text-sm font-semibold text-ink">Edición de parámetros normativos</p>
            {mensaje && <p className="mt-1 font-body text-xs text-text-secondary">{mensaje}</p>}
          </div>
          <Button onClick={guardar} disabled={!hayCambios || guardando}>Guardar cambios</Button>
        </div>
      </div>

      <TarifasBaseFijas datos={datos} borrador={borrador} onCambiar={cambiarVehiculo} />

      <div className="grid gap-6 xl:grid-cols-2">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Factor de gama</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {datos.gama.map((f) => (
              <CampoBorrador key={f.gama} etiqueta={f.gama} valor={borrador.gama[f.gama] ?? ""} onCambiar={(valor) => cambiarGrupo("gama", f.gama, valor)} />
            ))}
          </div>
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Factor de condición</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {datos.condicion.map((f) => (
              <CampoBorrador key={f.condicion} etiqueta={f.condicion.replaceAll("_", " ")} valor={borrador.condicion[f.condicion] ?? ""} onCambiar={(valor) => cambiarGrupo("condicion", f.condicion, valor)} />
            ))}
          </div>
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Factor horario</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {datos.horario.map((f) => (
              <CampoBorrador key={f.horario} etiqueta={f.horario} valor={borrador.horario[f.horario] ?? ""} onCambiar={(valor) => cambiarGrupo("horario", f.horario, valor)} />
            ))}
          </div>
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Factor día</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {datos.dia.map((f) => (
              <CampoBorrador key={f.dia} etiqueta={f.dia.replaceAll("_", " ")} valor={borrador.dia[f.dia] ?? ""} onCambiar={(valor) => cambiarGrupo("dia", f.dia, valor)} />
            ))}
          </div>
        </PassportCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Configuración general</h2>
          {datos.config && (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CampoBorrador etiqueta="Tarifa por hora" valor={borrador.config.tarifaHora} sufijo="$/hora" onCambiar={(valor) => cambiarConfig("tarifaHora", valor)} />
                <CampoBorrador etiqueta="Tope del factor variable" valor={borrador.config.topeFactorVariable} sufijo="x" onCambiar={(valor) => cambiarConfig("topeFactorVariable", valor)} />
              </div>
            </>
          )}
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Pago al conductor por certificación</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {datos.certificacionPago.map((f) => (
              <CampoBorrador key={f.certificacion} etiqueta={f.certificacion.replaceAll("_", " ")} valor={borrador.certificacion[f.certificacion] ?? ""} sufijo="%" onCambiar={(valor) => cambiarGrupo("certificacion", f.certificacion, valor)} />
            ))}
          </div>
        </PassportCard>
      </div>
      <ConfirmacionImpacto
        abierto={confirmando}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          setConfirmando(false);
          guardarConfirmado();
        }}
      />
    </div>
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
