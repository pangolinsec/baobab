# Backend Service Verification Tests

Pre-Tier 3 verification of the backend (`server/`) service. These tests confirm the backend is operational, the frontend detects it, and the infrastructure is ready for Tier 3 features (05 Web Search, 13 Project Knowledge, 16 Merge, 22 Pricing).

Extends `tier2-batch5-backend.md` (basic health/CORS/docker checks) with deeper verification of route responses, frontend integration, error handling, and Docker configuration.

---

## Prerequisites

1. Run `docker compose up` — both `app` (port 5173) and `api` (port 3001) must be running
2. Chrome MCP tab group initialized with a tab on `http://localhost:5173`
3. Terminal access for `docker compose` and `curl` commands

---

## Section 1 — Docker Infrastructure

### BV-01: Both services start from a cold state

1. Run `docker compose down -v` to remove all containers and volumes
2. Run `docker compose up -d`
3. Wait 15 seconds for startup
4. Run `docker compose ps`
5. **Verify**: `app` service status is "Up" or "running"
6. **Verify**: `api` service status is "Up" or "running"
7. **Verify**: `app` maps port 5173
8. **Verify**: `api` maps port 3001

### BV-02: API service logs show successful startup

1. Run `docker compose logs api --tail=20`
2. **Verify**: Logs contain Fastify startup message (e.g., "Server listening at" or similar)
3. **Verify**: No error or crash messages in the logs

### BV-03: Data volume exists and is mounted

1. Run `docker volume ls | grep baobab`
2. **Verify**: A volume matching `baobab-data` (or `*_baobab-data`) is listed
3. Run `docker compose exec api ls -la /data`
4. **Verify**: The `/data` directory exists inside the container
5. **Verify**: The directory is writable (run `docker compose exec api touch /data/.test && echo OK`)
6. Clean up: `docker compose exec api rm /data/.test`

### BV-04: API service restarts cleanly

1. Run `docker compose restart api`
2. Wait 5 seconds
3. Run `curl -s http://localhost:3001/api/health`
4. **Verify**: Returns `{ "status": "ok" }` with HTTP 200

### BV-05: Hot reload works on server source changes

1. Note the current response from `curl -s http://localhost:3001/api/health`
2. The `./server/src` directory is volume-mounted into the container
3. **Verify**: `docker compose exec api ls /app/src/index.ts` shows the file exists
4. **Verify**: The container's `npm run dev` command uses `tsx watch` (check `docker compose exec api cat /app/package.json | grep dev`)

---

## Section 2 — Health Endpoint

### BV-06: Health endpoint returns correct shape

1. Run `curl -s http://localhost:3001/api/health`
2. **Verify**: Response is valid JSON
3. **Verify**: Contains `"status": "ok"`
4. **Verify**: Contains `"version"` field (string value)
5. **Verify**: HTTP status code is 200

### BV-07: Health endpoint responds quickly

1. Run `curl -s -o /dev/null -w "%{time_total}" http://localhost:3001/api/health`
2. **Verify**: Response time is under 500ms

---

## Section 3 — CORS Configuration

### BV-08: CORS allows localhost:5173 origin

1. Run: `curl -s -I -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET" http://localhost:3001/api/health`
2. **Verify**: Response includes `Access-Control-Allow-Origin` header
3. **Verify**: Allowed origin is `http://localhost:5173` (or `*`)
4. **Verify**: Response includes `Access-Control-Allow-Methods` containing `GET`

### BV-09: CORS allows 127.0.0.1:5173 origin

1. Run: `curl -s -I -X OPTIONS -H "Origin: http://127.0.0.1:5173" -H "Access-Control-Request-Method: GET" http://localhost:3001/api/health`
2. **Verify**: Response includes `Access-Control-Allow-Origin` header matching `http://127.0.0.1:5173`

### BV-10: CORS allows required HTTP methods

1. Run: `curl -s -I -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" http://localhost:3001/api/health`
2. **Verify**: `Access-Control-Allow-Methods` includes `POST`
3. Repeat for `DELETE`
4. **Verify**: `Access-Control-Allow-Methods` includes `DELETE`

### BV-11: CORS rejects disallowed origin

1. Run: `curl -s -I -X OPTIONS -H "Origin: http://evil.com" -H "Access-Control-Request-Method: GET" http://localhost:3001/api/health`
2. **Verify**: Response either lacks `Access-Control-Allow-Origin` or does NOT include `http://evil.com`
3. **Note**: If CORS origin is `*`, mark as WARN — not a security issue for local dev but should be tightened for production

---

## Section 4 — Placeholder Routes

These routes exist as scaffolding for Tier 3. They should respond without errors but are not yet functional.

### BV-12: Search route responds

1. Run `curl -s -w "\n%{http_code}" http://localhost:3001/api/search`
2. **Verify**: HTTP status is 200 (not 404 or 500)
3. **Verify**: Response is valid JSON
4. **Verify**: Response shape contains a `results` or `message` field

### BV-13: Files route responds

1. Run `curl -s -w "\n%{http_code}" http://localhost:3001/api/files`
2. **Verify**: HTTP status is 200 (not 404 or 500)
3. **Verify**: Response is valid JSON

### BV-14: Models route responds

1. Run `curl -s -w "\n%{http_code}" http://localhost:3001/api/models`
2. **Verify**: HTTP status is 200 (not 404 or 500)
3. **Verify**: Response is valid JSON

### BV-15: Unknown route returns 404

1. Run `curl -s -w "\n%{http_code}" http://localhost:3001/api/nonexistent`
2. **Verify**: HTTP status is 404
3. **Verify**: Response is JSON (Fastify default error handler)

### BV-16: POST to search endpoint (pre-implementation)

1. Run `curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d '{"query":"test"}' http://localhost:3001/api/search`
2. **Verify**: Does NOT return 404 (route exists)
3. **Note**: May return 404 (only GET is defined) or 200 — record actual behavior for baseline

---

## Section 5 — Frontend Integration

### BV-17: Frontend loads without backend errors in console

1. Navigate to `http://localhost:5173` in the browser tab
2. Check console for errors matching pattern `backend|api|3001|CORS|fetch`
3. **Verify**: No errors related to backend connectivity appear
4. **Verify**: App renders normally (tree view or welcome screen visible)

### BV-18: useBackendStatus detects running backend

1. With `http://localhost:5173` loaded, run in browser console:
   ```js
   fetch('http://localhost:3001/api/health').then(r => r.json()).then(d => console.log('HEALTH:', JSON.stringify(d)))
   ```
2. **Verify**: Console logs `HEALTH: {"status":"ok","version":"0.1.0"}` (or similar)
3. **Verify**: No CORS error in console

### BV-19: Frontend fetch to backend has no CORS issues

1. Run in browser console:
   ```js
   fetch('http://localhost:3001/api/search').then(r => r.json()).then(d => console.log('SEARCH:', JSON.stringify(d))).catch(e => console.error('SEARCH_ERR:', e.message))
   ```
2. **Verify**: Logs search placeholder response, NOT a CORS error
3. Repeat for `/api/files` and `/api/models`
4. **Verify**: All three succeed without CORS errors

### BV-20: Backend URL is correctly configured

1. Run in browser console:
   ```js
   console.log('VITE_API_URL:', import.meta.env.VITE_API_URL || 'NOT SET')
   ```
2. **Note**: Record whether `VITE_API_URL` is set or not
3. Run in browser console:
   ```js
   fetch('http://localhost:3001/api/health').then(r => console.log('DIRECT_FETCH: OK')).catch(e => console.log('DIRECT_FETCH: FAIL'))
   ```
4. **Verify**: Direct fetch succeeds regardless of env var (frontend hardcodes `http://localhost:3001`)

---

## Section 6 — Graceful Degradation

### BV-21: Frontend survives backend being stopped

1. Run `docker compose stop api`
2. Wait 3 seconds
3. Reload `http://localhost:5173` in the browser
4. **Verify**: App loads without crash or white screen
5. **Verify**: Conversations, tree view, and settings all function normally
6. **Verify**: No uncaught errors in console (warnings are acceptable)

### BV-22: Frontend recovers when backend restarts

1. With backend still stopped from BV-21, start it: `docker compose start api`
2. Wait 5 seconds
3. Click away from the browser tab and click back (triggers visibility change / refocus)
4. Run in browser console:
   ```js
   fetch('http://localhost:3001/api/health').then(r => r.json()).then(d => console.log('RECOVERED:', JSON.stringify(d)))
   ```
5. **Verify**: Health check succeeds
6. **Note**: Record whether `useBackendStatus` automatically re-detects the backend on tab refocus

### BV-23: Chat functionality works without backend

1. Stop backend: `docker compose stop api`
2. Create a new conversation and send a message (requires a valid Anthropic API key in settings)
3. **Verify**: Message sends and streams correctly (API calls go directly from browser to Anthropic, not through backend)
4. **Verify**: All tree operations (branch, star, dead-end, tags) work
5. Restart backend: `docker compose start api`

---

## Section 7 — Tier 3 Readiness Checklist

These are not pass/fail tests — they document the current state of backend infrastructure needed by each Tier 3 feature.

### BV-24: Feature 05 (Web Search) prerequisites

1. **Route exists**: `GET /api/search` responds (verified in BV-12)
2. **POST handler**: Run `curl -s -X POST -H "Content-Type: application/json" -d '{"query":"test","provider":"duckduckgo"}' http://localhost:3001/api/search`
3. **Record**: Does POST return a functional search result, a placeholder, or a 404?
4. **Search service files**: Run `docker compose exec api ls /app/src/services/search/ 2>/dev/null || echo "NOT FOUND"`
5. **Record**: Which search provider implementations exist (duckduckgo.ts, tavily.ts, bing.ts)?
6. **Settings integration**: Check if search API key fields exist in Settings dialog

### BV-25: Feature 13 (Project Knowledge) prerequisites

1. **Files route**: `GET /api/files` responds (verified in BV-13)
2. **Upload endpoint**: Run `curl -s -X POST -F "file=@/dev/null;filename=test.txt" http://localhost:3001/api/files`
3. **Record**: Does file upload work, return placeholder, or error?
4. **Projects route**: Run `curl -s http://localhost:3001/api/projects`
5. **Record**: Does the route exist or return 404?
6. **Sync route**: Run `curl -s -X POST -H "Content-Type: application/json" -d '{"projects":[],"tags":[]}' http://localhost:3001/api/sync`
7. **Record**: Does the sync route exist or return 404?

### BV-26: Feature 22 (Pricing) prerequisites

1. **Token usage capture**: This is frontend-only (no backend dependency)
2. **Provider response parsing**: Check if `src/api/providers/*.ts` files extract `usage` from API responses
3. **Record**: Which providers currently capture token usage in their response handling?
4. **Pricing data file**: Check if `src/data/pricing.ts` exists
5. **Record**: Does it exist, and does it contain model pricing data?

---

## Summary Table

| ID | Test | Section |
|----|------|---------|
| BV-01 | Both services start from cold state | Docker |
| BV-02 | API logs show successful startup | Docker |
| BV-03 | Data volume exists and is mounted | Docker |
| BV-04 | API restarts cleanly | Docker |
| BV-05 | Hot reload works | Docker |
| BV-06 | Health endpoint correct shape | Health |
| BV-07 | Health endpoint responds quickly | Health |
| BV-08 | CORS allows localhost:5173 | CORS |
| BV-09 | CORS allows 127.0.0.1:5173 | CORS |
| BV-10 | CORS allows required methods | CORS |
| BV-11 | CORS rejects disallowed origin | CORS |
| BV-12 | Search route responds | Routes |
| BV-13 | Files route responds | Routes |
| BV-14 | Models route responds | Routes |
| BV-15 | Unknown route returns 404 | Routes |
| BV-16 | POST to search endpoint | Routes |
| BV-17 | Frontend loads without backend errors | Integration |
| BV-18 | useBackendStatus detects backend | Integration |
| BV-19 | Frontend fetch has no CORS issues | Integration |
| BV-20 | Backend URL configured correctly | Integration |
| BV-21 | Frontend survives backend stopped | Degradation |
| BV-22 | Frontend recovers on backend restart | Degradation |
| BV-23 | Chat works without backend | Degradation |
| BV-24 | Feature 05 prerequisites | Tier 3 Readiness |
| BV-25 | Feature 13 prerequisites | Tier 3 Readiness |
| BV-26 | Feature 22 prerequisites | Tier 3 Readiness |
