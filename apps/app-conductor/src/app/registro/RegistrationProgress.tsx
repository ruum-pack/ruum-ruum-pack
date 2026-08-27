import { PASOS_REGISTRO, TEXTO_GUARDADO_REMOTO, type EstadoGuardadoRemoto } from "./registration-types";

export function RegistrationProgress({
  paso,
  onGoToStep,
  borradorLocalGuardado,
  sesionAutenticada,
  estadoGuardadoRemoto,
  detalleGuardadoRemoto
}: {
  paso: number;
  onGoToStep: (indice: number) => void;
  borradorLocalGuardado: boolean;
  sesionAutenticada: boolean;
  estadoGuardadoRemoto: EstadoGuardadoRemoto;
  detalleGuardadoRemoto: string | null;
}) {
  const porcentaje = Math.round(((paso + 1) / PASOS_REGISTRO.length) * 100);
  const pasoActualInfo = PASOS_REGISTRO[paso] ?? PASOS_REGISTRO[0];

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* 1. Header con Barra de Progreso Porcentual */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-surface-elevated/40 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-signal text-xs font-black text-slate-950">
              {paso + 1}
            </span>
            <span className="font-display text-sm font-bold text-text-primary">
              Paso {paso + 1} de {PASOS_REGISTRO.length} — <span className="text-text-primary font-extrabold">{pasoActualInfo.shortTitle}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border/60 bg-surface-elevated px-2.5 py-0.5 font-display text-xs font-black text-text-primary">
              {porcentaje}% completado
            </span>
            <span className="hidden font-body text-xs text-text-tertiary sm:inline">
              ⏱ Tiempo est. {pasoActualInfo.tiempo}
            </span>
          </div>
        </div>

        {/* Linea de Progreso Animada */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated border border-border/30">
          <div
            className="h-full bg-signal transition-all duration-500 ease-out shadow-[0_0_12px_rgba(245,166,35,0.4)]"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>

      {/* 2. Pipeline de Pasos (Navegación Interactiva de Cuenta, Identidad, Licencia, Documentos, Revisión) */}
      <nav aria-label="Pasos de registro" className="w-full">
        {/* Vista Móvil: Scrollable Pipeline con Etiquetas de Pasos Visibles */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar [-webkit-overflow-scrolling:touch]">
            {PASOS_REGISTRO.map((pasoInfo, indice) => {
              const completado = indice < paso;
              const activo = indice === paso;

              return (
                <button
                  key={pasoInfo.titulo}
                  type="button"
                  disabled={!completado}
                  onClick={() => completado && onGoToStep(indice)}
                  className={[
                    "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200",
                    activo
                      ? "border-signal bg-signal/15 text-text-primary ring-2 ring-signal/40 shadow-sm"
                      : completado
                      ? "border-control/40 bg-control-soft text-control hover:bg-control-soft/70 cursor-pointer"
                      : "border-border/40 bg-surface-elevated/40 text-text-tertiary opacity-60 cursor-not-allowed"
                  ].join(" ")}
                  aria-label={`Paso ${indice + 1}: ${pasoInfo.titulo}`}
                  aria-current={activo ? "step" : undefined}
                >
                  <span
                    className={[
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all",
                      completado
                        ? "bg-control text-white font-bold"
                        : activo
                        ? "bg-signal text-slate-950 font-black shadow-xs"
                        : "bg-surface-elevated border border-border text-text-tertiary"
                    ].join(" ")}
                  >
                    {completado ? "✓" : pasoInfo.icono}
                  </span>
                  <div className="flex flex-col">
                    <span className={`font-display text-xs font-bold whitespace-nowrap ${activo ? "text-text-primary font-black" : completado ? "text-text-primary" : "text-text-tertiary"}`}>
                      {pasoInfo.shortTitle}
                    </span>
                    <span className="text-[10px] text-text-tertiary">{pasoInfo.tiempo}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vista Tablet / Desktop: Grid de 5 Columnas Interconectado de Alto Contraste */}
        <ol className="hidden min-w-0 gap-2 sm:grid sm:min-w-full sm:grid-cols-5">
          {PASOS_REGISTRO.map((pasoInfo, indice) => {
            const completado = indice < paso;
            const activo = indice === paso;

            return (
              <li key={pasoInfo.titulo} className="flex flex-col min-w-0">
                <button
                  type="button"
                  disabled={!completado}
                  onClick={() => completado && onGoToStep(indice)}
                  className={[
                    "group flex w-full flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-200",
                    activo
                      ? "border-signal bg-signal/10 ring-2 ring-signal/30 shadow-md transform -translate-y-0.5"
                      : completado
                      ? "border-control/30 bg-control-soft/50 hover:border-control/60 hover:bg-control-soft cursor-pointer"
                      : "border-border/50 bg-surface opacity-60 cursor-not-allowed"
                  ].join(" ")}
                  aria-label={`Paso ${indice + 1}: ${pasoInfo.titulo}`}
                  aria-current={activo ? "step" : undefined}
                  title={pasoInfo.titulo}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={[
                        "flex size-7 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold transition-all",
                        completado
                          ? "bg-control text-white font-black shadow-xs"
                          : activo
                          ? "bg-signal text-slate-950 font-black shadow-md ring-2 ring-signal/50"
                          : "bg-surface-elevated border border-border/60 text-text-tertiary"
                      ].join(" ")}
                    >
                      {completado ? "✓" : pasoInfo.icono}
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      0{indice + 1}
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      className={[
                        "font-display text-xs font-bold truncate transition-colors",
                        activo
                          ? "text-text-primary font-black"
                          : completado
                          ? "text-text-primary font-bold"
                          : "text-text-tertiary font-medium"
                      ].join(" ")}
                    >
                      {pasoInfo.shortTitle}
                    </span>
                    <span className="truncate font-body text-[10px] text-text-tertiary">
                      ⏱ {pasoInfo.tiempo}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* 3. Tarjeta Descriptiva del Paso Activo */}
      <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-surface-elevated border border-border/60 text-xl font-bold text-text-primary shadow-xs">
              {pasoActualInfo.icono}
            </div>
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Paso {paso + 1} de {PASOS_REGISTRO.length}
              </p>
              <h2 className="font-display text-base font-bold text-text-primary sm:text-lg">
                {pasoActualInfo.titulo}
              </h2>
            </div>
          </div>
          <span className="rounded-xl border border-border bg-surface-elevated px-3 py-1 font-body text-xs font-semibold text-text-secondary sm:hidden">
            ⏱ {pasoActualInfo.tiempo}
          </span>
        </div>
        <p className="mt-2.5 font-body text-sm leading-6 text-text-secondary">
          {pasoActualInfo.objetivo}
        </p>
      </div>

      {/* 4. Aviso Anticipatorio de Documentos Requeridos en Paso 1 (Cuenta) */}
      {paso === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-signal/30 bg-signal/10 p-4 text-xs leading-5 text-text-secondary shadow-xs">
          <span className="text-xl shrink-0" aria-hidden>📋</span>
          <div>
            <strong className="font-display text-sm font-bold text-text-primary block mb-0.5">
              Ten listos tus documentos para continuar:
            </strong>
            Para completar los siguientes pasos necesitarás tu <span className="font-semibold text-text-primary">CURP</span>, <span className="font-semibold text-text-primary">Licencia de conducir vigente</span> e <span className="font-semibold text-text-primary">Identificación oficial (INE o Pasaporte)</span>.
          </div>
        </div>
      )}

      {/* 5. Estado de Guardado Local / Remoto — Q4: visible y tranquilizador */}
      {!sesionAutenticada && borradorLocalGuardado && (
        <output className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 font-body text-xs font-bold text-emerald-600 dark:text-emerald-400" aria-live="polite">
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black">✓</span>
          Borrador guardado en este dispositivo — volverás donde te quedaste
        </output>
      )}

      {sesionAutenticada && estadoGuardadoRemoto !== "inactivo" && (
        <output
          aria-live="polite"
          aria-atomic="true"
          title={detalleGuardadoRemoto ?? undefined}
          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 font-body text-xs font-bold shadow-sm transition-all ${
            estadoGuardadoRemoto === "guardado"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : estadoGuardadoRemoto === "guardando"
              ? "border-border bg-surface-elevated text-text-secondary"
              : estadoGuardadoRemoto === "sin_conexion"
              ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-red-500/20 bg-red-500/10 text-red-500"
          }`}
        >
          {estadoGuardadoRemoto === "guardando" && <span className="size-4 rounded-full border-2 border-border border-t-signal animate-spin" aria-hidden />}
          {estadoGuardadoRemoto === "guardado" && <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black" aria-hidden>✓</span>}
          {estadoGuardadoRemoto === "sin_conexion" && <span aria-hidden>⚠️</span>}
          {estadoGuardadoRemoto === "error" && <span aria-hidden>⚠️</span>}
          <span className="flex flex-col leading-tight">
            <span>
              {estadoGuardadoRemoto === "guardando" && "Guardando automáticamente…"}
              {estadoGuardadoRemoto === "guardado" && "✓ Guardado — volverás donde te quedaste"}
              {estadoGuardadoRemoto === "sin_conexion" && "Sin conexión — guardado local, se sincronizará solo"}
              {estadoGuardadoRemoto === "error" && `Error al guardar${detalleGuardadoRemoto ? `: ${detalleGuardadoRemoto}` : ""}`}
            </span>
            {estadoGuardadoRemoto === "guardado" && <span className="text-[10px] font-semibold opacity-80">Cada cambio se guarda en la nube</span>}
          </span>
        </output>
      )}
    </div>
  );
}
