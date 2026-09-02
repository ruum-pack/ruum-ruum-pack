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
  upsert(...args: unknown[]) { return this.registrar("upsert", args); }
  delete(...args: unknown[]) { return this.registrar("delete", args); }
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
  userId = "auth-admin-1",
  userEmail,
  storageResult = {},
  functionsResult = {}
}: {
  tablas?: Record<string, Resultado>;
  rpcs?: Record<string, Resultado>;
  userId?: string | null;
  userEmail?: string | null;
  storageResult?: Resultado & { publicUrl?: string };
  functionsResult?: Resultado;
} = {}) {
  const llamadas: LlamadaTabla[] = [];
  const cliente = {
    llamadas,
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: userId
            ? {
                id: userId,
                email: userEmail !== undefined ? (userEmail ?? undefined) : `${userId}@example.com`
              }
            : null
        },
        error: null
      })),
      resetPasswordForEmail: vi.fn(async (email: string, options?: unknown) => {
        llamadas.push({ table: "auth", action: "resetPasswordForEmail", args: [email, options] });
        return { data: {}, error: null };
      })
    },
    from: vi.fn((table: string) => new QueryFake(llamadas, table, tablas[table])),
    rpc: vi.fn(async (nombre: string, args: unknown) => {
      llamadas.push({ table: "rpc", action: nombre, args: [args] });
      const resultado = rpcs[nombre] ?? {};
      return { data: resultado.data ?? null, error: resultado.error ?? null };
    }),
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(async (path: string, _file: unknown, opts: unknown) => {
          llamadas.push({ table: `storage:${bucket}`, action: "upload", args: [path, opts] });
          if (storageResult.error) return { data: null, error: storageResult.error };
          return { data: { path }, error: null };
        }),
        getPublicUrl: vi.fn((path: string) => {
          llamadas.push({ table: `storage:${bucket}`, action: "getPublicUrl", args: [path] });
          return { data: { publicUrl: storageResult.publicUrl ?? `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}` } };
        }),
        createSignedUrl: vi.fn(async (path: string, expiresIn: number) => {
          llamadas.push({ table: `storage:${bucket}`, action: "createSignedUrl", args: [path, expiresIn] });
          if (storageResult.error) return { data: null, error: storageResult.error };
          return { data: { signedUrl: `https://test.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=mock` }, error: null };
        })
      }))
    },
    functions: {
      invoke: vi.fn(async (fn: string, opts: unknown) => {
        llamadas.push({ table: "functions", action: fn, args: [opts] });
        if (functionsResult.error) return { data: null, error: functionsResult.error };
        return { data: functionsResult.data ?? { documento_id: "doc-1", ruta: "ruta/mock" }, error: null };
      })
    }
  };

  return cliente;
}
