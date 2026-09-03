import { PassportCard } from "@ruum/ui";
import { NavegacionUsuario } from "./NavegacionUsuario";

export default function Loading() {
  return (
    <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content user-v2-content--wide py-6 sm:py-10 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="h-8 w-36 rounded-lg bg-surface-elevated animate-pulse" />
          <div className="h-10 w-28 rounded-lg bg-surface-elevated animate-pulse" />
        </div>

        {/* Hero Card Skeleton */}
        <PassportCard>
          <div className="space-y-4 animate-pulse">
            <div className="h-4 w-44 rounded bg-surface-elevated" />
            <div className="h-8 w-72 rounded bg-surface-elevated" />
            <div className="h-4 w-full max-w-md rounded bg-surface-elevated/70" />
            <div className="h-12 w-48 rounded-xl bg-surface-elevated mt-4" />
          </div>
        </PassportCard>

        {/* Grid Skeletons */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5 animate-pulse space-y-3">
            <div className="h-5 w-36 rounded bg-surface-elevated" />
            <div className="h-16 rounded-xl bg-surface-elevated/60" />
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5 animate-pulse space-y-3">
            <div className="h-5 w-36 rounded bg-surface-elevated" />
            <div className="h-16 rounded-xl bg-surface-elevated/60" />
          </div>
        </div>
      </div>
    </main>
  );
}
