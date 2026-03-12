---
title: Setup
parent: Development
nav_order: 1
---

# Development Setup

## Clone and start

```bash
git clone <repo-url>
cd baobab
docker compose up --build
```

The dev server starts on [http://localhost:5173](http://localhost:5173) with hot module replacement — changes to source files are reflected immediately in the browser.

## Docker architecture

The development environment uses Docker Compose with volume mounts for hot reload:

```yaml
# Mounted from host (changes reflected immediately)
./src         → /app/src
./index.html  → /app/index.html
./public      → /app/public
./package.json → /app/package.json
# Plus config files (vite, tsconfig, tailwind, postcss)

# Inside container only (not on host)
/app/node_modules  → anonymous Docker volume
```

## Adding dependencies

Because `node_modules` lives in an anonymous Docker volume, adding packages requires a specific workflow:

1. **Edit `package.json` on the host** — add the dependency directly to the file
2. **Rebuild the image**: `docker compose build --no-cache`
3. **Recreate with fresh volumes**: `docker compose up -V`

{: .warning }
Do **not** run `npm install` inside a container — `docker compose run --rm` creates ephemeral containers, and the anonymous `node_modules` volume is not shared between them.

## Type checking

```bash
docker compose run --rm app npx tsc --noEmit
```

Run this before committing to catch type errors.

## Production build

```bash
# Build inside Docker
docker compose run --rm app npm run build

# Or build a production container
docker build --target production -t baobab .
docker run -p 8080:80 baobab
```

The production build uses a multi-stage Dockerfile:
1. **dev** stage: Node.js for development
2. **build** stage: compile TypeScript and bundle with Vite
3. **production** stage: Nginx serving the compiled static files

## Backend server (optional)

```bash
# Start both frontend and backend
docker compose --profile backend up --build
```

The backend (Fastify + SQLite) runs on port 3001. The frontend automatically detects it via a health check at startup.
