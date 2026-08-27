import Link from "next/link";
import type { Database } from "@ruum/shared/types";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { obtenerViajeActivo } from "../lib/inicio";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

export interface InicioUsuarioProps {
  usuario: UsuarioRow | null;
  traslados: PasaporteRow[];
}

function tarjetaVehiculo(t: PasaporteRow): string {
  const partes = [
    t.vehiculo_marca,
    t.vehiculo_modelo,
    t.vehiculo_anio ? String(t.vehiculo_anio) : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" ") : "MITSUBISHI MIRAGE 2026";
}

/* Íconos SVG dedicados con fidelidad exacta a la imagen de referencia */
function IconoCarroFrente({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z" />
      <circle cx="7.5" cy="14.5" r="1.5" />
      <circle cx="16.5" cy="14.5" r="1.5" />
    </svg>
  );
}

function IconoEscudoCheck({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconoEslabones({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="5" width="12" height="6" rx="3" />
      <rect x="6" y="13" width="12" height="6" rx="3" />
    </svg>
  );
}

function IconoCentroAyuda({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  );
}

function IconoCampana({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function IconoChevron({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconoPlus({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function InicioUsuario({ usuario, traslados }: InicioUsuarioProps) {
  const viajeActivo = obtenerViajeActivo(traslados);

  // Derivación del nombre del usuario para el saludo
  const nombreMostrar = usuario?.nombre
    ? usuario.nombre.trim().split(" ")[0].toUpperCase()
    : "ARGELIA";

  // Datos del vehículo activo (dinámicos o representativos de la imagen)
  const vehiculoTexto = viajeActivo
    ? tarjetaVehiculo(viajeActivo).toUpperCase()
    : "MITSUBISHI MIRAGE 2026";

  const vehiculoTipoTexto = viajeActivo?.vehiculo_tipo
    ? ETIQUETA_TIPO_VEHICULO[viajeActivo.vehiculo_tipo]
    : "Sedan";

  const idTrasladoActivo = viajeActivo?.traslado_id ?? "demo";
  const urlSeguimiento = viajeActivo?.traslado_id
    ? `/traslados/${viajeActivo.traslado_id}`
    : `/mis-viajes`;

  return (
    <div className="w-full max-w-md mx-auto space-y-5 pb-20 sm:pb-12 text-[#F8F8F5]">
      {/* 1. Saludo Principal */}
      <section className="pt-2">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
          Hola, {nombreMostrar} <span role="img" aria-label="saludo" className="inline-block">👋</span>
        </h1>
        <p className="mt-1 font-body text-sm text-[#8E9CAE]">
          Tu traslado está en curso.
        </p>
      </section>

      {/* 2. Tarjeta: TRASLADO ACTIVO */}
      <section>
        <div className="rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-5 shadow-2xl backdrop-blur-sm">
          {/* Header de la tarjeta */}
          <span className="block font-display text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            TRASLADO ACTIVO
          </span>

          {/* Fila principal del vehículo */}
          <div className="mt-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#141F32] text-[#FFC400] shadow-sm">
                <IconoCarroFrente className="size-6 text-[#FFC400]" />
              </div>
              <div>
                <h2 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-white leading-tight">
                  {vehiculoTexto}
                </h2>
                <p className="font-body text-xs text-[#8E9CAE] mt-0.5">
                  {vehiculoTipoTexto}
                </p>
              </div>
            </div>

            {/* Badge de estado "En curso" */}
            <span className="shrink-0 rounded-full border border-sky-500/20 bg-[#0E2442] px-3 py-1 font-body text-xs font-semibold text-[#38BDF8]">
              En curso
            </span>
          </div>

          {/* Subetapa: Recolección y línea vertical conectora */}
          <div className="mt-5 pl-1">
            <div className="flex items-center gap-2">
              <span className="flex size-3.5 items-center justify-center rounded-full bg-[#FFC400]/20">
                <span className="size-2 rounded-full bg-[#FFC400]" />
              </span>
              <span className="font-display text-xs font-black uppercase tracking-wider text-[#FFC400]">
                RECOLECCIÓN
              </span>
            </div>
            <div className="ml-[7px] border-l-2 border-[#1E293B] pl-4 py-1 mt-0.5">
              <p className="font-body text-xs text-[#94A3B8]">
                El conductor se dirige al origen.
              </p>
            </div>
          </div>

          {/* Progreso: Paso 4 de 7 y 57% */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="rounded-lg bg-[#0E2442] px-2.5 py-1 font-body font-bold text-[#60A5FA]">
                Paso 4 de 7
              </span>
              <span className="font-display text-sm font-black text-white">
                57%
              </span>
            </div>
            {/* Barra de progreso */}
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#162235]">
              <div
                className="h-full rounded-full bg-[#FFC400] transition-all duration-500"
                style={{ width: "57%" }}
              />
            </div>
          </div>

          {/* Pie de tarjeta: Ver seguimiento */}
          <div className="mt-5 border-t border-[#1C2A3E] pt-4">
            <Link
              href={urlSeguimiento}
              className="group flex items-center justify-between text-white transition hover:text-[#FFC400]"
            >
              <span className="font-display text-sm font-bold">
                Ver seguimiento del traslado
              </span>
              <span className="text-[#FFC400] transition group-hover:translate-x-0.5">
                <IconoChevron className="size-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Botón de Acción Principal: + SOLICITAR TRASLADO */}
      <section>
        <Link
          href="/traslados/nuevo"
          className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#FFC400] px-4 font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-[#0B111B] shadow-lg shadow-[#FFC400]/15 transition hover:bg-[#e6b000] active:scale-[0.98]"
        >
          <IconoPlus className="size-5 text-[#0B111B]" />
          <span>SOLICITAR TRASLADO</span>
        </Link>
      </section>

      {/* 4. Sección: ACCESOS RÁPIDOS (3 Columnas) */}
      <section className="space-y-3">
        <h2 className="font-display text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
          ACCESOS RÁPIDOS
        </h2>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {/* Card 1: Pasaporte Digital */}
          <Link
            href={idTrasladoActivo !== "demo" ? `/traslados/${idTrasladoActivo}` : "/mis-viajes"}
            className="group flex min-h-[160px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3.5 text-center shadow-md transition hover:border-sky-500/40 hover:bg-[#0D182A] active:scale-98"
          >
            <div className="flex size-11 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-400">
              <IconoEscudoCheck className="size-6 text-sky-400" />
            </div>
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Pasaporte Digital
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Consulta el estatus, evidencia y trazabilidad de tu traslado
              </p>
            </div>
            <div className="text-sky-400 transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </Link>

          {/* Card 2: Mis traslados */}
          <Link
            href="/mis-viajes"
            className="group flex min-h-[160px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3.5 text-center shadow-md transition hover:border-[#FFC400]/40 hover:bg-[#0D182A] active:scale-98"
          >
            <div className="flex size-11 items-center justify-center rounded-full border border-[#FFC400]/25 bg-[#FFC400]/10 text-[#FFC400]">
              <IconoEslabones className="size-6 text-[#FFC400]" />
            </div>
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Mis traslados
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Activos, programados e historial completo
              </p>
            </div>
            <div className="text-[#FFC400] transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </Link>

          {/* Card 3: Centro de ayuda */}
          <Link
            href="/soporte"
            className="group flex min-h-[160px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3.5 text-center shadow-md transition hover:border-emerald-500/40 hover:bg-[#0D182A] active:scale-98"
          >
            <div className="flex size-11 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
              <IconoCentroAyuda className="size-6 text-emerald-400" />
            </div>
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Centro de ayuda
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Reporta pagos, evidencia e incidentes
              </p>
            </div>
            <div className="text-emerald-400 transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </Link>
        </div>
      </section>

      {/* 5. Tarjeta: Notificaciones recientes */}
      <section>
        <Link
          href={urlSeguimiento}
          className="group flex items-center justify-between gap-3.5 rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-4 shadow-md transition hover:border-sky-500/40 hover:bg-[#0D182A] active:scale-98"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-400">
            <IconoCampana className="size-5 text-sky-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xs sm:text-sm font-bold text-white leading-tight">
              Notificaciones recientes
            </h3>
            <p className="mt-0.5 font-body text-xs text-[#94A3B8] leading-tight truncate">
              El conductor asignado se dirige al origen.
            </p>
            <p className="mt-1 font-body text-[11px] text-[#64748B]">
              Hoy, 09:30 a. m.
            </p>
          </div>
          <div className="shrink-0 text-sky-400 transition group-hover:translate-x-0.5">
            <IconoChevron className="size-4 text-sky-400" />
          </div>
        </Link>
      </section>
    </div>
  );
}
