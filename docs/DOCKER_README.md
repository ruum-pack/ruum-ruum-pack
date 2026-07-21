# Configuracion de Docker para el Proyecto Ruum

Este documento describe la configuracion de Docker para desarrollo y produccion.

## Estructura de archivos

```
ruum/
├── Dockerfile                    # Para PRODUCCION
├── Dockerfile.dev               # Para DESARROLLO con hot-reload
├── docker-compose.yml           # Configuracion base (produccion)
├── docker-compose.dev.yml       # Configuracion para desarrollo
├── .dockerignore
└── .npmrc                       # Configuracion de pnpm (shamefully-hoist)
```

## Requisitos

- Docker 20.10+
- Docker Compose v2+
- al menos 8GB RAM (recomendado para el build)

## Uso

### Desarrollo Local (con hot-reload)

Para desarrollo con hot-reload de Next.js:

```bash
cd /mnt/c/Users/hmlom/ruum

# Construir e iniciar los servicios en modo desarrollo
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# O si ya se ha construido antes:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Servicios disponibles:**
- App Conductor: http://localhost:3001
- App Usuario: http://localhost:3000
- Panel Admin: http://localhost:3002

**Características:**
- Hot reload de Next.js
- Código fuente montado como volumen (los cambios se reflejan inmediatamente)
- node_modules centralizado en /app/node_modules
- Cada app tiene un symlink: node_modules -> /app/node_modules

### Producción

Para producción, usar el Dockerfile principal:

```bash
cd /mnt/c/Users/hmlom/ruum

# Construir imagenes de produccion
docker compose build

# Iniciar servicios
docker compose up -d
```

### Construir imagen individuales

```bash
# Construir imagen para desarrollo
docker build -t ruum-dev -f Dockerfile.dev .

# Construir imagen para produccion
docker build -t ruum-prod .
```

## Solucion de Problemas

### Error: Cannot find module '/app/apps/app-xxx/node_modules/next'

**Causa:** Los node_modules dentro de cada app en el host sobrescriben los del contenedor.

**Solucion:** La configuracion actual usa volúmenes anónimos para `/app/apps/app-xxx/node_modules` que preservan los symlinks creados en el Dockerfile.dev. Esto deberia resolver el problema.

Si el problema persiste:
1. Asegúrate de que el Dockerfile.dev se construya correctamente
2. Verifica que los volúmenes anónimos estén configurados en docker-compose.dev.yml
3. Elimina los contenedores y vuelve a construirlos:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```

### Puerto ya en uso

Los puertos 3000, 3001 y 3002 deben estar libres. Si hay conflicto:

```bash
# Verificar que puertos estan en uso
lsof -i :3000
lsof -i :3001
lsof -i :3002

# O con Docker
ss -tulnp | grep 300
```

### Limpiar cache de Docker

Si hay problemas con el build:

```bash
# Limpiar cache de build
docker builder prune

# Limpiar imágenes no usadas
docker image prune -a

# Limpiar todo (CUIDADO: elmina todo lo no usado)
docker system prune -a --volumes
```

## Configuracion Tecnica

### Dockerfile (Produccion)

- Multi-stage build para optimizar el tamaño de la imagen
- Usa Node.js 24 (alpine)
- pnpm 10 para gestion de dependencias
- Instala todas las dependencias y hace build de todos los workspaces
- Imagen final solo contiene los archivos necesarios para produccion

### Dockerfile.dev (Desarrollo)

- Usa Node.js 24 (alpine)
- pnpm 10 con `shamefully-hoist=true` para node_modules centralizado
- Instala todas las dependencias del monorepo
- Crea symlinks: `/app/apps/app-xxx/node_modules -> /app/node_modules`
- Diseñado para usarse con volúmenes montados en docker-compose.dev.yml

### docker-compose.yml

Configuracion base para produccion. Usa:
- Dockerfile para construir imagenes
- NO monta volúmenes (todo está en la imagen)
- node_modules centralizado

### docker-compose.dev.yml

Extiende docker-compose.yml para desarrollo:
- Usa Dockerfile.dev
- Monta código fuente como volúmenes
- Volúmenes anónimos para `/app/apps/app-xxx/node_modules` para preservar symlinks
- Hot reload de Next.js

## Notas Importantes

1. **pnpm workspaces**: El proyecto usa pnpm con workspaces. La configuracion de Docker asume esta estructura.

2. **shamefully-hoist**: Se usa en Dockerfile.dev para tener todas las dependencias en `/app/node_modules`. Esto es necesario para que los symlinks funcionen correctamente.

3. **Volúmenes en desarrollo**: Cuando usas docker-compose.dev.yml, el código fuente se monta desde el host. Esto permite hot-reload, pero los node_modules vienen del contenedor (no del host).

4. **Rendimiento**: El primer build puede tardar varios minutos dependiendo de la velocidad de internet y el hardware. Los builds posteriores usan cache de Docker y son más rápidos.

5. **Sopabase**: El proyecto parece tener una configuracion de Supabase separada. Esta configuracion de Docker es solo para las aplicaciones Next.js, no para los servicios de Supabase.
