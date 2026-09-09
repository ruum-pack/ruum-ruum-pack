"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@ruum/ui";
import {
  PERMISOS_EMPRESA,
  ROLES_EMPRESA,
  type MiembroEmpresaNuevo,
  type RolEmpresa,
  type RolEmpresaClave,
  type SucursalEmpresa
} from "@ruum/shared/types";
import {
  actualizarSucursal,
  cambiarRolMiembro,
  crearSucursal,
  invitarMiembro,
  listarEmpresasAdmin,
  listarMiembros,
  listarRoles,
  listarSucursales,
  removerMiembro
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { AdminPageHeader } from "../../../admin-ui";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "../../../admin-components";

export default function PaginaEquipoEmpresa() {
  const { id } = useParams<{ id: string }>();
  const [miembros, setMiembros] = useState<MiembroEmpresaNuevo[]>([]);
  const [roles, setRoles] = useState<RolEmpresa[]>([]);
  const [sucursales, setSucursales] = useState<SucursalEmpresa[]>([]);
  const [fiscal, setFiscal] = useState<{ rfc: string; razon_social: string | null; regimen: string | null; version: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const [invUsuarioId, setInvUsuarioId] = useState("");
  const [invRol, setInvRol] = useState<RolEmpresaClave>("viewer");
  const [sucNombre, setSucNombre] = useState("");
  const [sucCiudad, setSucCiudad] = useState("");
  const [sucDireccion, setSucDireccion] = useState("");

  const cargar = useCallback(async () => {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [m, r, s, empresas] = await Promise.all([
        listarMiembros(cliente, id),
        listarRoles(cliente),
        listarSucursales(cliente, id),
        listarEmpresasAdmin(cliente)
      ]);
      setMiembros(m);
      setRoles(r);
      setSucursales(s);
      const versiones = empresas.versionesFiscales
        .filter((v) => v.empresa_id === id)
        .sort((a, b) => b.version - a.version);
      const vigente = versiones[0];
      setFiscal(
        vigente
          ? { rfc: vigente.rfc, razon_social: vigente.razon_social, regimen: vigente.regimen_fiscal, version: vigente.version }
          : null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el equipo.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  function ejecutar(fn: (cliente: ReturnType<typeof crearClienteNavegador>) => Promise<unknown>, ok: string) {
    setMensaje(null);
    startTransition(async () => {
      try {
        await fn(crearClienteNavegador());
        setMensaje(ok);
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operación fallida.");
      }
    });
  }

  if (cargando) return <AdminLoadingState label="Cargando equipo…" />;
  if (error && miembros.length === 0)
    return <AdminErrorState description={error} action={<Button onClick={() => void cargar()}>Reintentar</Button>} />;

  return (
    <div>
      <AdminPageHeader
        titulo="Equipo y roles"
        descripcion={`Empresa ${id.slice(0, 8)}… · ${miembros.length} miembros · sin límite de 2 usuarios.`}
        accion={<Link href={`/empresas/${id}`}>Volver a la empresa</Link>}
      />

      {mensaje ? <p role="status">{mensaje}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <section aria-label="Equipo">
        <h2>Equipo ({miembros.length})</h2>
        <label>
          Usuario ID (UUID)
          <input value={invUsuarioId} onChange={(e) => setInvUsuarioId(e.target.value)} placeholder="uuid del usuario" />
        </label>
        <label>
          Rol
          <select value={invRol} onChange={(e) => setInvRol(e.target.value as RolEmpresaClave)}>
            {ROLES_EMPRESA.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <Button
          onClick={() =>
            ejecutar((c) => invitarMiembro(c, id, invUsuarioId.trim(), invRol), "Miembro invitado.")
          }
          disabled={pendiente || invUsuarioId.trim() === ""}
        >
          Invitar
        </Button>

        {miembros.length === 0 ? (
          <AdminEmptyState title="Sin miembros" description="Invita por UUID de usuario." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((m) => (
                <tr key={m.id}>
                  <td>{m.usuario_nombre ?? m.usuario_id.slice(0, 8) + "…"}</td>
                  <td>
                    <select
                      value={m.rol_clave}
                      onChange={(e) =>
                        ejecutar((c) => cambiarRolMiembro(c, m.id, e.target.value as RolEmpresaClave), "Rol actualizado.")
                      }
                      disabled={pendiente}
                      aria-label={`Rol de ${m.usuario_id}`}
                    >
                      {ROLES_EMPRESA.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>{m.estado}</td>
                  <td>
                    <Button onClick={() => ejecutar((c) => removerMiembro(c, m.id), "Miembro removido.")} disabled={pendiente}>
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Roles y permisos">
        <h2>Roles y permisos</h2>
        <table>
          <thead>
            <tr>
              <th>Rol</th>
              {PERMISOS_EMPRESA.map((p) => (
                <th key={p}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.clave}>
                <td>{r.clave}</td>
                {PERMISOS_EMPRESA.map((p) => (
                  <td key={p}>{r.permisos.includes(p) ? "✓" : "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Sucursales">
        <h2>Sucursales ({sucursales.length})</h2>
        <label>
          Nombre
          <input value={sucNombre} onChange={(e) => setSucNombre(e.target.value)} placeholder="Matriz / CEDIS Norte" />
        </label>
        <label>
          Ciudad
          <input value={sucCiudad} onChange={(e) => setSucCiudad(e.target.value)} placeholder="CDMX" />
        </label>
        <label>
          Dirección
          <input value={sucDireccion} onChange={(e) => setSucDireccion(e.target.value)} placeholder="Calle, número, colonia" />
        </label>
        <Button
          onClick={() =>
            ejecutar(
              (c) => crearSucursal(c, id, { nombre: sucNombre.trim(), ciudad: sucCiudad.trim() || null, direccion: sucDireccion.trim() || null }).then(() => {
                setSucNombre("");
                setSucCiudad("");
                setSucDireccion("");
              }),
              "Sucursal creada."
            )
          }
          disabled={pendiente || sucNombre.trim().length < 3}
        >
          Agregar sucursal
        </Button>

        {sucursales.length === 0 ? (
          <AdminEmptyState title="Sin sucursales" description="Agrega el primer centro operativo." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sucursales.map((s) => (
                <tr key={s.id}>
                  <td>{s.nombre}{s.es_principal ? " (principal)" : ""}</td>
                  <td>{s.ciudad ?? "—"}</td>
                  <td>{s.activo ? "activa" : "inactiva"}</td>
                  <td>
                    <Button
                      onClick={() => ejecutar((c) => actualizarSucursal(c, s.id, { activo: !s.activo }), "Sucursal actualizada.")}
                      disabled={pendiente}
                    >
                      {s.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Facturación">
        <h2>Facturación (lectura)</h2>
        {fiscal ? (
          <dl>
            <dt>RFC</dt><dd>{fiscal.rfc}</dd>
            <dt>Razón social</dt><dd>{fiscal.razon_social ?? "—"}</dd>
            <dt>Régimen</dt><dd>{fiscal.regimen ?? "—"}</dd>
            <dt>Versión vigente</dt><dd>v{fiscal.version}</dd>
          </dl>
        ) : (
          <AdminEmptyState title="Sin datos fiscales" description="La empresa aún no registra datos de facturación." />
        )}
      </section>

      <section aria-label="Integraciones">
        <h2>Integraciones</h2>
        <AdminEmptyState title="Fuera de alcance Fase 2" description="ERP/contabilidad se integran en una fase posterior." />
      </section>
    </div>
  );
}
