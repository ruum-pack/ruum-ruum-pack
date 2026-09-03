"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "../../lib/supabase-browser";
import type { Database } from "@ruum/shared/types";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];

/* Íconos SVG dedicados con alta fidelidad */
function IconoAvatarGrande({ className = "size-16" }: { className?: string }) {
  return (
    <div className={`${className} flex items-center justify-center rounded-full bg-[#16253B] text-slate-400 shrink-0`}>
      <svg className="size-9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

function IconoEmail({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconoTelefono({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconoLapiz({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconoUsuarioCirculo({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66" />
    </svg>
  );
}

function IconoTelefonoVerde({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconoPinMorado({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
    </svg>
  );
}

function IconoCandadoAmarillo({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconoEscudoVerde({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconoCampanaAmarillo({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function IconoMundoMorado({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconoDocAzul({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconoTarjetaVerde({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function IconoLogoutRojo({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconoPapelera({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconoChevron({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function FilaOpcion({
  href,
  icono,
  titulo,
  subtitulo,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 p-3.5 transition hover:bg-[#101C30]/70"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl">
          {icono}
        </div>
        <div className="min-w-0">
          <p className="font-display text-xs sm:text-sm font-bold text-white leading-tight">
            {titulo}
          </p>
          <p className="font-body text-[11px] text-[#8E9CAE] mt-0.5 leading-tight truncate">
            {subtitulo}
          </p>
        </div>
      </div>
      <div className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white shrink-0">
        <IconoChevron className="size-4" />
      </div>
    </Link>
  );
}

export function CuentaCliente({ usuario }: { usuario: Usuario | null }) {
  const router = useRouter();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  // Derivación de datos reales del usuario autenticado
  const nombreMostrar = usuario?.nombre ?? "Mi cuenta";
  const correoMostrar = usuario?.correo_facturacion ?? "Sin correo registrado";
  const telefonoMostrar = usuario?.telefono ?? "Sin teléfono registrado";

  async function handleCerrarSesion() {
    setCerrandoSesion(true);
    try {
      const cliente = crearClienteNavegador();
      await cliente.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="user-v2-screen w-full max-w-md mx-auto pb-24">
      {/* 1. Título de la Pantalla */}
      <section className="pt-2">
        <h1 className="user-v2-heading-1">
          Mi cuenta
        </h1>
        <p className="user-v2-caption user-v2-muted mt-1">
          Administra tu perfil y preferencias.
        </p>
      </section>

      {/* 2. Tarjeta Hero de Perfil de Usuario */}
      <section>
        <div className="user-v2-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <IconoAvatarGrande />
              <div className="min-w-0">
                <h2 className="user-v2-card-title truncate">
                  {nombreMostrar}
                </h2>
                <p className="font-body text-xs text-[#8E9CAE]">
                  {usuario?.tipo_cuenta === "empresa" ? "Cuenta Empresarial" : "Usuario Personal"}
                </p>
                <div className="mt-1 flex items-center gap-1.5 font-body text-xs text-[#8E9CAE] truncate">
                  <IconoEmail className="size-3.5 text-[#8E9CAE] shrink-0" />
                  <span className="truncate">{correoMostrar}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 font-body text-xs text-[#8E9CAE]">
                  <IconoTelefono className="size-3.5 text-[#8E9CAE] shrink-0" />
                  <span>{telefonoMostrar}</span>
                </div>
              </div>
            </div>

            <Link
              href="/cuenta/perfil"
              className="text-slate-400 hover:text-white transition"
              aria-label="Ver perfil"
            >
              <IconoChevron className="size-4" />
            </Link>
          </div>

          <Link
            href="/cuenta/perfil"
            className="user-v2-secondary-button flex w-full items-center justify-center gap-2 px-4"
          >
            <IconoLapiz className="size-4 text-[#FFC400]" />
            <span>EDITAR PERFIL</span>
          </Link>
        </div>
      </section>

      {/* 3. Grupo: CUENTA */}
      <section className="space-y-1.5">
        <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-[#64748B] px-1">
          Cuenta
        </h3>
        <div className="overflow-hidden rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 shadow-xl divide-y divide-[#1C2A3E]/70">
          <FilaOpcion
            href="/cuenta/perfil"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <IconoUsuarioCirculo className="size-5" />
              </div>
            }
            titulo="Información personal"
            subtitulo="Datos personales y de identificación"
          />
          <FilaOpcion
            href="/cuenta/perfil"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <IconoTelefonoVerde className="size-5" />
              </div>
            }
            titulo="Teléfono y contacto"
            subtitulo="Correo, teléfono y medios de contacto"
          />
          <FilaOpcion
            href="/cuenta/perfil"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <IconoPinMorado className="size-5" />
              </div>
            }
            titulo="Direcciones guardadas"
            subtitulo="Orígenes y destinos frecuentes"
          />
        </div>
      </section>

      {/* 4. Grupo: SEGURIDAD */}
      <section className="space-y-1.5">
        <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-[#64748B] px-1">
          Seguridad
        </h3>
        <div className="overflow-hidden rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 shadow-xl divide-y divide-[#1C2A3E]/70">
          <FilaOpcion
            href="/cuenta/perfil"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#FFC400]/10 border border-[#FFC400]/20 text-[#FFC400]">
                <IconoCandadoAmarillo className="size-5" />
              </div>
            }
            titulo="Contraseña y acceso"
            subtitulo="Cambia tu contraseña y método de acceso"
          />
          <FilaOpcion
            href="/cuenta/perfil"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <IconoEscudoVerde className="size-5" />
              </div>
            }
            titulo="Seguridad de la cuenta"
            subtitulo="Sesiones activas y verificación en dos pasos"
          />
        </div>
      </section>

      {/* 5. Grupo: PREFERENCIAS */}
      <section className="space-y-1.5">
        <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-[#64748B] px-1">
          Preferencias
        </h3>
        <div className="overflow-hidden rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 shadow-xl divide-y divide-[#1C2A3E]/70">
          <FilaOpcion
            href="/cuenta/preferencias"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#FFC400]/10 border border-[#FFC400]/20 text-[#FFC400]">
                <IconoCampanaAmarillo className="size-5" />
              </div>
            }
            titulo="Notificaciones"
            subtitulo="Configura los avisos que deseas recibir"
          />
          <FilaOpcion
            href="/cuenta/preferencias"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <IconoMundoMorado className="size-5" />
              </div>
            }
            titulo="Preferencias"
            subtitulo="Idioma, zona horaria y otras opciones"
          />
        </div>
      </section>

      {/* 6. Grupo: DOCUMENTOS Y PAGOS */}
      <section className="space-y-1.5">
        <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-[#64748B] px-1">
          Documentos y pagos
        </h3>
        <div className="overflow-hidden rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 shadow-xl divide-y divide-[#1C2A3E]/70">
          <FilaOpcion
            href="/cuenta/legal"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <IconoDocAzul className="size-5" />
              </div>
            }
            titulo="Mis documentos"
            subtitulo="Identificaciones y documentos personales"
          />
          <FilaOpcion
            href="/cuenta/metodos-pago"
            icono={
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <IconoTarjetaVerde className="size-5" />
              </div>
            }
            titulo="Métodos de pago"
            subtitulo="Tarjetas y métodos de pago guardados"
          />
        </div>
      </section>

      {/* 7. Tarjeta: Cerrar sesión */}
      <section>
        <button
          type="button"
          onClick={handleCerrarSesion}
          disabled={cerrandoSesion}
          className="group flex w-full items-center justify-between gap-3.5 rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-4 shadow-xl text-left transition hover:border-rose-500/40 hover:bg-[#0D182A] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <IconoLogoutRojo className="size-5" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-white">
                {cerrandoSesion ? "Cerrando sesión..." : "Cerrar sesión"}
              </p>
              <p className="font-body text-xs text-[#8E9CAE]">
                Salir de tu cuenta en este dispositivo
              </p>
            </div>
          </div>
          <div className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-400 shrink-0">
            <IconoChevron className="size-4" />
          </div>
        </button>
      </section>

      {/* 8. Botón: Eliminar mi cuenta */}
      <section className="pt-2 text-center">
        <Link
          href="/soporte?motivo=eliminar_cuenta"
          className="inline-flex items-center gap-1.5 font-body text-xs font-semibold text-rose-400 transition hover:underline"
        >
          <IconoPapelera className="size-4 text-rose-400" />
          <span>Eliminar mi cuenta</span>
        </Link>
      </section>
    </div>
  );
}
