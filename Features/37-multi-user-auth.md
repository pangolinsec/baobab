# 37 — Multi-User and Auth

## Summary

Add user authentication and per-user data isolation to Baobab, enabling 2–5 people to share a single self-hosted instance. Each user gets their own conversations, projects, settings, and API keys. Authentication is local username/password with JWT sessions. The backend becomes the source of truth for all user data (migrating from the current IndexedDB-primary architecture). A simple admin role allows user management.

## Priority

Tier 4 — major architectural shift.

## Dependencies

- **00 Backend Architecture**: all data moves to backend SQLite/PostgreSQL.
- **All other features**: this feature touches every data path. It should be implemented after the core feature set is stable.

## Phasing

| Phase | Scope | Prerequisites | Status |
|-------|-------|---------------|--------|
| **A** | Auth system: user registration, login, JWT sessions. Backend user table. Login/register UI. Protected routes. | 00 | — |
| **B** | Data migration: move conversations, nodes, settings, projects from IndexedDB to server-side database. Per-user isolation. Migration tool for existing single-user data. | A | — |
| **C** | Admin: user management page, role-based access (admin/user), admin can view user list and reset passwords. | B | — |
| **D** | Shared resources (optional): allow users to share conversations or projects with other users on the instance. | C | — |

---

## Phase A — Authentication

### Data Model

#### Backend — SQLite

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,       -- bcrypt hash
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,          -- SHA-256 of the JWT (for revocation)
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### JWT Structure

```typescript
interface JWTPayload {
  sub: string;        // user ID
  username: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;        // 7 days from issuance
}
```

The JWT is stored in an `httpOnly` cookie (prevents XSS access) with `SameSite=Strict`. The backend validates it on every request.

### Backend Routes — `server/src/routes/auth.ts`

```typescript
// POST /api/auth/register
// Request: { username: string, displayName: string, password: string }
// Response: { user: { id, username, displayName, role }, token: string }
// Notes: First registered user becomes admin. Subsequent registrations
//        may be open or admin-only (configurable).

// POST /api/auth/login
// Request: { username: string, password: string }
// Response: { user: { id, username, displayName, role }, token: string }

// POST /api/auth/logout
// Invalidates the current session.

// GET /api/auth/me
// Returns the current user from the JWT. Used on app load to check auth state.
// Response: { user: { id, username, displayName, role } } | 401

// PUT /api/auth/password
// Request: { currentPassword: string, newPassword: string }
// Changes the current user's password.
```

### Password Requirements

- Minimum 8 characters.
- Hashed with bcrypt (cost factor 12).
- No complexity requirements beyond length (users are self-hosting for 2–5 people — overly strict rules are counterproductive).

### Registration Policy

Configurable via environment variable:

```
REGISTRATION_MODE=open       # Anyone can register (default for first setup)
REGISTRATION_MODE=admin-only # Only admin can create users
REGISTRATION_MODE=closed     # No new registrations
```

The first registered user is always promoted to admin regardless of mode.

### Frontend Auth Flow

```
App Load
  │
  ├─ GET /api/auth/me
  │   ├─ 200 → user is logged in → proceed to app
  │   └─ 401 → redirect to /login
  │
  ├─ /login
  │   Username: [              ]
  │   Password: [              ]
  │   [Log in]
  │   Don't have an account? [Register]
  │
  └─ /register (if REGISTRATION_MODE allows)
      Username: [              ]
      Display Name: [          ]
      Password: [              ]
      Confirm Password: [      ]
      [Register]
```

### Auth Store

```typescript
// src/store/useAuthStore.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}
```

### Route Protection

All app routes (`/c/:id`, `/settings`, `/projects/:id`, etc.) are wrapped in an auth guard:

```typescript
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}
```

Backend middleware validates JWT on every API request (except `/api/auth/login`, `/api/auth/register`, `/api/health`).

---

## Phase B — Data Migration

### Architecture Shift

**Before (current)**: IndexedDB is source of truth. Backend stores only files and tag cache.

**After**: Backend SQLite is source of truth for all data. IndexedDB becomes a **local cache** for offline resilience and faster reads.

### New Backend Tables

```sql
-- Conversations (previously IndexedDB only)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  root_node_id TEXT,
  model TEXT,
  system_prompt TEXT,
  project_id TEXT,
  web_search_enabled INTEGER DEFAULT 0,
  search_provider TEXT DEFAULT 'duckduckgo',
  code_interpreter_enabled INTEGER,
  rag_config TEXT,              -- JSON blob
  http_tool_ids TEXT,           -- JSON array
  mcp_server_ids TEXT,          -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tree nodes (previously IndexedDB only)
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  parent_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  model TEXT,
  node_type TEXT DEFAULT 'standard',
  starred INTEGER DEFAULT 0,
  dead_end INTEGER DEFAULT 0,
  user_modified INTEGER DEFAULT 0,
  collapsed INTEGER DEFAULT 0,
  thinking TEXT,
  model_override TEXT,
  system_prompt_override TEXT,
  provider_id TEXT,
  provider_override TEXT,
  token_usage TEXT,            -- JSON blob
  tool_calls TEXT,             -- JSON array
  citations TEXT,              -- JSON array
  batch_id TEXT,
  merge_source_ids TEXT,       -- JSON array
  merge_mode TEXT,
  source TEXT,
  refusal TEXT,                -- JSON blob
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX idx_nodes_conversation ON nodes(conversation_id);

-- Tags (join table — previously string array on conversation)
CREATE TABLE conversation_tags (
  conversation_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (conversation_id, tag),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- User settings (previously single row in IndexedDB)
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  settings TEXT NOT NULL,        -- JSON blob of AppSettings
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Projects (previously IndexedDB only)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  system_prompt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Elicitation sessions (previously IndexedDB only)
CREATE TABLE elicitation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  config TEXT NOT NULL,          -- JSON blob
  status TEXT NOT NULL DEFAULT 'running',
  message_count INTEGER DEFAULT 0,
  token_count TEXT,              -- JSON blob
  activity_log TEXT,             -- JSON array
  latest_score TEXT,             -- JSON blob
  refusal_analysis TEXT,         -- JSON blob
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

### Data Isolation

Every query includes `WHERE user_id = ?` to ensure users can only access their own data. This is enforced in a middleware that extracts the user ID from the JWT and injects it into the request context:

```typescript
// server/src/middleware/auth.ts
fastify.decorateRequest('userId', '');

fastify.addHook('preHandler', async (request, reply) => {
  if (publicRoutes.includes(request.url)) return;
  const token = request.cookies.auth_token;
  if (!token) return reply.status(401).send({ error: 'Not authenticated' });
  const payload = verifyJWT(token);
  request.userId = payload.sub;
});
```

### Migration Tool

For existing single-user installations upgrading to multi-user:

1. On first boot with auth enabled, if no users exist and IndexedDB data is detected:
2. Show a migration wizard: "Create your admin account to migrate existing data."
3. User registers → admin account created.
4. Frontend reads all data from IndexedDB and uploads to backend via bulk API:
   ```
   POST /api/migrate
   Body: {
     conversations: Conversation[],
     nodes: Record<string, TreeNode>,
     settings: AppSettings,
     projects: Project[],
     elicitationSessions: ElicitationSession[]
   }
   ```
5. Backend associates all data with the new admin user.
6. IndexedDB data is cleared after successful migration.
7. Subsequent logins use the backend as source of truth.

### API Changes

All existing API endpoints gain user scoping. For example:

```typescript
// Before:
fastify.get('/api/projects/:id/files', async (request) => {
  return db.getFilesByProject(request.params.id);
});

// After:
fastify.get('/api/projects/:id/files', async (request) => {
  const project = db.getProject(request.params.id);
  if (!project || project.userId !== request.userId) {
    return reply.status(404).send({ error: 'Project not found' });
  }
  return db.getFilesByProject(request.params.id);
});
```

### New Backend Data Routes

```typescript
// Conversations
GET    /api/conversations              // list user's conversations
GET    /api/conversations/:id          // get conversation + nodes
POST   /api/conversations              // create conversation
PUT    /api/conversations/:id          // update conversation
DELETE /api/conversations/:id          // delete conversation + nodes

// Nodes
POST   /api/nodes                      // create node
PUT    /api/nodes/:id                  // update node
DELETE /api/nodes/:id                  // delete node + subtree

// Settings
GET    /api/settings                   // get user settings
PUT    /api/settings                   // update user settings

// Projects
GET    /api/projects                   // list user's projects
POST   /api/projects                   // create project
PUT    /api/projects/:id               // update project
DELETE /api/projects/:id               // delete project + files
```

### Frontend Store Changes

All Zustand stores gain a sync layer that reads/writes through the backend API instead of directly to IndexedDB:

```typescript
// Pattern for migrated stores:
createConversation: async (data) => {
  // 1. Optimistic update to local state
  set(state => ({ conversations: [...state.conversations, data] }));
  // 2. Persist to backend
  await backendFetch('/api/conversations', { method: 'POST', body: JSON.stringify(data) });
  // 3. On error, revert local state
}
```

IndexedDB remains as a local cache for faster startup (the frontend loads from IndexedDB, then syncs with the backend in the background).

---

## Phase C — Admin

### Admin Page (`/admin`)

Accessible only to users with `role: 'admin'`.

```
┌──────────────────────────────────────────────────────────────┐
│ Admin — User Management                                       │
│                                                               │
│ Registration mode: [Open ▾]                                   │
│                                                               │
│ ┌──────┬────────────┬──────┬───────────┬─────────┬──────────┐│
│ │ User │ Display    │ Role │ Created   │ Convos  │ Actions  ││
│ ├──────┼────────────┼──────┼───────────┼─────────┼──────────┤│
│ │ alice│ Alice      │admin │ 2026-02-20│   42    │ [...]    ││
│ │ bob  │ Bob        │user  │ 2026-02-21│   18    │ [...]    ││
│ │ carol│ Carol      │user  │ 2026-02-22│    7    │ [...]    ││
│ └──────┴────────────┴──────┴───────────┴─────────┴──────────┘│
│                                                               │
│ [+ Create User]                                               │
└──────────────────────────────────────────────────────────────┘
```

**Actions per user**:
- Reset password (generates a temporary password)
- Change role (admin ↔ user)
- Delete user (with confirmation — deletes all user data)

**Admin API routes**:

```typescript
// GET /api/admin/users — list all users (admin only)
// POST /api/admin/users — create user (admin only)
// PUT /api/admin/users/:id/role — change user role (admin only)
// POST /api/admin/users/:id/reset-password — reset password (admin only)
// DELETE /api/admin/users/:id — delete user and all data (admin only)
```

---

## Phase D — Shared Resources (Optional)

Deferred. If implemented:

- Conversations and projects gain a `shared_with` field (list of user IDs or "all").
- Shared conversations are read-only for non-owners (or read-write with explicit permission).
- A "Shared with me" section in the sidebar.
- Requires careful access control in every query.

This phase is complex and may not be needed for 2–5 users who can simply share via export/import (Feature 38).

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Password storage | bcrypt with cost factor 12 |
| Session hijacking | httpOnly + Secure + SameSite=Strict cookies |
| JWT expiration | 7-day expiry, refresh on activity |
| Brute force | Rate limit login attempts (5/minute per IP) |
| CSRF | SameSite=Strict cookies + CORS origin check |
| Data isolation | Every query scoped by user_id from JWT |
| Admin escalation | Role changes require admin JWT; admin cannot demote themselves if they're the last admin |
| API key storage | Per-user settings stored server-side; API keys encrypted at rest (AES-256 with instance secret) |

---

## Environment Variables

```
# Auth
AUTH_ENABLED=true                    # Enable authentication (default false for backwards compat)
JWT_SECRET=<random-32-bytes>         # JWT signing secret (auto-generated on first boot if not set)
REGISTRATION_MODE=open               # open | admin-only | closed

# Database (Phase B may warrant PostgreSQL for larger installs)
DATABASE_URL=sqlite:///app/data/baobab.db   # default
```

### Backwards Compatibility

When `AUTH_ENABLED=false` (default), the app behaves exactly as it does today — no login required, IndexedDB is source of truth, single-user mode. This preserves the existing single-user experience for users who don't need multi-user.

When upgrading to `AUTH_ENABLED=true`, the migration wizard handles the transition.

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/routes/auth.ts` | Authentication endpoints (register, login, logout, me, password) |
| `server/src/routes/admin.ts` | Admin user management endpoints |
| `server/src/routes/conversations.ts` | CRUD for conversations and nodes |
| `server/src/routes/settings.ts` | User settings endpoints |
| `server/src/middleware/auth.ts` | JWT validation middleware, user ID injection |
| `server/src/services/auth.ts` | Password hashing, JWT generation/verification |
| `src/store/useAuthStore.ts` | Authentication state and actions |
| `src/components/auth/LoginPage.tsx` | Login form |
| `src/components/auth/RegisterPage.tsx` | Registration form |
| `src/components/auth/AuthGuard.tsx` | Route protection wrapper |
| `src/components/admin/AdminPage.tsx` | User management page |
| `src/components/admin/UserTable.tsx` | User list with actions |

## Files to Modify

| File | Change |
|------|--------|
| `server/src/index.ts` | Register auth middleware, new routes |
| `server/src/db/schema.ts` | Add users, sessions, conversations, nodes, user_settings, projects, elicitation_sessions tables |
| `server/package.json` | Add `bcrypt`, `jsonwebtoken`, `@fastify/cookie` dependencies |
| `src/store/useTreeStore.ts` | Add backend sync layer for conversations and nodes |
| `src/store/useSettingsStore.ts` | Add backend sync layer for settings |
| `src/store/useProjectStore.ts` | Add backend sync layer for projects |
| `src/store/useElicitationStore.ts` | Add backend sync layer for sessions |
| `src/App.tsx` (or router config) | Wrap app routes in AuthGuard, add /login and /register routes |
| `docker-compose.yml` | Add AUTH_ENABLED and JWT_SECRET environment variables |

## Implementation Order

1. **Phase A**: Backend auth routes → JWT middleware → auth store → login/register UI → route protection.
2. **Phase B**: Backend data tables → CRUD routes → store sync layers → migration tool → IndexedDB cache layer.
3. **Phase C**: Admin routes → admin UI → role management.
4. **Phase D** (optional): Shared resources model → access control → shared view.

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | Empty username/password → validation error. Missing JWT → 401. |
| What if the external dependency is unavailable? | Backend down → if IndexedDB cache exists, app works in read-only mode (no new conversations). Login page shows "Server unavailable." |
| What if this runs concurrently with itself? | Two users creating conversations simultaneously → no conflict (separate user IDs). Race on registration → unique constraint on username prevents duplicates. |
| What happens on the second invocation? | Login with existing session → returns existing user (idempotent). Register with existing username → 409 Conflict. |
| What if the user's data is larger than expected? | SQLite handles 100K+ nodes fine. For 5 users with heavy usage, consider PostgreSQL. Migration tool batches uploads (1000 nodes per request). |
| What state persists vs. resets across page reload? | JWT in httpOnly cookie survives reload. Auth state re-checked via GET /api/auth/me on load. IndexedDB cache provides instant UI while backend syncs. |

## Browser-Only Mode

When `AUTH_ENABLED=false`, the app works exactly as today — no auth, IndexedDB is source of truth, single-user. The auth system has zero impact on the existing browser-only experience.

When `AUTH_ENABLED=true`, the backend is required. Browser-only mode is not supported in multi-user configuration.
