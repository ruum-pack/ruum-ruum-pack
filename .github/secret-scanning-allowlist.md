# Secret scanning — allowlist local (no es workflow)

Este repo no usa `.github/secret_scanning.yml` como workflow (GitHub lo ignoraría:
un workflow válido requiere `name/on/jobs` bajo `.github/workflows/`).

- El gate real es `pnpm scan:secrets` (`scripts/scan-secrets.mjs`), bloqueante en
  `pre-commit` y CI (`ci.yml: workspace`).
- Fixtures intencionales con secretos falsos para probar el scanner:
  - `tests/fixtures/test-secret-positive/**`
  - `tests/fixtures/**`
  - `tests/security/scan-secrets.test.mjs`
  Están excluidos en `scan-secrets.mjs` (raíz: `excludeFixtures`, `ARCHIVOS_EXCLUIDOS`).
- Push protection de GitHub se configura en la UI del repo/org (bypass list),
  no por archivo. No versionar secretos reales nunca.
