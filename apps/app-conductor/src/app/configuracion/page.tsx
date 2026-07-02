"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";

type Bloque = "cuenta" | "documentos" | "preferencias" | "soporte";
type EstadoDocumento = "pendiente" | "revision" | "aprobado" | "rechazado" | "vencido" | "actualizacion";

const BLOQUES: { id: Bloque; titulo: string; descripcion: string }[] = [
  { id: "cuenta", titulo: "Cuenta", descripcion: "Perfil, seguridad, banco e historial de viajes." },
  { id: "documentos", titulo: "Documentos", descripcion: "Expediente operativo, vigencias y carga desde celular." },
  { id: "preferencias", titulo: "Preferencias", descripcion: "Notificaciones y tipos de viaje que quieres recibir." },
  { id: "soporte", titulo: "Soporte", descripcion: "Ayuda, reportes, cierre de sesión y eliminación de cuenta." }
];

const DOCUMENTOS: { nombre: string; estado: EstadoDocumento; vigencia: string; nota: string }[] = [
  { nombre: "Licencia de conducir", estado: "aprobado", vigencia: "Vigente hasta 14 nov 2027", nota: "Frente y reverso validados." },
  { nombre: "Comprobante de domicilio", estado: "revision", vigencia: "Cargado hoy", nota: "Operación revisará el archivo." },
  { nombre: "Constancia de situación fiscal", estado: "actualizacion", vigencia: "Actualizar antes del pago", nota: "Requiere RFC y régimen fiscal legibles." },
  { nombre: "Identificación oficial", estado: "aprobado", vigencia: "Vigente hasta 08 mar 2030", nota: "Documento principal aprobado." },
  { nombre: "Otros requeridos por operación", estado: "pendiente", vigencia: "Pendiente de carga", nota: "Se solicitará según tipo de servicio." }
];

const ESTADO_DOCUMENTO: Record<EstadoDocumento, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente de carga", clase: "border-ink/15 bg-ink/[0.04] text-ink/60" },
  revision: { texto: "En revisión", clase: "border-route/30 bg-route-soft text-route" },
  aprobado: { texto: "Aprobado", clase: "border-control/30 bg-control-soft text-control" },
  rechazado: { texto: "Rechazado", clase: "border-danger/25 bg-danger-soft text-danger" },
  vencido: { texto: "Vencido", clase: "border-danger/25 bg-danger-soft text-danger" },
  actualizacion: { texto: "Requiere actualización", clase: "border-warn/40 bg-warn-soft text-warn" }
};

const HISTORIAL = [
  { fecha: "2026-06-21", estatus: "Pagado", tipo: "Foráneo", pago: "$1,500", ruta: "CDMX -> Puebla" },
  { fecha: "2026-06-23", estatus: "Finalizado", tipo: "Empresarial", pago: "$1,800", ruta: "CDMX -> Querétaro" },
  { fecha: "2026-06-26", estatus: "En revisión", tipo: "Local", pago: "$1,500", ruta: "Puebla -> CDMX" }
];

const SOPORTE = [
  { etiqueta: "Preguntas frecuentes", href: "#preguntas-frecuentes" },
  { etiqueta: "Contacto con soporte", href: "tel:+525500004911" },
  { etiqueta: "Reportar problema", href: "/viajes" },
  { etiqueta: "Ayuda con pagos y documentos", href: "mailto:soporte-conductores@ruumruum.mx?subject=Ayuda%20con%20pagos%20o%20documentos" },
  { etiqueta: "Términos y aviso de privacidad", href: "https://ruumruum.mx/legal" }
];

function dato(label: string, valor: string) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">{label}</dt>
      <dd className="mt-1 font-body text-sm font-medium">{valor}</dd>
    </div>
  );
}

export default function PaginaConfiguracion() {
  const [bloque, setBloque] = useState<Bloque>("cuenta");
  const [push, setPush] = useState(true);
  const [noMolestar, setNoMolestar] = useState(false);
  const [alertasViaje, setAlertasViaje] = useState(true);
  const [alertasPago, setAlertasPago] = useState(true);
  const [alertasDocumentos, setAlertasDocumentos] = useState(true);
  const [alertasAdmin, setAlertasAdmin] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const preferenciasActivas = useMemo(
    () => [
      "Viajes locales",
      "Viajes foráneos",
      "Nocturnos con autorización",
      "Empresariales",
      "Personales",
      "Sedán, SUV y pickup",
      "Manual y automática"
    ],
    []
  );

  function probarNotificacion() {
    setMensaje("Notificación de prueba enviada en modo demo.");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Panel
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Configuración de Ruum Ruum Conductor</h1>
          <p className="mt-2 font-body text-sm text-ink/60">
            Administra cuenta, documentos, preferencias y soporte operativo.
          </p>
        </div>
        <Link href="/viajes">
          <Button variant="secundario">Volver a viajes</Button>
        </Link>
      </header>

      {mensaje && (
        <div className="mt-5">
          <Aviso tono="info">{mensaje}</Aviso>
        </div>
      )}

      <nav className="mt-6 grid gap-2 sm:grid-cols-4" aria-label="Bloques de configuración">
        {BLOQUES.map((item) => (
          <button
            key={item.id}
            onClick={() => setBloque(item.id)}
            className={[
              "rounded-lg border px-4 py-3 text-left transition-colors",
              bloque === item.id ? "border-signal bg-signal-soft text-ink" : "border-ink/10 bg-mist text-ink/65 hover:border-ink/25"
            ].join(" ")}
          >
            <span className="block font-body text-sm font-semibold">{item.titulo}</span>
            <span className="mt-1 block font-body text-xs leading-5">{item.descripcion}</span>
          </button>
        ))}
      </nav>

      {bloque === "cuenta" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Perfil del conductor</p>
            <div className="mt-4 flex flex-col gap-5 sm:flex-row">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-signal-soft font-display text-3xl font-semibold text-ink">
                CD
              </div>
              <dl className="grid flex-1 gap-4 sm:grid-cols-2">
                {dato("Nombre completo", "Conductor Demo")}
                {dato("Correo", "conductor@ruumruum.mx")}
                {dato("Teléfono", "+52 55 0000 4821")}
                {dato("País y estado", "México, Ciudad de México")}
                <div className="sm:col-span-2">{dato("Dirección completa", "Av. Insurgentes Sur 123, Roma Norte, Cuauhtémoc, CDMX")}</div>
                {dato("Contraseña", "Último cambio: hace 42 días")}
              </dl>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secundario">Editar perfil</Button>
              <Button variant="fantasma">Cambiar contraseña</Button>
            </div>
          </PassportCard>

          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Datos de cuenta bancaria</p>
            <dl className="mt-4 grid gap-4">
              {dato("Banco", "BBVA")}
              {dato("Número de tarjeta", "**** **** **** 4821")}
              {dato("Número de cuenta", "******3912")}
              {dato("CLABE", "002180*********4821")}
            </dl>
            <Aviso tono="atencion">La información bancaria está parcialmente oculta. Para editarla se requiere validación de identidad.</Aviso>
            <div className="mt-4">
              <Button variant="secundario">Validar identidad para editar</Button>
            </div>
          </PassportCard>

          <PassportCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">Historial de viajes</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Filtros operativos</h2>
              </div>
              <Link href="/viajes" className="font-body text-sm font-medium text-route">
                Ver todos
              </Link>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {["Fecha", "Estatus", "Tipo de viaje", "Pago", "Origen", "Destino"].map((filtro) => (
                <button key={filtro} className="rounded-lg border border-ink/10 px-3 py-2 text-left font-body text-xs text-ink/60">
                  {filtro}
                </button>
              ))}
            </div>
            <div className="mt-4 divide-y divide-ink/10">
              {HISTORIAL.map((viaje) => (
                <div key={`${viaje.fecha}-${viaje.ruta}`} className="grid gap-2 py-3 font-body text-sm sm:grid-cols-[0.8fr_1.4fr_0.8fr_0.8fr]">
                  <span className="text-ink/50">{viaje.fecha}</span>
                  <span className="font-medium">{viaje.ruta}</span>
                  <span>{viaje.tipo}</span>
                  <span className="font-mono-ruum">{viaje.pago}</span>
                </div>
              ))}
            </div>
          </PassportCard>
        </section>
      )}

      {bloque === "documentos" && (
        <section className="mt-6">
          <PassportCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">Documentos principales</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Expediente del conductor</h2>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-signal bg-signal px-4 py-2 font-body text-sm font-semibold text-ink">
                Subir archivo o fotografía
                <input type="file" accept="image/*,.pdf" className="sr-only" onChange={() => setMensaje("Archivo recibido en modo demo.")} />
              </label>
            </div>
            <div className="mt-5 grid gap-3">
              {DOCUMENTOS.map((doc) => (
                <div key={doc.nombre} className="rounded-lg border border-ink/10 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-body text-sm font-semibold">{doc.nombre}</p>
                      <p className="mt-1 font-body text-xs text-ink/50">{doc.vigencia}</p>
                      <p className="mt-2 font-body text-sm text-ink/60">{doc.nota}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1.5 text-center font-body text-xs font-semibold ${ESTADO_DOCUMENTO[doc.estado].clase}`}>
                      {ESTADO_DOCUMENTO[doc.estado].texto}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </PassportCard>
        </section>
      )}

      {bloque === "preferencias" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <PassportCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">Notificaciones</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Canales y alertas</h2>
              </div>
              <Button variant="secundario" onClick={probarNotificacion}>
                Probar notificación
              </Button>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Push", push, setPush],
                ["Modo no molestar 22:00 - 07:00", noMolestar, setNoMolestar],
                ["Alertas de nuevos viajes", alertasViaje, setAlertasViaje],
                ["Pagos", alertasPago, setAlertasPago],
                ["Documentos", alertasDocumentos, setAlertasDocumentos],
                ["Administrativas", alertasAdmin, setAlertasAdmin]
              ].map(([label, activo, cambiar]) => (
                <label key={label as string} className="flex items-center justify-between gap-4 rounded-lg border border-ink/10 px-4 py-3">
                  <span className="font-body text-sm font-medium">{label as string}</span>
                  <input
                    type="checkbox"
                    checked={activo as boolean}
                    onChange={(event) => (cambiar as (valor: boolean) => void)(event.target.checked)}
                    className="h-5 w-5 accent-signal"
                  />
                </label>
              ))}
            </div>
          </PassportCard>

          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Preferencias de viaje</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Asignación inteligente</h2>
            <p className="mt-2 font-body text-sm text-ink/60">
              Estas preferencias ayudan a filtrar, asignar u ofertar viajes compatibles con tu operación.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {preferenciasActivas.map((preferencia) => (
                <span key={preferencia} className="rounded-full border border-ink/10 bg-ink/[0.03] px-3 py-1.5 font-body text-xs font-medium text-ink/65">
                  {preferencia}
                </span>
              ))}
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {dato("Capacidad de unidad", "Autos compactos a SUV")}
              {dato("Tipos de vehículo", "Sedán, SUV, pickup")}
              {dato("Transmisión", "Estándar/manual y automática")}
              {dato("Servicios preferidos", "Locales, foráneos, empresariales y personales")}
            </dl>
          </PassportCard>
        </section>
      )}

      {bloque === "soporte" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Soporte</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Ayuda operativa</h2>
            <div className="mt-5 grid gap-3">
              {SOPORTE.map((opcion) => (
                <a
                  key={opcion.etiqueta}
                  href={opcion.href}
                  className="rounded-lg border border-ink/10 px-4 py-3 text-left font-body text-sm font-medium text-ink/70 hover:border-ink/25"
                >
                  {opcion.etiqueta}
                </a>
              ))}
            </div>
            <div id="preguntas-frecuentes" className="mt-5 rounded-lg border border-ink/10 px-4 py-3">
              <p className="font-body text-sm font-semibold">Preguntas frecuentes</p>
              <p className="mt-1 font-body text-sm text-ink/60">
                Para urgencias operativas usa Contacto con soporte. Para emergencias reales, usa el botón Emergencia / 911 dentro del viaje activo.
              </p>
            </div>
          </PassportCard>

          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Acceso y cuenta</p>
            <div className="mt-4 grid gap-3">
              <Button variant="secundario">Cerrar sesión</Button>
              <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-4">
                <p className="font-body text-sm font-semibold text-danger">Eliminar cuenta</p>
                <p className="mt-2 font-body text-sm text-ink/65">
                  Esta acción requiere confirmación, advertencias claras y validación de identidad antes de desactivar el acceso.
                </p>
                <div className="mt-4">
                  <Button variant="fantasma">Iniciar validación para eliminar</Button>
                </div>
              </div>
            </div>
          </PassportCard>
        </section>
      )}
    </main>
  );
}
