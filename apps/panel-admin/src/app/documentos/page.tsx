"use client";

"use client";
import { useEffect, useState, useTransition } from "react";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { listarConductoresAdmin, listarUsuariosAdmin, validarDocumentoConductor } from "@ruum/api/services";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AccionesVerificacion } from "../usuarios/AccionesVerificacion";

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

function Badge({ estado }: { estado: string }) {
  const clase =
    estado === "Aprobado"
      ? "border-status-success/30 bg-status-success-soft text-status-success"
      : estado === "Rechazado" || estado === "Vencido"
        ? "border-status-error/25 bg-status-error-soft text-status-error"
        : "border-status-warning/40 bg-status-warning-soft text-status-warning";
  return <span className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${clase}`}>{estado}</span>;
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
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_DEMO);
  const [conductores, setConductores] = useState<Conductor[]>(CONDUCTORES_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
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


  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Documentos</h1>
      <p className="mt-1 font-body text-sm text-text-secondary">Validación documental real de conductores, usuarios y empresas.</p>
      <div className="mt-4">
        <Aviso tono={esDemo ? "atencion" : "info"}>
          {esDemo ? "No se pudieron cargar datos reales de Supabase." : `Estados documentales: ${ESTADOS.join(", ")}.`}
        </Aviso>
      </div>

      {cargando ? (
        <p className="mt-8 font-body text-sm text-text-tertiary">Cargando documentos...</p>
      ) : (
        <section className="mt-6 grid gap-6">
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Documentos de conductores</h2>
            <div className="mt-4 grid gap-3">
              {conductores.length === 0 ? (
                <p className="rounded-lg border border-dashed border-ink/15 px-4 py-6 font-body text-sm text-text-tertiary">No hay conductores para validar.</p>
              ) : (
                conductores.map((conductor) => (
                  <div key={conductor.id} className="rounded-lg border border-ink/10 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-body text-sm font-semibold">{conductor.nombre}</p>
                        <p className="mt-1 font-body text-sm text-text-secondary">Licencia, identificación, comprobante de domicilio y constancia fiscal</p>
                        <p className="mt-1 font-body text-xs text-text-tertiary">ID {conductor.id.slice(0, 8).toUpperCase()} · Actualizado {new Date(conductor.actualizado_en).toLocaleString("es-MX")}</p>
                      </div>
                      <Badge estado={estadoConductor(conductor)} />
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
              {usuarios.length === 0 ? (
                <p className="rounded-lg border border-dashed border-ink/15 px-4 py-6 font-body text-sm text-text-tertiary">No hay usuarios para validar.</p>
              ) : (
                usuarios.map((usuario) => (
                  <div key={usuario.id} className="rounded-lg border border-ink/10 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-body text-sm font-semibold">{usuario.nombre ?? usuario.id.slice(0, 8).toUpperCase()}</p>
                        <p className="mt-1 font-body text-sm text-text-secondary">
                          {usuario.tipo_cuenta === "empresa" ? "Constancia fiscal y datos de facturación" : "Identificación y datos de contacto"}
                        </p>
                        <p className="mt-1 font-body text-xs text-text-tertiary">
                          {usuario.rol.replaceAll("_", " ")} · {usuario.correo_facturacion ?? usuario.telefono ?? "Sin correo/teléfono registrado"}
                        </p>
                      </div>
                      <Badge estado={estadoUsuario(usuario)} />
                    </div>
                    <AccionesVerificacion usuario={usuario} onActualizado={cargar} />
                  </div>
                ))
              )}
            </div>
          </PassportCard>
        </section>
      )}
    </main>
  );
}
