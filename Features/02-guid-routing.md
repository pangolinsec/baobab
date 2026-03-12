# 02 — GUID-Based Routing

## Summary

Each conversation gets its own URL path (`/c/:conversationId`), matching the pattern used by Claude and ChatGPT. The root path `/` shows a landing page. Creating a new conversation navigates to its URL on first message send (ChatGPT behavior).

## Priority

Tier 1 — core UX.

## Dependencies

None.

## Data Model Changes

No schema changes needed — conversations already have UUIDs as IDs. The router reads the ID from the URL and loads the corresponding conversation.

## Package Addition

- `react-router-dom` v7 (or latest stable)

## Routing Table

| Path | View | Behavior |
|------|------|----------|
| `/` | Landing | "No conversation selected" page with prompt to create one |
| `/c/:conversationId` | Conversation | Loads the conversation into the tree store and displays it |
| `/c/:conversationId/:researchId` | Research view | (Future: feature 06) Displays a research sub-tree for a specific research run |
| `/settings/:section?` | Settings | Full settings page with tabbed sections (see Settings Architecture in `_overview.md`). `:section` is optional — defaults to General |
| `*` (catch-all) | 404 / Redirect | Redirect to `/` |

## Implementation

### Router Setup (`App.tsx`)

Wrap the app in `BrowserRouter`. Define routes:

```
<Routes>
  <Route path="/" element={<MainLayout />}>
    <Route index element={<LandingPage />} />
    <Route path="c/:conversationId" element={<ConversationView />} />
    <Route path="settings/:section?" element={<SettingsPage />} />
  </Route>
</Routes>
```

`MainLayout` renders the sidebar and the `<Outlet />` for the active route. The sidebar is always visible.

### Navigation Behavior

1. **Creating a new conversation**: clicking "+" in the sidebar calls `createConversation()` but does NOT navigate yet. The user lands on a blank state within the conversation (ready to type). On first message send, `navigate(`/c/${conversation.id}`)` is called.

2. **Selecting an existing conversation**: clicking a conversation in the sidebar calls `navigate(`/c/${conv.id}`)`.

3. **Loading from URL**: when the app loads at `/c/:id`, the `ConversationView` component calls `loadConversation(id)` on mount. If the conversation doesn't exist (stale link), redirect to `/`.

4. **Deleting a conversation**: if the deleted conversation is the current one, navigate to `/`.

5. **Browser back/forward**: standard browser history navigation. React Router handles this — clicking back goes to the previous conversation URL.

### URL Updates

The URL should update when:
- A conversation is selected (sidebar click)
- A new conversation's first message is sent
- A conversation is deleted (redirect to `/`)

The URL should NOT update when:
- Navigating within a conversation (selecting nodes, branching, etc.)

The URL should update when opening settings (navigates to `/settings` or `/settings/:section`).

### Sidebar Integration

The sidebar currently calls `loadConversation(id)` directly. Change it to use `useNavigate()`:

```typescript
const navigate = useNavigate();
// In conversation click handler:
navigate(`/c/${conv.id}`);
```

The `ConversationView` component handles calling `loadConversation` based on the URL param.

### Landing Page (implements UI Fix 1 — Empty State / Onboarding)

The `<LandingPage>` component serves as both the `/` route and the first-time onboarding experience. It should be a standalone component (not inlined into `TreeView`) so the router simply renders it at `/`.

Contents:

- Baobab logo/icon
- **API key setup prompt** if no key is configured (or key is invalid) — either inline or a link to Settings. A first-time user should see this before anything else.
- Brief explanation of how the tree concept works (1-2 sentences + a small illustration or diagram)
- Prominent "New Conversation" button
- Optionally: list of recent conversations as quick links

### Docker / Nginx

For the production build, nginx must serve `index.html` for all routes (SPA fallback). This is already configured in `nginx.conf`:

```
location / {
    try_files $uri $uri/ /index.html;
}
```

### Vite Dev Server

Vite's dev server already handles SPA fallback by default — no config changes needed.

## Edge Cases

- **Stale URLs**: a bookmarked `/c/some-deleted-id` should redirect to `/` gracefully, not crash.
- **Concurrent tabs**: two tabs open on the same conversation should both work (IndexedDB handles concurrent reads). Writes from one tab won't live-update the other (acceptable for v1; could add `BroadcastChannel` later).
- **Deep linking**: sharing a `/c/:id` URL with someone else won't work since conversations are in their local IndexedDB. This is expected — the URL is for the user's own navigation, not sharing.
