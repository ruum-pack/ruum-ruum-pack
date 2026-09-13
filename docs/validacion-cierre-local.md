# Validación local del cierre arquitectónico

Validaciones ejecutadas en el entorno de edición:

- `node scripts/check-fronteras.mjs`: **PASS** — 0 violaciones no justificadas.
- Parseo sintáctico TypeScript/TSX con TypeScript 5.8.3 sobre `packages/api/src` y las tres apps: **535 archivos, 0 errores de sintaxis**.
- `node --check scripts/check-fronteras.mjs`: **PASS**.
- `node --check tests/e2e/run-golden.mjs`: **PASS**.
- Parseo YAML de `.github/workflows/ci.yml`: **PASS**.

No fue posible ejecutar `pnpm typecheck`, `pnpm test:piramide`, `supabase db reset` ni el Golden Path local en este runtime porque `pnpm` y Supabase CLI no están instalados y el entorno no permite descargarlos desde Internet. El workflow de CI incluye ahora `architecture-golden-path` como gate obligatorio para ejecutar esa validación con las herramientas correspondientes.
