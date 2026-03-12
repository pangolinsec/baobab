# Tier 2 Batch 5 — Backend Architecture Results

**Date**: 2026-02-20
**Environment**: Docker Compose (app on 5173, api on 3001), Chrome MCP

## Summary

| Test | Status | Notes |
|------|--------|-------|
| T00-1: Backend health endpoint | PASS | Returns `{"status":"ok","version":"0.1.0"}` with HTTP 200 |
| T00-2: Backend CORS headers | PASS | `access-control-allow-origin: http://localhost:5173` present |
| T00-3: Backend Docker service | PASS | `api` service Up, port 3001 mapped correctly |
| T00-4: Frontend detects backend | PASS | `fetch('/api/health')` returns `{"status":"ok"}`, no CORS errors |
| T00-5: Frontend handles backend unavailability | PASS | Frontend loads, conversations render, tree view works with api stopped |
| T00-6: Backend placeholder routes | PASS | `/api/search` and `/api/models` both return 200 with placeholder JSON |
| T00-7: Data volume persistence | PASS | `baobab-data` volume mounted at `/data` inside container |

**Result: 7/7 PASS**

---

## Detailed Results

### T00-1: Backend health endpoint responds
- **Status**: PASS
- Ran `curl -s http://localhost:3001/api/health`
- Response: `{"status":"ok","version":"0.1.0"}`
- HTTP status: 200

### T00-2: Backend CORS headers allow frontend origin
- **Status**: PASS
- Ran OPTIONS preflight request with `Origin: http://localhost:5173`
- Response includes: `access-control-allow-origin: http://localhost:5173`
- Also includes: `access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS`

### T00-3: Backend Docker service starts without errors
- **Status**: PASS
- `docker compose ps` shows `baobab-api-1` with status "Up 18 hours"
- Port mapping: `0.0.0.0:3001->3001/tcp`

### T00-4: Frontend detects backend availability
- **Status**: PASS
- Navigated to localhost:5173 in browser
- Executed `fetch('http://localhost:3001/api/health')` from browser console
- Console logged: `BACKEND_TEST: {"status":"ok","version":"0.1.0"}`
- No CORS errors in console

### T00-5: Frontend handles backend unavailability gracefully
- **Status**: PASS
- Stopped backend: `docker compose stop api`
- Reloaded frontend at localhost:5173
- Frontend loaded normally — sidebar, conversation list, tree view all rendered
- Opened an existing conversation — messages and tree displayed correctly
- Restarted backend: `docker compose start api`

### T00-6: Backend placeholder routes respond
- **Status**: PASS
- `/api/search`: `{"results":[],"message":"Search endpoint placeholder"}` (200)
- `/api/models`: `{"models":[],"message":"Models endpoint placeholder"}` (200)

### T00-7: Data volume persistence
- **Status**: PASS
- `docker volume ls | grep baobab` shows `baobab_baobab-data`
- `/data` is mounted inside the container (confirmed via `mount | grep data`)
- Directory is empty (expected — no writes yet from fresh backend)
