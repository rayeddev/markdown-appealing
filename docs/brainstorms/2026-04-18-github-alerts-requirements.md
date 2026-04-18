---
date: 2026-04-18
topic: github-alerts
issue: rayeddev/markdown-appealing#23
---

# GitHub Alerts / Callouts

## Problem Frame

GitHub-flavored alerts (`> [!NOTE]`, `> [!WARNING]`, etc.) are now a standard expectation for any markdown tool — READMEs, release notes, and AI-generated docs rely on them. Today, Markdown Appealing renders them as plain blockquotes with a stray `[!NOTE]` line of text, which looks broken. Users previewing a README locally can't trust the preview to reflect what GitHub will render.

## Requirements

**Parsing**
- R1. Blockquotes whose first line is exactly one of `[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!CAUTION]`, `[!IMPORTANT]` (case-insensitive, matching GFM) render as alert callouts
- R2. Blockquotes that do not match the alert pattern render as today — no regression on regular `>` quotes
- R3. The `[!TYPE]` marker line is consumed (not shown as body content); the remaining blockquote content becomes the alert body

**Rendering**
- R4. Each alert shows a type-specific icon + label (NOTE, TIP, etc.) and the original body content
- R5. Icons are inline SVG, embedded in the webview HTML — no external CDN, no web font dependency
- R6. Body supports normal inline markdown (links, emphasis, code) and multi-paragraph content

**Visual Treatment**
- R7. Each of the 3 themes (clean, editorial, terminal) styles alerts in its own voice — not one uniform look. Treatment should feel native to each theme rather than bolted on:
  - **clean**: soft card with tinted background + colored left border + icon
  - **editorial**: serif-friendly rule-based treatment with accent color per type
  - **terminal**: ASCII-style box or `[!TYPE]` header preserved as part of the aesthetic
- R8. Each theme supports both light and dark mode for all 5 alert types (30 combinations total: 3 themes × 2 modes × 5 types)
- R9. Alert type is still signaled by hue + icon so meaning is preserved across themes

## Success Criteria

- **Primary**: A README that uses GitHub alerts renders close enough to GitHub in the preview that users trust it — the preview is a believable stand-in for "what will this look like on GitHub?"
- Non-alert blockquotes are visually unchanged from today
- All 30 theme × mode × type combinations look intentional — no "we forgot terminal dark mode CAUTION" gaps
- Feature works offline (extension bundle contains everything it needs)

## Scope Boundaries

- Only the 5 GFM-spec alert types — no custom types (TODO, SUCCESS, QUESTION)
- No collapsible / foldable alerts
- No per-alert configuration (can't disable individual types, can't change colors via settings)
- No support for nested alerts-inside-alerts (GFM doesn't support this either)
- No special handling for alerts inside lists, tables, or other non-top-level contexts beyond what markdown-it gives us naturally

## Key Decisions

- **Theme-harmonized over GitHub-color-matching**: The extension's USP is 3 opinionated themes. Using GitHub's canonical blue/green/yellow/red/purple across every theme would flatten that differentiation. Each theme expressing alerts in its own voice is more work but aligns with the product identity. Type meaning is still preserved via hue family + icon.
- **GFM 5 only, no custom types**: Extending beyond the spec breaks cross-tool portability. Users writing alerts expect them to render the same in the preview and on GitHub. Custom types can be revisited later if demand emerges.
- **Inline SVG over icon font or emoji**: Keeps the webview self-contained and offline, consistent with the rest of the preview's "no network" behavior.

## Dependencies / Assumptions

- Implementation path (markdown-it plugin vs. custom blockquote override) is a **technical decision deferred to planning** — both can satisfy the requirements above.
- `src/markdownParser.ts` already overrides markdown-it's fence + heading renderers; adding blockquote transformation fits the existing pattern.
- `themes/clean.css`, `themes/editorial.css`, `themes/terminal.css` each need new alert selectors for both `[data-mode="light"]` and `[data-mode="dark"]`.
- Assumed: no existing users rely on the current broken rendering of `[!NOTE]` blockquotes (effectively dead state).

## Outstanding Questions

### Deferred to Planning
- [Affects R1, R3][Technical] Plugin (`markdown-it-github-alerts` or similar) vs. custom blockquote renderer override. Trade-off: plugin = less code + standard output; custom = full control over HTML shape and no new dependency.
- [Affects R4, R5][Design] Exact icon set — reuse GitHub's SVGs (Octicons, MIT-licensed) or use a minimal custom set per theme. Terminal theme may want ASCII glyphs instead of SVG.
- [Affects R7][Design] Terminal theme specifics — does "ASCII-style" mean a `┌─ NOTE ─┐ ... └───┘` box, a preserved `[!NOTE]` header with tint, or something else? Needs a mock.
- [Affects R7][Design] Editorial theme specifics — accent rule placement (left border, top rule, side-margin label) needs a mock before CSS.

## Next Steps

-> `/ce:plan` for structured implementation planning
