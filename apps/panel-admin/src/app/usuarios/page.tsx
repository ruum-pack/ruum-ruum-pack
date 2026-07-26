"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { invitarUsuarioAdmin, listarUsuariosAdminPaginados } from "@ruum/api/services";
import Link from "next/link";
import { AdminBadge, AdminButton, AdminEmptyState, AdminTooltip } from "../admin-components";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

const ETIQUETA_VERIFICACION: Record<UsuarioRow["estado_verificacion"], string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  verificado: "Verificado",
  rechazado: "Rechazado"
};

const ETIQUETA_ESTADO_CUENTA: Record<string, string> = {
  activa: "Activa",
  suspendida: "Suspendida",
  cerrada: "Cerrada"
};

export default function PaginaUsuariosAdmin() {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [tamanoPagina, setTamanoPagina] = useState(25);
  const [totalResultados, setTotalResultados] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [mostrarInvitar, setMostrarInvitar] = useState(false);
  const [filtroCuenta, setFiltroCuenta] = useState("todos");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [filtroVerificacion, setFiltroVerificacion] = useState("todos");
  const [error, setError] = useState<string | null>(null);
  const paginaRef = useRef(1);

  const cargar = useCallback(async (paginaAAbrir = paginaRef.current) => {
    if (!tieneSupabaseConfigurado()) {
      setUsuarios([]);
      setCargando(false);
      return;
    }
    const p = paginaAAbrir;
    setCargando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const resultado = await listarUsuariosAdminPaginados(cliente, p, tamanoPagina, busqueda || undefined);
      setUsuarios(resultado.data);
      paginaRef.current = resultado.paginacion.pagina;
      setPagina(resultado.paginacion.pagina);
      setTotalResultados(resultado.paginacion.total);
      setTotalPaginas(resultado.paginacion.total_paginas);
    } catch (err) {
      setUsuarios([]);
      setError(err instanceof Error ? err.message : "Error al cargar usuarios.");
    } finally {
      setCargando(false);
    }
  }, [tamanoPagina, busqueda]);

  useEffect(() => {
    paginaRef.current = 1;
    setPagina(1);
    const timer = setTimeout(() => { void cargar(1); }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, cargar, tamanoPagina]);

  function irAPagina(p: number) {
    if (p < 1 || p > totalPaginas) return;
    paginaRef.current = p;
    setPagina(p);
    void cargar(p);
  }

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((usuario) => {
      const cuentaActiva = (usuario.estado_cuenta ?? "activa") === "activa";
      const coincideCuenta = filtroCuenta === "todos"
        || (filtroCuenta === "activa" && cuentaActiva)
        || (filtroCuenta === "inactiva" && !cuentaActiva);
      const coincideRol = filtroRol === "todos" || usuario.rol === filtroRol;
      const verificado = usuario.estado_verificacion === "verificado";
      const coincideVerificacion = filtroVerificacion === "todos"
        || (filtroVerificacion === "verificado" && verificado)
        || (filtroVerificacion === "pendiente" && !verificado);
      return coincideCuenta && coincideRol && coincideVerificacion;
    });
  }, [filtroCuenta, filtroRol, filtroVerificacion, usuarios]);

  const hayFiltrosLocales = filtroCuenta !== "todos" || filtroRol !== "todos" || filtroVerificacion !== "todos";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col gap-4 border-b border-border-default pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="font-body text-admin-secundario text-text-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink">Dashboard</Link>
            <span className="mx-2">/</span>
            <span className="text-text-secondary">Usuarios</span>
          </nav>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Usuarios</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">Gestión de cuentas y permisos de la torre de control.</p>
        </div>
        <AdminButton onClick={() => setMostrarInvitar(true)} className="sticky top-3 z-10 self-start shadow-sm sm:static sm:self-auto">
          <span aria-hidden="true" className="text-base leading-none">+</span>
          Invitar usuario
        </AdminButton>
      </div>

      <div className="mt-6 rounded-card border border-ink/10 bg-surface-primary p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_200px_180px_auto]">
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-semibold text-text-secondary">Buscar usuarios</span>
            <input id="buscar-usuarios" type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} placeholder="Buscar por nombre, correo o rol" className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
          </label>
          <FiltroSelect label="Estado de cuenta" value={filtroCuenta} onChange={setFiltroCuenta} options={[["todos", "Todas"], ["activa", "Activa"], ["inactiva", "Inactiva"]]} />
          <FiltroSelect label="Rol" value={filtroRol} onChange={setFiltroRol} options={[["todos", "Todos"], ["personal", "Personal"], ["titular_empresa", "Titular empresa / Admin"], ["usuario_autorizado", "Usuario autorizado"]]} />
          <FiltroSelect label="Verificación" value={filtroVerificacion} onChange={setFiltroVerificacion} options={[["todos", "Todas"], ["verificado", "Verificado"], ["pendiente", "Pendiente"]]} />
          <div className="flex items-end">
            {(busqueda || hayFiltrosLocales) && <AdminButton variant="quiet" onClick={() => { setBusqueda(""); setFiltroCuenta("todos"); setFiltroRol("todos"); setFiltroVerificacion("todos"); setPagina(1); }} aria-label="Limpiar búsqueda">Limpiar</AdminButton>}
          </div>
        </div>
        <p className="mt-3 font-body text-sm text-text-secondary">{usuariosFiltrados.length} usuario{usuariosFiltrados.length === 1 ? "" : "s"} encontrado{usuariosFiltrados.length === 1 ? "" : "s"}</p>
      </div>

      {error && <div className="mt-3"><Aviso tono="danger">{error}</Aviso></div>}

      <div className="admin-table-card mt-4">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] font-body text-sm">
          <caption className="sr-only">Lista de usuarios registrados</caption>
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="left-0 z-10 bg-surface-primary px-4 py-3 sm:sticky">Nombre</th>
              <th className="px-4 py-3">Tipo de cuenta</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado verificación</th>
              <th className="px-4 py-3 text-right">Traslados realizados</th>
              <th className="px-4 py-3 text-center">Estado de pago</th>
              <th className="px-4 py-3">Fecha de registro</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-text-tertiary">Cargando…</td></tr>
            ) : usuariosFiltrados.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8">
                <AdminEmptyState
                  title={usuarios.length === 0 && !busqueda && !hayFiltrosLocales ? "Aún no has invitado usuarios." : "No se encontraron usuarios para tu búsqueda."}
                  description={usuarios.length === 0 && !busqueda && !hayFiltrosLocales ? "Usa el botón 'Invitar usuario' para comenzar." : "Ajusta el texto de búsqueda o limpia los filtros rápidos."}
                  action={usuarios.length === 0 && !busqueda && !hayFiltrosLocales ? <AdminButton onClick={() => setMostrarInvitar(true)}>Invitar usuario</AdminButton> : undefined}
                />
              </td></tr>
            ) : (
              usuariosFiltrados.map((u, indice) => (
                <tr key={u.id} className={`border-b border-ink/5 last:border-0 ${indice % 2 === 1 ? "bg-surface-secondary/45" : "bg-surface-primary"}`}>
                  <td data-label="Nombre" className={`left-0 z-[1] px-4 py-4 font-medium sm:sticky ${indice % 2 === 1 ? "bg-surface-secondary" : "bg-surface-primary"}`}>
                    <Link href={`/usuarios/${u.id}`} className="hover:text-focus-default hover:underline">{u.nombre ?? <span className="text-text-tertiary">Sin nombre</span>}</Link>
                  </td>
                  <td data-label="Tipo de cuenta" className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="capitalize">{u.tipo_cuenta}</span>
                      <BadgeCuenta estado={u.estado_cuenta ?? "activa"} />
                    </div>
                  </td>
                  <td data-label="Rol" className="px-4 py-4 capitalize">{etiquetaRol(u.rol)}</td>
                  <td data-label="Estado verificación" className="px-4 py-4"><BadgeVerificacion estado={u.estado_verificacion} /></td>
                  <td data-label="Traslados realizados" className="px-4 py-4 text-right font-mono-ruum">
                    <AdminTooltip label={u.traslados_completados_sin_incidencia === 0 ? "Aún no ha completado un traslado." : "Traslados completados sin incidencia."}>
                      <span tabIndex={0} className="inline-flex rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-focus-default/30">{u.traslados_completados_sin_incidencia}</span>
                    </AdminTooltip>
                  </td>
                  <td data-label="Estado de pago" className="px-4 py-4 text-center">
                    <AdminTooltip label={u.metodo_pago_registrado ? "Método de pago registrado para la cuenta." : "Sin método de pago registrado."}>
                      <span tabIndex={0}>
                        <AdminBadge tone={u.metodo_pago_registrado ? "success" : "warning"}>{u.metodo_pago_registrado ? "Registrado" : "Sin registrar"}</AdminBadge>
                      </span>
                    </AdminTooltip>
                  </td>
                  <td data-label="Fecha de registro" className="px-4 py-4 text-text-secondary">{new Date(u.creado_en).toLocaleDateString("es-MX")}</td>
                  <td data-label="Acciones" className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Link href={`/usuarios/${u.id}`} className="inline-flex items-center gap-1 rounded-md border border-ink/20 px-3 py-1.5 font-body text-xs font-semibold text-ink hover:bg-ink/5"><span aria-hidden="true">✎</span> Gestionar</Link>
                      <AdminTooltip label="Próximamente: reset contraseña, desactivar usuario, reenviar verificación.">
                        <button type="button" className="rounded-md border border-ink/20 px-2.5 py-1.5 font-body text-xs font-semibold text-text-secondary hover:bg-ink/5" aria-label={`Acciones rápidas para ${u.nombre ?? "usuario"}`}>...</button>
                      </AdminTooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between font-body text-sm text-text-secondary">
          <span>{totalResultados} resultado{(totalResultados !== 1) ? "s" : ""}</span>
          <div className="flex items-center gap-3">
            <span>Página {pagina} de {totalPaginas}</span>
            <div className="flex gap-1">
              <button onClick={() => irAPagina(pagina - 1)} disabled={pagina <= 1} className="rounded-md border border-ink/20 px-3 py-1.5 text-xs disabled:opacity-30">&larr; Anterior</button>
              <button onClick={() => irAPagina(pagina + 1)} disabled={pagina >= totalPaginas} className="rounded-md border border-ink/20 px-3 py-1.5 text-xs disabled:opacity-30">Siguiente &rarr;</button>
            </div>
          </div>
        </div>
      )}

      {mostrarInvitar && (
        <InvitarUsuarioDialog onCerrar={() => setMostrarInvitar(false)} onCreado={() => { setMostrarInvitar(false); void cargar(1); }} />
      )}
    </main>
  );
}

function FiltroSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-xs font-semibold text-text-secondary">{label}</span>
      <select value={value} onChange={(evento) => onChange(evento.target.value)} className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20">
        {options.map(([opcion, etiqueta]) => <option key={opcion} value={opcion}>{etiqueta}</option>)}
      </select>
    </label>
  );
}

function BadgeCuenta({ estado }: { estado: string }) {
  if (estado === "activa") return <AdminBadge tone="success">Activa</AdminBadge>;
  if (estado === "suspendida") return <AdminBadge tone="danger">Suspendida</AdminBadge>;
  if (estado === "cerrada") return <AdminBadge tone="neutral">Inactiva</AdminBadge>;
  return <AdminBadge tone="neutral">{ETIQUETA_ESTADO_CUENTA[estado] ?? estado}</AdminBadge>;
}

function BadgeVerificacion({ estado }: { estado: UsuarioRow["estado_verificacion"] }) {
  const tone = estado === "verificado" ? "success" : estado === "rechazado" ? "danger" : "warning";
  return <AdminBadge tone={tone}>{ETIQUETA_VERIFICACION[estado]}</AdminBadge>;
}

function etiquetaRol(rol: UsuarioRow["rol"]) {
  const etiquetas: Record<UsuarioRow["rol"], string> = {
    personal: "Personal",
    titular_empresa: "Titular empresa",
    usuario_autorizado: "Usuario autorizado"
  };
  return etiquetas[rol] ?? rol.replaceAll("_", " ");
}

function InvitarUsuarioDialog({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipoCuenta, setTipoCuenta] = useState<"personal" | "empresa">("personal");
  const [perfilEmpresa, setPerfilEmpresa] = useState<"administrador_flota" | "usuario_final" | "finanzas">("usuario_final");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invitar() {
    if (!correo.trim()) return;
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await invitarUsuarioAdmin(cliente, {
        correo: correo.trim(),
        nombre: nombre.trim() || null,
        tipoCuenta,
        perfilEmpresa: tipoCuenta === "empresa" ? perfilEmpresa : undefined
      });
      onCreado();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo invitar al usuario.";
      if (mensaje.includes("CORREO_YA_REGISTRADO") || mensaje.includes("duplicate")) {
        setError("El correo ya está registrado.");
      } else if (mensaje.includes("CORREO_INVALIDO")) {
        setError("Ingresa un correo electrónico válido.");
      } else {
        setError(mensaje);
      }
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
      <div role="dialog" aria-modal="true" aria-labelledby="invitar-usuario-titulo" className="relative w-full max-w-md rounded-card bg-surface-primary p-6 shadow-xl">
        <button type="button" onClick={onCerrar} disabled={procesando} className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border border-ink/15 font-body text-sm font-semibold text-text-secondary hover:bg-surface-secondary hover:text-ink disabled:opacity-50" aria-label="Cerrar invitación">X</button>
        <h2 id="invitar-usuario-titulo" className="font-display text-lg font-semibold">Invitar usuario</h2>
        <p className="mt-1 pr-8 font-body text-sm text-text-secondary">Se registrará una cuenta pendiente para seguimiento operativo.</p>
        <p className="mt-3 rounded-lg border border-status-info/25 bg-status-info-soft px-3 py-2 font-body text-xs text-status-info">
          Se enviará un correo con la invitación y enlace de activación al destinatario.
        </p>

        {error && <div className="mt-3"><Aviso tono="danger">{error}</Aviso></div>}

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Correo electrónico <span className="text-status-error">*</span></span>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="usuario@ejemplo.com" className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Nombre completo</span>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del usuario" className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Tipo de cuenta</span>
            <select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value as "personal" | "empresa")} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm capitalize focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20">
              <option value="personal">Personal</option>
              <option value="empresa">Empresa</option>
            </select>
          </label>
          {tipoCuenta === "empresa" && (
            <label className="flex flex-col gap-1">
              <span className="font-body text-xs font-medium text-text-secondary">Rol / permisos iniciales</span>
              <select value={perfilEmpresa} onChange={(e) => setPerfilEmpresa(e.target.value as "administrador_flota" | "usuario_final" | "finanzas")} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20">
                <option value="administrador_flota">Administrador de flota</option>
                <option value="usuario_final">Usuario final</option>
                <option value="finanzas">Finanzas</option>
              </select>
              <span className="font-body text-xs text-text-tertiary">El perfil se registra con la invitación; los permisos finos se gestionan desde Capacidades.</span>
            </label>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCerrar} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Cancelar</button>
          <button onClick={invitar} disabled={procesando || !correo.trim()} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-focus-default px-4 py-2 font-body text-sm font-semibold text-surface-primary shadow-sm hover:bg-focus-default/90 disabled:opacity-50">
            {procesando && <span className="size-3 rounded-full border-2 border-surface-primary/40 border-t-surface-primary animate-spin" aria-hidden="true" />}
            {procesando ? "Enviando..." : "Invitar"}
          </button>
        </div>
      </div>
    </div>
  );
}
