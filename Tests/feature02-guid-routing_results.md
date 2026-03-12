# Feature 02 — GUID-Based Routing: Test Results

**Date**: 2026-02-20
**Environment**: Docker Compose (app on 5173), Chrome MCP
**Starting state**: Multiple conversations exist (Tell me about cats, List 5 animals, etc.)

## Summary

| Section | Total | Pass | Fail | Skipped |
|---------|-------|------|------|---------|
| 1 — Landing Page Route | 3 | 3 | 0 | 0 |
| 2 — Conversation Routes | 5 | 5 | 0 | 0 |
| 3 — Settings Routes | 4 | 4 | 0 | 0 |
| 4 — Browser Navigation | 3 | 3 | 0 | 0 |
| 5 — Page Refresh Persistence | 2 | 2 | 0 | 0 |
| 6 — Edge Cases | 1 | 1 | 0 | 0 |
| **Total** | **18** | **18** | **0** | **0** |

---

## Detailed Results

### Section 1 — Landing Page Route

**T02-1: Root URL shows landing page**
- **Status**: PASS
- Navigated to `http://localhost:5173/`
- Landing page displayed with Baobab logo, welcome message, "New Conversation" button, and RECENT conversations list
- Sidebar showed conversation list
- URL confirmed as `http://localhost:5173/`

**T02-2: Unknown routes redirect to root**
- **Status**: PASS
- Navigated to `http://localhost:5173/nonexistent-page`
- Browser redirected to `http://localhost:5173/`
- Landing page displayed normally, no error

**T02-3: Random path segments redirect to root**
- **Status**: PASS
- Navigated to `http://localhost:5173/foo/bar/baz`
- Browser redirected to `http://localhost:5173/`

### Section 2 — Conversation Routes

**T02-4: Clicking a conversation updates the URL**
- **Status**: PASS
- Started at landing page `/`
- Clicked "Tell me about cats" in sidebar
- URL changed to `http://localhost:5173/c/2aba3a4a-e4db-4df1-aeb1-56ea8c855045`
- Conversation loaded with tree view showing all nodes

**T02-5: Direct navigation to conversation URL**
- **Status**: PASS
- Navigated to root, then directly to `http://localhost:5173/c/2aba3a4a-e4db-4df1-aeb1-56ea8c855045`
- "Tell me about cats" conversation loaded correctly
- Sidebar highlighted the correct conversation
- Tree view showed all nodes (user, assistant, branches)

**T02-6: Switching conversations updates the URL**
- **Status**: PASS
- Clicked "List 5 animals" → URL changed to `/c/4529381c-a885-426f-9a71-7eed28b0ceed`
- Clicked back to "Tell me about cats" → URL changed to `/c/2aba3a4a-e4db-4df1-aeb1-56ea8c855045`

**T02-7: Invalid conversation ID shows graceful fallback**
- **Status**: PASS
- Navigated to `http://localhost:5173/c/invalid-uuid-that-does-not-exist`
- App did not crash — redirected to landing page `/`
- No error page or blank screen

**T02-8: Creating a new conversation updates the URL**
- **Status**: PASS (after fix)
- Clicked "+" button in sidebar header
- "New Conversation" was created and appeared in sidebar with onboarding tips
- URL immediately updated to `http://localhost:5173/c/3d9b02e5-1ab4-4afa-a5f3-7893db38d5ec`
- Sidebar highlighted the new conversation entry
- **Fix applied**: Sidebar.tsx `onClick` handler now captures the return value of `createConversation()` and navigates to `/c/${conv.id}` instead of `/`

### Section 3 — Settings Routes

**T02-9: Navigating to settings updates URL**
- **Status**: PASS
- Clicked Settings in sidebar
- URL changed to `http://localhost:5173/settings`
- Settings page displayed with tab navigation

**T02-10: Settings section routing**
- **Status**: PASS
- `/settings/general` → General tab active (Theme section visible)
- `/settings/providers` → Providers tab active (highlighted)
- `/settings/advanced` → Advanced tab active
- `/settings/prompts` → Prompts tab active
- `/settings/pricing` → Pricing tab active
- All 5 sections routed correctly via direct URL navigation

**T02-11: Settings without section defaults correctly**
- **Status**: PASS
- Navigated to `http://localhost:5173/settings` (no section)
- Settings page opened with General tab selected by default
- Theme section content visible

**T02-12: Clicking settings tabs updates URL**
- **Status**: PASS
- From `/settings`, clicked "Providers" → URL updated to `/settings/providers`
- Clicked "Advanced" → URL updated to `/settings/advanced`

### Section 4 — Browser Navigation

**T02-13: Browser back button works**
- **Status**: PASS
- Navigation sequence: `/` → `/c/2aba3a4a...` → `/c/4529381c...`
- Back → returned to `/c/2aba3a4a...` (first conversation loaded)
- Back again → returned to `/` (landing page shown)

**T02-14: Browser forward button works**
- **Status**: PASS
- Continued from T02-13 (at `/`)
- Forward → navigated to `/c/2aba3a4a...` (first conversation loaded)
- Forward again → navigated to `/c/4529381c...` (second conversation loaded)

**T02-15: Back/Forward through settings**
- **Status**: PASS
- From conversation `/c/4529381c...`, clicked Settings → `/settings`
- Back → returned to `/c/4529381c...` with conversation loaded
- Forward → returned to `/settings`

### Section 5 — Page Refresh Persistence

**T02-16: Refreshing a conversation URL reloads the conversation**
- **Status**: PASS
- Navigated to `/c/2aba3a4a-e4db-4df1-aeb1-56ea8c855045`
- Refreshed the page (location.reload())
- After reload: same URL in address bar
- Conversation loaded from IndexedDB — tree view showed all nodes
- Sidebar highlighted "Tell me about cats"

**T02-17: Refreshing settings preserves the section**
- **Status**: PASS
- Navigated to `/settings/prompts`
- Refreshed the page
- After reload: URL still `/settings/prompts`
- Prompts tab active (highlighted in navigation, "Default System Prompt" content visible)

### Section 6 — Edge Cases

**T02-18: URL updates when deleting current conversation**
- **Status**: PASS
- Loaded "New Conversation" at `/c/a4590fb7-2c95-4f0e-adf4-81dc761314b0`
- Hovered over sidebar entry, clicked trash icon to delete
- URL changed to `/` (landing page)
- Deleted conversation no longer in sidebar
- Navigating back to `/c/a4590fb7-2c95-4f0e-adf4-81dc761314b0` redirected to `/` — no crash

## Issues Found

1. **T02-8 (fixed)**: Creating a new conversation via the "+" button did not update the URL to `/c/<new-uuid>`. Root cause: the `onClick` handler in `Sidebar.tsx` called `navigate('/')` after `createConversation()`, ignoring the returned conversation object. Fixed by capturing the return value and navigating to `/c/${conv.id}`. Retested and confirmed PASS.
