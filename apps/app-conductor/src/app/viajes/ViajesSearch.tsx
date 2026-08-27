"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Componente de búsqueda para la página de viajes
 * Recomendación AI-002: Búsqueda en viajes históricos
 */

interface ViajesSearchProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

export function ViajesSearch({ onSearch, placeholder = "Buscar viajes..." }: ViajesSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar con URL
  useEffect(() => {
    const urlQuery = searchParams.get("q");
    if (urlQuery) {
      setQuery(urlQuery);
    }
  }, [searchParams]);

  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      
      // Actualizar URL
      const params = new URLSearchParams(searchParams.toString());
      if (newQuery.trim()) {
        params.set("q", newQuery.trim());
      } else {
        params.delete("q");
      }
      
      router.replace(`/viajes?${params.toString()}`, { scroll: false });
      
      // Llamar callback si existe
      onSearch?.(newQuery);
    },
    [router, searchParams, onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    router.replace(`/viajes?${params.toString()}`, { scroll: false });
    inputRef.current?.focus();
    onSearch?.("");
  }, [router, searchParams, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleClear]
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-11 pr-11 py-3 rounded-xl bg-surface border border-border/40 text-text-primary placeholder:text-text-tertiary font-body text-sm focus:outline-none focus:ring-2 focus:ring-route-action/20 focus:border-route-action/40 transition-colors"
          aria-label="Buscar viajes por origen, destino o folio"
          enterKeyHint="search"
        />
        
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Indicador de resultados - aparece cuando hay query */}
      {query && isFocused && (
        <div className="mt-1 flex items-center gap-2 px-1">
          <span className="flex size-2 rounded-full bg-signal animate-pulse" aria-hidden />
          <span className="font-body text-[11px] text-text-secondary">
            Buscando en {searchParams.get("vista") === "mis-viajes" ? "historial" : "ofertas"}...
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Filtro de viajes basado en query de búsqueda
 * @param viaje Datos del viaje
 * @param query Término de búsqueda
 * @returns true si el viaje coincide con la búsqueda
 */
export function filterViajesBySearch(viaje: {
  traslado_id?: string | null;
  origen_ciudad?: string | null;
  origen_direccion?: string | null;
  destino_ciudad?: string | null;
  destino_direccion?: string | null;
  folio?: string | null;
}, query: string): boolean {
  if (!query.trim()) return true;
  
  const searchLower = query.toLowerCase();
  const searchTerms = searchLower.split(/\s+/).filter(Boolean);
  
  const searchableText = [
    viaje.traslado_id ?? "",
    viaje.folio ?? "",
    viaje.origen_ciudad ?? "",
    viaje.origen_direccion ?? "",
    viaje.destino_ciudad ?? "",
    viaje.destino_direccion ?? "",
  ].join(" ").toLowerCase();
  
  return searchTerms.every((term) => 
    searchableText.includes(term)
  );
}
