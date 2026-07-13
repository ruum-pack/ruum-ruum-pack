import { vi } from "vitest";

type Resultado = { data?: unknown; error?: unknown; count?: number | null };

export interface LlamadaTabla {
  table: string;
  action: string;
  args: unknown[];
}

class QueryFake {
  constructor(
    private readonly llamadas: LlamadaTabla[],
    private readonly table: string,
    private readonly resultado: Resultado = {}
  ) {}

  private registrar(action: string, args: unknown[]) {
    this.llamadas.push({ table: this.table, action, args });
    return this;
  }

  select(...args: unknown[]) { return this.registrar("select", args); }
  update(...args: unknown[]) { return this.registrar("update", args); }
  insert(...args: unknown[]) { return this.registrar("insert", args); }
  eq(...args: unknown[]) { return this.registrar("eq", args); }
  in(...args: unknown[]) { return this.registrar("in", args); }
  not(...args: unknown[]) { return this.registrar("not", args); }
  gte(...args: unknown[]) { return this.registrar("gte", args); }
  limit(...args: unknown[]) { return this.registrar("limit", args); }
  order(...args: unknown[]) { return this.registrar("order", args); }
  or(...args: unknown[]) { return this.registrar("or", args); }

  maybeSingle() {
    this.registrar("maybeSingle", []);
    return Promise.resolve({ data: this.resultado.data ?? null, error: this.resultado.error ?? null });
  }

  single() {
    this.registrar("single", []);
    return Promise.resolve({ data: this.resultado.data ?? null, error: this.resultado.error ?? null });
  }

  then(resolve: (value: Resultado) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve({
      data: this.resultado.data ?? null,
      error: this.resultado.error ?? null,
      count: this.resultado.count ?? null
    }).then(resolve, reject);
  }
}

export function crearClienteFake({
  tablas = {},
  rpcs = {},
  userId = "auth-admin-1"
}: {
  tablas?: Record<string, Resultado>;
  rpcs?: Record<string, Resultado>;
  userId?: string | null;
} = {}) {
  const llamadas: LlamadaTabla[] = [];
  const cliente = {
    llamadas,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null }, error: null }))
    },
    from: vi.fn((table: string) => new QueryFake(llamadas, table, tablas[table])),
    rpc: vi.fn(async (nombre: string, args: unknown) => {
      llamadas.push({ table: "rpc", action: nombre, args: [args] });
      const resultado = rpcs[nombre] ?? {};
      return { data: resultado.data ?? null, error: resultado.error ?? null };
    })
  };

  return cliente;
}
