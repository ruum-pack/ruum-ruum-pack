"use client";

import { useEffect, useState, useTransition } from "react";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { listarConductoresAdmin, listarUsuariosAdmin, validarDocumentoConductor } from "@ruum/api/services";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AccionesVerificacion } from "../usuarios/AccionesVerificacion";
import { AdminPageHeader, AdminFiltroActivo, limpiarParamsFiltroUrl } from "../admin-ui";
import { AdminLoadingState, AdminEmptyState, AdminErrorState, AdminBadge } from "../admin-components";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Conductor = Database["public"]["Tables"]["conductores"]["Row"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];

const ESTADOS = ["Pendiente de carga", "En revisión", "Aprobado", "Rechazado", "Vencido", "Requiere actualización"];

const USUARIOS_DEMO: Usuario[] = [];
const CONDUCTORES_DEMO: Conductor[] = [];

function estadoUsuario(usuario: Usuario) {
  const etiquetas: Record<EstadoVerificacion, string> = {
    pendiente: "Pendiente de carga",
    en_revision: "En revisión",
    verificado: "Aprobado",
    rechazado: "Rechazado"
  };
  return etiquetas[usuario.estado_verificacion];
}

function estadoConductor(conductor: Conductor) {
  return conductor.documentos_vigentes ? "Aprobado" : "Requiere actualización";
}

function BadgeEstado({ estado }: { estado: string }) {
  const tono = estado === "Aprobado" ? "success" : estado === "Rechazado" || estado === "Vencido" ? "danger" : "warning";
  return <AdminBadge tone={tono}>{estado}</AdminBadge>;
}

function AccionesConductor({ conductor, onActualizado }: { conductor: Conductor; onActualizado: () => void }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cambiar(aprobado: boolean) {
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await validarDocumentoConductor(cliente, conductor.id, aprobado);
        setMensaje("Conductor actualizado.");
        onActualizado();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo actualizar el conductor.");
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button variant="quiet" onClick={() => cambiar(true)} disabled={pendiente}>Aprobar</Button>
      <Button variant="quiet" onClick={() => cambiar(false)} disabled={pendiente}>Rechazar / solicitar actualización</Button>
      {mensaje && <span className="font-body text-sm text-text-secondary">{mensaje}</span>}
    </div>
  );
}

export default function PaginaDocumentosAdmin() {
  const [filtroPorVencer, setFiltroPorVencer] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_DEMO);
  const [conductores, setConductores] = useState<Conductor[]>(CONDUCTORES_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setUsuarios(USUARIOS_DEMO);
      setConductores(CONDUCTORES_DEMO);
      setEsDemo(true);
      setCargando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      const [usuariosReales, conductoresReales] = await Promise.all([
        listarUsuariosAdmin(cliente),
        listarConductoresAdmin(cliente)
      ]);
      setUsuarios(usuariosReales);
      setConductores(conductoresReales);
      setEsDemo(false);
    } catch {
      if (puedeUsarDatosDemo()) {
        setUsuarios(USUARIOS_DEMO);
        setConductores(CONDUCTORES_DEMO);
        setEsDemo(true);
      } else {
        setUsuarios([]);
        setConductores([]);
        setError("No pudimos cargar los datos documentales.");
        setEsDemo(false);
      }
    } finally {
      setCargando(false);
    }
  }

useEffect(() => {
  const timer = setTimeout(() => { void cargar(); }, 0);
  return () => clearTimeout(timer);
}, []);

  useEffect(() => {
    setFiltroPorVencer(new URLSearchParams(window.location.search).get("filtro") === "por_vencer");
  }, []);

  const conductoresVisibles = filtroPorVencer ? conductores.filter((conductor) => !conductor.documentos_vigentes) : conductores;
  const usuariosVisibles = filtroPorVencer
    ? usuarios.filter((usuario) => usuario.estado_verificacion === "pendiente" || usuario.estado_verificacion === "en_revision")
    : usuarios;

  if (cargando) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando documentos" />
      </main>
    );
  }

  if (error && !esDemo && conductores.length === 0 && usuarios.length === 0) {
    return (
      <main className="admin-page-shell">
        <AdminErrorState
          title={error}
          action={<Button onClick={cargar}>Reintentar</Button>}
        />
      </main>
    );
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Administración"
        titulo="Documentos"
        descripcion="Validación documental de conductores, usuarios y empresas."
        estadoConexion={esDemo ? "demo" : "datos_en_vivo"}
      />

      {filtroPorVencer && (
        <AdminFiltroActivo
          etiqueta="Por vencer / pendientes"
          onLimpiar={() => { setFiltroPorVencer(false); limpiarParamsFiltroUrl(["filtro"]); }}
        />
      )}

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="atencion">No se pudieron cargar datos reales de Supabase.</Aviso>
        </div>
      )}

      <section className="mt-6 grid gap-6">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Documentos de conductores</h2>
          <div className="mt-4 grid gap-3">
            {conductoresVisibles.length === 0 ? (
              <AdminEmptyState title="Sin conductores para validar" />
            ) : (
              conductoresVisibles.map((conductor) => (
                <div key={conductor.id} className="rounded-lg border border-ink/10 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-body text-sm font-semibold">{conductor.nombre}</p>
                      <p className="mt-1 font-body text-sm text-text-secondary">Licencia, identificación, comprobante de domicilio y constancia fiscal</p>
                      <p className="mt-1 font-body text-admin-secundario text-text-tertiary">ID {conductor.id.slice(0, 8).toUpperCase()} · Actualizado {new Date(conductor.actualizado_en).toLocaleString("es-MX")}</p>
                    </div>
                    <BadgeEstado estado={estadoConductor(conductor)} />
                  </div>
                  <AccionesConductor conductor={conductor} onActualizado={cargar} />
                </div>
              ))
            )}
          </div>
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Documentos de usuarios o empresas</h2>
          <div className="mt-4 grid gap-3">
            {usuariosVisibles.length === 0 ? (
              <AdminEmptyState title="Sin usuarios para validar" />
            ) : (
              usuariosVisibles.map((usuario) => (
                <div key={usuario.id} className="rounded-lg border border-ink/10 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-body text-sm font-semibold">{usuario.nombre ?? usuario.id.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-1 font-body text-sm text-text-secondary">
                        {usuario.tipo_cuenta === "empresa" ? "Constancia fiscal y datos de facturación" : "Identificación y datos de contacto"}
                      </p>
                      <p className="mt-1 font-body text-admin-secundario text-text-tertiary">
                        {usuario.rol.replaceAll("_", " ")} · {usuario.correo_facturacion ?? usuario.telefono ?? "Sin correo/teléfono registrado"}
                      </p>
                    </div>
                    <BadgeEstado estado={estadoUsuario(usuario)} />
                  </div>
                  <AccionesVerificacion usuario={usuario} onActualizado={cargar} />
                </div>
              ))
            )}
          </div>
        </PassportCard>
      </section>
    </main>
  );
}
