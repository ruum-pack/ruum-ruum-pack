import { PassportCard } from "@ruum/ui";
import { NavegacionUsuario } from "../../NavegacionUsuario";
export default function Loading() {
  return (
    <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content user-v2-content--wide py-6 sm:py-12">
        <div className="h-8 w-48 rounded bg-surface-elevated animate-pulse" />
        <div className="mt-4 h-4 w-full rounded bg-surface-elevated animate-pulse" />
        <PassportCard><div className="h-32 rounded bg-surface-elevated animate-pulse" /></PassportCard>
      </div>
    </main>
  );
}
