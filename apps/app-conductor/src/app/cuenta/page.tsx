"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso, Card, LogoMarca, SelloConductor } from "@ruum/ui";
import { useCerrarSesion } from "../../lib/use-cerrar-sesion";

type SeccionCuenta = {
  href: string;
  titulo: string;
  descripcion: string;
  icono: string;
};

type CategoriaCuenta = {
  titulo: string;
  secciones: SeccionCuenta[];
};

const CATEGORIAS_CUENTA: CategoriaCuenta[] = [
  {
    titulo: "Gestión Operativa",
    secciones: [
      { href: "/cuenta/perfil", titulo: "Perfil", descripcion: "Datos personales y contacto de emergencia.", icono: "👤" },
      { href: "/cuenta/documentos", titulo: "Documentos", descripcion: "Licencia, identificación y vigencia.", icono: "📄" },
      { href: "/cuenta/datos-bancarios", titulo: "Datos bancarios", descripcion: "CLABE para depósitos.", icono: "💳" }
    ]
  },
  {
    titulo: "Ajustes de Cuenta",
    secciones: [
      { href: "/cuenta/preferencias", titulo: "Preferencias", descripcion: "Notificaciones y modalidades.", icono: "⚙️" },
      { href: "/notificaciones", titulo: "Avisos y Alertas", descripcion: "Comunicados y alertas Ruum.", icono: "🔔" },
      { href: "/cuenta/seguridad", titulo: "Seguridad", descripcion: "Contraseña y sesión activa.", icono: "🛡️" }
    ]
  },
  {
    titulo: "Ayuda y Legal",
    secciones: [
      { href: "/cuenta/soporte", titulo: "Soporte", descripcion: "WhatsApp 24/7 y ayuda en ruta.", icono: "🎧" },
      { href: "/cuenta/legal", titulo: "Marco Legal", descripcion: "Términos y aviso de privacidad.", icono: "📜" }
    ]
  }
];

function vibrar(ms = 12) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

export default function PaginaCuenta() {
  const router = useRouter();
  const { cerrarSesion, cerrandoSesion, errorCerrarSesion } = useCerrarSesion();
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const contRef = useRef<HTMLDivElement>(null);

  // Gesto: deslizar a la izquierda para volver (swipe right -> back es nativo iOS; aquí deslizamiento horizontal)
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      // swipe horizontal predominante
      if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        // deslizar a la derecha (dx >0) desde borde izquierdo, o a la izquierda para volver según spec
        if (dx > 72 && startX < 28) {
          vibrar(10);
          router.back();
        } else if (dx < -72) {
          vibrar(10);
          router.back();
        }
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return (
    <div ref={contRef} className="mx-auto w-full max-w-5xl px-0 sm:px-6 sm:py-12 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-12">
      {/* Header — Logo RUUM Conductor, renglón abajo Cuenta, tarjeta CONDUCTOR CERTIFICADO alineada a la derecha */}
      <header className="flex items-center justify-between gap-4 border-b border-border/30 px-4 pt-4 pb-5 sm:px-0 sm:pt-0 sm:pb-6">
        <div className="flex flex-col gap-1 min-w-0">
          <LogoMarca
            tamano={28}
            color="signal"
            descriptor="Conductor"
            mostrarDescriptor={true}
            mostrarRespaldo={false}
          />
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Cuenta
          </h1>
        </div>
        <div className="flex items-center shrink-0">
          <SelloConductor compacto tema="dorado" className="scale-90 sm:scale-100 origin-right" />
        </div>
      </header>

      {errorCerrarSesion && (
        <div className="mt-3 px-4 sm:px-0">
          <Aviso tono="danger">{errorCerrarSesion}</Aviso>
        </div>
      )}

      <div className="mt-3 sm:mt-8 grid gap-6 sm:gap-8 px-4 sm:px-0">
        {CATEGORIAS_CUENTA.map((categoria) => (
          <section key={categoria.titulo} className="grid gap-2 sm:gap-3.5">
            <h2 className="px-1 font-display text-[11px] font-black uppercase tracking-widest text-text-tertiary">
              {categoria.titulo}
            </h2>

            {/* Móvil: Lista Compacta — filas delgadas, 1 columna, 48dp, divisor sutil */}
            <div className="md:hidden overflow-hidden rounded-2xl border border-border/40 bg-surface shadow-xs divide-y divide-border/10">
              {categoria.secciones.map((seccion) => (
                <Link
                  key={seccion.href}
                  href={seccion.href}
                  onClick={() => vibrar(10)}
                  className="flex items-center gap-3 px-3 py-3 min-h-14 active:bg-surface-elevated transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated text-base">
                    {seccion.icono}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-bold text-text-primary leading-tight">{seccion.titulo}</span>
                    <span className="block font-body text-xs text-text-tertiary leading-tight truncate">{seccion.descripcion}</span>
                  </span>
                  <span className="shrink-0 font-display text-sm font-bold text-text-tertiary">›</span>
                </Link>
              ))}
            </div>

            {/* Desktop: Cards en grid */}
            <div className="hidden md:grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoria.secciones.map((seccion) => (
                <Link key={seccion.href} href={seccion.href} onClick={() => vibrar(10)} className="group block min-h-12">
                  <Card className="h-full border-border/80 bg-surface-elevated/40 p-5 transition-all duration-150 group-hover:border-signal group-hover:bg-surface-elevated group-hover:shadow-md group-hover:-translate-y-0.5 active:translate-y-0">
                    <div className="flex h-full flex-col justify-between gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface font-display text-xl shadow-2xs group-hover:border-signal/40">
                          {seccion.icono}
                        </div>
                        <span className="font-display text-base font-bold text-text-tertiary transition-transform duration-150 group-hover:translate-x-1 group-hover:text-signal">→</span>
                      </div>
                      <div>
                        <h3 className="font-display text-base font-bold text-text-primary transition-colors group-hover:text-signal">{seccion.titulo}</h3>
                        <p className="mt-1 font-body text-xs leading-5 text-text-tertiary">{seccion.descripcion}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Móvil: Cerrar sesión como fila al final + bottom sheet. Desktop: card destacada (oculta en móvil para evitar tap accidental cerca de nav) */}
      {/* Lista - cerrar sesión (solo móvil, sutil) */}
      <div className="md:hidden mt-6 px-4">
        <button
          type="button"
          onClick={() => { vibrar(14); setSheetAbierto(true); }}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3.5 min-h-14 active:bg-red-500/10 transition-colors"
          aria-label="Cerrar sesión activa"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-surface text-red-500">🚪</span>
          <span className="text-left flex-1">
            <span className="block font-display text-sm font-bold text-red-500">Cerrar sesión</span>
            <span className="block font-body text-xs text-text-tertiary">Salir de este dispositivo</span>
          </span>
          <span className="font-display text-sm text-red-500">›</span>
        </button>
      </div>

      <div className="hidden md:block mt-10 px-4 sm:px-0">
        <Card className="border-red-500/20 bg-red-500/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-surface text-xl text-red-500">🚪</div>
              <div>
                <h2 className="font-display text-base font-bold text-text-primary">Cerrar Sesión Activa</h2>
                <p className="mt-0.5 font-body text-xs text-text-secondary leading-5">Saldrás de tu cuenta en este dispositivo. Deberás iniciar sesión para operar.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { vibrar(14); setSheetAbierto(true); }}
              disabled={cerrandoSesion}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-surface px-6 py-2.5 font-display text-xs font-bold text-red-500 shadow-xs transition hover:border-red-500 hover:bg-red-500/10 active:scale-95 disabled:opacity-50 cursor-pointer"
              aria-label="Cerrar sesión activa"
            >
              {cerrandoSesion ? "Cerrando..." : "🚪 Cerrar sesión"}
            </button>
          </div>
        </Card>
      </div>

      {/* Bottom sheet confirmación — evita tap accidental cerca de bottom nav */}
      {sheetAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="titulo-cerrar-sesion-sheet">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setSheetAbierto(false)} aria-label="Cerrar diálogo" />
          <div className="relative w-full max-w-md rounded-t-[1.75rem] border-t border-border/40 bg-surface-elevated p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl animate-slideUp">
            <div className="mx-auto h-1 w-10 rounded-full bg-border/60 mb-4" aria-hidden />
            <h2 id="titulo-cerrar-sesion-sheet" className="font-display text-base font-black text-text-primary">¿Cerrar sesión?</h2>
            <p className="mt-1 font-body text-sm leading-6 text-text-secondary">Saldrás de tu cuenta de conductor en este dispositivo.</p>
            <div className="mt-5 grid gap-2.5">
              <button
                type="button"
                onClick={() => { vibrar(18); void cerrarSesion(); }}
                disabled={cerrandoSesion}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-red-500 px-5 py-3 font-display text-sm font-black text-white shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                {cerrandoSesion ? "Cerrando sesión…" : "Sí, cerrar sesión"}
              </button>
              <button
                type="button"
                onClick={() => setSheetAbierto(false)}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-surface px-5 py-3 font-display text-sm font-bold text-text-primary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
