import Link from "next/link";
import Image from "next/image";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { PerfilCuentaForm } from "./PerfilCuentaForm";
import { BotonResetPassword } from "./BotonResetPassword";
import { FacturacionCuentaForm } from "./FacturacionCuentaForm";
import { NavegacionUsuario } from "../NavegacionUsuario";

export type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
export type Vehiculo = Database["public"]["Tables"]["vehiculos"]["Row"];
export type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
export type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export interface CuentaReal {
  usuario: Usuario;
  vehiculos: Vehiculo[];
  empresa: Empresa | null;
  historialEmpresa: PasaporteRow[];
}

const LINKS_CUENTA = [
  { href: "/cuenta/perfil", inicial: "P", titulo: "Perfil del usuario", descripcion: "Datos personales, foto, teléfono y domicilio." },
  { href: "/cuenta/vehiculos", inicial: "V", titulo: "Mis vehículos", descripcion: "Autos frecuentes, placas, VIN y fotografías." },
  { href: "/cuenta/metodos-pago", inicial: "M", titulo: "Métodos de pago", descripcion: "Tarjeta, transferencia y pago empresarial." },
  { href: "/cuenta/facturacion", inicial: "F", titulo: "Facturación", descripcion: "RFC, razón social, CFDI y correo fiscal." },
  { href: "/cuenta/preferencias", inicial: "N", titulo: "Preferencias", descripcion: "Notificaciones y alertas." },
  { href: "/cuenta/legal", inicial: "D", titulo: "Legal", descripcion: "Documentos, términos y aviso de privacidad." }
];

const DOCUMENTOS_LEGALES = {
  terminos: { pagina: "/legal/terminos", descarga: "/docs-legales/terminos-y-condiciones-ruum-ruum.docx" },
  privacidad: { pagina: "/legal/privacidad", descarga: "/docs-legales/aviso-de-privacidad-ruum-ruum.docx" },
};

/* Etiquetas legibles para estado_verificacion — reemplaza replace("_", " ")
 * que solo corregía el primer guión y dejaba estados como "usuario pendiente_verificacion". */
const ETIQUETA_VERIFICACION: Record<string, string> = {
  pendiente: "Pendiente de verificación",
  en_revision: "En revisión",
  verificado: "Verificado",
  rechazado: "Documentación rechazada",
  usuario_pendiente_verificacion: "Pendiente de verificación",
};

function etiquetaVerificacion(estado: string): string {
  return ETIQUETA_VERIFICACION[estado] ?? estado.replaceAll("_", " ");
}


export async function obtenerCuenta(): Promise<CuentaReal | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const { listarTrasladosDeEmpresa, obtenerUsuarioActual } = await import("@ruum/api/services");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);
    if (!usuario) return null;

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
      historialEmpresa
    };
  } catch {
    return null;
  }
}

export function iniciales(nombre: string | null | undefined) {
  if (!nombre) return "RR";
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function dato(valor: string | number | null | undefined) {
  return valor ? String(valor) : "Pendiente";
}

function fechaCorta(fechaIso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

function dinero(valor: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(valor ?? 0);
}

export function Campo({ etiqueta, valor }: { etiqueta: string; valor?: string | null | undefined }) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">{etiqueta}</dt>
      <dd className="mt-1 font-body text-sm font-medium">{dato(valor)}</dd>
    </div>
  );
}

export function Seccion({
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

function FilaConfiguracion({
  href,
  titulo,
  descripcion,
  detalle,
  inicial
}: {
  href: string;
  titulo: string;
  descripcion?: string;
  detalle?: string;
  inicial: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 app-card app-card-interactive rounded-xl bg-mist px-4 py-4 font-body text-sm hover:border-route/50 hover:bg-route-soft/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-route/30 bg-route-soft font-display text-sm font-bold text-route-dark">
        {inicial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-bold leading-tight text-ink">{titulo}</span>
        {descripcion && <span className="mt-1 block text-xs leading-4 text-ink/55">{descripcion}</span>}
      </span>
      {detalle && <span className="shrink-0 rounded-full border border-route/30 px-2 py-1 text-xs text-route-dark">{detalle}</span>}
      <span className="text-lg leading-none text-route-dark transition-transform group-hover:translate-x-0.5">›</span>
    </Link>
  );
}

function GrupoConfiguracion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono-ruum text-xs uppercase tracking-wide text-route-dark">{titulo}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function AvisoSinSesion() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <Aviso tono="info">Inicia sesión para consultar y actualizar los datos de tu cuenta.</Aviso>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/login?next=/cuenta">
          <Button>Iniciar sesión</Button>
        </Link>
        <Link href="/registro">
          <Button variant="secondary">Crear cuenta</Button>
        </Link>
      </div>
    </main>
  );
}

export function HeaderCuenta({ usuario }: { usuario?: Usuario }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link href="/" className="font-body text-sm text-ink/55 hover:underline">
          Inicio
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">Cuenta</h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-ink/60">
          Administra tu perfil, vehículos frecuentes, métodos de pago y datos de facturación.
        </p>
      </div>
      <div className="hidden sm:block">
        <Link href="/soporte">
          <Button>¿Necesitas ayuda?</Button>
        </Link>
      </div>
      {usuario && (
        <div className="flex items-center gap-3 sm:hidden">
          {usuario.foto_url ? (
            <Image src={usuario.foto_url} alt="Foto de perfil" width={48} height={48} className="size-12 rounded-full object-cover" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-route-soft font-display text-sm font-bold text-route-dark">
              {iniciales(usuario.nombre)}
            </div>
          )}
          <div>
            <p className="font-body text-sm font-semibold">{dato(usuario.nombre)}</p>
            <p className="font-body text-xs text-ink/55">{etiquetaVerificacion(usuario.estado_verificacion)}</p>
          </div>
        </div>
      )}
    </header>
  );
}

export function HeroCuenta({ usuario }: { usuario: Usuario }) {
  return (
    <section className="mb-6">
      <PassportCard>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {usuario.foto_url ? (
            <Image src={usuario.foto_url} alt="Foto de perfil" width={80} height={80} className="size-16 rounded-full object-cover sm:size-20" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-route-soft font-display text-lg font-bold text-route-dark sm:size-20 sm:text-2xl">
              {iniciales(usuario.nombre)}
            </div>
          )}
          <div className="text-center sm:text-left">
            <p className="font-display text-lg font-bold sm:text-xl">{dato(usuario.nombre)}</p>
            <p className="mt-1 font-mono-ruum text-sm text-ink/55">{dato(usuario.telefono)}</p>
            <p className="mt-1 font-body text-sm text-ink/55">
              {usuario.tipo_cuenta === "empresa" ? "Cuenta empresarial" : "Cuenta personal"} ·{" "}
              {etiquetaVerificacion(usuario.estado_verificacion)}
            </p>
            <div className="mt-2 flex justify-center gap-2 sm:justify-start">
              <Link href="/cuenta/perfil">
                <Button variant="secondary">Editar perfil</Button>
              </Link>
              {!usuario.doc_identidad_url && (
                <Link href="/verificacion">
                  <Button variant="secondary">Subir identificación</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </PassportCard>
    </section>
  );
}

export function NavegacionCuenta({ usuario }: { usuario: Usuario }) {
  const detallePreferencias =
    usuario.notificaciones_push || usuario.notificaciones_email || usuario.notificaciones_sms_whatsapp ? "Activas" : "Pausadas";

  return (
    <section className="mb-6">
      <PassportCard>
        <div className="grid gap-5">
          <GrupoConfiguracion titulo="Cuenta">
            {LINKS_CUENTA.slice(0, 4).map((link) => (
              <FilaConfiguracion key={link.href} {...link} />
            ))}
          </GrupoConfiguracion>
          <GrupoConfiguracion titulo="Preferencias">
            <FilaConfiguracion {...LINKS_CUENTA[4]} detalle={detallePreferencias} />
          </GrupoConfiguracion>
          <GrupoConfiguracion titulo="Legal">
            <FilaConfiguracion {...LINKS_CUENTA[5]} />
            <FilaConfiguracion href={DOCUMENTOS_LEGALES.terminos.pagina} inicial="T" titulo="Términos y condiciones" descripcion="Reglas de uso, pagos, cancelaciones y servicio." />
            <FilaConfiguracion href={DOCUMENTOS_LEGALES.privacidad.pagina} inicial="A" titulo="Aviso de privacidad" descripcion="Tratamiento de datos e identidad." />
          </GrupoConfiguracion>
        </div>
      </PassportCard>
    </section>
  );
}

export function LayoutCuenta({ cuenta, children }: { cuenta: CuentaReal; children: React.ReactNode }) {
  return (
    <main className="app-page">
      <NavegacionUsuario />
      <div className="app-container py-10 sm:py-14">
        <HeaderCuenta usuario={cuenta.usuario} />
        <NavegacionCuenta usuario={cuenta.usuario} />
        {children}
      </div>
      <div className="fixed bottom-6 right-6 z-50 sm:hidden">
        <Link href="/traslados/nuevo">
          <Button className="shadow-2">Solicitar traslado</Button>
        </Link>
      </div>
    </main>
  );
}

export function SeccionPerfil({ usuario }: { usuario: Usuario }) {
  return (
    <Seccion titulo="Perfil del usuario" descripcion="Datos visibles y de contacto de la cuenta.">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          {usuario.foto_url ? (
            <Image src={usuario.foto_url} alt="Foto de perfil" width={80} height={80} className="size-20 rounded-full object-cover" />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-ink font-display text-2xl text-mist">
              {iniciales(usuario.nombre)}
            </div>
          )}
          <div>
            <p className="font-body text-lg font-semibold">{dato(usuario.nombre)}</p>
            <p className="mt-1 font-body text-sm text-ink/55">
              {usuario.tipo_cuenta === "empresa" ? "Cuenta empresarial" : "Cuenta personal"} ·{" "}
              {etiquetaVerificacion(usuario.estado_verificacion)}
            </p>
          </div>
        </div>
        <PerfilCuentaForm usuario={usuario} />
        <div className="rounded-lg border border-ink/10 px-4 py-4">
          <p className="font-body text-sm font-semibold">Verificación de identidad</p>
          <p className="mt-1 font-body text-sm text-ink/55">Estado actual: {etiquetaVerificacion(usuario.estado_verificacion)}.</p>
          <div className="mt-4">
            <Link href="/verificacion">
              <Button variant="secondary">{usuario.doc_identidad_url ? "Actualizar identificación" : "Subir identificación"}</Button>
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-ink/10 px-4 py-4">
          <p className="font-body text-sm font-semibold">Contraseña</p>
          <p className="mt-1 font-body text-sm text-ink/55">
            Te enviaremos un enlace a tu correo para crear una nueva contraseña de forma segura.
          </p>
          <div className="mt-4">
            <BotonResetPassword email={usuario.correo_facturacion ?? ""} />
          </div>
        </div>
      </div>
    </Seccion>
  );
}

export function SeccionVehiculos({ vehiculos }: { vehiculos: Vehiculo[] }) {
  return (
    <Seccion titulo="Mis vehículos" descripcion="Guarda vehículos frecuentes para acelerar solicitudes futuras.">
      <div className="grid gap-4 md:grid-cols-2">
        {vehiculos.length > 0 ? (
          vehiculos.map((vehiculo) => (
            <div key={vehiculo.id} className="app-card rounded-lg bg-mist px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">{vehiculo.alias || "Vehículo frecuente"}</p>
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
                    <Image key={foto} src={foto} alt={vehiculo.alias ?? vehiculo.modelo} width={200} height={150} className="aspect-[4/3] rounded-lg object-cover" />
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex aspect-[5/2] items-center justify-center rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] font-body text-sm text-ink/45">
                  Sin fotografías guardadas
                </div>
              )}
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Color" valor={vehiculo.color} />
                <Campo etiqueta="Placas" valor={vehiculo.placas} />
                <Campo etiqueta="VIN" valor={vehiculo.vin} />
                <Campo etiqueta="Transmisión" valor={vehiculo.transmision} />
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
          <Button variant="secondary">Agregar desde una solicitud</Button>
        </Link>
      </div>
    </Seccion>
  );
}

export function SeccionMetodosPago({ usuario }: { usuario: Usuario }) {
  const esEmpresa = usuario.tipo_cuenta === "empresa" || usuario.rol === "titular_empresa";
  return (
    <Seccion titulo="Métodos de pago" descripcion="Ruum Ruum solo usa métodos electrónicos; no se guarda información completa de tarjeta.">
      <div className="grid gap-4 sm:grid-cols-3">

        {/* Tarjeta bancaria — CTA condicional según estado de registro */}
        <div className="flex flex-col gap-3 rounded-lg border border-ink/10 px-4 py-4">
          <div>
            <p className="font-body text-sm font-semibold">Tarjeta bancaria</p>
            <p className="mt-1 font-body text-xs text-ink/55">
              {usuario.metodo_pago_registrado ? "Registrada y activa" : "Sin tarjeta registrada"}
            </p>
          </div>
          {!usuario.metodo_pago_registrado && (
            <Link
              href="/cuenta/metodos-pago"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-ink/20 px-3 py-1.5 font-body text-xs font-medium text-ink transition hover:border-route-dark hover:text-route-dark"
            >
              Registrar tarjeta →
            </Link>
          )}
        </div>

        {/* Transferencia */}
        <div className="rounded-lg border border-ink/10 px-4 py-4">
          <p className="font-body text-sm font-semibold">Transferencia</p>
          <p className="mt-1 font-body text-xs text-ink/55">Disponible para todos los traslados</p>
        </div>

        {/* Pago empresarial */}
        <div className="flex flex-col gap-3 rounded-lg border border-ink/10 px-4 py-4">
          <div>
            <p className="font-body text-sm font-semibold">Pago empresarial</p>
            <p className="mt-1 font-body text-xs text-ink/55">
              {esEmpresa ? "Activo para esta cuenta" : "Disponible en cuentas empresa"}
            </p>
          </div>
          {!esEmpresa && (
            <Link
              href="/soporte"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-ink/20 px-3 py-1.5 font-body text-xs font-medium text-ink transition hover:border-route-dark hover:text-route-dark"
            >
              Solicitar activación →
            </Link>
          )}
        </div>

      </div>
    </Seccion>
  );
}

export function SeccionFacturacion({ usuario, empresa }: { usuario: Usuario; empresa: Empresa | null }) {
  return (
    <Seccion titulo="Facturación" descripcion="Captura los datos fiscales para comprobantes y cuentas empresariales.">
      <FacturacionCuentaForm usuario={usuario} empresa={empresa} />
    </Seccion>
  );
}

export function SeccionPreferencias({ usuario }: { usuario: Usuario }) {
  return (
    <Seccion titulo="Preferencias" descripcion="Controla notificaciones y alertas de tu cuenta.">
      <div className="grid gap-3">
        {[
          ["Push", usuario.notificaciones_push],
          ["Correo electrónico", usuario.notificaciones_email],
          ["SMS / WhatsApp", usuario.notificaciones_sms_whatsapp],
          ["Alertas de pago", usuario.alertas_pago],
          ["Promocionales", usuario.notificaciones_promocionales]
        ].map(([etiqueta, activo]) => (
          <div key={String(etiqueta)} className="flex items-center justify-between border-t border-ink/10 py-3 font-body text-sm">
            <span className="font-semibold">{etiqueta}</span>
            <span className={`rounded-full border px-2.5 py-1 text-xs ${activo ? "border-route/30 bg-route-soft text-route-dark" : "border-ink/15 bg-ink/[0.05] text-ink/60"}`}>
              {activo ? "Activa" : "Pausada"}
            </span>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

export function SeccionLegal() {
  return (
    <Seccion titulo="Legal" descripcion="Documentos y condiciones vigentes de Ruum Ruum.">
      <div className="grid gap-3">
        {/* Página HTML accesible + descarga .docx opcional */}
        <div className="flex items-center justify-between rounded-lg border border-ink/10 px-4 py-3">
          <Link href={DOCUMENTOS_LEGALES.terminos.pagina} className="font-body text-sm font-semibold text-ink hover:text-route-dark">
            Términos y condiciones
          </Link>
          <a
            href={DOCUMENTOS_LEGALES.terminos.descarga}
            download
            className="font-body text-xs text-ink/45 underline-offset-2 hover:text-ink/70 hover:underline"
            aria-label="Descargar términos y condiciones en Word"
          >
            .docx
          </a>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-ink/10 px-4 py-3">
          <Link href={DOCUMENTOS_LEGALES.privacidad.pagina} className="font-body text-sm font-semibold text-ink hover:text-route-dark">
            Aviso de privacidad
          </Link>
          <a
            href={DOCUMENTOS_LEGALES.privacidad.descarga}
            download
            className="font-body text-xs text-ink/45 underline-offset-2 hover:text-ink/70 hover:underline"
            aria-label="Descargar aviso de privacidad en Word"
          >
            .docx
          </a>
        </div>
      </div>
    </Seccion>
  );
}

export function SeccionHistorialEmpresa({ historialEmpresa }: { historialEmpresa: PasaporteRow[] }) {
  return (
    <Seccion titulo="Historial de empresa" descripcion="Traslados creados por la cuenta titular y por usuarios autorizados de la misma empresa.">
      <div className="grid gap-3">
        {historialEmpresa.length > 0 ? (
          historialEmpresa.slice(0, 6).map((traslado) => (
            <div key={traslado.traslado_id} className="grid gap-4 rounded-lg border border-ink/10 bg-mist px-4 py-4 md:grid-cols-[1.2fr_1fr_auto]">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">{traslado.estado.replaceAll("_", " ")}</p>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  {dato(traslado.vehiculo_marca)} {dato(traslado.vehiculo_modelo)}
                </h3>
                <p className="mt-1 font-body text-sm text-ink/55">{fechaCorta(traslado.creado_en)}</p>
              </div>
              <div className="grid gap-1 font-body text-sm text-ink/65">
                <span>Conductor: {dato(traslado.conductor_nombre)}</span>
                <span>Pago: {traslado.tipo_pago.replaceAll("_", " ")}</span>
                <span>Evidencia inicial: {traslado.evidencia_inicial_fotos_sincronizadas}/5</span>
              </div>
              <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:justify-center">
                <span className="font-body text-sm font-semibold">{dinero(traslado.precio_final ?? traslado.precio_cotizado)}</span>
                <Link href={`/traslados/${traslado.traslado_id}`}>
                  <Button variant="secondary">Ver detalle</Button>
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
  );
}
