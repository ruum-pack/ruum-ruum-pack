"use client";

"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import { listarEmpresasAdmin, validarDocumentoEmpresa, type DatosEmpresasAdmin } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Traslado = Database["public"]["Tables"]["traslados"]["Row"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];

const TIPOS = ["Agencia automotriz", "Lote de autos", "Arrendadora", "Flotilla", "Taller", "Aseguradora", "Grupo automotriz", "Empresa general"];
const FUTURO = ["Centros de costo", "Usuarios con permisos", "Reportes mensuales", "Tarifas especiales", "Crédito corporativo", "Aprobación interna de traslados"];

const DATOS_DEMO: DatosEmpresasAdmin = {
  empresas: [],
  usuarios: [],
  traslados: []
};

const ETIQUETA_ESTADO: Record<EstadoVerificacion, string> = {
  pendiente: "Pendiente de carga",
  en_revision: "En revisión",
  verificado: "Aprobado",
  rechazado: "Rechazado"
};

function fecha(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(fechaIso));
}

function Badge({ estado }: { estado: EstadoVerificacion }) {
  const clase =
    estado === "verificado"
      ? "border-status-success/30 bg-status-success-soft text-status-success"
      : estado === "rechazado"
        ? "border-status-error/25 bg-status-error-soft text-status-error"
        : "border-status-warning/40 bg-status-warning-soft text-status-warning";
  return <span className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${clase}`}>{ETIQUETA_ESTADO[estado]}</span>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">{etiqueta}</dt>
      <dd className="mt-1 font-body text-sm font-medium">{valor || "Pendiente"}</dd>
    </div>
  );
}

function AccionesEmpresa({ empresa, onActualizado }: { empresa: Empresa; onActualizado: () => void }) {
  const [condicionesPago, setCondicionesPago] = useState(empresa.condiciones_pago ?? "");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cambiar(estado: EstadoVerificacion) {
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await validarDocumentoEmpresa(cliente, empresa.id, estado, condicionesPago);
        setMensaje("Empresa actualizada.");
        onActualizado();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo actualizar la empresa.");
      }
    });
  }

  return (
    <div className="mt-5 grid gap-3 rounded-lg border border-ink/10 px-4 py-4">
      <label className="grid gap-1.5">
        <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Condiciones de pago</span>
        <textarea
          value={condicionesPago}
          onChange={(e) => setCondicionesPago(e.target.value)}
          className="min-h-20 rounded-lg border border-ink/50 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
          placeholder="Ej. Pago por transferencia semanal, 7 días contra factura"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="quiet" onClick={() => cambiar("verificado")} disabled={pendiente}>Aprobar RFC / CFDI</Button>
        <Button variant="quiet" onClick={() => cambiar("rechazado")} disabled={pendiente}>Rechazar</Button>
        <Button variant="quiet" onClick={() => cambiar("en_revision")} disabled={pendiente}>Solicitar actualización</Button>
        {mensaje && <span className="font-body text-sm text-text-secondary">{mensaje}</span>}
      </div>
    </div>
  );
}

export default function PaginaEmpresasAdmin() {
  const [datos, setDatos] = useState<DatosEmpresasAdmin>(DATOS_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    if (!tieneSupabaseConfigurado()) {
      setDatos(DATOS_DEMO);
      setEsDemo(true);
      setCargando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      setDatos(await listarEmpresasAdmin(cliente));
      setEsDemo(false);
    } catch {
      if (puedeUsarDatosDemo()) {
        setDatos(DATOS_DEMO);
        setEsDemo(true);
      } else {
        setDatos(DATOS_DEMO);
        setEsDemo(false);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
  const timer = setTimeout(() => {
    void cargar();
  }, 0);
  return () => clearTimeout(timer);
}, []);

  const usuariosPorEmpresa = useMemo(() => {
    const mapa = new Map<string, Usuario[]>();
    for (const usuario of datos.usuarios) {
      if (!usuario.empresa_id) continue;
      mapa.set(usuario.empresa_id, [...(mapa.get(usuario.empresa_id) ?? []), usuario]);
    }
    return mapa;
  }, [datos.usuarios]);

  const viajesPorEmpresa = useMemo(() => {
    const empresaPorUsuario = new Map(datos.usuarios.filter((usuario) => usuario.empresa_id).map((usuario) => [usuario.id, usuario.empresa_id as string]));
    const mapa = new Map<string, Traslado[]>();
    for (const traslado of datos.traslados) {
      const empresaId = empresaPorUsuario.get(traslado.usuario_id);
      if (!empresaId) continue;
      mapa.set(empresaId, [...(mapa.get(empresaId) ?? []), traslado]);
    }
    return mapa;
  }, [datos.traslados, datos.usuarios]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Empresas</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">Cuentas empresariales reales, usuarios vinculados, condiciones comerciales y facturación.</p>
        </div>
        <Button>Crear empresa</Button>
      </div>

      <section className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipos de empresa</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIPOS.map((tipo) => (
              <span key={tipo} className="rounded-full border border-ink/10 px-3 py-1.5 font-body text-xs font-semibold text-text-secondary">
                {tipo}
              </span>
            ))}
          </div>
        </PassportCard>
      </section>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="atencion">No se pudieron cargar datos reales de Supabase; la lista queda vacía.</Aviso>
        </div>
      )}

      {cargando ? (
        <p className="mt-8 font-body text-sm text-text-tertiary">Cargando empresas...</p>
      ) : (
        <section className="mt-6 grid gap-4">
          {datos.empresas.length === 0 ? (
            <PassportCard>
              <p className="font-body text-sm text-text-secondary">No hay empresas registradas.</p>
            </PassportCard>
          ) : (
            datos.empresas.map((empresa) => {
              const usuarios = usuariosPorEmpresa.get(empresa.id) ?? [];
              const viajes = viajesPorEmpresa.get(empresa.id) ?? [];
              const titular = usuarios.find((usuario) => usuario.rol === "titular_empresa");
              const autorizado = usuarios.find((usuario) => usuario.rol === "usuario_autorizado");
              return (
                <PassportCard key={empresa.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Cuenta empresarial</p>
                      <h2 className="mt-1 font-display text-xl font-semibold">{empresa.nombre}</h2>
                      <p className="mt-1 font-body text-sm text-text-secondary">
                        {empresa.razon_social ?? empresa.nombre} · RFC {empresa.rfc ?? "pendiente"}
                      </p>
                    </div>
                    <Badge estado={empresa.estado_verificacion} />
                  </div>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Dato etiqueta="Titular" valor={titular?.nombre ?? titular?.correo_facturacion} />
                    <Dato etiqueta="Usuario autorizado" valor={autorizado?.nombre ?? autorizado?.correo_facturacion} />
                    <Dato etiqueta="Usuarios vinculados" valor={usuarios.length} />
                    <Dato etiqueta="Historial de traslados" valor={`${viajes.length} traslados`} />
                    <Dato etiqueta="Régimen fiscal" valor={empresa.regimen_fiscal} />
                    <Dato etiqueta="Código postal fiscal" valor={empresa.codigo_postal_fiscal} />
                    <Dato etiqueta="Uso de CFDI" valor={empresa.uso_cfdi} />
                    <Dato etiqueta="Correo facturación" valor={empresa.correo_facturacion ?? titular?.correo_facturacion} />
                    <Dato etiqueta="Condiciones comerciales" valor={empresa.condiciones_pago} />
                    <Dato etiqueta="Actualizado" valor={fecha(empresa.actualizado_en)} />
                  </dl>

                  {usuarios.length > 0 && (
                    <div className="mt-5 rounded-lg border border-ink/10 px-4 py-4">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Usuarios asociados</p>
                      <div className="mt-3 grid gap-2">
                        {usuarios.map((usuario) => (
                          <div key={usuario.id} className="flex flex-col justify-between gap-1 font-body text-sm sm:flex-row">
                            <span className="font-medium">{usuario.nombre ?? usuario.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-text-secondary">
                              {usuario.rol.replaceAll("_", " ")} · {usuario.telefono ?? usuario.correo_facturacion ?? "Sin contacto"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <AccionesEmpresa empresa={empresa} onActualizado={cargar} />
                </PassportCard>
              );
            })
          )}
        </section>
      )}

      <div className="mt-6">
        <Aviso tono="info">Fuera del MVP: {FUTURO.join(", ")}.</Aviso>
      </div>
    </main>
  );
}
