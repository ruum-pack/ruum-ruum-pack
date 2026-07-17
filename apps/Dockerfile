# Etapa base
FROM node:20-alpine AS base
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10 turbo@2

# Etapa de dependencias
FROM base AS deps
COPY package*.json pnpm-lock.yaml turbo.json ./
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/
RUN pnpm install --frozen-lockfile

# Etapa de desarrollo
FROM deps AS dev
WORKDIR /app
EXPOSE 3000

# Etapa de compilación con Turborepo
FROM dev AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=@ruum/app-usuario... --filter=@ruum/app-conductor... --filter=@ruum/panel-admin...

# Etapa final de producción
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copia solo lo necesario
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps

CMD ["pnpm", "turbo", "start"]