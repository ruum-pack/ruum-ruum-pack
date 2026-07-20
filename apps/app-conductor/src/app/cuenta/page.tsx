import Link from "next/link";
import { Card } from "@ruum/ui";
import { CuentaHeader } from "./CuentaHeader";

const SECCIONES = [
  { href: "/cuenta/perfil", titulo: "Perfil", descripcion: "Datos personales, dirección y contacto de emergencia." },
  { href: "/cuenta/documentos", titulo: "Documentos", descripcion: "Expediente operativo y carga de archivos." },
  { href: "/cuenta/preferencias", titulo: "Preferencias", descripcion: "Notificaciones y tipos de viaje." },
  { href: "/notificaciones", titulo: "Centro de notificaciones", descripcion: "Avisos operativos leídos y pendientes." },
  { href: "/cuenta/datos-bancarios", titulo: "Datos bancarios", descripcion: "Cuenta para depósitos y estado de validación." },
  { href: "/cuenta/seguridad", titulo: "Seguridad", descripcion: "Contraseña, sesión y cambios sensibles." },
  { href: "/cuenta/soporte", titulo: "Soporte", descripcion: "Canales oficiales y baja de cuenta." },
  { href: "/cuenta/legal", titulo: "Legal", descripcion: "Términos y aviso de privacidad." }
];

export default function PaginaCuenta() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Cuenta" descripcion="Administra una sección a la vez. Cada pantalla tiene su propio enlace directo." />
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {SECCIONES.map((seccion) => (
          <Link key={seccion.href} href={seccion.href}>
            <Card className="h-full">
              <p className="font-display text-xl font-semibold">{seccion.titulo}</p>
              <p className="mt-2 font-body text-sm leading-6 text-text-secondary">{seccion.descripcion}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
