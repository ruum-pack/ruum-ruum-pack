/**
 * /verificacion — Verificación just-in-time con Didit y respaldo manual.
 *
 * Estados posibles al llegar aquí:
 *  - pendiente     → nunca subió doc / no verificado → mostrar opciones (Didit o manual)
 *  - en_revision   → ya subió doc, esperando admin → mostrar confirmación de espera
 *  - verificado    → cuenta aprobada → mostrar pantalla de éxito
 *  - rechazado     → mostrar opciones con aviso para reintentar
 */
import Link from "next/link";
import { NavegacionUsuario } from "../NavegacionUsuario";
import { VerificacionForm } from "./VerificacionForm";
import { obtenerUsuarioActual } from "@ruum/api/services";

interface Props {
  searchParams: Promise<{ next?: string }>;
}

/* Pantalla cuando el usuario ya está verificado */
function CuentaYaVerificada() {
  return (
    <div className="grid gap-5 text-center">
      <div className="flex justify-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#e6f9f0]">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1d9e75"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-bold text-ink">Cuenta Verificada</h2>
        <p className="mt-2 font-body text-sm leading-6 text-ink/60">
          Tu identidad ya se encuentra validada y tu cuenta está lista para solicitar y gestionar traslados vehiculares.
        </p>
      </div>

      <div className="mt-2 grid gap-3">
        <Link
          href="/traslados/nuevo"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-signal px-5 py-3 font-display text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-signal/90 focus-visible:outline-route-dark"
        >
          Solicitar traslado
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-ink/20 bg-mist px-5 py-3 font-display text-sm font-semibold text-ink transition hover:bg-ink/5"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

/* Pantalla de espera para usuarios que ya enviaron su documentación manual */
function EsperandoRevision() {
  return (
    <div className="grid gap-5">
      <div className="flex justify-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-[#f5a623]/40 bg-[#f5a623]/10">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#b8860b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-display text-xl font-semibold">En revisión</h2>
        <p className="mt-2 font-body text-sm leading-6 text-ink/60">
          Ya recibimos tu documentación. El equipo de Ruum la está revisando.
          El proceso toma entre <strong className="text-ink">24 y 48 horas hábiles</strong>.
        </p>
      </div>

      <div className="app-card grid gap-4 px-5 py-5">
        {[
          { label: "Cuenta creada", sub: "Correo y contraseña", done: true },
          { label: "Domicilio", sub: "Registrado", done: true },
          { label: "Identificación oficial", sub: "Recibida — en revisión", done: true },
          { label: "Aprobación de cuenta", sub: "Pendiente de revisión por el equipo", done: false },
        ].map(({ label, sub, done }) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className={[
                "flex size-8 items-center justify-center rounded-full",
                done ? "bg-[#e6f9f0]" : "border border-[#f5a623]/40 bg-[#f5a623]/10",
              ].join(" ")}
            >
              {done ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1d9e75"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#b8860b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-body text-sm font-medium">{label}</p>
              <p
                className={[
                  "font-body text-xs",
                  !done ? "text-[#b8860b]" : "text-ink/45",
                ].join(" ")}
              >
                {sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-[#f5a623]/25 bg-[#f5a623]/8 px-4 py-3">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#b8860b"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
        <p className="font-body text-xs leading-5 text-amber-800">
          Te notificaremos por correo y SMS cuando quedes habilitado para solicitar traslados.
          Mientras tanto puedes explorar la app.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-signal px-5 py-3 font-display text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-signal/90 focus-visible:outline-route-dark"
      >
        Ir al inicio
      </Link>

      <div
        aria-disabled="true"
        className="rounded-lg border border-ink/10 bg-mist px-4 py-3 text-center font-body text-xs leading-5 text-ink/60"
      >
        Podrás solicitar tu traslado cuando tu cuenta quede aprobada.
      </div>
    </div>
  );
}

export default async function PaginaVerificacion({ searchParams }: Props) {
  const { next } = await searchParams;
  void next;

  /* Leer estado actual del usuario para decidir qué mostrar */
  let estadoVerificacion: string | null = null;
  let docYaSubido = false;
  let fotoPerfilUrl: string | null = null;
  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);
    estadoVerificacion = usuario?.estado_verificacion ?? null;
    docYaSubido = !!usuario?.doc_identidad_url;
    fotoPerfilUrl = usuario?.foto_url ?? null;
  } catch {
    /* si falla, mostrar el formulario normalmente */
  }

  /* Si ya está verificado → pantalla de éxito */
  if (estadoVerificacion === "verificado") {
    return (
      <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
        <NavegacionUsuario variante="claro" />
        <div className="user-v2-content user-v2-content--wide py-10 sm:py-14">
          <div className="mx-auto max-w-lg">
            <CuentaYaVerificada />
          </div>
        </div>
      </main>
    );
  }

  /* Si ya subió documentación y está en revisión → pantalla de espera */
  const yaEnRevision = estadoVerificacion === "en_revision" || (docYaSubido && estadoVerificacion !== "rechazado");

  return (
    <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content user-v2-content--wide py-10 sm:py-14">
        <div className="mb-6">
          <Link href="/" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            ← Inicio
          </Link>
        </div>

        <div className="mx-auto max-w-lg">
          {yaEnRevision ? (
            <EsperandoRevision />
          ) : (
            <>
              <div className="mb-8">
                <h1 className="font-display text-2xl font-semibold leading-tight">
                  Verificación de cuenta
                </h1>
                <p className="mt-2 font-body text-sm text-ink/60">
                  Para tu seguridad y la del conductor certificado, validamos tu identidad oficial antes del primer traslado.
                </p>

                {estadoVerificacion === "rechazado" && (
                  <div className="mt-4">
                    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4m0 4h.01" />
                      </svg>
                      <p className="font-body text-xs leading-5 text-red-700">
                        Tu verificación anterior no pudo confirmarse. Realiza la prueba biométrica con Didit o sube una foto clara de tu identificación oficial.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Checklist de progreso */}
              <div className="app-card mb-6 grid gap-4 px-5 py-5">
                {[
                  { label: "Cuenta creada", sub: "Correo y contraseña", done: true },
                  { label: "Teléfono registrado", sub: "Para notificaciones del traslado", done: true },
                  { label: "Identificación oficial", sub: "Validación biométrica o documental", done: false },
                ].map(({ label, sub, done }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className={[
                        "flex size-8 items-center justify-center rounded-full",
                        done ? "bg-[#e6f9f0]" : "border border-ink/15 bg-mist",
                      ].join(" ")}
                    >
                      {done ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#1d9e75"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-ink/40"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium">{label}</p>
                      <p className="font-body text-xs text-ink/45">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Nota de seguridad */}
              <div className="app-status-strip mb-6 flex items-start gap-2.5 px-4 py-3">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#b8860b"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M12 4 18 6v5c0 4-2.5 6.8-6 8-3.5-1.2-6-4-6-8V6l6-2Z" />
                </svg>
                <p className="font-body text-xs leading-5 text-amber-800">
                  Tus datos biométricos y documentos se procesan de forma encriptada bajo estándares bancarios. No se comparten con terceros ni con los conductores.
                </p>
              </div>

              <VerificacionForm fotoPerfilInicial={fotoPerfilUrl} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
