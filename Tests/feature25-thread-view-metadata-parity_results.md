# Feature 25 — Thread View Metadata Parity: Test Results

**Date**: 2026-02-20
**Environment**: Docker Compose (app on 5173), Chrome MCP
**Starting state**: "Tell me about cats" conversation with branching tree (behavior branch + breeds branch), Cat Behavior node starred, "Tell me about their breeds" node flagged as dead-end

## Summary

| Section | Total | Pass | Fail | Skipped |
|---------|-------|------|------|---------|
| 1 — Model & Provider Indicators | 4 | 2 | 0 | 2 |
| 2 — Annotations & Badges | 5 | 3 | 0 | 2 |
| 3 — Timestamps | 1 | 1 | 0 | 0 |
| 4 — Action Buttons (Hover) | 5 | 5 | 0 | 0 |
| 5 — Content Features | 2 | 0 | 0 | 2 |
| 6 — Parity Cross-Check | 2 | 2 | 0 | 0 |
| **Total** | **19** | **13** | **0** | **6** |

---

## Detailed Results

### Section 1 — Model & Provider Indicators

**T25-1: Assistant model chip in thread view**
- **Status**: PASS
- In thread view, assistant messages show "Haiku 4.5" model chip after the "Assistant" label
- Model chip appears in a muted text style within the header
- Both assistant messages (#Cats and Cat Behavior/Cat Breeds) show the model chip

**T25-2: User model override chip in thread view**
- **Status**: SKIPPED
- No model override was set on any user node in the test conversation
- Verified that user messages without overrides do NOT show a model chip — only "You" + timestamp visible in headers

**T25-3: System prompt override chip in thread view**
- **Status**: SKIPPED
- No system prompt override was set on any user node
- Would require manual setup via context menu in tree view, which was not part of the prerequisite data

**T25-4: Provider indicator in thread view**
- **Status**: PASS (negative verification)
- All messages used the default Anthropic provider
- No "via [Provider Name]" text appears in any message header — correct behavior for default provider

### Section 2 — Annotations & Badges

**T25-5: Star indicator in thread view**
- **Status**: PASS
- Cat Behavior assistant message (starred in prerequisites) shows star with CSS classes `text-amber-500 fill-amber-500`
- Star color is amber/gold (computed color: `oklch(0.769 0.188 70.08)`)
- Non-starred messages have plain star icons with `fill=none` and muted color — these are hover-action buttons (hidden by default via `opacity-0 group-hover:opacity-100`), NOT header indicators
- Only the starred node shows the star in the header area

**T25-6: Dead-end styling in thread view**
- **Status**: PASS
- "Tell me about their breeds" user message has `opacity-40` on its group container (dimmed to ~40%)
- A flag icon (`lucide lucide-flag text-[var(--color-text-muted)]`) appears in the message header, NOT in the hover group — always visible
- Non-dead-end messages have full opacity (group class is just `group` without `opacity-40`)
- Visual screenshot confirms dimmed appearance of the dead-end message

**T25-7: Edited badge in thread view**
- **Status**: SKIPPED
- Attempted to create an edited node via Duplicate & Edit, but the JavaScript textarea value injection did not properly trigger React's state management
- The Duplicate & Edit dialog opened correctly, but the automated text modification didn't persist through React's controlled input handling
- Would need manual editing or a more sophisticated React event simulation

**T25-8: Summary badge in thread view**
- **Status**: SKIPPED
- No summary nodes exist in the test conversation
- Creating a summary node requires the summarize branch operation, which would alter the test data significantly

**T25-9: Reply target indicator in thread view**
- **Status**: PASS
- Reply target assistant message has `ring-1 ring-[var(--color-reply-target)]` CSS classes (green ring/border)
- "reply target" text label with corner-down-right arrow icon appears in the message header
- Only one message in the thread has this indicator (verified via DOM inspection — only the last assistant message contains "reply target" text)

### Section 3 — Timestamps

**T25-10: Timestamps on messages**
- **Status**: PASS
- All messages show timestamps in the header area (right-aligned)
- Format: "11:28 AM" / "11:29 AM" (short time with AM/PM)
- Timestamps appear on both user and assistant messages
- Verified via DOM inspection: all 4 messages have timestamps matching `\d+:\d+ [AP]M` pattern

### Section 4 — Action Buttons (Hover)

**T25-11: Assistant message hover actions**
- **Status**: PASS
- Hovered over Cat Breeds assistant message
- Action buttons appeared with correct icons and titles:
  - Reply here (`lucide-corner-down-right`)
  - Duplicate & Edit (`lucide-copy-plus`)
  - Flag as dead end (`lucide-flag`)
  - Star (`lucide-star`)
  - Copy (`lucide-copy`)
  - Delete (`lucide-trash2`, in red/oklch color)
- Buttons appear via `opacity-0 group-hover:opacity-100` transition

**T25-12: User message hover actions**
- **Status**: PASS
- Hovered over "Tell me about their breeds" user message (dead-end flagged)
- Action buttons appeared with correct icons and titles:
  - Resend (`lucide-send`)
  - Duplicate & Edit (`lucide-copy-plus`)
  - Unflag dead end (`lucide-flag`, in accent color since already flagged)
  - Star (`lucide-star`)
  - Copy (`lucide-copy`)
  - Delete (`lucide-trash2`, in red)

**T25-13: Error message hover actions**
- **Status**: SKIPPED (per test plan: "If no error node exists, SKIP this test")
- No error nodes exist in the test conversation

**T25-14: Star toggle works in thread view**
- **Status**: PASS
- Clicked star on first assistant message (#Cats, originally un-starred)
- Star icon changed to filled amber (`text-amber-500 fill-amber-500`), button title changed to "Unstar"
- Clicked again (Unstar) — star returned to plain state (`lucide lucide-star`), button title returned to "Star"

**T25-15: Dead-end toggle works in thread view**
- **Status**: PASS
- Clicked "Flag as dead end" on first user message ("Tell me about cats")
- Group container gained `opacity-40` class — message dimmed
- Flag icon appeared in header, button changed to "Unflag dead end"
- Clicked "Unflag dead end" — opacity returned to normal, button changed back to "Flag as dead end"

### Section 5 — Content Features

**T25-16: System prompt collapsible in thread view**
- **Status**: SKIPPED
- No system prompt was configured when the test messages were generated
- The "System prompt" button found in the DOM is the input footer button, not a collapsible section within a message
- Thread messages do not show system prompt collapsibles when no system prompt was in effect

**T25-17: Thinking block collapsible in thread view**
- **Status**: SKIPPED (per test plan: "If no thinking content exists, SKIP this test")
- No thinking mode was enabled; no assistant responses contain thinking content

### Section 6 — Parity Cross-Check

**T25-18: Compare tree view and thread view for same node**
- **Status**: PASS
- Selected Cat Behavior assistant node (starred, reply target, Haiku 4.5)
- **Tree view** indicators: "Assistant Haiku 4.5" header, amber filled star icon, "reply target" badge, 293 in / 372 out tokens
- **Thread view** indicators: "Assistant Haiku 4.5" header, amber star (`text-amber-500 fill-amber-500`), "reply target" label with arrow icon, `ring-1 ring-[var(--color-reply-target)]`, timestamp "11:28 AM"
- All indicators match between views; thread view adds timestamp (expected addition per test plan)

**T25-19: Branch indicator appears at branching points**
- **Status**: PASS
- In thread view on the breeds branch path, a branch indicator appears between the #Cats assistant response and the "Tell me about their breeds" user message
- Indicator text: "1 other branch from here" with a git-branch icon
- Confirmed visually via zoomed screenshot
