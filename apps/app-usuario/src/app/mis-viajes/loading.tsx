import { PassportCard } from "@ruum/ui";

function SkeletonCard() {
  return <div className="animate-pulse rounded-xl border border-border bg-surface p-4"><div className="h-4 w-28 rounded bg-surface-elevated" /><div className="mt-3 h-5 w-48 rounded bg-surface-elevated" /><div className="mt-2 h-3 w-32 rounded bg-surface-elevated/60" /><div className="mt-4 grid grid-cols-4 gap-3"><div className="h-10 rounded bg-surface-elevated/60" /><div className="h-10 rounded bg-surface-elevated/60" /><div className="h-10 rounded bg-surface-elevated/60" /><div className="h-10 rounded bg-surface-elevated/60" /></div></div>;
}
export default function Loading() {
  return (
    <main className="app-page">
      <div className="app-container py-6 sm:py-10">
        <div className="h-6 w-24 rounded bg-surface-elevated animate-pulse" />
        <div className="mt-4 h-8 w-48 rounded bg-surface-elevated animate-pulse" />
        <PassportCard><div className="h-10 rounded bg-surface-elevated animate-pulse" /><div className="mt-6 grid gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div></PassportCard>
      </div>
    </main>
  );
}
