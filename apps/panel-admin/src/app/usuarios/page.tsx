"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { invitarUsuarioAdmin, listarUsuariosAdminPaginados } from "@ruum/api/services";
import Link from "next/link";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

const ETIQUETA_VERIFICACION: Record<UsuarioRow["estado_verificacion"], string> = {
  pendiente: "Pendiente",
  en_revision: "En revision",
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Usuarios</h1>
        <button onClick={() => setMostrarInvitar(true)} className="rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-surface-primary hover:bg-ink/90">Invitar usuario</button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <label className="sr-only" htmlFor="buscar-usuarios">Buscar usuarios</label>
        <input id="buscar-usuarios" type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} placeholder="Buscar por nombre o correo…" className="flex-1 rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
        {busqueda && <button onClick={() => { setBusqueda(""); setPagina(1); }} className="font-body text-sm text-text-tertiary hover:text-ink" aria-label="Limpiar busqueda">Limpiar</button>}
      </div>

      {error && <div className="mt-3"><Aviso tono="danger">{error}</Aviso></div>}

      <div className="mt-3 overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
        <table className="w-full font-body text-sm">
          <caption className="sr-only">Lista de usuarios registrados</caption>
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Cuenta</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Verificacion</th>
              <th className="px-4 py-3">Traslados</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Registrado</th>
              <th className="px-4 py-3">Accion</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-text-tertiary">Cargando…</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-text-tertiary">Sin resultados{busqueda ? ` para "${busqueda}"` : ""}.</td></tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/usuarios/${u.id}`} className="hover:text-focus-default hover:underline">{u.nombre ?? <span className="text-text-tertiary">Sin nombre</span>}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize">{u.tipo_cuenta}</span>
                    <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs text-text-secondary">{ETIQUETA_ESTADO_CUENTA[u.estado_cuenta ?? "activa"] ?? u.estado_cuenta}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{u.rol.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{ETIQUETA_VERIFICACION[u.estado_verificacion]}</td>
                  <td className="px-4 py-3 font-mono-ruum">{u.traslados_completados_sin_incidencia}</td>
                  <td className="px-4 py-3">{u.metodo_pago_registrado ? <span className="text-status-success">Registrado</span> : <span className="text-text-tertiary">Sin registrar</span>}</td>
                  <td className="px-4 py-3 text-text-secondary">{new Date(u.creado_en).toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3">
                    <Link href={`/usuarios/${u.id}`} className="rounded-md border border-ink/20 px-3 py-1.5 font-body text-xs font-medium text-ink hover:bg-ink/5">Gestionar</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between font-body text-sm text-text-secondary">
          <span>{totalResultados} resultado{(totalResultados !== 1) ? "s" : ""}</span>
          <div className="flex items-center gap-3">
            <span>Pagina {pagina} de {totalPaginas}</span>
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
