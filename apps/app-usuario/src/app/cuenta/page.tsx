import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { USUARIO_DEMO } from "../../lib/datos-demo";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Vehiculo = Database["public"]["Tables"]["vehiculos"]["Row"];
type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

const VEHICULOS_DEMO: Vehiculo[] = [
  {
    id: "demo-vehiculo-1",
    usuario_id: "demo-usuario",
    tipo: "suv",
    alias: "Mi camioneta",
    marca: "Honda",
    modelo: "CR-V",
    anio: 2021,
    transmision: "automatica",
    color: "Gris",
    placas: "ABC-123-D",
    vin: "3HGRU5H59MM000001",
    fotos_urls: [],
    estado_general_declarado: "Uso familiar, sin daños visibles relevantes.",
    tiene_tarjeta_circulacion: true,
    tiene_verificacion: true,
    tiene_placas: true,
    permiso_especial_vigente: null,
    puede_circular_rodando: true,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString()
  },
  {
    id: "demo-vehiculo-2",
    usuario_id: "demo-usuario",
    tipo: "sedan",
    alias: "Auto de oficina",
    marca: "Nissan",
    modelo: "Versa",
    anio: 2022,
    transmision: "manual",
    color: "Blanco",
    placas: "XYZ-987-A",
    vin: "3N1CN8AE9NL000002",
    fotos_urls: [],
    estado_general_declarado: "Unidad operativa para traslados locales.",
    tiene_tarjeta_circulacion: true,
    tiene_verificacion: true,
    tiene_placas: true,
    permiso_especial_vigente: null,
    puede_circular_rodando: true,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString()
  }
];

const EMPRESA_DEMO: Empresa = {
  id: "demo-empresa",
  nombre: "Ruum Demo Operadora",
  rfc: "RDO260101AB1",
  razon_social: "Ruum Demo Operadora S.A. de C.V.",
  regimen_fiscal: "601 - General de Ley Personas Morales",
  codigo_postal_fiscal: "06600",
  uso_cfdi: "G03 - Gastos en general",
  correo_facturacion: "facturacion@demo.ruum.mx",
  creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  actualizado_en: new Date().toISOString()
};

const HISTORIAL_EMPRESA_DEMO: PasaporteRow[] = [
  {
    traslado_id: "demo-empresa-001",
    usuario_id: "demo-autorizado",
    vehiculo_id: "demo-vehiculo-empresa-1",
    conductor_id: "demo-conductor",
    estado: "traslado_en_curso",
    tiene_incidencia_abierta: false,
    tipo_pago: "anticipado",
    causa_fallido: null,
    precio_cotizado: 2850,
    precio_final: null,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    actualizado_en: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    vehiculo_tipo: "suv",
    vehiculo_marca: "Toyota",
    vehiculo_modelo: "RAV4",
    vehiculo_anio: 2023,
    conductor_nombre: "Conductor asignado",
    conductor_estado: "activo",
    conductor_nivel: "ejecutivo",
    conductor_calificacion: 4.9,
    evidencia_inicial_fotos_sincronizadas: 5,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 2850
  },
  {
    traslado_id: "demo-empresa-002",
    usuario_id: "demo-titular",
    vehiculo_id: "demo-vehiculo-empresa-2",
    conductor_id: null,
    estado: "pendiente_de_conductor",
    tiene_incidencia_abierta: false,
    tipo_pago: "al_cierre",
    causa_fallido: null,
    precio_cotizado: 1900,
    precio_final: null,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    actualizado_en: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    vehiculo_tipo: "sedan",
    vehiculo_marca: "Nissan",
    vehiculo_modelo: "Sentra",
    vehiculo_anio: 2022,
    conductor_nombre: null,
    conductor_estado: null,
    conductor_nivel: null,
    conductor_calificacion: null,
    evidencia_inicial_fotos_sincronizadas: 0,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 0
  }
];

async function obtenerCuenta() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      usuario: { ...USUARIO_DEMO, tipo_cuenta: "empresa" as const, rol: "titular_empresa" as const, empresa_id: EMPRESA_DEMO.id },
      vehiculos: VEHICULOS_DEMO,
      empresa: EMPRESA_DEMO,
      historialEmpresa: HISTORIAL_EMPRESA_DEMO,
      esDemo: true
    };
  }

  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const { listarTrasladosDeEmpresa, obtenerUsuarioActual } = await import("@ruum/api/services");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);

    if (!usuario) {
      return {
        usuario: { ...USUARIO_DEMO, tipo_cuenta: "empresa" as const, rol: "titular_empresa" as const, empresa_id: EMPRESA_DEMO.id },
        vehiculos: VEHICULOS_DEMO,
        empresa: EMPRESA_DEMO,
        historialEmpresa: HISTORIAL_EMPRESA_DEMO,
        esDemo: true
      };
    }

    const [vehiculosRes, empresaRes] = await Promise.all([
      cliente.from("vehiculos").select("*").eq("usuario_id", usuario.id).order("creado_en", { ascending: false }),
      usuario.empresa_id ? cliente.from("empresas").select("*").eq("id", usuario.empresa_id).maybeSingle() : null
    ]);

    if (vehiculosRes.error) throw vehiculosRes.error;
    if (empresaRes?.error) throw empresaRes.error;

    const historialEmpresa =
      usuario.rol === "titular_empresa" && usuario.empresa_id
        ? await listarTrasladosDeEmpresa(cliente, usuario.empresa_id)
        : [];

    return {
      usuario,
      vehiculos: vehiculosRes.data ?? [],
      empresa: empresaRes?.data ?? null,
      historialEmpresa,
      esDemo: false
    };
  } catch {
    return {
      usuario: { ...USUARIO_DEMO, tipo_cuenta: "empresa" as const, rol: "titular_empresa" as const, empresa_id: EMPRESA_DEMO.id },
      vehiculos: VEHICULOS_DEMO,
      empresa: EMPRESA_DEMO,
      historialEmpresa: HISTORIAL_EMPRESA_DEMO,
      esDemo: true
    };
  }
}

function iniciales(nombre: string | null | undefined) {
  if (!nombre) return "RR";
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

function dato(valor: string | number | null | undefined) {
  return valor ? String(valor) : "Pendiente";
}

function fechaCorta(fechaIso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

function dinero(valor: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(valor ?? 0);
}

function Campo({ etiqueta, valor, tipo = "text" }: { etiqueta: string; valor?: string | null | undefined; tipo?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-body text-sm font-medium text-ink">{etiqueta}</span>
      <input
        type={tipo}
        defaultValue={valor ?? ""}
        className="rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
        placeholder="Pendiente"
      />
    </label>
  );
}

function Seccion({
  titulo,
  descripcion,
  children
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <PassportCard>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">{titulo}</h2>
        {descripcion && <p className="font-body text-sm text-ink/55">{descripcion}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </PassportCard>
  );
}

export default async function PaginaCuenta() {
  const { usuario, vehiculos, empresa, historialEmpresa, esDemo } = await obtenerCuenta();
  const correo = usuario.correo_facturacion ?? "correo@pendiente.com";
  const esEmpresa = usuario.tipo_cuenta === "empresa" || usuario.rol === "titular_empresa";
  const esTitularEmpresa = usuario.rol === "titular_empresa" && Boolean(usuario.empresa_id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Inicio
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">Cuenta</h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-ink/60">
            Administra tu perfil, vehículos frecuentes, métodos de pago y datos de facturación.
          </p>
        </div>
        <Link href="/traslados/nuevo">
          <Button>Solicitar traslado</Button>
        </Link>
      </header>

      {esDemo && (
        <div className="mb-6">
          <Aviso tono="info">
            Estás viendo la cuenta con datos de ejemplo. Inicia sesión para editar tu información real.
          </Aviso>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Seccion titulo="Perfil del usuario" descripcion="Datos visibles y de contacto de la cuenta.">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              {usuario.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={usuario.foto_url} alt="Foto de perfil" className="size-20 rounded-full object-cover" />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-full bg-ink font-display text-2xl text-mist">
                  {iniciales(usuario.nombre)}
                </div>
              )}
              <div>
                <p className="font-body text-lg font-semibold">{dato(usuario.nombre)}</p>
                <p className="mt-1 font-body text-sm text-ink/55">
                  {usuario.tipo_cuenta === "empresa" ? "Cuenta empresarial" : "Cuenta personal"} ·{" "}
                  {usuario.estado_verificacion.replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre completo" valor={usuario.nombre} />
              <Campo etiqueta="Fotografía" valor={usuario.foto_url} />
              <Campo etiqueta="Correo electrónico" valor={correo} tipo="email" />
              <Campo etiqueta="Teléfono" valor={usuario.telefono} />
              <Campo etiqueta="País" valor={usuario.pais} />
              <Campo etiqueta="Estado" valor={usuario.estado} />
              <div className="sm:col-span-2">
                <Campo etiqueta="Dirección principal" valor={usuario.direccion_principal} />
              </div>
            </div>

            <div className="rounded-lg border border-ink/10 px-4 py-4">
              <p className="font-body text-sm font-semibold">Contraseña</p>
              <p className="mt-1 font-body text-sm text-ink/55">
                El cambio de contraseña se realiza con Supabase Auth para no manejar credenciales dentro de la app.
              </p>
              <div className="mt-4">
                <Button variant="secundario" disabled>
                  Enviar correo de cambio
                </Button>
              </div>
            </div>
          </div>
        </Seccion>

        <Seccion
          titulo="Métodos de pago y facturación"
          descripcion="Ruum Ruum solo usa métodos electrónicos; no se guarda información completa de tarjeta."
        >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Tarjeta bancaria", usuario.metodo_pago_registrado ? "Registrada" : "Pendiente"],
                ["Transferencia", "Disponible"],
                ["Pago empresarial", esEmpresa ? "Activo" : "Requiere cuenta empresa"]
              ].map(([titulo, estado]) => (
                <div key={titulo} className="rounded-lg border border-ink/10 px-4 py-4">
                  <p className="font-body text-sm font-semibold">{titulo}</p>
                  <p className="mt-1 font-body text-xs text-ink/55">{estado}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-ink/10 pt-5">
              <p className="font-body text-sm font-semibold">Datos de facturación empresarial</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="RFC" valor={empresa?.rfc} />
                <Campo etiqueta="Razón social" valor={empresa?.razon_social ?? empresa?.nombre} />
                <Campo etiqueta="Régimen fiscal" valor={empresa?.regimen_fiscal} />
                <Campo etiqueta="Código postal fiscal" valor={empresa?.codigo_postal_fiscal} />
                <Campo etiqueta="Uso de CFDI" valor={empresa?.uso_cfdi} />
                <Campo etiqueta="Correo para facturación" valor={empresa?.correo_facturacion ?? usuario.correo_facturacion} />
              </div>
            </div>
          </div>
        </Seccion>
      </section>

      <section className="mt-6">
        <Seccion
          titulo="Mis vehículos"
          descripcion="Guarda vehículos frecuentes para acelerar solicitudes futuras."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {vehiculos.length > 0 ? (
              vehiculos.map((vehiculo) => (
                <div key={vehiculo.id} className="rounded-lg border border-ink/10 bg-mist px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-body text-xs uppercase tracking-wide text-ink/45">
                        {vehiculo.alias || "Vehículo frecuente"}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-semibold">
                        {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}
                      </h3>
                    </div>
                    <span className="rounded-full border border-ink/10 px-2.5 py-1 font-body text-xs text-ink/55">
                      {ETIQUETA_TIPO_VEHICULO[vehiculo.tipo]}
                    </span>
                  </div>

                  {vehiculo.fotos_urls.length > 0 ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {vehiculo.fotos_urls.slice(0, 3).map((foto) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={foto} src={foto} alt={vehiculo.alias ?? vehiculo.modelo} className="aspect-[4/3] rounded-lg object-cover" />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 flex aspect-[5/2] items-center justify-center rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] font-body text-sm text-ink/45">
                      Sin fotografías guardadas
                    </div>
                  )}

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="font-body text-xs text-ink/45">Color</dt>
                      <dd className="font-body text-sm font-medium">{dato(vehiculo.color)}</dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs text-ink/45">Placas</dt>
                      <dd className="font-body text-sm font-medium">{dato(vehiculo.placas)}</dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs text-ink/45">VIN</dt>
                      <dd className="font-body text-sm font-medium">{dato(vehiculo.vin)}</dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs text-ink/45">Transmisión</dt>
                      <dd className="font-body text-sm font-medium">{dato(vehiculo.transmision)}</dd>
                    </div>
                  </dl>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-ink/15 px-4 py-6 font-body text-sm text-ink/55">
                Aún no tienes vehículos frecuentes guardados.
              </div>
            )}
          </div>

          <div className="mt-5">
            <Link href="/traslados/nuevo">
              <Button variant="secundario">Agregar desde una solicitud</Button>
            </Link>
          </div>
        </Seccion>
      </section>

      {esTitularEmpresa && (
        <section className="mt-6">
          <Seccion
            titulo="Historial de empresa"
            descripcion="Traslados creados por la cuenta titular y por usuarios autorizados de la misma empresa."
          >
            <div className="grid gap-3">
              {historialEmpresa.length > 0 ? (
                historialEmpresa.slice(0, 6).map((traslado) => (
                  <div
                    key={traslado.traslado_id}
                    className="grid gap-4 rounded-lg border border-ink/10 bg-mist px-4 py-4 md:grid-cols-[1.2fr_1fr_auto]"
                  >
                    <div>
                      <p className="font-body text-xs uppercase tracking-wide text-ink/45">
                        {traslado.estado.replaceAll("_", " ")}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-semibold">
                        {dato(traslado.vehiculo_marca)} {dato(traslado.vehiculo_modelo)}
                      </h3>
                      <p className="mt-1 font-body text-sm text-ink/55">{fechaCorta(traslado.creado_en)}</p>
                    </div>
                    <div className="grid gap-1 font-body text-sm text-ink/65">
                      <span>Conductor: {dato(traslado.conductor_nombre)}</span>
                      <span>Pago: {traslado.tipo_pago.replace("_", " ")}</span>
                      <span>Evidencia inicial: {traslado.evidencia_inicial_fotos_sincronizadas}/5</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:justify-center">
                      <span className="font-body text-sm font-semibold">
                        {dinero(traslado.precio_final ?? traslado.precio_cotizado)}
                      </span>
                      <Link href={`/traslados/${traslado.traslado_id}`}>
                        <Button variant="secundario">Ver detalle</Button>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-ink/15 px-4 py-6 font-body text-sm text-ink/55">
                  Aún no hay traslados empresariales para mostrar.
                </div>
              )}
            </div>
          </Seccion>
        </section>
      )}
    </main>
  );
}
