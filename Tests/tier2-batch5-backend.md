# Tier 2 Batch 5 — Backend Architecture

Tests for Feature 00 (Backend Service). These tests verify the Fastify backend starts correctly and the frontend detects its availability. Most tests use the browser against `localhost:5173` with Chrome MCP tools; backend-specific checks use `curl` against `localhost:3001`.

---

## Prerequisites

Before running tests:

1. Both services are running via `docker compose up` and accessible:
   - Frontend at `localhost:5173`
   - Backend at `localhost:3001`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`

---

## Feature 00 — Backend Service

### T00-1: Backend health endpoint responds

1. In a terminal, run: `curl -s http://localhost:3001/api/health`
2. **Verify**: The response is valid JSON
3. **Verify**: The response contains a `status` field with value `"ok"`
4. **Verify**: The HTTP status code is 200

### T00-2: Backend CORS headers allow frontend origin

1. In a terminal, run: `curl -s -I -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET" http://localhost:3001/api/health`
2. **Verify**: The response includes `Access-Control-Allow-Origin` header
3. **Verify**: The origin `http://localhost:5173` is allowed (header value is `*` or `http://localhost:5173`)

### T00-3: Backend Docker service starts without errors

1. Run `docker compose ps` and check the api service
2. **Verify**: The `api` service is listed and its status is "Up" or "running"
3. **Verify**: Port 3001 is mapped correctly

### T00-4: Frontend detects backend availability

1. Navigate to `http://localhost:5173` in the browser
2. Open the browser console (F12 → Console tab)
3. Run in console: `fetch('http://localhost:3001/api/health').then(r => r.json()).then(d => console.log('BACKEND:', d))`
4. **Verify**: Console logs a JSON object with `status: "ok"`
5. **Verify**: No CORS errors appear in the console

### T00-5: Frontend handles backend unavailability gracefully

1. Stop the backend service: `docker compose stop api`
2. Reload the frontend at `http://localhost:5173`
3. **Verify**: The frontend loads normally without errors or crashes
4. **Verify**: All frontend features (conversations, tree view, settings) work without the backend
5. Restart the backend: `docker compose start api`

### T00-6: Backend placeholder routes respond

1. Run: `curl -s http://localhost:3001/api/search`
2. **Verify**: The endpoint responds (may return empty results or a placeholder response, not a 404)
3. Run: `curl -s http://localhost:3001/api/models`
4. **Verify**: The endpoint responds (may return empty results or a placeholder response, not a 404)

### T00-7: Data volume persistence

1. Run: `docker compose exec api ls /data` (or the configured data directory)
2. **Verify**: The data directory exists inside the container
3. **Verify**: The `baobab-data` volume is mounted (check `docker volume ls | grep baobab`)
