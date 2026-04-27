---
title: "feat: Render inline `**Label:** value` runs as a compact metadata grid"
type: feat
status: active
date: 2026-04-27
origin: docs/brainstorms/2026-04-27-inline-metadata-grid-requirements.md
---

# feat: Render inline `**Label:** value` runs as a compact metadata grid

## Overview

Runs of bold-prefix paragraph lines like `**Status:** verified` currently render as plain prose with bolded labels. This plan detects runs of 2+ such lines and rewrites them into a compact two-column grid that visually echoes the existing frontmatter card while sitting more densely in the body.

## Problem Frame

Markdown authors frequently write inline metadata as runs of `**Label:** value` lines:

```
**Status:** verified — applied 2026-04-27 03:19 server time
**Group:** [2026-04-26-infra-cleanup](README.md)
**Risk:** low — config-only, fully reversible (we keep `.OLD` copies)
**Estimated downtime:** zero (config reload is hot)
```

Today this renders as four loose lines with no alignment, no visual identity, and no signal that it's structured metadata. The repo already ships a polished frontmatter card for YAML front matter; this work extends that visual language to inline body runs.

(see origin: [docs/brainstorms/2026-04-27-inline-metadata-grid-requirements.md](docs/brainstorms/2026-04-27-inline-metadata-grid-requirements.md))

## Requirements Trace

- R1. Detect runs of 2+ consecutive `**Label:** value` lines and fuse them into a single metadata grid block
- R2. A `Label` is the bold text immediately preceded by `**` and immediately followed by `:**`. A `value` is everything from the first character after `:** ` (or `:**`) up to the next softbreak or end-of-paragraph
- R3. A single isolated `**Label:** value` paragraph stays as a normal paragraph
- R4. The grid must visually unify with the existing frontmatter card (same border, background, color tokens) but use **compact padding** — tighter row height and cell padding than the frontmatter card
- R5. The `value` must render as inline markdown (links, inline code, emphasis, etc.); the `Label` renders as plain text
- R6. The grid must respect all three themes × light/dark mode
- R7. Lines with empty values (`**Label:**` with nothing after) must not contribute to the run-count; treat as normal paragraph

## Scope Boundaries

- Top-level paragraphs only — runs inside list items, blockquotes, or table cells stay unchanged
- Consecutive only — a blank line separating paragraphs still allows fusion if both paragraphs are pure single-line `**Label:** value` matches; nothing else between
- Flat key→value — no nested grids, no multi-paragraph values
- No new author syntax — detection is purely shape-based
- Display-only — no interactivity
- Singletons stay as paragraphs (no false positives on `**Note:** see below.`)
- Labels render verbatim as written (no humanization)
- The colon must be inside the bold (`**Label:**`), not outside (`**Label**:`) — the latter is treated as prose

### Deferred to Separate Tasks

- Recognizing the same shape inside list items or blockquotes — out of scope, future iteration

## Context & Research

### Relevant Code and Patterns

- [src/markdownParser.ts:63-125](src/markdownParser.ts#L63-L125) — the `gh_alert` core ruler. **This is the structural pattern** for the new rule: register on `md.core.ruler.after('inline', ...)`, walk the token stream after inline parsing, replace boundary tokens with `html_block` tokens carrying the wrapper HTML, and leave other tokens untouched.
- [src/markdownParser.ts:165-209](src/markdownParser.ts#L165-L209) — `parseMarkdown()` shows where module-level rules co-exist with the per-render `heading_open` override. The new rule belongs at module scope (stateless transform).
- [src/previewPanel.ts:115-123](src/previewPanel.ts#L115-L123) — `buildFrontmatterCard()` shows the existing card markup shape (`.frontmatter-card > .frontmatter-row > .frontmatter-key + .frontmatter-value`).
- [src/previewPanel.ts:718-750](src/previewPanel.ts#L718-L750) — base CSS for `.frontmatter-card` and friends. The new compact variant will share these tokens and override only spacing.
- Theme CSS files: [themes/clean.css](themes/clean.css), [themes/editorial.css](themes/editorial.css), [themes/terminal.css](themes/terminal.css) — none of them currently override the frontmatter card heavily, so the compact inline grid likely needs no per-theme overrides at all unless the terminal theme wants a flourish.

### Institutional Learnings

- [docs/solutions/best-practices/custom-markdown-block-rendering-2026-04-19.md](docs/solutions/best-practices/custom-markdown-block-rendering-2026-04-19.md) — **directly applicable**. Mirror this pattern: register on `core.ruler.after('inline', ...)`, find boundary tokens at the same `level`, replace with `html_block`, keep emitted classes generic so themes can override.
  - Key constraint inherited: stateless transform, no document-level state, register at module level.
  - Variation: this rule operates on **paragraph runs and softbreak-separated inline lines**, not on a single block construct like blockquote. The token-walking shape stays the same; the matching logic is what's new.

### External References

- None needed — local patterns and institutional learnings cover this work fully. (Phase 1.2: codebase has 1 direct example — `gh_alert` — plus a documented learning, so external research adds little.)

## Key Technical Decisions

- **Mirror the `gh_alert` rule shape, not the frontmatter approach.** Frontmatter is detected pre-markdown-it via regex on the raw source; this is detected post-inline-parse via token walking. The two surfaces share visual identity but are independent in the parser.
- **Detect across two source forms:**
  - **Form A:** A single paragraph whose inline children break into multiple `**Label:** value` segments separated by `softbreak` tokens (no blank line between source lines).
  - **Form B:** Multiple consecutive top-level paragraphs each containing exactly one `**Label:** value` (blank lines between source lines).
  - Both forms fuse into a single grid block when 2+ matching segments are found.
- **Match shape on tokens, not on the rendered string.** A logical line "matches" when its leading inline tokens are exactly `[strong_open, text "<label>:", strong_close, text " <value-prefix>", ...]` and the value-prefix part is non-empty after the leading space. This avoids fragile regex against the rendered HTML or raw source.
- **Render value as inline markdown by reusing the existing inline children.** Pass the value's child tokens (after the strong-close + leading space) into a sub-renderer (`md.renderer.renderInline(children, ...)`) so links, code, emphasis all work without re-parsing.
- **Emit `html_block` boundaries, normal inline content for values.** The wrapper `<div class="meta-grid">` and per-row `<div class="meta-row"><span class="meta-key">…</span><span class="meta-value">` come from `html_block` tokens; the value's already-parsed inline children render through their normal path.
- **Class naming: `.meta-grid` (not reuse `.frontmatter-card`).** Use a sibling class so both surfaces can evolve independently. Share visual identity by inheriting the same CSS variables and by making `.meta-grid` use `.frontmatter-card`-derived styles via a shared base block. Keeps the diff small and the two surfaces stylistically aligned without coupling them.
- **Compact padding lives in base CSS, not per theme.** The frontmatter card is roomy (page header) and the meta grid is dense (body element); the *only* spacing override needed is row padding + cell min-width.
- **Singleton exclusion = run length ≥ 2.** A single matching paragraph stays a paragraph. This is the lone false-positive guard; it removes the `**Note:** …` problem entirely.
- **Empty-value lines do not count.** A line with `**Label:**` and no value text after it is treated as not-a-match — does not start a run, does not extend a run, does not break a run unless its position interrupts otherwise-consecutive matches.

## Open Questions

### Resolved During Planning

- **Where does the rule live?** [src/markdownParser.ts](src/markdownParser.ts) at module scope, after the existing `gh_alert` rule. Stateless transform, mirrors the documented pattern.
- **Can we reuse `.frontmatter-card` styles?** Yes — emit a sibling class `.meta-grid` and write its CSS to inherit the same surface/border/color variables, overriding only spacing.
- **Inline markdown in values?** Yes — render via `md.renderer.renderInline(value_children, ...)`. Labels stay plain text (escape only).
- **Should Form A (softbreak-separated lines in one paragraph) be supported?** Yes. The screenshot example almost certainly came from Form A — lines without blank-line separation. Without Form A support the feature would silently fail on the most natural authoring pattern.

### Deferred to Implementation

- **Exact CSS spacing values** (row padding, key min-width, font-size delta vs frontmatter card). Tune visually in the Extension Development Host.
- **Whether the terminal theme wants a flourish** (e.g., `::before` prefix on the grid like other terminal-theme decorations). Decide once base styling is in.
- **Mid-paragraph trailing prose handling** — if a paragraph contains 2+ matching lines followed by a non-matching softbreak-separated line (e.g., a closing remark), should the trailing prose stay outside the grid as a sibling paragraph? Likely yes (split the paragraph at the run boundary), confirm with implementation.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Token flow:**

```
INPUT (Form A — single paragraph, softbreak-separated):
  paragraph_open
  inline { children:
    strong_open, text("Status:"), strong_close, text(" verified — ..."),
    softbreak,
    strong_open, text("Group:"),  strong_close, text(" "), link_open, ..., link_close,
    softbreak,
    strong_open, text("Risk:"),   strong_close, text(" low — ..."),
    softbreak,
    strong_open, text("Estimated downtime:"), strong_close, text(" zero ...")
  }
  paragraph_close

OUTPUT (after rule):
  html_block("<div class=\"meta-grid\">")
  html_block("<div class=\"meta-row\"><span class=\"meta-key\">Status</span><span class=\"meta-value\">")
  inline { children: text(" verified — ...") }   // rendered via renderInline
  html_block("</span></div>")
  html_block("<div class=\"meta-row\"><span class=\"meta-key\">Group</span><span class=\"meta-value\">")
  inline { children: text(" "), link_open, ..., link_close }
  html_block("</span></div>")
  ... (rows for Risk and Estimated downtime)
  html_block("</div>")
```

**Detection algorithm (sketch):**

```
walk top-level tokens:
  collect a "run" of consecutive paragraph_open/inline/paragraph_close triples
    where each paragraph splits cleanly into 1+ matching segments
    (split inline.children at softbreaks; each segment starts with
     [strong_open, text ending with ':', strong_close, text starting with ' ', ...])

  if total matching segments across the run >= 2:
    replace the entire run's tokens with:
      [grid-open html_block,
       per-row html_blocks interleaved with inline tokens carrying value children,
       grid-close html_block]
  else:
    leave the run untouched
```

The rule processes runs greedily; a run breaks when it hits any non-matching paragraph or any non-paragraph block token.

## Implementation Units

- [x] **Unit 1: Add `inline_metadata_grid` core ruler in markdownParser**

**Goal:** Detect runs of 2+ `**Label:** value` segments (across Form A and Form B) and rewrite them into `html_block` boundaries plus per-row inline tokens that render through the normal markdown-it pipeline.

**Requirements:** R1, R2, R3, R5, R7

**Dependencies:** None — runs after the existing `gh_alert` rule but doesn't depend on it.

**Files:**
- Modify: [src/markdownParser.ts](src/markdownParser.ts)
- Test: [src/markdownParser.test.ts](src/markdownParser.test.ts) *(create if absent — currently no test file exists in `src/`; check `package.json` test config and add one if reasonable, otherwise document manual test steps)*

**Approach:**
- Register on `md.core.ruler.after('inline', 'inline_metadata_grid', ...)` after the existing `gh_alert` rule.
- Build a helper `splitInlineIntoSegments(inlineToken)` that returns an array of `{ label: string, valueChildren: Token[] }` or `null` if the paragraph contains any non-matching content. A segment is recognized when the leading children are `[strong_open, text "X:", strong_close, text " <something>" ...]`. Empty-value segments (no text after `:** `) abort the split (return null). Softbreaks within the paragraph become segment boundaries.
- Walk the top-level token stream. Maintain a `run` accumulator of paragraphs whose inline children fully split into segments. When the next token isn't a matching paragraph, finalize the run:
  - If the run accumulated 2+ segments total, replace its token range with: opening html_block (`<div class="meta-grid">`), then for each segment a row-open html_block (`<div class="meta-row"><span class="meta-key">${label}</span><span class="meta-value">`), an inline token carrying the segment's value children, a row-close html_block (`</span></div>`), and finally a closing html_block (`</div>`).
  - If the run is shorter, leave the original tokens in place.
- Escape labels with the existing `escapeHtml` helper.
- Make the rule idempotent (re-running it on already-rewritten tokens is a no-op because `html_block` tokens are skipped).

**Execution note:** Test-first. Before implementing the algorithm, add cases for Form A (single paragraph, softbreaks), Form B (multiple paragraphs), singleton-skip, mixed prose, and inline markdown in values. The walking + splicing logic is the kind of thing that's much easier to land correctly with assertions in place.

**Technical design:** *(directional, see High-Level Technical Design above for the token flow.)*

**Patterns to follow:**
- [src/markdownParser.ts:63-125](src/markdownParser.ts#L63-L125) — `gh_alert` rule structure: `state.tokens` walk, boundary find, `new state.Token('html_block', ...)` replacement.
- [docs/solutions/best-practices/custom-markdown-block-rendering-2026-04-19.md](docs/solutions/best-practices/custom-markdown-block-rendering-2026-04-19.md) — five rules from the institutional learning, especially "stateless, module-level."
- `escapeHtml` helper in [src/markdownParser.ts:157-163](src/markdownParser.ts#L157-L163) for label escaping.

**Test scenarios:**
- Happy path (Form A): one paragraph with 4 softbreak-separated `**Label:** value` lines fuses into one grid with 4 rows.
- Happy path (Form B): three consecutive paragraphs each containing one `**Label:** value` fuse into one grid with 3 rows.
- Happy path (mixed): two consecutive paragraphs where the first has 2 softbreak-separated matches and the second has 1 match fuse into a 3-row grid.
- Happy path (inline markdown in value): `**Group:** [link](x)` renders the value cell with a working `<a>` element.
- Happy path (inline code in value): ``**Risk:** uses `.OLD` files`` renders the value cell with a `<code>` element.
- Edge case: a single isolated `**Note:** see below.` paragraph stays as a normal paragraph (no grid).
- Edge case: a paragraph with `**Label:**` and no value text is not treated as a match and does not contribute to a run.
- Edge case: `**Label**: value` (colon outside the bold) is not matched.
- Edge case: a label containing internal punctuation (`**Estimated downtime:** zero`) renders correctly with the full label.
- Edge case: matching paragraphs separated by a non-matching paragraph produce two separate evaluations — neither side fuses unless that side has ≥2 matches independently.
- Edge case: a paragraph that starts with a match but contains trailing non-matching prose after a softbreak — the run is *not* a clean split, so that paragraph is excluded from the run.
- Error path: malformed bold (`**Status verified` with no closing `**`) is left as-is by markdown-it; the rule sees no `strong_open` and ignores the paragraph.
- Integration: the rule does not interfere with the existing `gh_alert` rule (a blockquote starting with `[!NOTE]` followed by `**Label:** value` lines still becomes an alert, not a grid).
- Integration: code fences containing literal `**Label:** value` lines are unaffected (they emit `fence` tokens, not paragraphs).

**Verification:**
- The example block from the screenshot renders as one grid with 4 rows in the preview, with the link and inline code rendering inside their value cells.
- Existing markdown rendering (headings, lists, alerts, code blocks, frontmatter card) is unchanged for files without metadata runs.

- [x] **Unit 2: Compact metadata grid CSS in previewPanel**

**Goal:** Add base CSS for `.meta-grid`, `.meta-row`, `.meta-key`, `.meta-value` that visually unifies with the frontmatter card (border, background, colors) but uses tighter padding.

**Requirements:** R4, R6

**Dependencies:** Unit 1 (the rule emits these classes; CSS makes them look right).

**Files:**
- Modify: [src/previewPanel.ts](src/previewPanel.ts) — add styles to the inline `<style>` block, near the existing `.frontmatter-card` rules around line 718.

**Approach:**
- Add `.meta-grid` rules sharing the frontmatter card's surface tokens: `--surface-elevated` background, `--border` 1px border, `border-radius: 6px`, `margin: 1em 0` (vs frontmatter card's `margin-bottom: 1.5em`).
- `.meta-row`: tighter padding than frontmatter row (e.g., `0.25em 0` vs `0.4em 0`), same `border-bottom` separator with `:last-child` exception.
- `.meta-key`: `--ink-soft` color, smaller `min-width` (e.g., `7em` vs `8em`), same alignment behavior.
- `.meta-value`: `--ink-body` color, allow inline markdown to flow naturally (no special rules — the value cell contains real anchor/code/strong/em elements).
- Smaller overall `font-size` (e.g., `0.85em` vs frontmatter's `0.875em`) to reinforce the "dense body element" feel.
- Optional shared base class approach: introduce `.meta-grid, .frontmatter-card { /* shared tokens */ }` and only override per-class spacing — only do this if it noticeably reduces duplication.
- Inline markdown inside `.meta-value` (links, code) inherits the existing global `.content-inner a` and `.content-inner code` rules; verify no scoping fights.

**Test expectation: none — pure CSS.** Verification is visual.

**Verification:**
- Grid renders with visibly tighter padding than the frontmatter card while reading as the same family.
- Links inside value cells use the document's link color; inline code inside value cells uses the document's code styling, both legible against the grid background.
- All three themes × light/dark mode (6 combinations) render the grid coherently — no clashing borders, no unreadable text.

- [ ] **Unit 3: Per-theme polish (only if needed)**

**Goal:** Add theme-specific overrides only where the base CSS leaves the grid feeling generic in a particular theme.

**Requirements:** R6

**Dependencies:** Unit 2.

**Files:**
- Possibly modify: [themes/clean.css](themes/clean.css), [themes/editorial.css](themes/editorial.css), [themes/terminal.css](themes/terminal.css)

**Approach:**
- Open the preview against a representative file in all 6 theme/mode combinations.
- For each combination, decide whether the base CSS already feels intentional. If yes, change nothing for that theme.
- For terminal specifically, consider mirroring the existing terminal-theme decorations (e.g., monospace key column, optional `::before` accent) — but only if it helps; don't add chrome for its own sake.
- For editorial, consider whether the key column should use the theme's serif font or stay sans for scannability.
- Keep overrides minimal. Per the institutional-learnings doc, avoid duplicating variable-driven base styles.

**Test expectation: none — pure CSS.** Verification is visual.

**Verification:**
- Each theme's grid feels native to that theme, not generic.
- No regressions to the frontmatter card, which shares the same theme files.

## System-Wide Impact

- **Interaction graph:** Only the `parseMarkdown()` → `buildHtml()` pipeline is affected. The new core rule runs after `gh_alert` and before the heading override; both already coexist with module-level rules.
- **Error propagation:** If anything in the splitting/walking logic throws or returns null, the rule leaves the original tokens in place and renders identically to today. Failure mode is a no-op, never a broken render.
- **State lifecycle risks:** None. The rule is stateless and module-scoped, like `gh_alert`.
- **API surface parity:** No change to `parseMarkdown()`'s return type — only the emitted HTML for matching paragraph runs differs.
- **Integration coverage:** Verify behavior with: alerts containing metadata-shape lines (alert wins), code fences containing metadata-shape lines (fence wins, no grid), tables containing metadata-shape rows (table wins), files with both YAML frontmatter card and inline metadata grid in the same file (both render correctly, side by side).
- **Unchanged invariants:** TOC generation, scroll-spy, code copy, search, theme switching, dark-mode toggle, alerts (`gh_alert`), the frontmatter card, and Mermaid rendering all continue to work identically.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| False positive on lines authors meant as inline emphasis (`**Note:** see below.`) | Singleton exclusion: a run requires 2+ matching segments. The single-line case is the dominant false-positive surface. |
| Walking-and-splicing the token stream introduces an off-by-one when the run is followed by another candidate run | Mirror the `gh_alert` close-index recomputation pattern (`adjustedCloseIdx`). Use a fresh outer loop that re-evaluates positions after each splice, or build the new token array in one pass instead of mutating in place. |
| Inline markdown in values breaks because the rule consumes the `inline` token | Don't replace the inline token — emit row-open and row-close `html_block` tokens around a *new* inline token whose `children` array holds the value's existing children. The renderer walks children normally. |
| Compact padding looks cramped in the editorial theme's serif body | Tune the padding values during Unit 2's visual pass. If still off, add an editorial-theme override in Unit 3 (one of the explicit reasons Unit 3 exists). |
| The rule fires on tokens emitted by `gh_alert`'s html_blocks if they contain matching paragraph patterns inside | The rule scans paragraph_open / inline / paragraph_close triples at top-level. `gh_alert` already wraps its body in html_blocks and the inner paragraphs are nested inside; check `level` to skip nested paragraphs and process only top-level (level === 0). |

## Documentation / Operational Notes

- After landing, consider extending [docs/solutions/best-practices/custom-markdown-block-rendering-2026-04-19.md](docs/solutions/best-practices/custom-markdown-block-rendering-2026-04-19.md) with a "multi-paragraph run variant" section so future contributors see this case as a recognized variation of the established pattern.
- No README changes — this is a render-quality improvement that doesn't require user education.
- No new author syntax to document.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-27-inline-metadata-grid-requirements.md](docs/brainstorms/2026-04-27-inline-metadata-grid-requirements.md)
- Pattern reference: [src/markdownParser.ts:63-125](src/markdownParser.ts#L63-L125) (`gh_alert` rule)
- Visual reference: [src/previewPanel.ts:115-123](src/previewPanel.ts#L115-L123) (`buildFrontmatterCard`) and [src/previewPanel.ts:718-750](src/previewPanel.ts#L718-L750) (frontmatter card CSS)
- Institutional learning: [docs/solutions/best-practices/custom-markdown-block-rendering-2026-04-19.md](docs/solutions/best-practices/custom-markdown-block-rendering-2026-04-19.md)
- Adjacent prior plan: [docs/plans/2026-04-15-002-feat-frontmatter-metadata-card-plan.md](docs/plans/2026-04-15-002-feat-frontmatter-metadata-card-plan.md)
