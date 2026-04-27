---
date: 2026-04-27
topic: inline-metadata-grid
---

# Inline Metadata Grid (`**Label:** value` Run)

## Problem Frame

Authors regularly write key-value metadata inline in the body of a markdown file as runs of bold-prefix paragraphs:

```
**Status:** verified — applied 2026-04-27 03:19 server time
**Group:** [2026-04-26-infra-cleanup](README.md)
**Risk:** low — config-only, fully reversible (we keep `.OLD` copies)
**Estimated downtime:** zero (config reload is hot)
```

The current preview renders these as four loose paragraphs with bolded prefixes. Labels and values don't align, the block has no visual identity, and at a glance it reads as prose rather than structured metadata. The repo already has a polished metadata card for YAML frontmatter (see [docs/brainstorms/2026-04-15-frontmatter-card-requirements.md](docs/brainstorms/2026-04-15-frontmatter-card-requirements.md)) — this brainstorm extends that pattern to inline runs.

## Requirements

- R1. Detect runs of **2 or more consecutive** paragraphs/lines whose content matches the shape `**Label:** value` and fuse them into a single metadata grid block.
- R2. A `Label` is the text inside the leading `**…**`. A `value` is everything after the first `:` (or `: `) following the closing `**`.
- R3. A single isolated `**Label:** value` paragraph (no consecutive sibling) renders as a normal paragraph — no grid is emitted.
- R4. Render the grid as a two-column block, visually consistent with the frontmatter card (same border, background, color tokens) so the two surfaces feel like one design language.
- R4a. The grid must use **compact padding** — tighter row height and cell padding than the frontmatter card. The frontmatter card sits at the top and benefits from breathing room; inline grids appear mid-document and should feel dense and unobtrusive. Same visual identity (border, background, colors), tighter spacing.
- R5. Render `value` as **inline markdown** — links, inline code, emphasis, em-dashes, etc., must all work (the screenshot example contains a link and inline code).
- R6. Render `Label` as plain text (no inline markdown processing inside the label).
- R7. The grid must respect the active theme and dark/light mode, same as the frontmatter card.
- R8. The grid block participates in normal document flow — it can appear anywhere a paragraph can (under a heading, between paragraphs, inside a list item is **out of scope**, see Scope Boundaries).

## Success Criteria

- The example block in the screenshot renders as a clean two-column grid with aligned labels and values, visually matching the frontmatter card.
- A single `**Note:** see below.` paragraph still renders as a normal paragraph (no false-positive grid).
- A run with a link or inline code in the value renders the inline markdown correctly inside the grid value cell.
- All three themes × light/dark mode look intentional with no jaggy borders or color clashes.

## Scope Boundaries

- **Top-level only.** Runs inside list items, blockquotes, or table cells are not promoted to grids in this iteration. They keep current rendering.
- **Consecutive only.** A blank line breaks the run. We do not fuse across blank lines.
- **No nested grids.** A grid is flat key→value; we do not support sub-keys or multi-line values that span paragraphs.
- **No new syntax.** No `:::meta` fence, no HTML markers — detection is purely shape-based on existing markdown.
- **No interactivity.** Display-only, like the frontmatter card.
- **Singletons stay paragraphs.** Even when a single `**Foo:** bar` line could plausibly be metadata, we leave it as a paragraph to avoid catching lines authors meant as inline emphasis (e.g. `**Note:** see below.`).
- **Empty values.** A line `**Label:**` with empty value is **not** treated as a metadata row (does not contribute to the count required for fusion). Treat it as a normal paragraph.
- **Labels are verbatim.** No title-casing, humanization, or trimming beyond whitespace.

## Key Decisions

- **Two-column grid over definition list / chip row / typographic-only.** Unifies visually with the existing frontmatter card; one design language for "this is metadata" across the extension.
- **Auto-fuse consecutive runs of 2+ over explicit-fence or after-heading-only.** Zero new syntax for the author. Singleton-exclusion handles the main false-positive case (single `**Note:** …` lines) without requiring opt-in.
- **Inline markdown in values, plain text in labels.** Values often contain links and inline code (the screenshot proves it); labels are conventionally short identifiers and don't need formatting. Keeping labels plain also avoids weird edge cases like a label that contains a colon or formatting.
- **Consecutive = no blank line between matching paragraphs.** Matches the natural way authors group these in source. A blank line is a clear "I meant these as separate things" signal.
- **Reuse the frontmatter card's styles.** Grid markup should use the same CSS class shape (or a shared base class) so themes only need one set of tokens to maintain.
- **Compact padding for inline grids.** Frontmatter card = roomy (it's the page header). Inline metadata grid = compact (it's a body element). Share visual identity, override row/cell spacing only.

## Open Questions for Planning

- **Markdown-it integration point.** Likely a `core.ruler.after('block', …)` rule that scans token runs for matching `paragraph_open → inline → paragraph_close` triples, similar in spirit to the existing `gh_alert` rule in [src/markdownParser.ts](src/markdownParser.ts) — planning should confirm this is the cleanest hook.
- **Class naming.** Should the grid reuse the frontmatter card's existing class (e.g. `.frontmatter-card`) or introduce a sibling class like `.meta-grid` that inherits the same visual tokens? Tradeoff: shared class = less CSS, but couples two surfaces' future evolution.
- **Label-trailing-colon variants.** Source might have `**Label**:` (colon outside bold) instead of `**Label:**` (colon inside bold). Decide in planning whether both forms count as a match or only the canonical `**Label:**` form. Recommend: only canonical, to avoid catching prose like `**Important**: read this.`
- **Interaction with the existing fence renderer.** Confirm fenced code blocks containing literal `**Label:** value` lines are unaffected (they should be — fences emit different token types).

## Next Steps

-> `/ce:plan` for structured implementation planning.
