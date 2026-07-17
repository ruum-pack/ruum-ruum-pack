"use client";

import { useMemo } from "react";
import { createNavigationOptions, type NavigationTarget } from "../../../lib/navigation-launcher";

export function NavigationLauncher({ target }: { target: NavigationTarget }) {
  const options = useMemo(() => createNavigationOptions(target), [target]);

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-3">
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Abrir navegación con</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <a
            key={option.id}
            href={option.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-route-action bg-route-soft px-3 py-2 text-center font-body text-sm font-semibold text-route-action transition hover:bg-surface"
          >
            {option.label}
          </a>
        ))}
      </div>
    </div>
  );
}
