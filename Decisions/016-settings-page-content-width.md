# ADR-016: Settings Page Content Width

**Date**: 2026-02-20
**Status**: Accepted
**Context**: While implementing user-configurable soft refusal patterns (regex pattern editor table in Settings > Elicitation), the narrow content column became a noticeable constraint. The settings page content area was capped at `max-w-lg` (512px), which worked well when settings were primarily toggles and dropdowns but caused horizontal cramping for the tabular editors (custom pricing, refusal patterns) and textarea-based sections (persona, system prompt template) added in later features.

---

## Decision 1: Widen Settings Content Area to max-w-3xl

**Problem**: Settings sections with data tables (custom pricing rows, refusal pattern entries) and multi-line textareas were squeezed into 512px, truncating regex patterns and making editing awkward. The layout no longer matched the content complexity.

**Options considered**:

1. **Keep max-w-lg globally, allow specific sections to break out**: Individual sections like the pattern editor would use `max-w-none` on their own container. Preserves narrow layout for simple sections.
2. **Bump to max-w-2xl (672px)**: A moderate increase that gives tabular editors room to breathe without making simple toggle/input sections feel sparse.
3. **Bump to max-w-3xl (768px)**: More generous width, tested visually and confirmed to work well for both tabular editors and simpler toggle/input sections.
4. **Bump to max-w-4xl or remove cap entirely**: Maximum flexibility but risks poor readability for label/description text and awkward stretching of toggles and small inputs.

**Decision**: Option 3 — bump to `max-w-3xl`.

**Rationale**: 768px provides ~50% more horizontal space than the original 512px. After visual comparison with `max-w-2xl`, the extra room was preferred — regex patterns and pricing table rows display without truncation, textareas feel natural, and simple sections (toggles, dropdowns) still look proportionate without excessive stretching. A per-section breakout (option 1) would add layout complexity for marginal benefit, and removing the cap entirely (option 4) would degrade readability on wide monitors.

**Impact**: Single class change in `src/components/pages/SettingsPage.tsx` on the content container div (`max-w-lg` → `max-w-3xl`). Affects all settings sections uniformly.

---

## Spec Files Updated

No spec files were updated in this session.
