"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarUsuariosAdmin } from "@ruum/api/services";
import { USUARIOS_DEMO } from "../../lib/datos-demo";
import { AccionesVerificacion } from "./AccionesVerificacion";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

const ETIQUETA_VERIFICACION: Record<UsuarioRow["estado_verificacion"], string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  verificado: "Verificado",
  rechazado: "Rechazado"
};

export default function PaginaUsuariosAdmin() {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  async function cargar() {
    if (!tieneSupabaseConfigurado()) {
      setUsuarios(USUARIOS_DEMO);
      setEsDemo(true);
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      setUsuarios(await listarUsuariosAdmin(cliente));
      setEsDemo(false);
    } catch {
      setUsuarios(USUARIOS_DEMO);
      setEsDemo(true);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
  const timer = setTimeout(() => { void cargar(); }, 0);
  return () => clearTimeout(timer);
}, []);

  const usuariosFiltrados = busqueda.trim()
    ? usuarios.filter((u) => {
        const q = busqueda.trim().toLowerCase();
        return (
          (u.nombre ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
        );
      })
    : usuarios;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Usuarios</h1>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no usuarios reales.</Aviso>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <label className="sr-only" htmlFor="buscar-usuarios">Buscar usuarios</label>
        <input
          id="buscar-usuarios"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="flex-1 rounded-lg border border-ink/20 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/40 focus:border-route-dark focus:outline-none focus:ring-2 focus:ring-route-dark/20"
        />
        {busqueda && (
          <button onClick={() => setBusqueda("")} className="font-body text-sm text-ink/50 hover:text-ink" aria-label="Limpiar búsqueda">
            Limpiar
          </button>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-card border border-ink/10 bg-mist">
        <table className="w-full font-body text-sm">
          <caption className="sr-only">Lista de usuarios registrados</caption>
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/45">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo de cuenta</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Verificación</th>
              <th className="px-4 py-3">Traslados sin incidencia</th>
              <th className="px-4 py-3">Método de pago</th>
              <th className="px-4 py-3">Registrado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink/50">
                  Cargando…
                </td>
              </tr>
            ) : usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink/50">
              Sin resultados para &quot;{busqueda}&quot;.
                </td>
              </tr>
            ) : (
              usuariosFiltrados.map((u) => (
                <tr key={u.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {u.nombre ?? <span className="text-ink/40">Sin nombre</span>}
                  </td>
                  <td className="px-4 py-3 capitalize">{u.tipo_cuenta}</td>
                  <td className="px-4 py-3 capitalize">{u.rol.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{ETIQUETA_VERIFICACION[u.estado_verificacion]}</td>
                  <td className="px-4 py-3 font-mono-ruum">{u.traslados_completados_sin_incidencia}</td>
                  <td className="px-4 py-3">
                    {u.metodo_pago_registrado ? (
                      <span className="text-control">Registrado</span>
                    ) : (
                      <span className="text-ink/40">Sin registrar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink/55">{new Date(u.creado_en).toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3">
                    {(u.estado_verificacion === "pendiente" || u.estado_verificacion === "en_revision") && (
                      <AccionesVerificacion usuario={u} onActualizado={cargar} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
