"use client";

import { useEffect, useRef, useState, useId } from "react";
import type { Database } from "@ruum/shared/types";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

interface Props {
  trasladoId: string;
  estado: EstadoTraslado;
}

interface ItemMenu {
  href: string;
  label: string;
  descripcion: string;
}

export function AccionesRapidasPasaporte({ trasladoId: _trasladoId, estado }: Props) {
  void _trasladoId;
  const enCurso = [
    "conductor_asignado",
    "conductor_en_camino_al_origen",
    "conductor_en_punto_de_recoleccion",
    "traslado_en_curso",
    "llegada_a_destino",
  ].includes(estado);

  const primario =
    estado === "cotizacion_generada"
      ? { href: "#pago-soporte", label: "Aceptar cotización", clase: "bg-signal text-ink border-signal hover:bg-signal/90" }
      : estado === "cotizacion_aceptada"
        ? { href: "#pago-soporte", label: "Pagar traslado", clase: "bg-signal text-ink border-signal hover:bg-signal/90" }
        : estado === "pago_pendiente"
          ? { href: "#pago-soporte", label: "Completar pago", clase: "bg-signal text-ink border-signal hover:bg-signal/90" }
          : enCurso
            ? { href: "#chat-conductor", label: "Chatear con conductor", clase: "bg-signal text-ink border-signal hover:bg-signal/90" }
            : { href: "#acciones-incidencia", label: "Reportar incidencia", clase: "bg-surface-elevated border-border text-text-primary hover:border-signal/40" };

  const todosItems: ItemMenu[] = [
    { href: "#chat-conductor", label: "Chat con conductor", descripcion: "Mensajes y llamada enmascarada" },
    { href: "#acciones-incidencia", label: "Reportar incidencia", descripcion: "Aviso a soporte" },
    { href: "#pago-soporte", label: "Pago y soporte", descripcion: "Tarifa y ayuda" },
    { href: "#trazabilidad", label: "Trazabilidad", descripcion: "Progreso del traslado" },
    { href: "#evidencias", label: "Evidencias", descripcion: "Fotos y bitácora" },
    { href: "#detalles", label: "Detalles del traslado", descripcion: "Ruta, conductor y vehículo" },
  ];

  // Excluir el destino del CTA primario para no duplicar
  const itemsSecundarios = todosItems.filter((item) => item.href !== primario.href);

  const [abierto, setAbierto] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const primerItemRef = useRef<HTMLAnchorElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return;
    function handleClickFuera(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setAbierto(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAbierto(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickFuera);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [abierto]);

  // Focus al primer item al abrir
  useEffect(() => {
    if (abierto) {
      // microtask para esperar render del menú
      requestAnimationFrame(() => primerItemRef.current?.focus());
    }
  }, [abierto]);

  // Navegación con flechas dentro del menú
  function handleMenuKeyDown(event: React.KeyboardEvent) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]') ?? []);
    const currentIndex = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = items[(currentIndex + 1) % items.length];
      next?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = items[(currentIndex - 1 + items.length) % items.length];
      prev?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  return (
    <nav aria-label="Acciones rápidas del traslado" className="sticky top-0 z-30 mt-4 rounded-[var(--ruum-radius-modal)] border border-border bg-surface/95 p-2 shadow-3 backdrop-blur">
      <div className="flex gap-2">
        {/* CTA Primario - siempre visible */}
        <a
          href={primario.href}
          className={`flex-1 inline-flex min-h-11 items-center justify-center rounded-[var(--ruum-radius-field)] border px-3 text-center font-body text-xs font-bold transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${primario.clase}`}
        >
          {primario.label}
        </a>

        {/* Menú de acciones secundarias */}
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            id={`btn-mas-${menuId}`}
            aria-haspopup="menu"
            aria-expanded={abierto}
            aria-controls={abierto ? `menu-mas-${menuId}` : undefined}
            onClick={() => setAbierto((v) => !v)}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-[var(--ruum-radius-field)] border border-border bg-surface-elevated px-3 text-center font-body text-xs font-bold text-text-secondary hover:border-border-strong hover:text-text-primary transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
          >
            Más
            <span aria-hidden="true" className={`inline-block text-[10px] leading-none transition-transform ${abierto ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>

          {abierto && (
            <div
              ref={menuRef}
              id={`menu-mas-${menuId}`}
              role="menu"
              aria-labelledby={`btn-mas-${menuId}`}
              onKeyDown={handleMenuKeyDown}
              className="absolute right-0 top-full z-50 mt-2 min-w-[268px] max-w-[min(88vw,320px)] overflow-hidden rounded-xl border border-border bg-surface py-1.5 shadow-3 animate-fade-in"
            >
              <p className="px-3 pb-1.5 pt-1 font-body text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Más acciones</p>
              {itemsSecundarios.map((item, idx) => (
                <a
                  key={item.href}
                  ref={idx === 0 ? primerItemRef : undefined}
                  href={item.href}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setAbierto(false)}
                  className="flex flex-col gap-0.5 px-3 py-2.5 text-left transition hover:bg-surface-soft focus:bg-surface-soft focus:outline-none focus-visible:bg-surface-soft"
                >
                  <span className="font-body text-sm font-semibold leading-none text-text-primary">{item.label}</span>
                  <span className="font-body text-xs leading-none text-text-secondary">{item.descripcion}</span>
                </a>
              ))}
              <div className="mx-2 mt-1.5 border-t border-border pt-1.5">
                <p className="px-1 font-body text-[11px] leading-4 text-text-tertiary">
                  Accesos directos a las secciones del pasaporte. Si no ves la opción, desplázate al acordeón correspondiente.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Live region para anunciar apertura/cierre a lectores */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {abierto ? `Menú Más abierto, ${itemsSecundarios.length} opciones disponibles` : ""}
      </span>
    </nav>
  );
}
