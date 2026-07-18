# Dockerfile for development - optimized for hot-reload with Next.js
# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
ARG PNPM_VERSION=10

################################################################################
# Stage 1: Base
################################################################################
FROM node:${NODE_VERSION}-alpine as base

WORKDIR /app

RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

################################################################################
# Stage 2: Dependencies (instalación COMPLETA)
################################################################################
FROM base as deps

# Copiar archivos de configuración del monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Instalar TODAS las dependencias
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

################################################################################
# Stage 3: Build
################################################################################
FROM deps as build

# Copiar el resto del código
COPY . .

# Hacer build de todos los workspaces
RUN pnpm run build

################################################################################
# Stage 4: Final (producción)
################################################################################
FROM base as final

# Copiar TODO node_modules (monorepo completo)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

# Copiar el código fuente y artefactos del build
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./package.json

# Exponer el puerto
EXPOSE 3001

# Comando para iniciar la app (USAR start, no dev)
CMD ["pnpm", "--filter", "@ruum/app-conductor", "start"]