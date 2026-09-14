# ADR-002: Overrides de dependencias pnpm

## Estado

Aceptado como control provisional de dependencias transitivas.

## Fecha

2026-09-13

## Decisión

Los overrides del `package.json` raíz se mantienen centralizados para que una instalación limpia use, de forma reproducible, las versiones mínimas actualmente validadas:

| Paquete | Override | Motivo operativo | Seguimiento |
| --- | --- | --- | --- |
| `postcss` | `8.5.26` | Fijar la versión transitiva validada por el pipeline CSS | Añadir referencia CVE/issue antes de retirar |
| `nanoid@3.3.15` | `3.3.18` | Elevar una versión transitiva parcheada | Añadir referencia CVE/issue antes de retirar |
| `fast-uri@3.1.3` | `3.1.6` | Elevar una versión transitiva parcheada | Añadir referencia CVE/issue antes de retirar |
| `sharp@0.34.5` | `0.35.3` | Elevar una versión transitiva compatible con la imagen Node soportada | Confirmar consumidor y compatibilidad antes de retirar |
| `brace-expansion@5.0.6` | `5.0.9` | Elevar una versión transitiva parcheada | Añadir referencia CVE/issue antes de retirar |

El repositorio no conservaba la referencia CVE/issue que originó estas reglas. Por eso se consideran provisionales: cualquier actualización debe registrar la referencia, fecha de revisión y criterio de retirada aquí, además de ejecutar `pnpm install --frozen-lockfile`, typecheck, lint y las pruebas afectadas.
