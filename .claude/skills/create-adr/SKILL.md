---
name: create-adr
description: Create an Architecture Decision Record from the current session's decisions.
---

# Create ADR

Generate an Architecture Decision Record (ADR) that captures the decisions and plans from the current Claude Code session, written to the `Decisions/` directory.

## Arguments

```
/create-adr
```

No arguments. The next ADR number is auto-detected and the title is inferred from context.

## Process

1. **Determine the next ADR number.** Scan `Decisions/` for existing files matching the pattern `NNN-*.md` and increment the highest number found.

2. **Review the conversation.** Read through the current session's discussion to identify:
   - Decisions made (explicit choices between alternatives)
   - Design plans established
   - Trade-offs considered and resolved
   - Implementation strategies agreed upon

3. **Draft the ADR.** Write the document following the canonical format below. Every section is required.

4. **Present the draft to the user.** Show the full ADR content and ask if they want to make any changes before saving.

5. **Write the file** to `Decisions/NNN-<slug>.md` where `<slug>` is a kebab-case summary of the title.

## Canonical ADR Format

Follow this structure exactly. Refer to existing ADRs in `Decisions/` for examples.

````markdown
# ADR-NNN: Title

**Date**: YYYY-MM-DD
**Status**: Accepted
**Context**: One paragraph summarizing the situation that led to these decisions. What was happening in the session? What problem space was being explored? Reference prior ADRs if this session builds on them.

---

## Decision 1: Short Decision Title

**Problem**: What conflict, gap, or design question needed resolving.

**Options considered**:

1. **Option name** (source/origin if applicable): Description of the approach.
2. **Option name**: Description of the alternative approach.

**Decision**: Which option was chosen, stated clearly.

**Rationale**: Why this option won. Focus on the reasoning — trade-offs, simplicity, consistency, user experience, extensibility, etc.

**Impact**: What files, specs, or systems are affected by this decision. Be specific.

---

## Decision 2: ...

(Repeat for each decision. Use `---` separators between decisions.)

---

## Spec Files Updated

| Spec File | Changes Applied |
|-----------|----------------|
| `path/to/file.md` | Brief description of changes |

(Always include this table. If no spec files were updated, write "No spec files were updated in this session." below the heading instead of a table.)
````

### Writing guidelines

- **Title**: Short, descriptive noun phrase (e.g., "Tier 1 Implementation Plan", "Pre-Tier 2 Issue Resolution", "Feature Spec Reconciliation").
- **Context**: One paragraph. Set the scene — what session activity produced these decisions. Reference prior ADRs by number (e.g., "ADR-001") when building on them.
- **Problem**: State the specific question or conflict. Not a vague topic — a concrete issue that required a choice.
- **Options considered**: At least 2 options. Include the source if relevant (e.g., a spec name, a person's suggestion, a prior proposal). Not all decisions have explicit options — if the session arrived at a decision without debating alternatives, omit the "Options considered" section and just include Problem, Decision, Rationale, and Impact.
- **Decision**: A clear, unambiguous statement. "Option 2 — lazy resolution." not "We decided to go with something like option 2."
- **Rationale**: The *why*. This is the most valuable section. Explain the reasoning, not just restate the decision.
- **Impact**: Concrete effects — files changed, specs updated, follow-up work created. Don't leave this vague.
- **Code snippets**: Include TypeScript/code blocks when the decision defines an interface, function signature, or data structure. These serve as the canonical reference.
- **Spec Files Updated table**: List every file that was modified as a result of the decisions. If no files were modified, state that explicitly.

### Tone

Match the existing ADRs: direct, technical, no hedging. Present tense for decisions ("Decision: Use sqlite-vec"), past tense for context and rationale ("Feature 19 originally specified...").

## Output

After writing the ADR, print:

```
ADR written to Decisions/NNN-<slug>.md
```
