## Structural Feature Specs for Baobab

> **RECONCILED**: This document has been reconciled into the canonical feature specs and `_overview.md`. Decisions are recorded in [ADR-001](../Decisions/001-spec-reconciliation.md). Key outcomes: S1 (TreeNode sub-objects) was superseded by the NodeType enum approach (ADR-001 Decision 1). S2 (Settings Page) and S3 (Context Menu) were adopted as conventions in `_overview.md`. S4 (Data Sync) was merged with R2 into the canonical sync protocol in Feature 00. This file is retained for historical reference only.

Below are four detailed feature specs, each addressing one of the identified architectural concerns. They follow the same format used by the existing specs in `/home/baud/Documents/DataML/GIT/baobab/Features/`.

---

# S1 -- TreeNode Data Model Refactoring

## Summary

The `TreeNode` interface in `/home/baud/Documents/DataML/GIT/baobab/src/types/index.ts` currently has 4 fields. Across all feature specs, it accumulates approximately 15 additional optional fields spanning unrelated concerns: display metadata (`thinking`, `tokenUsage`), user annotations (`starred`, `deadEnd`), cascade overrides (`modelOverride`, `providerOverride`, `systemPromptOverride`), synthetic node markers (`isSynthetic`, `isMerge`, `isSummary`, `mergeSourceIds`), tool use state (`toolUse`), and edit tracking (`userModified`). Rather than making `TreeNode` a flat bag of 19+ properties, this spec restructures it into a core type with optional grouped metadata sub-objects.

## Priority

Tier 0 -- foundational. Must be implemented before any Tier 2+ feature that adds fields to `TreeNode`. Does not block Tier 1 features (which only add `thinking`, `modelOverride`, `providerOverride`, `systemPromptOverride`), but should be done concurrently with Tier 1 to avoid a second migration.

## Dependencies

None. This is a data model refactoring that precedes feature implementation.

## Design Decision: Metadata Sub-Objects (Not Discriminated Unions)

Three options were evaluated:

1. **Flat optional fields** (current trajectory): simple but produces a god object. Every serialization, every UI component, and every store update must cope with 19+ optional fields. Autocomplete and type checking weaken as the interface grows.

2. **Discriminated union by node type** (`type: 'message' | 'tool' | 'summary' | 'merge' | 'synthetic'`): elegant for some cases, but many flags are orthogonal -- a message can be both starred and dead-end and have a model override and have thinking content. Unions do not model orthogonal traits cleanly.

3. **Core + optional grouped metadata sub-objects**: the TreeNode retains its core identity fields, and optional metadata is grouped by concern into sub-objects. Each sub-object is only present when relevant. This is the chosen approach.

Rationale for option 3: it preserves backward compatibility (existing code reads `node.content`, `node.role`, etc. unchanged), groups related fields so they are easy to reason about, and keeps the flat shape small enough that IndexedDB serialization stays straightforward.

## Proposed `TreeNode` Interface

```typescript
export type MessageRole = 'user' | 'assistant' | 'tool';

// --- Core: always present ---
export interface TreeNode {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: MessageRole;
  content: string;
  model: string;
  createdAt: number;
  childIds: string[];
  collapsed: boolean;

  // --- Grouped optional metadata ---
  overrides?: CascadeOverrides;
  annotations?: UserAnnotations;
  synthesis?: SynthesisMetadata;
  toolUse?: ToolUseData;
  inference?: InferenceMetadata;
}

// Cascade overrides (Features 08, 09)
export interface CascadeOverrides {
  modelOverride?: string;
  providerOverride?: string;
  systemPromptOverride?: string;
  // Future: temperature, maxTokens per-node overrides
}

// User annotations (Features 11, 12, 23)
export interface UserAnnotations {
  starred?: boolean;
  deadEnd?: boolean;
  userModified?: boolean;
}

// Synthetic/generated node metadata (Features 15, 16)
export interface SynthesisMetadata {
  isSummary?: boolean;
  isMerge?: boolean;
  isSynthetic?: boolean;
  mergeSourceIds?: string[];
}

// Tool use data (Feature 05)
export interface ToolUseData {
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
}

// Inference response metadata (Features 04, 07, 22)
export interface InferenceMetadata {
  thinking?: string;
  providerId?: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

## Accessor Functions

To avoid repetitive null-checking throughout the codebase, provide accessor functions in `/home/baud/Documents/DataML/GIT/baobab/src/lib/nodeAccessors.ts`:

```typescript
import type { TreeNode } from '../types';

export function isStarred(node: TreeNode): boolean {
  return node.annotations?.starred === true;
}

export function isDeadEnd(node: TreeNode): boolean {
  return node.annotations?.deadEnd === true;
}

export function isUserModified(node: TreeNode): boolean {
  return node.annotations?.userModified === true;
}

export function isMergeNode(node: TreeNode): boolean {
  return node.synthesis?.isMerge === true;
}

export function isSummaryNode(node: TreeNode): boolean {
  return node.synthesis?.isSummary === true;
}

export function isSyntheticNode(node: TreeNode): boolean {
  return node.synthesis?.isSynthetic === true;
}

export function getModelOverride(node: TreeNode): string | undefined {
  return node.overrides?.modelOverride;
}

export function getSystemPromptOverride(node: TreeNode): string | undefined {
  return node.overrides?.systemPromptOverride;
}

export function getThinking(node: TreeNode): string | undefined {
  return node.inference?.thinking;
}

export function getTokenUsage(node: TreeNode): { inputTokens: number; outputTokens: number } | undefined {
  return node.inference?.tokenUsage;
}

export function getProviderId(node: TreeNode): string | undefined {
  return node.inference?.providerId;
}

// Mutator helpers for store actions
export function setAnnotation<K extends keyof import('../types').UserAnnotations>(
  node: TreeNode,
  key: K,
  value: import('../types').UserAnnotations[K]
): TreeNode {
  return {
    ...node,
    annotations: { ...node.annotations, [key]: value },
  };
}

export function setOverride<K extends keyof import('../types').CascadeOverrides>(
  node: TreeNode,
  key: K,
  value: import('../types').CascadeOverrides[K]
): TreeNode {
  return {
    ...node,
    overrides: { ...node.overrides, [key]: value },
  };
}
```

## Dexie Migration Strategy

IndexedDB (via Dexie) stores the full `TreeNode` object. Sub-objects serialize naturally to IndexedDB (they are plain JS objects). The migration reshapes existing flat fields (if any were already added) into the sub-objects.

Since the current `TreeNode` in the codebase has no optional fields yet, the primary migration is a schema version bump that adds the new indexed fields:

```typescript
// In database.ts
this.version(2).stores({
  conversations: 'id, createdAt, updatedAt, projectId, *tags',
  nodes: 'id, conversationId, parentId, annotations.starred',
  settings: '++id',
}).upgrade(tx => {
  // No data migration needed for v1 -> v2 if no features have shipped yet.
  // If features 11/12 shipped with flat fields, migrate here:
  return tx.table('nodes').toCollection().modify(node => {
    if (node.starred !== undefined) {
      node.annotations = { ...node.annotations, starred: node.starred };
      delete node.starred;
    }
    if (node.deadEnd !== undefined) {
      node.annotations = { ...node.annotations, deadEnd: node.deadEnd };
      delete node.deadEnd;
    }
    // ... repeat for other flat fields that may have shipped
  });
});
```

Note: Dexie compound indexes on nested properties (like `annotations.starred`) require Dexie 4+. If using Dexie 3, use a top-level index alias instead.

## Impact on Existing Feature Specs

Each feature spec that adds fields to `TreeNode` must update its data model section to use the appropriate sub-object. For example:

- Feature 08 (Model Cascade): `modelOverride` and `providerOverride` move to `node.overrides.modelOverride` and `node.overrides.providerOverride`.
- Feature 09 (System Prompt Cascade): `systemPromptOverride` moves to `node.overrides.systemPromptOverride`.
- Feature 11 (Star Messages): `starred` moves to `node.annotations.starred`.
- Feature 12 (Dead-End Branches): `deadEnd` moves to `node.annotations.deadEnd`.
- Feature 04 (Advanced Config): `thinking` moves to `node.inference.thinking`.
- Feature 05 (Web Search): `toolUse` stays at `node.toolUse` (already a sub-object).
- Feature 07 (Inference Providers): `providerId` moves to `node.inference.providerId`.
- Feature 15 (Summarize): `isSummary` moves to `node.synthesis.isSummary`.
- Feature 16 (Merge): `isSynthetic`, `isMerge`, `mergeSourceIds` move to `node.synthesis.*`.
- Feature 22 (Pricing): `tokenUsage` moves to `node.inference.tokenUsage`.
- Feature 23 (Resend/Duplicate): `userModified` moves to `node.annotations.userModified`.

## Resolution Algorithm Updates

Functions like `resolveModel` and `resolveSystemPrompt` that walk the tree checking for overrides change from:

```typescript
if (current.modelOverride) { ... }
```

to:

```typescript
if (current.overrides?.modelOverride) { ... }
```

Or, using the accessor:

```typescript
if (getModelOverride(current)) { ... }
```

## Performance Considerations

- Sub-objects add one level of indirection but do not measurably affect performance. V8 and JSC inline nested object access.
- IndexedDB serialization handles nested plain objects natively (structured clone algorithm). No custom serialization needed.
- The accessor functions are trivial and will be inlined by the JIT compiler.

## Edge Cases

- **Partial sub-objects**: a node may have `overrides: { modelOverride: 'claude-opus-4' }` with no `providerOverride`. All sub-object fields are optional. The accessor functions handle `undefined` gracefully.
- **Empty sub-objects**: a node could end up with `annotations: {}` after removing all annotations. This is harmless but wastes a few bytes. The mutator helpers could prune empty sub-objects, but this is not worth the complexity.
- **Backward compatibility**: if any features shipped with flat fields before this refactoring, the Dexie migration handles reshaping. If no features have shipped yet (which is the case currently), no migration logic is needed beyond the schema version bump.

---

# S2 -- Settings Page Architecture

## Summary

The current settings UI is a single modal dialog (`/home/baud/Documents/DataML/GIT/baobab/src/components/settings/SettingsDialog.tsx`) containing an API key, model selector, and theme toggle. By Tier 2, it must accommodate: 6 provider API keys with validation (Feature 07), advanced API parameters with sliders (Feature 04), default system prompt (Feature 09), search provider keys (Feature 05), summarization prompt (Feature 15), merge prompt (Feature 16), comparison/classify defaults (Feature 17), research agent sub-agent configuration (Feature 06), and pricing preferences (Feature 22). This cannot remain a modal. This spec converts settings into a full routed page with a sidebar navigation of tabbed sections.

## Priority

Tier 1 -- foundational. Must be done before Feature 07 (Inference Providers) which adds 6 provider sections.

## Dependencies

- **02 GUID-Based Routing**: requires the router to be in place for `/settings` route.

## Routing

Add a `/settings` route alongside the existing routes:

```
<Routes>
  <Route path="/" element={<MainLayout />}>
    <Route index element={<LandingPage />} />
    <Route path="c/:conversationId" element={<ConversationView />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="settings/:section" element={<SettingsPage />} />
  </Route>
</Routes>
```

The `/settings` route renders a full-page settings UI within the `MainLayout` (sidebar stays visible). The optional `:section` param deep-links to a specific section (e.g., `/settings/providers`).

## UI Layout

### Settings Page

```
+-----------------------------------------------------------+
| Baobab           [+]                                     |
+------------------+----------------------------------------+
| [Sidebar]        | Settings                                |
|                  +----------------------------------------+
| Conversations    | [General]  [Providers]  [Advanced]      |
| ...              | [Prompts]  [Research]   [About]         |
|                  +----------------------------------------+
|                  |                                          |
|                  | General Settings                         |
|                  |                                          |
|                  | Theme                                    |
|                  | [Light] [Dark]                           |
|                  |                                          |
|                  | Default Model                            |
|                  | [Claude Haiku 4.5           v]           |
|                  |                                          |
|                  |                                          |
+------------------+----------------------------------------+
```

### Settings Tab Navigation

A horizontal tab bar (or vertical sidebar within the settings area, depending on viewport width) with sections:

| Tab ID | Label | Contents | Feature Dependencies |
|--------|-------|----------|---------------------|
| `general` | General | Theme, default model, default provider | Core |
| `providers` | Providers | API keys for all 6+ providers, validation, connection tests | Feature 07 |
| `advanced` | Advanced | Thinking toggle/budget, temperature, max tokens, top-p, top-k | Feature 04 |
| `prompts` | Prompts | Default system prompt, summarization prompt, merge prompt, comparison prompt | Features 09, 15, 16, 17 |
| `search` | Search | Default search provider, Tavily key, Bing key | Feature 05 |
| `research` | Research | Orchestrator prompt, synthesis prompt, max iterations, sub-agent list | Feature 06 |
| `pricing` | Pricing | Custom model pricing, display preferences | Feature 22 |
| `about` | About | Version, links, export/import data | Core |

Tabs are only rendered when their features are present. For example, the "Search" tab only appears when the backend is available (`isBackendAvailable()`). The "Research" tab only appears when Feature 06 is implemented.

### Tab Component Structure

```
src/components/settings/
  SettingsPage.tsx              # Route component, renders tab bar + active section
  SettingsTabBar.tsx            # Horizontal tab navigation
  sections/
    GeneralSection.tsx          # Theme, default model
    ProvidersSection.tsx        # All provider configs (accordion)
    AdvancedSection.tsx         # API parameters
    PromptsSection.tsx          # Default prompts
    SearchSection.tsx           # Search provider config
    ResearchSection.tsx         # Research agent config
    PricingSection.tsx          # Pricing preferences
    AboutSection.tsx            # Version info, data management
```

### SettingsPage Component (sketch)

```typescript
import { useParams, useNavigate } from 'react-router-dom';

const SECTIONS = [
  { id: 'general', label: 'General', component: GeneralSection },
  { id: 'providers', label: 'Providers', component: ProvidersSection },
  { id: 'advanced', label: 'Advanced', component: AdvancedSection },
  { id: 'prompts', label: 'Prompts', component: PromptsSection },
  { id: 'search', label: 'Search', component: SearchSection, requires: 'backend' },
  { id: 'research', label: 'Research', component: ResearchSection, requires: 'backend' },
  { id: 'pricing', label: 'Pricing', component: PricingSection },
  { id: 'about', label: 'About', component: AboutSection },
];

export function SettingsPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const activeSection = section || 'general';
  const backendAvailable = isBackendAvailable();

  const visibleSections = SECTIONS.filter(s =>
    !s.requires || (s.requires === 'backend' && backendAvailable)
  );

  const ActiveComponent = visibleSections.find(s => s.id === activeSection)?.component
    || GeneralSection;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="border-b border-[#E0D5CB] dark:border-[#3D3229] px-6">
        <div className="flex gap-1">
          {visibleSections.map(s => (
            <button
              key={s.id}
              onClick={() => navigate(`/settings/${s.id}`)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeSection === s.id
                  ? 'bg-white dark:bg-[#2A2520] text-[#D97757] border-b-2 border-[#D97757]'
                  : 'text-[#8B7E74] hover:text-[#3D3229] dark:hover:text-[#E0D5CB]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active section */}
      <div className="flex-1 overflow-y-auto p-6">
        <ActiveComponent />
      </div>
    </div>
  );
}
```

### Providers Section (accordion pattern)

The providers section replicates the existing API key flow but for multiple providers, using an accordion:

```
Inference Providers
=========================================================

v Anthropic (default)                         [checkmark]
  API Key: [sk-ant-**********]         [eye] [validate]
  Status: Valid -- 12 models available

> OpenAI                                      [not set]
  (collapsed -- click to expand)

> Ollama                                      [not set]

> OpenRouter                                  [not set]

> Gemini                                      [not set]

> Hugging Face                                [not set]

---------------------------------------------------------
Default Provider: [Anthropic  v]
```

Each provider accordion item contains:
- API key input (or base URL for Ollama)
- Validate/test button
- Status indicator (idle, validating, valid, invalid)
- Model count when valid

### Quick Access from Header

A gear icon in the main layout header opens `/settings`:

```
+---------------------------------------------------------+
| Baobab             [gear icon]              [+]        |
+---------------------------------------------------------+
```

The old `SettingsDialog` component is removed. All references to opening the settings dialog change to `navigate('/settings')`.

### Backward Compatibility: Quick Settings Modal (optional)

For quick single-setting changes (like switching theme), a lightweight popover could remain available from the gear icon without navigating away. This is optional and lower priority.

## Data Model Changes

### `AppSettings` Interface Growth

The `AppSettings` interface grows across features. With the tabbed architecture, each section reads/writes a logical subset of `AppSettings`. The store does not need to be split -- Zustand selectors already allow components to subscribe to specific fields.

However, the settings store (`/home/baud/Documents/DataML/GIT/baobab/src/store/useSettingsStore.ts`) should be refactored to use update functions grouped by section rather than one setter per field:

```typescript
interface SettingsState extends AppSettings {
  // Grouped update functions
  updateGeneral: (updates: Partial<Pick<AppSettings, 'theme' | 'defaultModel' | 'defaultProvider'>>) => Promise<void>;
  updateAdvanced: (updates: Partial<Pick<AppSettings, 'thinkingEnabled' | 'thinkingBudget' | 'temperature' | 'maxOutputTokens' | 'topP' | 'topK'>>) => Promise<void>;
  updateProvider: (providerId: string, config: Partial<ProviderConfig>) => Promise<void>;
  updatePrompts: (updates: Partial<Pick<AppSettings, 'defaultSystemPrompt' | 'summarizationPrompt' | 'mergePrompt' | 'comparisonPrompt'>>) => Promise<void>;
  // ... etc.

  // Generic update (for simple cases)
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}
```

The generic `updateSettings` persists to IndexedDB in one write:

```typescript
updateSettings: async (updates) => {
  set(updates);
  const current = await db.settings.toCollection().first();
  if (current?.id) await db.settings.update(current.id, updates);
},
```

## Navigation Integration

### Sidebar Link

The sidebar (`/home/baud/Documents/DataML/GIT/baobab/src/components/layout/Sidebar.tsx`) gets a settings link at the bottom:

```
+----------------------------+
| Baobab              [+]  |
+----------------------------+
| Conversations...           |
|                            |
| ...                        |
|                            |
+----------------------------+
| [gear] Settings            |
+----------------------------+
```

### Keyboard Shortcut

`Ctrl+,` / `Cmd+,` navigates to `/settings` (standard keyboard shortcut for settings in most apps).

## Edge Cases

- **Navigating away with unsaved changes**: each section auto-saves on blur/change (like the current dialog's validate-on-blur pattern). No explicit "Save" button is needed per section. If a destructive change is in progress (e.g., deleting a sub-agent), confirm before navigating away.
- **Deep linking**: `/settings/providers` directly opens the Providers tab. If the section does not exist (typo in URL), fall back to `/settings/general`.
- **Mobile/narrow viewport**: the tab bar wraps or converts to a dropdown select on narrow screens.
- **Backend unavailability**: sections marked `requires: 'backend'` are hidden. If the backend goes down after the page loaded, show a warning banner but do not hide the sections (the user may want to review their config).

---

# S3 -- Context Menu Architecture

## Summary

Six feature specs (11, 12, 15, 16, 17, 23) add items to the tree node right-click context menu. The combined menu would have 10+ items for some node states, making it unwieldy. This spec defines a structured context menu system with grouped sections, conditional visibility based on node state, and optional submenus for advanced actions.

## Priority

Tier 1 -- foundational. Must be in place before implementing any context-menu-dependent feature.

## Dependencies

None.

## Inventory of Context Menu Items

Compiled from all feature specs, here is every item that appears in a node context menu:

| Item | Feature | Condition | Category |
|------|---------|-----------|----------|
| Reply here | Core | All non-error nodes | Actions |
| Resend | 23 | User nodes only | Actions |
| Duplicate & Edit | 23 | All nodes | Actions |
| Retry | 23 | Error nodes only | Actions |
| Star / Unstar | 11 | All nodes | Annotate |
| Flag as dead end / Remove flag | 12 | All nodes | Annotate |
| Summarize branch | 15 | Nodes with children | Branch Ops |
| Score / Evaluate | 17 | All nodes | Branch Ops |
| Copy | Core | All nodes | Clipboard |
| Copy error | 23 | Error nodes only | Clipboard |
| Delete | Core | All nodes | Danger |
| Delete branch | Core | All nodes | Danger |

Additionally, multi-select mode (Ctrl+Click two nodes) replaces the context menu / detail panel with:
- Merge (Feature 16)
- Compare (Feature 17)

These multi-select actions are not in the right-click menu -- they appear in the detail panel. So the right-click menu concerns single-node operations only.

## Menu Structure

### Grouping by Separator

Items are organized into logical groups separated by dividers. The groups are:

```
+---------------------------+
| Reply here                |    <-- Primary Actions
| Resend                    |    (contextual: "Resend" for user, absent for assistant)
| Duplicate & Edit          |
|---------------------------|
| Star                      |    <-- Annotations
| Flag as dead end          |
|---------------------------|
| Summarize branch          |    <-- Branch Operations
| Score / Evaluate          |
|---------------------------|
| Copy                      |    <-- Clipboard / Utility
|---------------------------|
| Delete                    |    <-- Danger Zone (always last)
+---------------------------+
```

### Conditional Visibility Rules

```typescript
interface ContextMenuConfig {
  nodeId: string;
  node: TreeNode;
  isError: boolean;
  isDeadEnd: boolean;
  isStarred: boolean;
  hasChildren: boolean;
  isUserMessage: boolean;
  isAssistantMessage: boolean;
  isToolNode: boolean;
  isSynthetic: boolean;
  isStreaming: boolean;
}

function buildContextMenuItems(config: ContextMenuConfig): MenuGroup[] {
  const groups: MenuGroup[] = [];

  // Group 1: Primary Actions
  const actions: MenuItem[] = [];
  if (!config.isError && !config.isStreaming) {
    actions.push({ id: 'reply', label: 'Reply here', icon: CornerDownRight });
  }
  if (config.isUserMessage && !config.isStreaming) {
    actions.push({ id: 'resend', label: 'Resend', icon: RefreshCw });
  }
  if (config.isError) {
    actions.push({ id: 'retry', label: 'Retry', icon: RotateCw });
  }
  if (!config.isError && !config.isStreaming) {
    actions.push({ id: 'duplicate', label: 'Duplicate & Edit', icon: CopyPlus });
  }
  if (actions.length > 0) groups.push({ items: actions });

  // Group 2: Annotations
  const annotations: MenuItem[] = [];
  annotations.push({
    id: 'star',
    label: config.isStarred ? 'Unstar' : 'Star',
    icon: Star,
  });
  annotations.push({
    id: 'deadend',
    label: config.isDeadEnd ? 'Remove dead-end flag' : 'Flag as dead end',
    icon: Ban,
  });
  groups.push({ items: annotations });

  // Group 3: Branch Operations (only if relevant features are enabled)
  const branchOps: MenuItem[] = [];
  if (config.hasChildren) {
    branchOps.push({ id: 'summarize', label: 'Summarize branch', icon: FileText });
  }
  branchOps.push({ id: 'score', label: 'Score / Evaluate', icon: BarChart3 });
  if (branchOps.length > 0) groups.push({ items: branchOps });

  // Group 4: Clipboard
  const clipboard: MenuItem[] = [];
  if (config.isError) {
    clipboard.push({ id: 'copy-error', label: 'Copy error', icon: Copy });
  } else {
    clipboard.push({ id: 'copy', label: 'Copy', icon: Copy });
  }
  groups.push({ items: clipboard });

  // Group 5: Danger
  groups.push({
    items: [{ id: 'delete', label: 'Delete', icon: Trash2, danger: true }],
  });

  return groups;
}
```

### TypeScript Types

```typescript
interface MenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;         // e.g. "S" for star
  danger?: boolean;          // red text styling
  disabled?: boolean;
  disabledReason?: string;   // tooltip when disabled
  submenu?: MenuItem[];      // for nested menus (future)
}

interface MenuGroup {
  items: MenuItem[];
  label?: string;            // optional group header (not used in v1)
}

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  nodeId: string | null;
  groups: MenuGroup[];
}
```

### Rendering

```
src/components/tree/
  ContextMenu.tsx              # The floating menu component
  useContextMenu.ts            # Hook: right-click handler, state, item builder
```

The `ContextMenu` component renders groups with dividers:

```
+---------------------------+
|  [icon] Reply here        |
|  [icon] Resend            |
|  [icon] Duplicate & Edit  |
|  ----------------------   |
|  [icon] Star         (S)  |
|  [icon] Flag dead end     |
|  ----------------------   |
|  [icon] Summarize branch  |
|  ----------------------   |
|  [icon] Copy         (C)  |
|  ----------------------   |
|  [icon] Delete       (D)  |   <-- red text
+---------------------------+
```

### Keyboard Shortcuts within Menu

When the context menu is open, single-key shortcuts activate items:
- `S` -- Star/Unstar
- `D` -- Delete (with confirmation)
- `C` -- Copy
- `R` -- Reply here
- `Escape` -- Close menu
- Arrow keys -- Navigate items
- `Enter` -- Activate focused item

### Context Menu for Error Nodes

Error nodes get a reduced menu (no Reply, no Duplicate):

```
+---------------------------+
|  [icon] Retry             |
|  ----------------------   |
|  [icon] Copy error        |
|  ----------------------   |
|  [icon] Delete            |
+---------------------------+
```

### Context Menu for Streaming Nodes

When a node is actively streaming, most actions are disabled:

```
+---------------------------+
|  [icon] Copy (disabled)   |
|  ----------------------   |
|  [icon] Cancel streaming  |
+---------------------------+
```

### Dismissal Behavior

- Click outside: close
- Escape: close
- Selecting any item: close (after executing)
- Scrolling the tree: close
- Another right-click: reposition to new location

## ASCII Mockup: Maximum Context Menu (User Node With Children)

```
+---------------------------+
|  Reply here               |
|  Resend                   |
|  Duplicate & Edit         |
|  ----------------------   |
|  Star                     |
|  Flag as dead end         |
|  ----------------------   |
|  Summarize branch         |
|  Score / Evaluate         |
|  ----------------------   |
|  Copy                     |
|  ----------------------   |
|  Delete                   |
+---------------------------+
```

11 items maximum. This is acceptable because the grouping with dividers makes scanning easy, and 3 of those items are conditional (Resend only on user nodes, Summarize only on nodes with children, Score requires Feature 17).

## ASCII Mockup: Minimal Context Menu (Leaf Assistant Node, No Features)

```
+---------------------------+
|  Reply here               |
|  Duplicate & Edit         |
|  ----------------------   |
|  Star                     |
|  Flag as dead end         |
|  ----------------------   |
|  Copy                     |
|  ----------------------   |
|  Delete                   |
+---------------------------+
```

8 items. Still clean.

## Feature Gating

Items related to unimplemented features should not appear. The context menu builder accepts a feature flags object:

```typescript
interface FeatureFlags {
  starMessages: boolean;      // Feature 11
  deadEndBranches: boolean;   // Feature 12
  summarizeBranches: boolean; // Feature 15
  compareClassify: boolean;   // Feature 17
  resendDuplicate: boolean;   // Feature 23
}
```

Items are only included when their feature flag is `true`. This allows incremental feature rollout without menu clutter.

## Integration with Detail Panel Actions

The detail panel action bar (`[Reply here] [Copy] [Delete]` etc.) mirrors the context menu's primary actions. Both should use the same action handler functions to avoid duplication:

```typescript
// src/lib/nodeActions.ts
export function getNodeActions(config: ContextMenuConfig): Action[] { ... }
```

Both the context menu and the detail panel consume `getNodeActions`.

## Edge Cases

- **Root node**: "Delete" should be "Delete conversation" or disabled (deleting the root deletes everything). Show a confirmation: "This will delete the entire conversation."
- **Synthetic nodes** (merge/summary triggers): these are valid targets for Star, Copy, Reply. The context menu does not need special handling; the conditional rules already cover it.
- **Right-click on edges**: no menu. Only nodes have context menus.
- **Right-click on collapsed node**: same menu as expanded. The collapse state does not affect available actions.
- **Touch devices**: long-press triggers the context menu (via `onContextMenu` event, which fires on long-press in mobile browsers). If not reliable, add a "..." button on each node that opens the same menu.

---

# S4 -- Data Ownership and Sync Protocol (IndexedDB + SQLite)

## Summary

The frontend stores conversations and nodes in IndexedDB (Dexie). The backend stores projects, project files, tags, and embeddings in SQLite. Some concepts exist in both stores: projects exist in IndexedDB (Feature 13, for conversation grouping) and SQLite (for file storage); tags exist in IndexedDB (per-conversation tag arrays, Feature 24) and SQLite (canonical tag list for autocomplete). This spec defines clear ownership rules, the sync protocol, and conflict resolution for all shared data.

## Priority

Tier 1 -- must be finalized before implementing Features 13 (Project Knowledge) and 24 (Tags), which are the first features that create dual-store data.

## Dependencies

- **00 Backend Architecture**: backend must exist for SQLite storage.
- **13 Project Knowledge**: projects concept.
- **24 Tags**: tags concept.

## Data Ownership Rules

The fundamental principle: **the frontend IndexedDB is the source of truth for conversation data; the backend SQLite is the source of truth for file/ML data.** Shared concepts have a designated owner, and the non-owner holds a derived cache.

| Data Entity | Owner | Non-Owner Cache | Sync Direction |
|-------------|-------|-----------------|---------------|
| Conversations | Frontend (IndexedDB) | Never in backend | -- |
| Tree Nodes | Frontend (IndexedDB) | Never in backend | -- |
| AppSettings | Frontend (IndexedDB) | Never in backend | -- |
| Projects (metadata) | Frontend (IndexedDB) | Backend SQLite (for file association) | Frontend -> Backend |
| Project Files | Backend (SQLite + disk) | Frontend (lightweight index in memory) | Backend -> Frontend |
| Tags (canonical list) | Frontend (IndexedDB, derived from conversations) | Backend SQLite (optional cache for autocomplete) | Frontend -> Backend |
| Tag-Conversation associations | Frontend (IndexedDB) | Never in backend | -- |
| Embeddings | Backend (SQLite) | Frontend (IndexedDB, browser-only mode only) | Bidirectional (see below) |
| Research Runs | Frontend (IndexedDB) | Never in backend | -- |
| Research Nodes | Frontend (IndexedDB) | Never in backend | -- |

### Key Design Decision

The backend **never** stores conversations or tree nodes. This is stated in Feature 00 ("Conversations and nodes remain in the browser's IndexedDB -- the backend doesn't need them") and must be preserved. The backend is a service layer for file processing, search proxying, and ML inference -- not a conversation database.

## Shared Concept: Projects

### Frontend Ownership

Projects are created, renamed, and deleted in the frontend. The `Project` object lives in IndexedDB:

```typescript
// Frontend IndexedDB
interface Project {
  id: string;          // UUID, generated by frontend
  name: string;
  createdAt: number;
  updatedAt: number;
}
```

### Backend Mirror

The backend needs project IDs to associate files with projects. When the frontend creates/updates/deletes a project, it pushes the change to the backend:

```typescript
// Frontend: after creating a project in IndexedDB
async function syncProjectToBackend(project: Project): Promise<void> {
  if (!isBackendAvailable()) return; // graceful degradation
  await backendFetch('/api/projects', {
    method: 'PUT',
    body: JSON.stringify({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }),
  });
}

// Frontend: after deleting a project
async function deleteProjectFromBackend(projectId: string): Promise<void> {
  if (!isBackendAvailable()) return;
  await backendFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
  // Backend cascades: deletes project_files rows and files on disk
}
```

### Backend API Additions

```
PUT  /api/projects           -- upsert project (idempotent)
DELETE /api/projects/:id     -- delete project and associated files
GET  /api/projects           -- list all projects (for reconciliation)
```

The `PUT` is an upsert: if the project exists, update its name; if not, create it. This makes sync idempotent and safe to retry.

### Conflict Resolution

The frontend is the owner. If the backend has a project that the frontend does not, it is an orphan (the user deleted it in the frontend while the backend was unreachable). On startup reconciliation, orphan backend projects are deleted.

## Shared Concept: Tags

### Frontend Ownership (derived)

Tags are stored as string arrays on `Conversation.tags` in IndexedDB. The canonical tag list is derived by scanning all conversations:

```typescript
async function getAllTags(): Promise<string[]> {
  const conversations = await db.conversations.toArray();
  const tagSet = new Set<string>();
  for (const conv of conversations) {
    for (const tag of conv.tags || []) tagSet.add(tag);
  }
  return Array.from(tagSet).sort();
}
```

### Backend Cache (optional optimization)

The backend `tags` table is a performance cache for autocomplete. It avoids scanning all conversations every time the user types in the tag input. The frontend pushes tag changes:

```typescript
// When a tag is added to a conversation
async function syncTagToBackend(tag: string): Promise<void> {
  if (!isBackendAvailable()) return;
  await backendFetch('/api/tags', {
    method: 'PUT',
    body: JSON.stringify({ name: tag }),
  });
}
```

The backend `tags` table stores `{ id, name, created_at }`. The `PUT` is an upsert on `name`.

### Tag Removal

When the last conversation with a given tag removes it, the tag should be pruned from the backend cache. This is done during reconciliation (see below), not eagerly on each tag removal (to avoid race conditions).

### Backend Endpoint

```
PUT  /api/tags               -- upsert tag
GET  /api/tags               -- list all tags (for autocomplete)
```

The frontend uses `GET /api/tags` for autocomplete when the backend is available. When the backend is unavailable, it falls back to `getAllTags()` from IndexedDB.

## Sync Protocol

### Startup Reconciliation

When the app loads and the backend is available, perform a lightweight reconciliation:

```typescript
async function reconcileWithBackend(): Promise<void> {
  if (!isBackendAvailable()) return;

  // 1. Sync projects: frontend -> backend
  const localProjects = await db.projects?.toArray() || [];
  const remoteProjects = await backendFetch('/api/projects');

  // Push local projects to backend (upsert is idempotent)
  for (const project of localProjects) {
    await syncProjectToBackend(project);
  }

  // Delete orphan backend projects
  const localIds = new Set(localProjects.map(p => p.id));
  for (const remote of remoteProjects) {
    if (!localIds.has(remote.id)) {
      await deleteProjectFromBackend(remote.id);
    }
  }

  // 2. Sync tags: frontend -> backend
  const localTags = await getAllTags();
  const remoteTags: string[] = await backendFetch('/api/tags').then(r => r.map(t => t.name));

  // Push local tags
  for (const tag of localTags) {
    if (!remoteTags.includes(tag)) {
      await syncTagToBackend(tag);
    }
  }

  // Prune backend tags not in frontend
  for (const tag of remoteTags) {
    if (!localTags.includes(tag)) {
      await backendFetch(`/api/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
    }
  }

  // 3. Fetch file index from backend
  // (Backend -> Frontend: file metadata for autocomplete)
  for (const project of localProjects) {
    const files = await backendFetch(`/api/projects/${project.id}/files`);
    // Store in memory (Zustand) for autocomplete, not in IndexedDB
    useProjectStore.getState().setProjectFiles(project.id, files);
  }
}
```

### Event-Driven Sync (During Session)

After startup, sync is event-driven:

| Frontend Event | Sync Action |
|---------------|-------------|
| Create project | `PUT /api/projects` |
| Rename project | `PUT /api/projects` |
| Delete project | `DELETE /api/projects/:id` |
| Add tag to conversation | `PUT /api/tags` |
| Upload file (user action) | `POST /api/files/upload` then refresh file index |
| Delete file | `DELETE /api/files/:id` then refresh file index |

No polling. No WebSocket (the backend is a simple REST service). The frontend drives all sync.

### Failure Handling

If a sync call fails (backend unreachable, network error):
1. Log the error.
2. Do not block the user action. The frontend operation succeeds regardless.
3. Queue the failed sync for retry on next reconciliation (startup or manual "Sync" button).

A simple queue:

```typescript
interface SyncQueueItem {
  action: 'upsert-project' | 'delete-project' | 'upsert-tag' | 'delete-tag';
  payload: unknown;
  createdAt: number;
}
```

Stored in IndexedDB (`syncQueue` table). Drained on startup reconciliation.

## ASCII Diagram: Data Flow

```
+-------------------------------------------+     +---------------------------+
|            Frontend (Browser)             |     |     Backend (Docker)      |
|                                           |     |                           |
|  IndexedDB (Dexie)                        |     |  SQLite                   |
|  +-------------------------------------+  |     |  +---------------------+  |
|  | conversations                       |  |     |  | projects            |  |
|  | nodes                               |  |     |  | project_files       |  |
|  | settings                            |  |     |  | tags                |  |
|  | projects (metadata)                 |--|--+-->|  | message_embeddings  |  |
|  | syncQueue                           |  |  |  |  +---------------------+  |
|  +-------------------------------------+  |  |  |                           |
|                                           |  |  |  Filesystem               |
|  Zustand (memory)                         |  |  |  +---------------------+  |
|  +-------------------------------------+  |  |  |  | /data/files/        |  |
|  | projectFiles (index from backend)   |<-|--+--|  | (uploaded files)    |  |
|  | availableModels                     |  |     |  +---------------------+  |
|  | tagAutocomplete                     |<-|-----|                           |
|  +-------------------------------------+  |     +---------------------------+
|                                           |
+-------------------------------------------+

Arrows:
  -->  Frontend pushes to backend (projects, tags)
  <--  Backend provides to frontend (file index, tag list, ML results)
```

## Browser-Only Mode

When the backend is unavailable:
- Projects still work as conversation grouping (IndexedDB only).
- Tags work entirely from IndexedDB (scan-and-deduplicate).
- File upload is limited to text files stored in IndexedDB.
- The `syncQueue` accumulates but never drains (acceptable -- if the backend is never available, the queue entries are irrelevant).
- `isBackendAvailable()` returns false, and all backend-dependent UI is hidden.

## Dexie Schema Updates

```typescript
this.version(3).stores({
  conversations: 'id, createdAt, updatedAt, projectId, *tags',
  nodes: 'id, conversationId, parentId',
  settings: '++id',
  projects: 'id, name, createdAt',
  syncQueue: '++id, action, createdAt',
});
```

## Edge Cases

- **Backend becomes available after offline period**: on next page load, startup reconciliation runs and drains the sync queue. The backend is brought up to date.
- **Backend has files for a project the frontend deleted**: the reconciliation deletes the orphan project from the backend, which cascades to delete associated files.
- **Two browser tabs**: both tabs write to IndexedDB independently. Both trigger sync to the backend. Since all sync operations are idempotent (PUT upsert, DELETE is idempotent), concurrent syncs from two tabs do not conflict.
- **Tag rename**: not supported in v1 (per Feature 24). If added later, the rename must update both the `Conversation.tags` arrays in IndexedDB and the backend `tags` table. The sync protocol handles this naturally if the rename is modeled as "remove old tag, add new tag."
- **Large sync queue**: if the backend was down for a long time and hundreds of sync items accumulated, drain them in batches with rate limiting (e.g., 10 items per second) to avoid overwhelming the backend on startup.
- **Data export/import**: a future "Export all data" feature should export both IndexedDB data and trigger backend file downloads. This spec does not cover export, but the clear ownership model makes it straightforward: export IndexedDB for conversations/nodes/settings, and download files from `/api/files/:id` for each project file.

---

### Critical Files for Implementation

- `/home/baud/Documents/DataML/GIT/baobab/src/types/index.ts` - Core type definitions; TreeNode refactoring (S1) and AppSettings growth (S2) both modify this file
- `/home/baud/Documents/DataML/GIT/baobab/src/store/useSettingsStore.ts` - Settings store needs grouped update functions for the tabbed settings page (S2)
- `/home/baud/Documents/DataML/GIT/baobab/src/db/database.ts` - Dexie schema migrations for TreeNode sub-objects (S1), new tables for projects/syncQueue (S4), and index updates
- `/home/baud/Documents/DataML/GIT/baobab/src/components/tree/MessageNode.tsx` - Context menu integration point (S3) and TreeNode accessor usage (S1)
- `/home/baud/Documents/DataML/GIT/baobab/src/lib/tree.ts` - Tree utility functions that reference TreeNode fields; must update to use sub-object paths or accessors (S1)