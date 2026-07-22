"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  actualizarConfiguracionAdmin,
  listarConfiguracionAdmin,
  type ConfiguracionAdmin
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { CONFIG_ROL_ADMIN } from "../../lib/roles-admin";
import { AdminPageHeader } from "../admin-ui";
import {
  AdminBadge,
  AdminButton,
  AdminDialog,
  AdminErrorState,
  AdminLoadingState,
  AdminTextarea
} from "../admin-components";

type Resultado = { tipo: "success" | "error"; mensaje: string } | null;

const CATEGORIAS: Record<string, string> = {
  operacion: "Operación",
  comunicacion: "Comunicación",
  finanzas: "Finanzas",
  seguridad: "Seguridad"
};

function formatearFecha(valor: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
}

function resumenValor(valor: unknown) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return "Sin parámetros";
  const cantidad = Object.keys(valor as Record<string, unknown>).length;
  return `${cantidad} ${cantidad === 1 ? "parámetro principal" : "parámetros principales"}`;
}

export default function PaginaConfiguracionAdmin() {
  const [registros, setRegistros] = useState<ConfiguracionAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<ConfiguracionAdmin | null>(null);
  const [json, setJson] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    setCargando(true);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      setRegistros(await listarConfiguracionAdmin(cliente));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la configuración.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const agrupados = useMemo(() => {
    return registros.reduce<Record<string, ConfiguracionAdmin[]>>((acc, registro) => {
      (acc[registro.categoria] ??= []).push(registro);
      return acc;
    }, {});
  }, [registros]);

  function abrirEditor(registro: ConfiguracionAdmin) {
    setEditando(registro);
    setJson(JSON.stringify(registro.valor, null, 2));
    setMotivo("");
    setJsonError(null);
    setResultado(null);
  }

  async function guardar() {
    if (!editando) return;
    let valor: unknown;
    try {
      valor = JSON.parse(json);
      if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        throw new Error("El valor raíz debe ser un objeto JSON.");
      }
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "JSON inválido.");
      return;
    }
    if (motivo.trim().length < 10) return;

    setGuardando(true);
    try {
      const actualizado = await actualizarConfiguracionAdmin(
        crearClienteNavegador(), editando.clave, valor, motivo.trim(), editando.version
      );
      setRegistros((actuales) => actuales.map((r) => r.clave === actualizado.clave ? actualizado : r));
      setEditando(null);
      setResultado({ tipo: "success", mensaje: `${actualizado.nombre} se actualizó y quedó registrada en auditoría.` });
    } catch (e) {
      setResultado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo guardar la configuración." });
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <main className="admin-page-shell"><AdminLoadingState label="Cargando configuración operativa" /></main>;
  if (error) return <main className="admin-page-shell"><AdminErrorState title={error} action={<AdminButton onClick={cargar}>Reintentar</AdminButton>} /></main>;

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Administración"
        titulo="Configuración"
        descripcion="Parámetros efectivos de operación, comunicación, finanzas y seguridad. Cada cambio se versiona y audita."
      />

      {resultado && (
        <div role={resultado.tipo === "error" ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 font-body text-sm ${resultado.tipo === "error" ? "border-status-error/30 bg-status-error-soft text-status-error" : "border-status-success/30 bg-status-success-soft text-status-success"}`}>
          {resultado.mensaje}
        </div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="Accesos de administración">
        <Link href="/capacidades" className="rounded-2xl border border-border-default bg-surface-primary p-5 transition hover:border-signal focus:outline-none focus:ring-2 focus:ring-focus-default">
          <AdminBadge tone="warning">Acceso crítico</AdminBadge>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Roles y capacidades</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">Concede o revoca permisos efectivos a administradores con motivo obligatorio.</p>
        </Link>
        <Link href="/auditoria" className="rounded-2xl border border-border-default bg-surface-primary p-5 transition hover:border-signal focus:outline-none focus:ring-2 focus:ring-focus-default">
          <AdminBadge tone="info">Trazabilidad</AdminBadge>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Bitácora de cambios</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">Consulta quién cambió un parámetro, cuándo lo hizo y el motivo registrado.</p>
        </Link>
        <Link href="/tarifas" className="rounded-2xl border border-border-default bg-surface-primary p-5 transition hover:border-signal focus:outline-none focus:ring-2 focus:ring-focus-default">
          <AdminBadge tone="success">Especializado</AdminBadge>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Política tarifaria</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">Gestiona precios y factores desde su módulo transaccional dedicado.</p>
        </Link>
      </section>

      {Object.entries(agrupados).map(([categoria, items]) => (
        <section key={categoria} className="mt-8" aria-labelledby={`categoria-${categoria}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono-ruum text-admin-secundario uppercase tracking-wide text-text-tertiary">Parámetros persistentes</p>
              <h2 id={`categoria-${categoria}`} className="font-display text-xl font-semibold text-ink">{CATEGORIAS[categoria] ?? categoria}</h2>
            </div>
            <AdminBadge tone="success">Operativo</AdminBadge>
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {items.map((registro) => (
              <article key={registro.clave} className="rounded-2xl border border-border-default bg-surface-primary p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">{registro.nombre}</h3>
                    <p className="mt-1 font-body text-sm text-text-secondary">{registro.descripcion}</p>
                  </div>
                  <AdminBadge tone="neutral">v{registro.version}</AdminBadge>
                </div>
                <div className="mt-4 rounded-xl bg-surface-secondary px-4 py-3">
                  <p className="font-body text-sm font-semibold text-ink">{resumenValor(registro.valor)}</p>
                  <p className="mt-1 font-body text-xs text-text-tertiary">Actualizado {formatearFecha(registro.actualizada_en)}</p>
                </div>
                <div className="mt-4 flex justify-end">
                  <AdminButton variant="secondary" onClick={() => abrirEditor(registro)}>Editar parámetros</AdminButton>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-8 rounded-2xl border border-border-default bg-surface-primary p-5">
        <h2 className="font-display text-xl font-semibold text-ink">Matriz efectiva de roles</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">Esta vista se genera desde la misma definición de roles que controla la navegación del panel.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(CONFIG_ROL_ADMIN).map(([clave, rol]) => (
            <article key={clave} className="rounded-xl border border-border-default p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-body text-sm font-semibold text-ink">{rol.etiqueta}</h3>
                <AdminBadge tone={clave === "direccion" ? "warning" : "neutral"}>{clave}</AdminBadge>
              </div>
              <p className="mt-2 font-body text-sm text-text-secondary">{rol.descripcion}</p>
              <p className="mt-3 font-body text-xs text-text-tertiary">{rol.rutasPermitidas.length} rutas base habilitadas</p>
            </article>
          ))}
        </div>
      </section>

      <AdminDialog
        open={Boolean(editando)}
        title={editando ? `Editar ${editando.nombre}` : "Editar configuración"}
        description="El cambio se guarda directamente en la base de datos. Se exige un motivo y control de versión para evitar sobrescrituras."
        onOpenChange={(abierto) => { if (!abierto && !guardando) setEditando(null); }}
        footer={<>
          <AdminButton variant="secondary" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</AdminButton>
          <AdminButton onClick={guardar} loading={guardando} disabled={motivo.trim().length < 10 || Boolean(jsonError)}>Guardar cambio</AdminButton>
        </>}
      >
        <div className="space-y-4">
          <AdminTextarea
            label="Parámetros JSON"
            description="Conserva un objeto JSON válido. Los cambios toman efecto para los consumidores de esta configuración."
            value={json}
            onChange={(e) => { setJson(e.target.value); setJsonError(null); }}
            error={jsonError ?? undefined}
            rows={14}
            spellCheck={false}
            controlClassName="font-mono-ruum text-xs"
          />
          <AdminTextarea
            label="Motivo del cambio"
            description="Mínimo 10 caracteres; se almacenará en la bitácora de seguridad."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            error={motivo.length > 0 && motivo.trim().length < 10 ? "Escribe al menos 10 caracteres." : undefined}
            rows={3}
          />
        </div>
      </AdminDialog>
    </main>
  );
}
