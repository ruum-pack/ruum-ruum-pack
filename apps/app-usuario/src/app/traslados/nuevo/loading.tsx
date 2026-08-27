import { PassportCard } from "@ruum/ui";
export default function Loading() {
  return (
    <main className="app-page">
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-6 sm:py-12">
        <div className="h-8 w-48 rounded bg-surface-elevated animate-pulse" />
        <div className="mt-4 h-4 w-full rounded bg-surface-elevated animate-pulse" />
        <PassportCard><div className="h-32 rounded bg-surface-elevated animate-pulse" /></PassportCard>
      </div>
    </main>
  );
}
