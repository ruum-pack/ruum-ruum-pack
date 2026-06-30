"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarUsuariosAdmin } from "@ruum/api/services";
import { USUARIOS_DEMO } from "../../lib/datos-demo";

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

  useEffect(() => {
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
    cargar();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-2xl font-semibold">Usuarios</h1>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no usuarios reales.</Aviso>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-card border border-ink/10 bg-mist">
        <table className="w-full font-body text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/45">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo de cuenta</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Verificación</th>
              <th className="px-4 py-3">Traslados sin incidencia</th>
              <th className="px-4 py-3">Método de pago</th>
              <th className="px-4 py-3">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink/50">
                  Cargando…
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {u.nombre ?? <span className="text-ink/40">Sin nombre</span>}
                  </td>
                  <td className="px-4 py-3 capitalize">{u.tipo_cuenta}</td>
                  <td className="px-4 py-3 capitalize">{u.rol.replace("_", " ")}</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
