import Image from "next/image";
import { LogoMarca } from "@ruum/ui";

export function RegistrationShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-registro-conductor">
        <div className="-mx-2 -mt-2 mb-6 overflow-hidden rounded-xl border border-route-action bg-surface-strong">
          <Image
            src="/imagenes/registro-conductor.png"
            alt="Vehículo con puntos de registro digital para la certificación de traslado"
            width={1222}
            height={1222}
            priority
            className="aspect-[16/9] w-full object-cover"
          />
        </div>

        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-text-primary">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-body text-xs font-semibold text-text-tertiary">ruum by Movilia</p>
          </div>
        </div>

        {children}
      </section>
    </div>
  );
}
