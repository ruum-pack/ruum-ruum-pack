import { PassportCard } from "@ruum/ui";

export default function Loading() {
  return (
    <main className="app-page">
      <div className="app-container py-6 sm:py-10">
        <PassportCard><div className="h-6 w-32 rounded bg-surface-elevated animate-pulse" /><div className="mt-4 h-8 w-64 rounded bg-surface-elevated animate-pulse" /><div className="mt-6 h-32 rounded bg-surface-elevated animate-pulse" /></PassportCard>
        <div className="mt-4 rounded-xl border border-border bg-surface p-4 animate-pulse"><div className="h-4 w-40 rounded bg-surface-elevated" /><div className="mt-3 h-20 rounded bg-surface-elevated/60" /></div>
      </div>
    </main>
  );
}
