"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@ruum/ui";
import { listarCatalogoCapacidades, listarCapacidadesAdmin, concederCapacidadAdmin, type CapacidadAdmin } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader } from "../admin-ui";
import { AdminLoadingState, AdminErrorState, AdminDialog, AdminBadge } from "../admin-components";

type AdminRow = { id: string; nombre: string; rol_operativo: string };

export default function PaginaCapacidades() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [adminSeleccionado, setAdminSeleccionado] = useState<string>("");
  const [capacidades, setCapacidades] = useState<CapacidadAdmin[]>([]);
  const [catalogo, setCatalogo] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [formCapacidad, setFormCapacidad] = useState("");
  const [formConceder, setFormConceder] = useState(true);
  const [formMotivo, setFormMotivo] = useState("");

  async function cargarDatos() {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [adminsData, catalogoData] = await Promise.all([
        cliente.from("admins").select("id,nombre,rol_operativo").returns<AdminRow[]>(),
        listarCatalogoCapacidades(cliente)
      ]);
      if (adminsData.error) throw adminsData.error;
      setAdmins(adminsData.data ?? []);
      setCatalogo(catalogoData);
      if (adminsData.data && adminsData.data.length > 0 && !adminSeleccionado) {
        setAdminSeleccionado(adminsData.data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
    } finally {
      setCargando(false);
    }
  }

  async function cargarCapacidades(adminId: string) {
    try {
      const cliente = crearClienteNavegador();
      setCapacidades(await listarCapacidadesAdmin(cliente, adminId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las capacidades.");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void cargarDatos(), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (adminSeleccionado) cargarCapacidades(adminSeleccionado);
  }, [adminSeleccionado]);

  function ejecutarConcesion() {
    if (!adminSeleccionado || !formCapacidad || formMotivo.trim().length < 10) return;
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await concederCapacidadAdmin(cliente, adminSeleccionado, formCapacidad, formConceder, formMotivo.trim());
        setMensaje(formConceder ? "Capacidad concedida." : "Capacidad revocada.");
        setShowForm(false);
        setFormCapacidad("");
        setFormMotivo("");
        await cargarCapacidades(adminSeleccionado);
      } catch (e) {
        setMensaje(e instanceof Error ? e.message : "No se pudo procesar la operación.");
      }
    });
  }

  if (cargando) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando capacidades" />
      </main>
    );
  }

  if (error && capacidades.length === 0) {
    return (
      <main className="admin-page-shell">
        <AdminErrorState title={error} action={<Button onClick={cargarDatos}>Reintentar</Button>} />
      </main>
    );
  }

  const adminSelObj = admins.find(a => a.id === adminSeleccionado);

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Administración"
        titulo="Capacidades"
        descripcion="Catálogo único de capacidades. Concede o revoca permisos específicos a administradores. Los overrides individuales se respetan en middleware y PostgreSQL."
        estadoConexion={error ? "sin_conexion" : "datos_en_vivo"}
      />

      <section className="mt-6">
        <label className="font-body text-sm font-semibold text-text-secondary">Administrador</label>
        <select
          value={adminSeleccionado}
          onChange={(e) => setAdminSeleccionado(e.target.value)}
          className="mt-1 block w-full max-w-md rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm text-ink"
        >
          <option value="">Seleccionar administrador</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre} ({a.rol_operativo})</option>
          ))}
        </select>
      </section>

      {adminSelObj && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">
              Capacidades de {adminSelObj.nombre}
              <span className="ml-2 font-body text-sm font-normal text-text-tertiary">({adminSelObj.rol_operativo})</span>
            </h2>
            <Button variant="quiet" onClick={() => { setShowForm(true); setFormConceder(true); setFormCapacidad(""); setFormMotivo(""); }}>
              Conceder capacidad
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] font-body text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="border-b border-ink/10 px-3 py-2">Capacidad</th>
                  <th className="border-b border-ink/10 px-3 py-2">Estado</th>
                  <th className="border-b border-ink/10 px-3 py-2">Origen</th>
                  <th className="border-b border-ink/10 px-3 py-2">Motivo</th>
                  <th className="border-b border-ink/10 px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {capacidades.map((c) => (
                  <tr key={c.capacidad} className="align-top">
                    <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-secundario text-ink">
                      {c.capacidad}
                    </td>
                    <td className="border-b border-ink/10 px-3 py-3">
                      <AdminBadge tone={c.concedida ? "success" : "danger"}>
                        {c.concedida ? "Concedido" : "Denegado"}
                      </AdminBadge>
                    </td>
                    <td className="border-b border-ink/10 px-3 py-3 text-text-secondary">
                      {c.origen === "override" ? "Override" : "Rol base"}
                    </td>
                    <td className="border-b border-ink/10 px-3 py-3 text-text-secondary">
                      {c.motivo ?? "—"}
                    </td>
                    <td className="border-b border-ink/10 px-3 py-3">
                      {c.origen === "override" && (
                        <button
                          onClick={() => {
                            setAdminSeleccionado(adminSeleccionado);
                            setFormCapacidad(c.capacidad);
                            setFormConceder(!c.concedida);
                            setFormMotivo("");
                            setShowForm(true);
                          }}
                          className="font-body text-xs font-semibold text-status-info hover:underline"
                        >
                          {c.concedida ? "Revocar" : "Conceder"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AdminDialog
        open={showForm}
        title={formConceder ? "Conceder capacidad" : "Revocar capacidad"}
        description={`${formConceder ? "Concede" : "Revoca"} "${formCapacidad}" a ${adminSelObj?.nombre ?? ""}. El motivo es obligatorio.`}
        onOpenChange={(abierto) => { if (!abierto) setShowForm(false); }}
        footer={
          <>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-admin-boton font-semibold text-ink hover:bg-surface-secondary">Cancelar</button>
            <button type="button" onClick={ejecutarConcesion} disabled={pendiente || !formCapacidad || formMotivo.trim().length < 10} className={`rounded-lg px-4 py-2 font-body text-admin-boton font-semibold ${formConceder ? "bg-signal text-ink hover:bg-signal/90" : "border border-status-error/30 bg-status-error-soft text-status-error hover:bg-status-error hover:text-background-main"}`}>
              {pendiente ? "Procesando..." : formConceder ? "Confirmar concesión" : "Confirmar revocación"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-body text-sm font-semibold text-text-secondary">Capacidad</label>
            <select
              value={formCapacidad}
              onChange={(e) => setFormCapacidad(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm text-ink"
            >
              <option value="">Seleccionar capacidad</option>
              {catalogo
                .filter(cap => !(cap === "capacidades:administrar"))
                .map((cap) => (
                  <option key={cap} value={cap}>{cap}</option>
                ))}
              <option value="capacidades:administrar" disabled>capacidades:administrar (no auto-asignable)</option>
            </select>
          </div>
          <div>
            <label className="font-body text-sm font-semibold text-text-secondary">Acción</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input type="radio" checked={formConceder} onChange={() => setFormConceder(true)} className="accent-signal" />
                Conceder
              </label>
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input type="radio" checked={!formConceder} onChange={() => setFormConceder(false)} className="accent-signal" />
                Revocar
              </label>
            </div>
          </div>
          <div>
            <label className="font-body text-sm font-semibold text-text-secondary">Motivo *</label>
            <textarea
              value={formMotivo}
              onChange={(e) => setFormMotivo(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm text-ink"
              placeholder="Motivo obligatorio (mín. 10 caracteres)"
              rows={3}
            />
          </div>
        </div>
      </AdminDialog>

      {mensaje && (
        <div className="mt-4" role="status" aria-live="polite">
          <p className="font-body text-sm text-text-secondary">{mensaje}</p>
        </div>
      )}
    </main>
  );
}
