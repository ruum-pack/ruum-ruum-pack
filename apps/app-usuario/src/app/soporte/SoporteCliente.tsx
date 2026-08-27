"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FormularioSoporte } from "./FormularioSoporte";
import type { Database } from "@ruum/shared/types";

type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];

/* Íconos SVG dedicados con alta fidelidad gráfica */
function IconoBuscar({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconoCarroFrente({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z" />
      <circle cx="7.5" cy="14.5" r="1.5" />
      <circle cx="16.5" cy="14.5" r="1.5" />
    </svg>
  );
}

function IconoTarjeta({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function IconoCamara({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconoPerfil({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66" />
    </svg>
  );
}

function IconoAlerta({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconoPregunta({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  );
}

function IconoSalvavidas({ className = "size-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
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

function IconoChevronAbajo({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const PREGUNTAS_FRECUENTES_LISTA = [
  {
    id: "faq-1",
    pregunta: "¿Cómo funciona un traslado?",
    respuesta:
      "Un conductor certificado de Ruum Ruum se presenta en el punto de origen, realiza el inventario fotográfico de evidencia inicial en 360°, traslada tu vehículo siguiendo la ruta monitoreada por GPS y entrega con evidencia final de satisfacción.",
  },
  {
    id: "faq-2",
    pregunta: "¿Cómo puedo consultar mi traslado?",
    respuesta:
      "Desde la sección 'Mis traslados' o 'Pasaporte Digital' puedes ver el seguimiento en tiempo real, el estatus operativo, los datos del conductor y las fotos de evidencia antes y después del viaje.",
  },
  {
    id: "faq-3",
    pregunta: "¿Qué hago si el conductor no llega?",
    respuesta:
      "Puedes comunicarte directamente con el conductor asignado desde el botón de llamada en el Pasaporte Digital o reportar la demora desde el botón de 'Reportar problema' para que soporte asigne un conductor de respaldo inmediato.",
  },
  {
    id: "faq-4",
    pregunta: "¿Cómo funcionan las evidencias?",
    respuesta:
      "Tomamos fotografías de alta resolución en 8 ángulos clave del vehículo tanto en la recolección como en la entrega. Quedan registradas con sello de tiempo e inmutables en tu Pasaporte Digital.",
  },
  {
    id: "faq-5",
    pregunta: "¿Cómo puedo realizar un pago?",
    respuesta:
      "Puedes pagar de forma 100% segura mediante tarjeta de débito/crédito, transferencia SPEI o cargo corporativo desde la aplicación. No se aceptan pagos en efectivo para garantizar trazabilidad.",
  },
];

export function SoporteCliente({
  usuario,
  traslados,
  viajePreseleccionado,
}: {
  usuario: Usuario | null;
  traslados: Pasaporte[];
  viajePreseleccionado?: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [faqAbierto, setFaqAbierto] = useState<string | null>(null);
  const [modalReporte, setModalReporte] = useState(false);

  const viajeActivo = traslados.find((t) => t.traslado_id === viajePreseleccionado) ?? traslados[0];
  const nombreVehiculo = viajeActivo?.vehiculo_marca
    ? `${viajeActivo.vehiculo_marca} ${viajeActivo.vehiculo_modelo ?? ""} ${viajeActivo.vehiculo_anio ?? ""}`.trim()
    : "Mitsubishi Mirage 2026";
  const tipoVehiculo = viajeActivo?.vehiculo_tipo ? viajeActivo.vehiculo_tipo.charAt(0).toUpperCase() + viajeActivo.vehiculo_tipo.slice(1) : "Sedan";

  const faqsFiltradas = useMemo(() => {
    if (!busqueda.trim()) return PREGUNTAS_FRECUENTES_LISTA;
    const q = busqueda.trim().toLowerCase();
    return PREGUNTAS_FRECUENTES_LISTA.filter(
      (f) => f.pregunta.toLowerCase().includes(q) || f.respuesta.toLowerCase().includes(q)
    );
  }, [busqueda]);

  function alternarFaq(id: string) {
    setFaqAbierto((actual) => (actual === id ? null : id));
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-5 pb-24 text-[#F8F8F5]">
      {/* 1. Encabezado de Título */}
      <section className="pt-2">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Ayuda y soporte
        </h1>
        <h2 className="mt-1 font-display text-base font-bold text-white">
          ¿En qué podemos ayudarte?
        </h2>
        <p className="font-body text-xs sm:text-sm text-[#8E9CAE]">
          Estamos aquí para ayudarte con tu traslado.
        </p>
      </section>

      {/* 2. Buscador: "Buscar una solución..." */}
      <section>
        <div className="flex items-center gap-2.5 rounded-xl border border-[#1C2A3E] bg-[#0A1220]/90 px-3.5 py-3">
          <IconoBuscar className="size-5 text-[#8E9CAE] shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar una solución..."
            className="w-full bg-transparent p-0 font-body text-sm font-semibold text-white placeholder:text-[#8E9CAE] focus:outline-none min-h-0"
          />
        </div>
      </section>

      {/* 3. Tarjeta: TRASLADO ACTIVO */}
      <section>
        <div className="rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-sm space-y-3.5">
          <span className="block font-display text-[11px] font-bold uppercase tracking-wider text-[#FFC400]">
            TRASLADO ACTIVO
          </span>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#141F32] text-[#FFC400] shadow-sm">
                <IconoCarroFrente className="size-6 text-[#FFC400]" />
              </div>
              <div>
                <h3 className="font-display text-sm sm:text-base font-extrabold text-white leading-tight">
                  {nombreVehiculo}
                </h3>
                <p className="font-body text-xs text-[#8E9CAE] mt-0.5">
                  {tipoVehiculo}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <span className="size-2 rounded-full bg-[#FFC400] shrink-0" />
                  <span className="font-bold text-white">Recolección en proceso</span>
                </div>
                <p className="text-[11px] text-[#8E9CAE]">
                  El conductor se dirige al origen.
                </p>
              </div>
            </div>

            <Link
              href={viajeActivo?.traslado_id ? `/traslados/${viajeActivo.traslado_id}` : "/mis-viajes"}
              className="text-slate-400 hover:text-white transition"
              aria-label="Ver traslado activo"
            >
              <IconoChevron className="size-4" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setModalReporte(true)}
            className="flex h-12 w-full items-center justify-between rounded-xl bg-[#FFC400] px-4 font-display text-xs sm:text-sm font-black uppercase tracking-wide text-[#0B111B] shadow-md transition hover:bg-[#e6b000] active:scale-[0.99]"
          >
            <span>NECESITO AYUDA CON ESTE TRASLADO</span>
            <IconoChevron className="size-4 text-[#0B111B]" />
          </button>
        </div>
      </section>

      {/* 4. Sección: Temas de ayuda (Cuadrícula 3x2) */}
      <section className="space-y-3">
        <h2 className="font-display text-sm sm:text-base font-bold text-white">
          Temas de ayuda
        </h2>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {/* Card 1: Mi traslado */}
          <Link
            href="/mis-viajes"
            className="group flex min-h-[150px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3 text-center shadow-md transition hover:border-sky-500/40 hover:bg-[#0D182A] active:scale-98"
          >
            <IconoCarroFrente className="size-6 text-sky-400" />
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Mi traslado
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Seguimiento, conductor, recolección y entrega
              </p>
            </div>
            <div className="text-sky-400 transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </Link>

          {/* Card 2: Pagos */}
          <button
            type="button"
            onClick={() => setModalReporte(true)}
            className="group flex min-h-[150px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3 text-center shadow-md transition hover:border-emerald-500/40 hover:bg-[#0D182A] active:scale-98"
          >
            <IconoTarjeta className="size-6 text-emerald-400" />
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Pagos
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Cobros, tarifas, comprobantes y pagos pendientes
              </p>
            </div>
            <div className="text-emerald-400 transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </button>

          {/* Card 3: Evidencias */}
          <Link
            href={viajeActivo?.traslado_id ? `/traslados/${viajeActivo.traslado_id}` : "/mis-viajes"}
            className="group flex min-h-[150px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3 text-center shadow-md transition hover:border-purple-500/40 hover:bg-[#0D182A] active:scale-98"
          >
            <IconoCamara className="size-6 text-purple-400" />
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Evidencias
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Fotos, documentos y evidencias del vehículo
              </p>
            </div>
            <div className="text-purple-400 transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </Link>

          {/* Card 4: Mi cuenta */}
          <Link
            href="/cuenta"
            className="group flex min-h-[150px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3 text-center shadow-md transition hover:border-[#FFC400]/40 hover:bg-[#0D182A] active:scale-98"
          >
            <IconoPerfil className="size-6 text-[#FFC400]" />
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Mi cuenta
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Datos personales, acceso y configuración
              </p>
            </div>
            <div className="text-[#FFC400] transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </Link>

          {/* Card 5: Reportar problema */}
          <button
            type="button"
            onClick={() => setModalReporte(true)}
            className="group flex min-h-[150px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3 text-center shadow-md transition hover:border-rose-500/40 hover:bg-[#0D182A] active:scale-98"
          >
            <IconoAlerta className="size-6 text-rose-400" />
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Reportar problema
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Incidencias y problemas durante el traslado
              </p>
            </div>
            <div className="text-rose-400 transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </button>

          {/* Card 6: Preguntas frecuentes */}
          <a
            href="#preguntas-frecuentes"
            className="group flex min-h-[150px] flex-col items-center justify-between rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3 text-center shadow-md transition hover:border-teal-500/40 hover:bg-[#0D182A] active:scale-98"
          >
            <IconoPregunta className="size-6 text-teal-400" />
            <div className="my-auto py-1">
              <p className="font-display text-xs font-bold leading-snug text-white">
                Preguntas frecuentes
              </p>
              <p className="mt-1 font-body text-[10px] leading-tight text-[#8E9CAE]">
                Respuestas rápidas a las dudas más comunes
              </p>
            </div>
            <div className="text-teal-400 transition group-hover:translate-x-0.5">
              <IconoChevron className="size-3.5" />
            </div>
          </a>
        </div>
      </section>

      {/* 5. Banner: "¿Tienes un problema?" */}
      <section>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-3.5 sm:p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FFC400]/10 text-[#FFC400]">
              <IconoSalvavidas className="size-6 text-[#FFC400]" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white">
                ¿Tienes un problema?
              </h3>
              <p className="font-body text-xs text-[#8E9CAE]">
                Repórtalo y nuestro equipo te ayudará.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalReporte(true)}
            className="flex items-center gap-1 rounded-lg bg-[#FFC400] px-3.5 py-2 font-display text-xs font-extrabold uppercase tracking-wide text-[#0B111B] shadow-sm transition hover:bg-[#e6b000] shrink-0"
          >
            <span>REPORTAR PROBLEMA</span>
            <IconoChevron className="size-3 text-[#0B111B]" />
          </button>
        </div>
      </section>

      {/* 6. Sección: Preguntas frecuentes (Acordeón) */}
      <section id="preguntas-frecuentes" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm sm:text-base font-bold text-white">
            Preguntas frecuentes
          </h2>
          <button
            type="button"
            onClick={() => setBusqueda("")}
            className="font-body text-xs font-semibold text-sky-400 hover:underline"
          >
            Ver todas
          </button>
        </div>

        <div className="space-y-2">
          {faqsFiltradas.map((faq) => {
            const estaAbierto = faqAbierto === faq.id;
            return (
              <div
                key={faq.id}
                className="overflow-hidden rounded-xl border border-[#1C2A3E] bg-[#0A1220]/90 transition"
              >
                <button
                  type="button"
                  onClick={() => alternarFaq(faq.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-body text-xs sm:text-sm font-semibold text-white transition hover:bg-[#101C30]"
                >
                  <div className="flex items-center gap-3">
                    <IconoPregunta className="size-4 text-[#8E9CAE] shrink-0" />
                    <span>{faq.pregunta}</span>
                  </div>
                  <div className={`text-[#8E9CAE] transition-transform duration-200 ${estaAbierto ? "rotate-180" : ""}`}>
                    <IconoChevronAbajo className="size-4" />
                  </div>
                </button>
                {estaAbierto && (
                  <div className="border-t border-[#1C2A3E]/60 bg-[#070D18]/80 px-4 py-3 font-body text-xs leading-relaxed text-[#94A3B8]">
                    {faq.respuesta}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal / Formulario de Reporte Interactivo */}
      {modalReporte && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3">
          <div className="w-full max-w-lg rounded-2xl border border-[#1C2A3E] bg-[#0A1220] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1C2A3E] pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Contactar soporte</h2>
                <p className="font-body text-xs text-[#8E9CAE]">Respondemos en &lt;30 min.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalReporte(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-[#141F32] hover:text-white"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <FormularioSoporte
              traslados={traslados.filter((t) => t.traslado_id).map((t) => ({ id: t.traslado_id as string, label: `${(t.traslado_id as string).slice(0, 8).toUpperCase()} · ${t.vehiculo_marca ?? "Vehículo"}` }))}
              preseleccionado={viajePreseleccionado}
              emailUsuario={usuario?.correo_facturacion ?? usuario?.telefono ?? null}
            />
          </div>
        </div>
      )}
    </div>
  );
}
