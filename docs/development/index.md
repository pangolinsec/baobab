---
title: Development
nav_order: 5
has_children: true
---

# Development Guide

Everything you need to develop, extend, and contribute to Baobab.

## Quick reference

```bash
# Start dev server (hot reload on port 5173)
docker compose up

# Type-check
docker compose run --rm app npx tsc --noEmit

# Build for production
docker compose run --rm app npm run build

# Rebuild after dependency changes
docker compose build --no-cache
docker compose up -V
```

{: .warning }
**Never run `node`, `npm`, or `npx` directly on the host.** All commands must run inside Docker containers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- A code editor (VS Code recommended)
- Git

No Node.js installation required on the host — everything runs inside Docker.
