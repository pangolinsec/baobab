# UI Fixes Reference

Behavioral specifications for UI fixes referenced across feature specs. These originated from observations documented in `scratch/UIObservations.md` and are referenced by feature specs using the format "UI Fix N".

Only fixes referenced by feature specs are included here. See `scratch/UIObservations.md` for the full observation list and `scratch/UIfixes.md` for the triage/priority list.

---

## UI Fix 1 — Empty State / Onboarding

**Status**: Not implemented. Implemented as part of Feature 02 (GUID Routing).

**Referenced by**: Feature 02

**Behavior**: When no conversation is loaded (the `/` route), display a standalone `<LandingPage>` component with:
- API key configuration prompt if no key is set (first-time users see this before anything else)
- A brief explanation of the tree-structured conversation concept (1-2 sentences + small illustration)
- A prominent "New Conversation" button
- Optionally, a list of recent conversations as quick links

The landing page must be a standalone component (not inlined into `TreeView`) so Feature 02 can render it at the index route.

---

## UI Fix 3 — Error Node Visual Distinction

**Status**: Not implemented. Visual treatment ships with Feature 10; retry action ships with Feature 23.

**Referenced by**: Features 10, 12, 23, `_overview.md` (visual channels table)

**Behavior**: Failed API responses must be visually distinct from successful responses:
- **Styling**: Error nodes receive `border-2 border-red-500` and a distinct error icon.
- **Content**: Display a human-readable error message instead of raw JSON.
- **Reply prevention**: Error nodes are excluded from being valid reply targets. The "Reply here" action does not appear on error nodes.
- **Visual stacking**: Red error border takes precedence over the orange override ring (Feature 10), but override chips still render inside error nodes for diagnostic context. When an error node is in a dead-end branch (Feature 12), both `opacity-40` dimming and the red border apply simultaneously.
- **Retry**: The "Retry" action on error nodes is defined in Feature 23 (Resend/Duplicate), which replaces the error node in-place with a fresh API call.

---

## UI Fix 6 — Selection / Reply Target Decoupling

**Status**: Implemented (commits `005d209`, `275e3d6`).

**Referenced by**: Feature 21

**Behavior**: Clicking a tree node **selects** it for viewing (shows it in the detail panel, highlights it in the tree) but does NOT change the reply target. The reply target is set exclusively through explicit "Reply here" actions (detail panel button, context menu item). Collapse/expand does not alter the reply target.

This convention applies uniformly across tree view and thread view (Feature 21). The "Reply here" button is the canonical (and only) way to set a reply target.

---

## UI Fix 15 — Active Path Highlighting

**Status**: Not implemented. Ships with Feature 10 (Visual Indicators).

**Referenced by**: Feature 10, `_overview.md` (visual channels table)

**Behavior**: When a node is selected, the edges on the path from root to that node are highlighted with increased stroke width and/or accent color. Only edges are modified — node card appearance is NOT changed for path highlighting.

This keeps visual channels separated:
- **Edges** = path/branch context (this fix)
- **Node borders** = error state (UI Fix 3) and override state (Feature 10)
- **Node opacity** = dead-end status (Feature 12)
