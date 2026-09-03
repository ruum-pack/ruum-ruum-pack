import { PassportCard } from "@ruum/ui";
import { NavegacionUsuario } from "../../NavegacionUsuario";

export default function Loading() {
  return (
    <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content user-v2-content--wide py-6 sm:py-10">
        <PassportCard><div className="h-6 w-32 rounded bg-surface-elevated animate-pulse" /><div className="mt-4 h-8 w-64 rounded bg-surface-elevated animate-pulse" /><div className="mt-6 h-32 rounded bg-surface-elevated animate-pulse" /></PassportCard>
        <div className="mt-4 rounded-xl border border-border bg-surface p-4 animate-pulse"><div className="h-4 w-40 rounded bg-surface-elevated" /><div className="mt-3 h-20 rounded bg-surface-elevated/60" /></div>
      </div>
    </main>
  );
}
