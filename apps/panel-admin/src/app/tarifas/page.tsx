"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import {
  actualizarConfigTarifas,
  actualizarFactorCondicion,
  actualizarFactorDia,
  actualizarFactorGama,
  actualizarFactorHorario,
  actualizarPagoConductorPorCertificacion,
  actualizarTarifaVehiculo,
  obtenerConfiguracionTarifas,
  simularTarifaNormativa,
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
  if (estado === "vigente") return "border-success/30 bg-success/10 text-success";
  if (estado === "borrador") return "border-route-dark/30 bg-route-dark/10 text-route-dark";
  return "border-ink/15 bg-ink/5 text-ink/55";
}

function CampoEditable({
  etiqueta,
  valorInicial,
  sufijo,
  onGuardar
}: {
  etiqueta: string;
  valorInicial: number;
  sufijo?: string;
  onGuardar: (valor: number) => Promise<void>;
}) {
  const [valor, setValor] = useState(String(valorInicial));
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  function guardar() {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
      setMensaje("Valor inválido.");
      return;
    }
    setMensaje(null);
    startTransition(async () => {
      try {
        await onGuardar(numero);
        setMensaje("Guardado.");
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-ink/10 py-3 last:border-b-0">
      <label className="min-w-44 font-body text-sm font-medium text-ink/75">
        <span>{etiqueta}</span>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          className="mt-1 block w-32 rounded-lg border border-ink/30 bg-mist px-3 py-1.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
        />
      </label>
      {sufijo && <span className="pb-2 font-body text-xs text-ink/45">{sufijo}</span>}
      <Button variant="fantasma" onClick={guardar} disabled={pendiente}>Guardar</Button>
      {mensaje && <span className="pb-2 font-body text-xs text-ink/55">{mensaje}</span>}
    </div>
  );
}

export default function PaginaTarifasAdmin() {
  const [datos, setDatos] = useState<ConfiguracionTarifas>(VACIO);
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-route-dark">Apartado normativo rector</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Tarifas</h1>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tono="atencion">{error}</Aviso>
        </div>
      )}

      {cargando ? (
        <p className="mt-8 font-body text-sm text-ink/50">Cargando política tarifaria...</p>
      ) : (
        <div className="mt-6 grid gap-6">
          <PoliticaVigente key={datos.config?.actualizado_en ?? "sin-config"} datos={datos} cliente={cliente} onGuardado={cargar} />
          <FormulaVigente datos={datos} />
          <TarifaBasePorVehiculo datos={datos} cliente={cliente} onGuardado={cargar} />
          <ParametrosNormativos datos={datos} cliente={cliente} onGuardado={cargar} />
          <SimuladorNormativo datos={datos} />
        </div>
      )}
    </main>
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
  const [pendiente, startTransition] = useTransition();

  function guardar() {
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
            <span className="rounded-full border border-ink/10 bg-mist px-3 py-1 text-ink/65">
              Vigente desde {formatoFecha(config.vigente_desde)}
            </span>
            <span className="rounded-full border border-ink/10 bg-mist px-3 py-1 text-ink/65">
              Última modificación: {datos.adminActualizacion?.nombre ?? "Admin no identificado"} · {formatoFecha(config.actualizado_en)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_180px_220px]">
        <label className="font-body text-sm font-medium text-ink/75">
          Nombre de versión
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded-lg border border-ink/25 bg-mist px-3 py-2 text-sm" />
        </label>
        <label className="font-body text-sm font-medium text-ink/75">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className="mt-1 w-full rounded-lg border border-ink/25 bg-mist px-3 py-2 text-sm">
            <option value="borrador">Borrador</option>
            <option value="vigente">Vigente</option>
            <option value="archivada">Archivada</option>
          </select>
        </label>
        <label className="font-body text-sm font-medium text-ink/75">
          Fecha de vigencia
          <input type="datetime-local" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} className="mt-1 w-full rounded-lg border border-ink/25 bg-mist px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={guardar} disabled={pendiente}>Guardar política</Button>
        {mensaje && <span className="font-body text-xs text-ink/55">{mensaje}</span>}
      </div>
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
    <div className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-mist-dim px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex shrink-0 items-center gap-2 sm:w-40">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-route-dark font-body text-xs font-semibold text-white">
          {numero}
        </span>
        <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink/55">{etiqueta}</span>
      </div>
      <code className="font-mono-ruum text-sm leading-7 text-ink sm:text-[0.95rem]">{children}</code>
    </div>
  );
}

function Var({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-route-dark">{children}</span>;
}

function Op({ children }: { children: ReactNode }) {
  return <span className="text-ink/40">{children}</span>;
}

function FormulaVigente({ datos }: { datos: ConfiguracionTarifas }) {
  return (
    <PassportCard>
      <h2 className="font-display text-xl font-semibold">Fórmula vigente</h2>
      <p className="mt-1 font-body text-sm text-ink/55">Así se calcula la tarifa final que ve el usuario, paso por paso.</p>
      <div className="mt-4 grid gap-3">
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

type TarifaVehiculoRow = ConfiguracionTarifas["vehiculo"][number];

function FilaTarifaVehiculo({
  fila,
  cliente,
  onGuardado
}: {
  fila: TarifaVehiculoRow;
  cliente: ReturnType<typeof crearClienteNavegador> | null;
  onGuardado: () => Promise<void>;
}) {
  const [base, setBase] = useState(String(fila.base));
  const [porKm, setPorKm] = useState(String(fila.por_km));
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  function guardar() {
    const nuevaBase = Number(base);
    const nuevoPorKm = Number(porKm);
    if (!Number.isFinite(nuevaBase) || !Number.isFinite(nuevoPorKm)) {
      setMensaje("Valor inválido.");
      return;
    }
    setMensaje(null);
    startTransition(async () => {
      try {
        if (!cliente) throw new Error("Sin cliente Supabase.");
        await actualizarTarifaVehiculo(cliente, fila.id, { base: nuevaBase, por_km: nuevoPorKm });
        setMensaje("Guardado.");
        await onGuardado();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-ink/10 py-3 last:border-b-0">
      <span className="min-w-40 font-body text-sm font-medium text-ink/75">{ETIQUETA_RANGO[fila.rango] ?? fila.rango}</span>
      <label className="font-body text-xs text-ink/55">
        <span className="block">Base</span>
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          inputMode="decimal"
          className="mt-1 block w-28 rounded-lg border border-ink/30 bg-mist px-3 py-1.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
        />
      </label>
      <label className="font-body text-xs text-ink/55">
        <span className="block">$/km</span>
        <input
          value={porKm}
          onChange={(e) => setPorKm(e.target.value)}
          inputMode="decimal"
          className="mt-1 block w-24 rounded-lg border border-ink/30 bg-mist px-3 py-1.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
        />
      </label>
      <Button variant="fantasma" onClick={guardar} disabled={pendiente}>Guardar</Button>
      {mensaje && <span className="pb-2 font-body text-xs text-ink/55">{mensaje}</span>}
    </div>
  );
}

function TarifaBasePorVehiculo({
  datos,
  cliente,
  onGuardado
}: {
  datos: ConfiguracionTarifas;
  cliente: ReturnType<typeof crearClienteNavegador> | null;
  onGuardado: () => Promise<void>;
}) {
  const [porcentaje, setPorcentaje] = useState("15");
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const porCategoria = useMemo(() => {
    const grupos = new Map<CategoriaTarifa, TarifaVehiculoRow[]>();
    for (const fila of datos.vehiculo) {
      const lista = grupos.get(fila.categoria) ?? [];
      lista.push(fila);
      grupos.set(fila.categoria, lista);
    }
    return grupos;
  }, [datos.vehiculo]);

  function aplicarAumento() {
    const pct = Number(porcentaje);
    if (!Number.isFinite(pct) || pct === 0) {
      setMensaje("Ingresa un porcentaje válido (puede ser negativo para un descuento).");
      return;
    }
    setMensaje(null);
    startTransition(async () => {
      try {
        if (!cliente) throw new Error("Sin cliente Supabase.");
        for (const fila of datos.vehiculo) {
          const nuevaBase = Math.round(fila.base * (1 + pct / 100) * 100) / 100;
          await actualizarTarifaVehiculo(cliente, fila.id, { base: nuevaBase, por_km: fila.por_km });
        }
        setMensaje(`Base actualizada ${pct > 0 ? "+" : ""}${pct}% en las ${datos.vehiculo.length} filas.`);
        setConfirmando(false);
        await onGuardado();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo aplicar el aumento.");
      }
    });
  }

  return (
    <PassportCard>
      <h2 className="font-display text-xl font-semibold">Tarifa base por categoría y rango</h2>
      <p className="mt-1 font-body text-sm text-ink/55">
        Aquí se captura la base ($) y el $/km de cada categoría y rango de distancia. El $/hora general y los factores
        (gama, condición, horario, día) se ajustan aparte, más abajo.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-route/25 bg-route-soft px-4 py-3">
        <label className="font-body text-xs font-semibold text-route-dark">
          <span className="block">Ajuste rápido a todas las bases</span>
          <div className="mt-1 flex items-center gap-1">
            <input
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              inputMode="decimal"
              className="w-20 rounded-lg border border-route/40 bg-mist px-3 py-1.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
            />
            <span className="font-body text-sm text-route-dark">%</span>
          </div>
        </label>
        {!confirmando ? (
          <Button variant="fantasma" onClick={() => setConfirmando(true)} disabled={aplicando || datos.vehiculo.length === 0}>
            Aplicar a las {datos.vehiculo.length} bases
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-xs text-route-dark">
              Esto cambia la base de las {datos.vehiculo.length} filas de una vez. ¿Confirmas?
            </span>
            <Button variant="fantasma" onClick={aplicarAumento} disabled={aplicando}>Sí, aplicar</Button>
            <Button variant="fantasma" onClick={() => setConfirmando(false)} disabled={aplicando}>Cancelar</Button>
          </div>
        )}
        {mensaje && <span className="font-body text-xs text-route-dark">{mensaje}</span>}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {Array.from(porCategoria.entries()).map(([categoria, filas]) => (
          <div key={categoria}>
            <h3 className="font-body text-sm font-semibold text-ink/70">{ETIQUETA_CATEGORIA[categoria] ?? categoria}</h3>
            <div className="mt-2">
              {filas.map((fila) => (
                <FilaTarifaVehiculo key={fila.id} fila={fila} cliente={cliente} onGuardado={onGuardado} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PassportCard>
  );
}

function ParametrosNormativos({
  datos,
  cliente,
  onGuardado
}: {
  datos: ConfiguracionTarifas;
  cliente: ReturnType<typeof crearClienteNavegador> | null;
  onGuardado: () => Promise<void>;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Factor de gama</h2>
          {datos.gama.map((f) => (
            <CampoEditable key={`${f.gama}-${f.factor}`} etiqueta={f.gama} valorInicial={f.factor} onGuardar={async (valor) => {
              if (!cliente) throw new Error("Sin cliente Supabase.");
              await actualizarFactorGama(cliente, f.gama, valor);
              await onGuardado();
            }} />
          ))}
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Factor de condición</h2>
          {datos.condicion.map((f) => (
            <CampoEditable key={`${f.condicion}-${f.factor}`} etiqueta={f.condicion.replaceAll("_", " ")} valorInicial={f.factor} onGuardar={async (valor) => {
              if (!cliente) throw new Error("Sin cliente Supabase.");
              await actualizarFactorCondicion(cliente, f.condicion, valor);
              await onGuardado();
            }} />
          ))}
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Factor horario</h2>
          {datos.horario.map((f) => (
            <CampoEditable key={`${f.horario}-${f.factor}`} etiqueta={f.horario} valorInicial={f.factor} onGuardar={async (valor) => {
              if (!cliente) throw new Error("Sin cliente Supabase.");
              await actualizarFactorHorario(cliente, f.horario, valor);
              await onGuardado();
            }} />
          ))}
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Factor día</h2>
          {datos.dia.map((f) => (
            <CampoEditable key={`${f.dia}-${f.factor}`} etiqueta={f.dia.replaceAll("_", " ")} valorInicial={f.factor} onGuardar={async (valor) => {
              if (!cliente) throw new Error("Sin cliente Supabase.");
              await actualizarFactorDia(cliente, f.dia, valor);
              await onGuardado();
            }} />
          ))}
        </PassportCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Configuración general</h2>
          {datos.config && (
            <>
              <CampoEditable key={`tarifa-hora-${datos.config.tarifa_hora}`} etiqueta="Tarifa por hora" valorInicial={datos.config.tarifa_hora} sufijo="$/hora" onGuardar={async (valor) => {
                if (!cliente || !datos.config) throw new Error("Sin cliente Supabase.");
                await actualizarConfigTarifas(cliente, { tarifa_hora: valor, tope_factor_variable: datos.config.tope_factor_variable });
                await onGuardado();
              }} />
              <CampoEditable key={`tope-${datos.config.tope_factor_variable}`} etiqueta="Tope del factor variable" valorInicial={datos.config.tope_factor_variable} sufijo="máximo condición x horario x día" onGuardar={async (valor) => {
                if (!cliente || !datos.config) throw new Error("Sin cliente Supabase.");
                await actualizarConfigTarifas(cliente, { tarifa_hora: datos.config.tarifa_hora, tope_factor_variable: valor });
                await onGuardado();
              }} />
            </>
          )}
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Pago al conductor por certificación</h2>
          {datos.certificacionPago.map((f) => (
            <CampoEditable key={`${f.certificacion}-${f.porcentaje}`} etiqueta={f.certificacion.replaceAll("_", " ")} valorInicial={f.porcentaje} sufijo="%" onGuardar={async (valor) => {
              if (!cliente) throw new Error("Sin cliente Supabase.");
              await actualizarPagoConductorPorCertificacion(cliente, f.certificacion, valor);
              await onGuardado();
            }} />
          ))}
        </PassportCard>
      </div>
    </div>
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
    <PassportCard>
      <h2 className="font-display text-xl font-semibold">Simulador normativo</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectSim<CategoriaTarifa> etiqueta="Categoría" valor={categoria} onChange={setCategoria} opciones={datos.vehiculo.map((v) => v.categoria)} etiquetas={ETIQUETA_CATEGORIA} />
        <SelectSim<GamaTarifa> etiqueta="Gama" valor={gama} onChange={setGama} opciones={datos.gama.map((v) => v.gama)} />
        <SelectSim<CondicionTarifa> etiqueta="Condición" valor={condicion} onChange={setCondicion} opciones={datos.condicion.map((v) => v.condicion)} />
        <SelectSim<HorarioTarifa> etiqueta="Horario" valor={horario} onChange={setHorario} opciones={datos.horario.map((v) => v.horario)} />
        <SelectSim<DiaTarifa> etiqueta="Día" valor={dia} onChange={setDia} opciones={datos.dia.map((v) => v.dia)} />
        <label className="font-body text-sm font-medium text-ink/75">
          Distancia km
          <input value={distanciaKm} onChange={(e) => setDistanciaKm(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-ink/25 bg-mist px-3 py-2 text-sm" />
        </label>
        <label className="font-body text-sm font-medium text-ink/75">
          Tiempo horas
          <input value={tiempoHoras} onChange={(e) => setTiempoHoras(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-ink/25 bg-mist px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="mt-5 rounded-lg border border-ink/10 bg-mist px-4 py-4">
        {resultado.ok ? (
          <div className="grid gap-2 font-body text-sm text-ink/70 sm:grid-cols-4">
            <DatoSim etiqueta="Rango" valor={ETIQUETA_RANGO[resultado.valor.rango] ?? resultado.valor.rango} />
            <DatoSim etiqueta="Base categoría" valor={`$${resultado.valor.baseCategoria.toLocaleString("es-MX")}`} />
            <DatoSim etiqueta="Subtotal" valor={`$${resultado.valor.subtotal.toLocaleString("es-MX")}`} />
            <DatoSim etiqueta="Factor variable" valor={`${resultado.valor.factorVariable.toFixed(2)}x`} />
            <div className="sm:col-span-4">
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Tarifa final normativa</p>
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
    <label className="font-body text-sm font-medium text-ink/75">
      {etiqueta}
      <select value={valor} onChange={(e) => onChange(e.target.value as T)} className="mt-1 w-full rounded-lg border border-ink/25 bg-mist px-3 py-2 text-sm">
        {unicas.map((opcion) => <option key={opcion} value={opcion}>{etiquetas?.[opcion] ?? opcion.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function DatoSim({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="font-body text-xs uppercase tracking-wide text-ink/45">{etiqueta}</p>
      <p className="mt-1 font-semibold text-ink">{valor}</p>
    </div>
  );
}