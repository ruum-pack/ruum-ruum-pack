import { defineConfig } from 'eslint/config'
import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url))
})

const eslintConfig = defineConfig([
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: [
      '.next/**',
      '.turbo/**',
      'node_modules/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'android/**',
      '**.android.js'
    ]
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // FASE 6 — Fronteras: avisa (el gate duro es pnpm check:fronteras).
      "no-restricted-syntax": ["warn",
        {
          selector: "CallExpression > MemberExpression[property.name='from'][object.name!='Array'][object.name!='Buffer'][object.name!='Object']",
          message: "Fase 6: acceso directo a Supabase en apps. Usa un módulo de @ruum/api."
        },
        {
          selector: "CallExpression > MemberExpression[property.name='rpc']",
          message: "Fase 6: .rpc() directo en apps. Usa un módulo de @ruum/api."
        },
        {
          selector: "CallExpression > MemberExpression[property.name='invoke']",
          message: "Fase 6: invoke directo en apps. Usa un módulo de @ruum/api."
        }
      ]
    }
  }
])

export default eslintConfig
