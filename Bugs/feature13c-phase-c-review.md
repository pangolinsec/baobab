# Feature 13 Phase C Code Review — Bug & Issue Report

**Date**: 2026-02-21
**Scope**: All files from the Feature 13 Phase C implementation commit `5856380`
**Fix pass 1**: 2026-02-21 — addressed B1, I1, I2, I3 (all items fixed, amended into commit)

---

## Bugs

### ~~B1: Shared module-level global regex risks stale `lastIndex`~~ FIXED

**File**: `src/components/shared/MarkdownWithFilePills.tsx:7`

`AT_MENTION_RE` was a module-level `const` with the `g` flag. While `lastIndex` was manually reset at the top of each function, this is fragile — any future concurrent or re-entrant call could see stale state. Replaced with a local `new RegExp()` created inside the shared `splitMentions()` function, which also eliminated the duplicated regex matching logic between `processTextForMentions` and `renderTextWithPills`.

---

## Significant Issues

### ~~I1: Duplicated regex matching logic~~ FIXED

**File**: `src/components/shared/MarkdownWithFilePills.tsx`

`processTextForMentions` and `renderTextWithPills` contained ~90% identical string-scanning and pill-construction logic, including the leading-whitespace handling with `fullMatch.indexOf('@')`. Extracted shared `splitMentions()` helper; both functions now delegate to it.

---

### ~~I2: Missing element coverage in ReactMarkdown `components` override~~ FIXED

**File**: `src/components/shared/MarkdownWithFilePills.tsx:84-87`

The `components` override only covered `p`, `li`, and `td`. An `@filename.ext` inside a `<th>` (table header) or `<blockquote>` would render as plain text. Added `th` and `blockquote` to the override map. Headings (`h1`–`h6`) intentionally omitted — `@file` references in headings are implausible and overriding all heading levels would add noise.

---

### ~~I3: Unnecessary conditional triggers React exhaustive-deps lint warning~~ FIXED

**File**: `src/components/chat/ChatInput.tsx:154`

`if (largeSizeWarning) setLargeSizeWarning(null)` referenced `largeSizeWarning` without listing it in the `useEffect` deps array. The guard was unnecessary since `setLargeSizeWarning(null)` is a no-op when already null. Removed the conditional, leaving a bare `setLargeSizeWarning(null)`.

---

## Minor / Won't Fix

### M1: Token estimate uses `sizeBytes` instead of character count

**File**: `src/components/chat/ChatInput.tsx:248-249`

The large file warning computes `totalChars` by summing `sizeBytes` from `ProjectFile` entries, then divides by 4000 to estimate tokens. For UTF-8 text, bytes >= chars, making this estimate slightly conservative (warning fires early). Acceptable since the threshold (200K) is already an approximation.

---

### M2: Click-to-resolve shows one file at a time

**File**: `src/components/tree/NodeDetailPanel.tsx:401-422`

Clicking a second `@file` pill replaces the previously viewed file content. Users wanting to compare two files must click back and forth. Acceptable for V1 — adding a file viewer stack increases complexity without clear demand.

---

### M3: No file icon on pill elements

**File**: `src/components/shared/MarkdownWithFilePills.tsx`

Pills render as `@filename.ext` text with accent-colored background but no icon. A small `FileText` icon from lucide-react could improve scannability. Deferred — pills are already visually distinct via the accent badge styling, and adding icons to every pill in a message with many references could be noisy.

---

### M4: `fetchFiles` backend failure falls through to Dexie

**File**: `src/store/useProjectStore.ts:109-120`

When `isBackendAvailable()` returns true but the actual `fetchProjectFiles` call fails (e.g., timeout), execution falls through to the Dexie path. This means backend-only files won't appear — only locally stored files show. This is intentionally resilient behavior: the user sees whatever files are available rather than an error state. If the backend recovers, the next `fetchFiles` call will restore the full list.
