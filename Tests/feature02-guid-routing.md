# Feature 02 — GUID-Based Routing: Test Plan

Tests for URL routing: conversation deep links at `/c/:conversationId`, settings routing at `/settings/:section?`, browser navigation (back/forward), direct URL entry, and fallback for invalid routes. All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings
5. At least two conversations exist (create them if needed by sending messages)

---

## Section 1 — Landing Page Route

### T02-1: Root URL shows landing page

1. Navigate to `http://localhost:5173/`
2. Take a screenshot
3. **Verify**: The landing page or conversation list is displayed (sidebar with conversation list)
4. **Verify**: The URL in the address bar is `http://localhost:5173/`
5. **Verify**: No conversation is loaded in the main content area (or a welcome screen is shown)

### T02-2: Unknown routes redirect to root

1. Navigate to `http://localhost:5173/nonexistent-page`
2. **Verify**: The browser redirects to `http://localhost:5173/`
3. **Verify**: The landing page is displayed normally
4. **Verify**: No error page or blank screen

### T02-3: Random path segments redirect to root

1. Navigate to `http://localhost:5173/foo/bar/baz`
2. **Verify**: The browser redirects to `http://localhost:5173/`

---

## Section 2 — Conversation Routes

### T02-4: Clicking a conversation updates the URL

1. Start at the landing page (`http://localhost:5173/`)
2. Click a conversation in the sidebar
3. Read the URL from the address bar
4. **Verify**: The URL has changed to `http://localhost:5173/c/<some-uuid>` where `<some-uuid>` is a valid-looking ID
5. **Verify**: The conversation is loaded and visible in the main content area
6. Note this conversation ID for later tests

### T02-5: Direct navigation to conversation URL

1. Copy the conversation URL from T02-4 (e.g., `http://localhost:5173/c/<uuid>`)
2. Open a new tab or navigate directly to that URL
3. **Verify**: The conversation loads directly — the correct conversation is shown
4. **Verify**: The sidebar highlights the loaded conversation
5. **Verify**: The tree (or thread) view shows the conversation's nodes

### T02-6: Switching conversations updates the URL

1. With a conversation loaded, click a different conversation in the sidebar
2. **Verify**: The URL changes to `/c/<different-uuid>`
3. **Verify**: The new conversation is displayed
4. Click back to the first conversation
5. **Verify**: The URL changes back to `/c/<first-uuid>`

### T02-7: Invalid conversation ID shows graceful fallback

1. Navigate to `http://localhost:5173/c/invalid-uuid-that-does-not-exist`
2. Take a screenshot
3. **Verify**: The app does not crash or show an uncaught error
4. **Verify**: Either a "not found" message is shown, the user is redirected to the landing page, or an empty conversation view is displayed

### T02-8: Creating a new conversation updates the URL

1. Start at the landing page
2. Click the "New Chat" button (or "+" button) in the sidebar
3. **Verify**: The URL changes to `/c/<new-uuid>`
4. **Verify**: The new conversation is loaded with a welcome/empty state

---

## Section 3 — Settings Routes

### T02-9: Navigating to settings updates URL

1. Click the Settings link (gear icon) in the sidebar
2. **Verify**: The URL changes to include `/settings`
3. **Verify**: The Settings page is displayed

### T02-10: Settings section routing

1. Navigate to `http://localhost:5173/settings/general`
2. **Verify**: The Settings page opens with the General tab active
3. Navigate to `http://localhost:5173/settings/providers`
4. **Verify**: The Providers tab is now active
5. Navigate to `http://localhost:5173/settings/advanced`
6. **Verify**: The Advanced tab is now active
7. Navigate to `http://localhost:5173/settings/prompts`
8. **Verify**: The Prompts tab is now active
9. Navigate to `http://localhost:5173/settings/pricing`
10. **Verify**: The Pricing tab is now active

### T02-11: Settings without section defaults correctly

1. Navigate to `http://localhost:5173/settings`
2. **Verify**: The Settings page opens with a default tab selected (General or the first tab)

### T02-12: Clicking settings tabs updates URL

1. Navigate to Settings
2. Click the "Providers" tab
3. **Verify**: The URL updates to `/settings/providers`
4. Click the "Advanced" tab
5. **Verify**: The URL updates to `/settings/advanced`

---

## Section 4 — Browser Navigation

### T02-13: Browser back button works

1. Start at the landing page (`/`)
2. Click a conversation (URL becomes `/c/<uuid-1>`)
3. Click a different conversation (URL becomes `/c/<uuid-2>`)
4. Click the browser Back button
5. **Verify**: The URL returns to `/c/<uuid-1>`
6. **Verify**: The first conversation is loaded and displayed
7. Click Back again
8. **Verify**: The URL returns to `/`
9. **Verify**: The landing page is shown

### T02-14: Browser forward button works

1. Continue from T02-13 (at the landing page after pressing Back twice)
2. Click the browser Forward button
3. **Verify**: The URL goes to `/c/<uuid-1>`
4. **Verify**: The first conversation loads
5. Click Forward again
6. **Verify**: The URL goes to `/c/<uuid-2>`
7. **Verify**: The second conversation loads

### T02-15: Back/Forward through settings

1. From a conversation (`/c/<uuid>`), click Settings
2. **Verify**: URL changes to `/settings` (or `/settings/general`)
3. Click Back
4. **Verify**: Returns to `/c/<uuid>` with the conversation loaded
5. Click Forward
6. **Verify**: Returns to Settings

---

## Section 5 — Page Refresh Persistence

### T02-16: Refreshing a conversation URL reloads the conversation

1. Navigate to a conversation (`/c/<uuid>`)
2. Verify the conversation is loaded
3. Refresh the page (F5 or Ctrl+R)
4. **Verify**: After reload, the same URL is in the address bar
5. **Verify**: The conversation loads from IndexedDB and displays correctly
6. **Verify**: Nodes are visible in the tree/thread view

### T02-17: Refreshing settings preserves the section

1. Navigate to `http://localhost:5173/settings/prompts`
2. Refresh the page
3. **Verify**: The Settings page loads with the Prompts tab active
4. **Verify**: The URL still shows `/settings/prompts`

---

## Section 6 — Edge Cases

### T02-18: URL updates when deleting current conversation

1. Load a conversation and note its URL (`/c/<uuid>`)
2. Delete that conversation (hover over it in sidebar, click the delete/trash icon)
3. **Verify**: The URL changes away from `/c/<uuid>` (either to `/` or to another conversation)
4. **Verify**: The deleted conversation is no longer in the sidebar
5. **Verify**: Navigating back to `/c/<uuid>` does not crash the app
