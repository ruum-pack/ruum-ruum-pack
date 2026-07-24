"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

export type AdminDataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  mobileLabel?: string;
  defaultVisible?: boolean;
};

export type AdminDataTableRowAction<T> = {
  label: string;
  href?: (row: T) => string;
  onClick?: (row: T) => void;
};

export type AdminDataTableBulkAction<T> = {
  label: string;
  onClick: (rows: T[]) => void;
  destructive?: boolean;
  requiresConfirmation?: boolean;
};

export type AdminDataTableSortState = { columnId: string; direction: "asc" | "desc" } | null;

export function AdminDataTable<T>({
  caption,
  rows,
  columns,
  getRowId,
  loading = false,
  emptyMessage,
  partialError,
  rowActions = [],
  bulkActions = [],
  selectedIds,
  onSelectionChange,
  sortState,
  onSortChange,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  pageSizeOptions = [10, 25, 50]
}: {
  caption: string;
  rows: T[];
  columns: AdminDataTableColumn<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  emptyMessage: string;
  partialError?: string | null;
  rowActions?: AdminDataTableRowAction<T>[];
  bulkActions?: AdminDataTableBulkAction<T>[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  sortState?: AdminDataTableSortState;
  onSortChange?: (sort: AdminDataTableSortState) => void;
  visibleColumnIds?: Set<string>;
  onVisibleColumnIdsChange?: (ids: Set<string>) => void;
  pageSizeOptions?: number[];
}) {
  const [internalSort, setInternalSort] = useState<AdminDataTableSortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0] ?? 10);
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.defaultVisible !== false).map((column) => column.id))
  );
  const sort = sortState ?? internalSort;
  const visibleColumns = visibleColumnIds ?? internalVisibleColumns;

  function actualizarSort(siguiente: AdminDataTableSortState) {
    if (onSortChange) onSortChange(siguiente);
    else setInternalSort(siguiente);
  }

  function actualizarColumnasVisibles(siguiente: Set<string>) {
    if (onVisibleColumnIdsChange) onVisibleColumnIdsChange(siguiente);
    else setInternalVisibleColumns(siguiente);
  }

  useEffect(() => {
    setPage(1);
  }, [rows.length, sort?.columnId, sort?.direction, pageSize]);

  const columnasVisibles = columns.filter((column) => visibleColumns.has(column.id));
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.columnId);
    if (!column?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = normalizarSort(column.sortValue?.(a));
      const bv = normalizarSort(column.sortValue?.(b));
      if (av < bv) return sort.direction === "asc" ? -1 : 1;
      if (av > bv) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [columns, rows, sort]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const pageIds = pageRows.map(getRowId);
  const selectedRows = rows.filter((row) => selectedIds.has(getRowId(row)));
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  function toggleSort(column: AdminDataTableColumn<T>) {
    if (!column.sortValue) return;
    if (sort?.columnId !== column.id) actualizarSort({ columnId: column.id, direction: "asc" });
    else if (sort.direction === "asc") actualizarSort({ columnId: column.id, direction: "desc" });
    else actualizarSort(null);
  }

  function toggleRow(id: string) {
    const siguiente = new Set(selectedIds);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    onSelectionChange(siguiente);
  }

  function togglePage() {
    const siguiente = new Set(selectedIds);
    if (allPageSelected) pageIds.forEach((id) => siguiente.delete(id));
    else pageIds.forEach((id) => siguiente.add(id));
    onSelectionChange(siguiente);
  }

  function toggleColumn(columnId: string) {
    const siguiente = new Set(visibleColumns);
    if (siguiente.has(columnId) && siguiente.size > 1) siguiente.delete(columnId);
    else siguiente.add(columnId);
    actualizarColumnasVisibles(siguiente);
  }

  function moverFoco(evento: React.KeyboardEvent<HTMLTableRowElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(evento.key)) return;
    const filas = Array.from(evento.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>("tr[data-admin-row='true']") ?? []);
    const indice = filas.indexOf(evento.currentTarget);
    if (indice < 0) return;
    evento.preventDefault();
    const siguiente = evento.key === "ArrowDown"
      ? Math.min(filas.length - 1, indice + 1)
      : evento.key === "ArrowUp"
        ? Math.max(0, indice - 1)
        : evento.key === "Home"
          ? 0
          : filas.length - 1;
    filas[siguiente]?.focus();
  }

  return (
    <section className="admin-table-card mt-3" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <div aria-live="polite" className="font-body text-sm text-text-secondary">
          {loading ? "Cargando resultados" : `${sortedRows.length.toLocaleString("es-MX")} resultados · ${selectedIds.size} seleccionados`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="relative">
            <summary className="cursor-pointer rounded-lg border border-ink/20 px-3 py-2 font-body text-admin-boton font-semibold text-text-secondary">
              Columnas
            </summary>
            <div className="absolute right-0 z-20 mt-2 min-w-56 rounded-lg border border-border-default bg-surface-primary p-3 shadow-[var(--ruum-shadow-2)]">
              {columns.map((column) => (
                <label key={column.id} className="flex items-center gap-2 py-1 font-body text-sm text-text-secondary">
                  <input type="checkbox" checked={visibleColumns.has(column.id)} onChange={() => toggleColumn(column.id)} />
                  {column.header}
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>
      {partialError && (
        <div className="border-b border-status-warning/25 bg-status-warning-soft px-4 py-3 font-body text-sm text-status-warning">
          {partialError}
        </div>
      )}
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className="w-12 px-4 py-3">
              <input type="checkbox" checked={allPageSelected} onChange={togglePage} aria-label="Seleccionar página actual" />
            </th>
            {columnasVisibles.map((column) => (
              <th key={column.id} className="px-4 py-3">
                {column.sortValue ? (
                  <button type="button" onClick={() => toggleSort(column)} className="font-inherit text-left uppercase">
                    {column.header}{sort?.columnId === column.id ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                ) : column.header}
              </th>
            ))}
            {rowActions.length > 0 && <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columnasVisibles.length + 2} className="px-4 py-8 text-center text-text-tertiary">Cargando...</td></tr>
          ) : pageRows.length === 0 ? (
            <tr><td colSpan={columnasVisibles.length + 2} className="px-4 py-8 text-center text-text-tertiary">{emptyMessage}</td></tr>
          ) : pageRows.map((row) => {
            const rowId = getRowId(row);
            return (
              <tr key={rowId} tabIndex={0} data-admin-row="true" onKeyDown={moverFoco}>
                <td className="px-4 py-3" data-label="Seleccionar">
                  <input type="checkbox" checked={selectedIds.has(rowId)} onChange={() => toggleRow(rowId)} aria-label={`Seleccionar ${rowId}`} />
                </td>
                {columnasVisibles.map((column) => (
                  <td key={column.id} className="px-4 py-3" data-label={column.mobileLabel ?? column.header}>
                    {column.cell(row)}
                  </td>
                ))}
                {rowActions.length > 0 && (
                  <td className="px-4 py-3 text-right" data-label="Acciones">
                    <div className="flex flex-wrap justify-end gap-2">
                      {rowActions.map((action) => action.href ? (
                        <Link key={action.label} href={action.href(row)} className="font-body text-sm font-semibold text-status-info hover:underline">
                          {action.label}
                        </Link>
                      ) : (
                        <button key={action.label} type="button" onClick={() => action.onClick?.(row)} className="font-body text-sm font-semibold text-status-info hover:underline">
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-4 py-3">
        <label className="font-body text-sm text-text-secondary">
          Filas
          <select className="ml-2 rounded-lg border border-ink/20 bg-surface-primary px-2 py-1" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm" disabled={pageSafe <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button>
          <span className="font-body text-sm text-text-secondary">Página {pageSafe} de {totalPages}</span>
          <button type="button" className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm" disabled={pageSafe >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</button>
        </div>
      </div>
      {bulkActions.length > 0 && selectedRows.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-primary px-4 py-3 shadow-[var(--ruum-shadow-4)] lg:left-[calc(var(--admin-sidebar-width,18rem)+1rem)]">
          <p className="font-body text-sm font-semibold text-ink">{selectedRows.length.toLocaleString("es-MX")} seleccionado{selectedRows.length === 1 ? "" : "s"}</p>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => action.onClick(selectedRows)}
                className={[
                  "rounded-lg border px-3 py-2 font-body text-admin-boton font-semibold",
                  action.destructive || action.requiresConfirmation
                    ? "border-status-warning/35 text-status-warning hover:bg-status-warning-soft"
                    : "border-ink/20 text-text-secondary hover:border-signal/40 hover:bg-surface-secondary"
                ].join(" ")}
                title={`${action.label}: afectará ${selectedRows.length.toLocaleString("es-MX")} registro${selectedRows.length === 1 ? "" : "s"}.`}
              >
                {action.label}
              </button>
            ))}
            <button type="button" onClick={() => onSelectionChange(new Set())} className="rounded-lg border border-transparent px-3 py-2 font-body text-admin-boton font-semibold text-text-tertiary hover:bg-surface-secondary">
              Limpiar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function normalizarSort(valor: string | number | Date | null | undefined) {
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === "number") return valor;
  return String(valor ?? "").toLowerCase();
}
