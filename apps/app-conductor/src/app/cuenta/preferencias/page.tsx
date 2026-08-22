"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Aviso, Button, Card } from "@ruum/ui";
import { guardarPreferenciasConductor, obtenerConfiguracionConductor } from "@ruum/api/services";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { cargarConductorCuenta, type ConductorCuenta } from "../cuenta-utils";

type Preferencias = Database["public"]["Tables"]["preferencias_conductor"]["Row"];

const PREFS_DEFAULT = {
  notificaciones_push: true,
  modo_no_molestar: false,
  alertas_viaje: true,
  alertas_pago: true,
  alertas_documentos: true,
  alertas_admin: false,
  notificar_oportunidades: true,
  notificar_traslados_asignados: true,
  notificar_cambios_operativos: true,
  notificar_documentos: true,
  notificar_ganancias: true,
  notificar_promociones: false,
  viajes_locales: true,
  viajes_foraneos: true,
  viajes_nocturnos: false,
  viajes_empresariales: true,
  viajes_personales: true
};

type OpcionConfig = {
  clave: keyof typeof PREFS_DEFAULT;
  titulo: string;
  subtitulo: string;
  icono: string;
};

const SECCIONES_NOTIFICACIONES: { titulo: string; opciones: OpcionConfig[] }[] = [
  {
    titulo: "Operativas y de Servicio",
    opciones: [
      {
        clave: "notificaciones_push",
        titulo: "Push en este dispositivo",
        subtitulo: "Alertas visuales y sonoras en tiempo real",
        icono: "📲"
      },
      {
        clave: "modo_no_molestar",
        titulo: "Horario silencioso (22:00 - 07:00)",
        subtitulo: "Silencia avisos fuera de servicio o fuera de turno",
        icono: "🌙"
      },
      {
        clave: "notificar_traslados_asignados",
        titulo: "Traslados asignados",
        subtitulo: "Confirmación inmediata de servicios asignados a tu unidad",
        icono: "🚘"
      },
      {
        clave: "notificar_cambios_operativos",
        titulo: "Cambios operativos",
        subtitulo: "Modificaciones en rutas, puntos de encuentro o tiempos",
        icono: "⚡"
      },
      {
        clave: "notificar_documentos",
        titulo: "Alertas de documentos",
        subtitulo: "Avisos sobre licencias o expedientes por vencer",
        icono: "📄"
      }
    ]
  },
  {
    titulo: "Comerciales y Opcionales",
    opciones: [
      {
        clave: "notificar_oportunidades",
        titulo: "Nuevas oportunidades",
        subtitulo: "Avisos de servicios disponibles cercanos a tu ubicación",
        icono: "🎯"
      },
      {
        clave: "notificar_ganancias",
        titulo: "Ganancias y pagos",
        subtitulo: "Resumen de corte semanal y confirmación de depósitos",
        icono: "💵"
      },
      {
        clave: "notificar_promociones",
        titulo: "Promociones y beneficios",
        subtitulo: "Bonos operativos y campañas exclusivas de conductor",
        icono: "🎁"
      }
    ]
  }
];

const OPCIONES_VIAJES: OpcionConfig[] = [
  {
    clave: "viajes_locales",
    titulo: "Viajes locales",
    subtitulo: "Traslados dentro de la zona metropolitana primaria",
    icono: "🏙️"
  },
  {
    clave: "viajes_foraneos",
    titulo: "Viajes foráneos",
    subtitulo: "Traslados interurbanos y trayectos de larga distancia",
    icono: "🛣️"
  },
  {
    clave: "viajes_nocturnos",
    titulo: "Servicios nocturnos (22:00 a 06:00)",
    subtitulo: "Requiere activación voluntaria y autorización operativa",
    icono: "🌌"
  },
  {
    clave: "viajes_empresariales",
    titulo: "Viajes corporativos / empresariales",
    subtitulo: "Servicios ejecutivos para cuentas de empresa",
    icono: "🏢"
  },
  {
    clave: "viajes_personales",
    titulo: "Viajes personales de usuario final",
    subtitulo: "Servicios reservados directamente por particulares",
    icono: "👤"
  }
];

// Componente Toggle (Switch) moderno e interactivo
function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label
}: {
  checked: boolean;
  onChange: (nuevoEstado: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2",
        checked ? "bg-signal" : "bg-surface-elevated border-border/80",
        disabled ? "opacity-50 cursor-not-allowed" : ""
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block size-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5 bg-slate-950" : "translate-x-0 bg-text-secondary"
        ].join(" ")}
      />
    </button>
  );
}

export default function PaginaPreferenciasCuenta() {
  const [conductor, setConductor] = useState<ConductorCuenta | null>(null);
  const [prefs, setPrefs] = useState(PREFS_DEFAULT);
  const [notificacion, setNotificacion] = useState<{ tipo: "success" | "error"; mensaje: string } | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardandoAuto, setGuardandoAuto] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [temaSeleccionado, setTemaSeleccionado] = useState<"auto" | "light" | "dark">("dark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ruum-theme") as "light" | "dark" | null;
      if (stored) {
        setTemaSeleccionado(stored);
      } else {
        setTemaSeleccionado("auto");
      }
    }
  }, []);

  const cambiarTema = (nuevoTema: "auto" | "light" | "dark") => {
    setTemaSeleccionado(nuevoTema);
    if (typeof window !== "undefined") {
      if (nuevoTema === "auto") {
        localStorage.removeItem("ruum-theme");
        const matchesLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
        document.documentElement.setAttribute("data-theme", matchesLight ? "light" : "dark");
      } else {
        localStorage.setItem("ruum-theme", nuevoTema);
        document.documentElement.setAttribute("data-theme", nuevoTema);
      }
      window.dispatchEvent(new Event("ruum:cambio-tema"));
    }
  };

  useEffect(() => {
    async function cargar() {
      try {
        const actual = await cargarConductorCuenta();
        setConductor(actual);
        if (actual) {
          const cliente = crearClienteNavegador();
          const datos = await obtenerConfiguracionConductor(cliente, actual.id);
          const prefsDb = datos.preferencias as Preferencias | null;
          const { conductor_id: _, actualizado_en: __, ...prefsLimpias } = prefsDb ?? {};
          setPrefs({ ...PREFS_DEFAULT, ...prefsLimpias });
        }
        setErrorCarga(null);
      } catch {
        setErrorCarga("No se pudieron cargar las preferencias. Inténtalo de nuevo.");
      } finally {
        setCargando(false);
      }
    }
    void cargar();
  }, []);

  useEffect(() => {
    if (!notificacion) return;
    const timer = window.setTimeout(() => setNotificacion(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notificacion]);

  const preferenciasActivas = useMemo(
    () => [
      prefs.viajes_locales && "Locales",
      prefs.viajes_foraneos && "Foráneos",
      prefs.viajes_nocturnos && "Nocturnos autorizados",
      prefs.viajes_empresariales && "Empresariales",
      prefs.viajes_personales && "Personales"
    ].filter(Boolean) as string[],
    [prefs]
  );

  // Sincronización automática de preferencias (Auto-save)
   async function persistirPreferencias(nuevasPrefs: typeof PREFS_DEFAULT) {
     if (!conductor) return;
     setGuardandoAuto(true);
     try {
       const cliente = crearClienteNavegador();
       await guardarPreferenciasConductor(cliente, conductor.id, nuevasPrefs);
       setNotificacion({ tipo: "success", mensaje: "Preferencias actualizadas y sincronizadas" });
     } catch (error) {
       setNotificacion({
         tipo: "error",
         mensaje: traducirErrorOperativo(error, "No se pudieron guardar las preferencias.")
       });
     } finally {
       setGuardandoAuto(false);
     }
   }

   // Debounce auto-save to prevent race conditions from rapid toggles
   const autoSaveRef = useRef<{ timeoutId: NodeJS.Timeout | null; latestPrefs: typeof PREFS_DEFAULT | null }>({ timeoutId: null, latestPrefs: null });

   function cambiarPreferencia(clave: keyof typeof PREFS_DEFAULT, valor: boolean) {
     const estadoSiguiente = { ...prefs, [clave]: valor };
     setPrefs(estadoSiguiente);

     // Clear any pending save
     if (autoSaveRef.current.timeoutId) {
       clearTimeout(autoSaveRef.current.timeoutId);
     }

     // Store the latest preferences so even if an earlier save completes late,
     // we only persist the most recent state
     autoSaveRef.current.latestPrefs = estadoSiguiente;

     autoSaveRef.current.timeoutId = setTimeout(() => {
       const prefsAAhorrar = autoSaveRef.current.latestPrefs;
       autoSaveRef.current.latestPrefs = null;
       if (prefsAAhorrar) {
         void persistirPreferencias(prefsAAhorrar);
       }
     }, 500);
   }

   async function guardarManual() {
     if (!conductor) return;
     // Clear any pending auto-save
     if (autoSaveRef.current.timeoutId) {
       clearTimeout(autoSaveRef.current.timeoutId);
       autoSaveRef.current.timeoutId = null;
     }
     setPendiente(true);
     try {
       await persistirPreferencias(prefs);
     } finally {
       setPendiente(false);
     }
   }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <CuentaHeader
        titulo="Preferencias del Conductor"
        descripcion="Personaliza tus alertas de notificación y ajusta los tipos de viaje que deseas recibir."
      />

      {/* Toast de Guardado Automático */}
      {notificacion && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className={[
            "conductor-toast-bottom fixed right-4 z-50 max-w-[calc(100vw-2rem)] rounded-xl border px-4 py-3 font-body text-sm font-semibold shadow-[0_18px_48px_rgba(0,0,0,0.42)] sm:right-6 sm:max-w-sm",
            notificacion.tipo === "success"
              ? "border-emerald-500/40 bg-emerald-500/12 text-text-primary"
              : "border-red-500/40 bg-red-500/12 text-text-primary"
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <span className={notificacion.tipo === "success" ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
              {notificacion.tipo === "success" ? "✓" : "⚠️"}
            </span>
            {notificacion.mensaje}
          </div>
        </div>
      )}

      {cargando ? (
        <div className="mt-8 text-center font-body text-sm text-text-secondary">
          Cargando tus preferencias...
        </div>
      ) : errorCarga ? (
        <div className="mt-8 text-center">
          <Aviso tono="danger">{errorCarga}</Aviso>
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          {/* 1. Tarjeta de Notificaciones con Toggles e Iconos */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Canales de Alerta
                </p>

                <h2 className="font-display text-lg font-bold text-text-primary">
                  Notificaciones y Avisos
                </h2>
              </div>

              {guardandoAuto && (
                <span className="font-body text-xs font-semibold text-route-action animate-pulse">
                  Sincronizando...
                </span>
              )}
            </div>

            {SECCIONES_NOTIFICACIONES.map((seccion) => (
              <div key={seccion.titulo} className="mt-6 border-t border-border/30 pt-4 first:border-t-0 first:pt-0">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">
                  {seccion.titulo}
                </h3>

                <div className="grid gap-3">
                  {seccion.opciones.map((opcion) => {
                    const estaActivo = Boolean(prefs[opcion.clave]);
                    return (
                      <div
                        key={opcion.clave}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface-elevated/40 px-4 py-3.5 transition hover:border-border"
                      >
                        <div className="flex items-start gap-3.5">
                          <span className="text-xl shrink-0 mt-0.5">{opcion.icono}</span>
                          <div>
                            <span className="block font-display text-sm font-bold text-text-primary">
                              {opcion.titulo}
                            </span>
                            <span className="block font-body text-xs leading-5 text-text-tertiary">
                              {opcion.subtitulo}
                            </span>
                          </div>
                        </div>

                        <ToggleSwitch
                          checked={estaActivo}
                          label={opcion.titulo}
                          disabled={!conductor || guardandoAuto}
                          onChange={(nuevoValor) => cambiarPreferencia(opcion.clave, nuevoValor)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 3. Disclaimer de Seguridad Destacado */}
            <div className="mt-6 flex items-start gap-3.5 rounded-2xl border border-route-action/40 bg-route-action/10 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-route-action/20 text-lg font-bold text-route-action">
                🛡️
              </div>
              <div className="font-body text-xs leading-5 text-text-tertiary">
                <strong className="block font-display text-sm font-bold text-text-primary mb-0.5">
                  Protección Operativa e Integridad Ruum Ruum
                </strong>
                Los avisos críticos de seguridad (emergencias, protocolos de rastreo GPS) y los cambios urgentes durante un viaje activo se mantendrán siempre habilitados en tu dispositivo por política de protección al conductor.
              </div>
            </div>
          </Card>

          {/* 2. Tarjeta de Tipos de Viaje con Toggles e Iconografía */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Elegibilidad de Modalidades
                </p>

                <h2 className="font-display text-lg font-bold text-text-primary">
                  Tipos de Viaje Disponibles
                </h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {OPCIONES_VIAJES.map((opcion) => {
                const estaActivo = Boolean(prefs[opcion.clave]);
                return (
                  <div
                    key={opcion.clave}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface-elevated/40 px-4 py-3.5 transition hover:border-border"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="text-xl shrink-0 mt-0.5">{opcion.icono}</span>
                      <div>
                        <span className="block font-display text-sm font-bold text-text-primary">
                          {opcion.titulo}
                        </span>
                        <span className="block font-body text-xs leading-5 text-text-tertiary">
                          {opcion.subtitulo}
                        </span>
                      </div>
                    </div>

                    <ToggleSwitch
                      checked={estaActivo}
                      label={opcion.titulo}
                      disabled={!conductor || guardandoAuto}
                      onChange={(nuevoValor) => cambiarPreferencia(opcion.clave, nuevoValor)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Badges de resumen visual activo */}
            <div className="mt-6 border-t border-border/30 pt-4">
              <p className="font-body text-xs font-bold text-text-tertiary mb-2">
                Resumen de modalidades activadas ({preferenciasActivas.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {preferenciasActivas.map((pref) => (
                  <span
                    key={pref}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-elevated px-3 py-1 font-body text-xs font-bold text-text-primary"
                  >
                    ✓ {pref}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Tarjeta de Apariencia y Visualización (Tema) */}
          <Card>
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Apariencia y Visualización
              </p>
              <h2 className="font-display text-lg font-bold text-text-primary mt-1">
                Modo de Pantalla (Tema)
              </h2>
              <p className="mt-1 font-body text-xs text-text-tertiary">
                Selecciona la apariencia preferida para el día y la noche o permite la sincronización automática con el sistema.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { valor: "auto", etiqueta: "💻 Automático", desc: "Sigue el sistema" },
                { valor: "light", etiqueta: "☀️ Modo Día", desc: "Alto contraste" },
                { valor: "dark", etiqueta: "🌙 Modo Noche", desc: "Ruta oscura" }
              ].map((opc) => {
                const seleccionado = temaSeleccionado === opc.valor;
                return (
                  <button
                    key={opc.valor}
                    type="button"
                    onClick={() => cambiarTema(opc.valor as "auto" | "light" | "dark")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center cursor-pointer transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-route-action focus-visible:ring-offset-2 ${
                      seleccionado 
                        ? "border-route-action bg-route-action/10 text-text-primary font-extrabold shadow-xs" 
                        : "border-border/60 bg-surface-elevated/40 text-text-secondary hover:border-border"
                    }`}
                  >
                    <span className="font-display text-xs font-bold">{opc.etiqueta}</span>
                    <span className="font-body text-[10px] text-text-tertiary mt-1">{opc.desc}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Botón opcional de confirmación manual */}
          <div className="flex items-center justify-end">
            <Button
              variant="secondary"
              onClick={guardarManual}
              disabled={!conductor || pendiente || guardandoAuto}
            >
              {pendiente || guardandoAuto ? "Sincronizando..." : "Confirmar preferencias"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
