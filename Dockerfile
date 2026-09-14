# Dockerfile de producción para el monorepo Ruum (las tres apps Next.js).
# Desarrollo local con hot-reload: ver Dockerfile.dev + docker-compose.dev.yml.
# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
ARG PNPM_VERSION=10.0.0

################################################################################
# Stage 1: Base
################################################################################
FROM node:${NODE_VERSION}-alpine AS base

ARG PNPM_VERSION=10.0.0

WORKDIR /app

RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

################################################################################
# Stage 2: Dependencies (instalación COMPLETA)
################################################################################
FROM base AS deps

# Copiar archivos de configuración del monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY scripts/ ./scripts/

# Instalar TODAS las dependencias
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

################################################################################
# Stage 3: Build
################################################################################
FROM deps AS build

# Copiar el resto del código
COPY . .

# Hacer build de todos los workspaces
RUN pnpm run build

################################################################################
# Stage 4: Final (producción)
################################################################################
FROM base AS final

# Copiar TODO node_modules (monorepo completo)
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/apps ./apps
COPY --from=deps --chown=node:node /app/packages ./packages

# Copiar el código fuente y artefactos del build
COPY --from=build --chown=node:node /app/apps ./apps
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Las tres apps comparten la imagen; Compose selecciona el comando y puerto.
EXPOSE 3000 3001 3002

# No correr como root en producción.
USER node

# /login es pública (200 sin sesión) en las 3 apps; PORT lo fija Compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3001}/login" > /dev/null || exit 1

# Comando para iniciar la app (USAR start, no dev)
CMD ["pnpm", "--filter", "@ruum/app-conductor", "start"]
