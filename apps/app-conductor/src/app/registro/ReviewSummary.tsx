export function ReviewSummary({ titulo, valores, onEditar }: { titulo: string; valores: Array<string | undefined>; onEditar?: () => void }) {
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-sm font-semibold text-text-tertiary">{titulo}</p>
        {onEditar && (
          <button type="button" onClick={onEditar} className="inline-flex min-h-11 items-center font-body text-sm font-semibold text-route-action underline-offset-4 hover:underline">
            Editar
          </button>
        )}
      </div>
      <ul className="mt-2 grid gap-1">
        {valores.filter(Boolean).map((valor) => (
          <li key={valor} className="font-body text-sm text-text-secondary">{valor}</li>
        ))}
      </ul>
    </div>
  );
}
