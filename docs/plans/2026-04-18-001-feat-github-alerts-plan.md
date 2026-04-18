---
title: 'feat: GitHub Alerts / Callouts'
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-github-alerts-requirements.md
issue: rayeddev/markdown-appealing#23
---

# feat: GitHub Alerts / Callouts

## Overview

Render GitHub-flavored blockquote alerts (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]`, `> [!IMPORTANT]`) as styled callout blocks with type-specific icon + label. Each of the 3 themes (clean, editorial, terminal) expresses alerts in its own voice; all 5 types work in both light and dark mode. Regular blockquotes render unchanged.

## Problem Frame

Today these alerts render as plain blockquotes with a stray `[!NOTE]` text line, making the preview look broken for any README that uses GFM alerts. Since the extension pitches itself as a "beautiful" markdown preview and alerts are standard GFM, unsupported alerts directly undermine the core value proposition.

## Requirements Trace

- R1. Matching blockquotes render as alerts with icon + label (origin R1, R3, R4)
- R2. Non-matching blockquotes render unchanged (origin R2)
- R3. Icons inline SVG, offline (origin R5)
- R4. Body supports inline markdown + multi-paragraph (origin R6)
- R5. Theme-harmonized visuals across clean / editorial / terminal (origin R7, R9)
- R6. All 30 theme × mode × type combinations look intentional (origin R8)
- R7. User reading a README-with-alerts trusts the preview as a stand-in for GitHub (origin primary success criterion)

## Scope Boundaries

- GFM 5 types only — no TODO / SUCCESS / QUESTION custom types
- No collapsible alerts, no per-alert config, no nested alerts
- No special-casing alerts in lists/tables beyond what markdown-it handles naturally

## Context & Research

### Relevant Code and Patterns

- [src/markdownParser.ts:47-74](src/markdownParser.ts#L47-L74) — fence renderer override, the closest existing pattern. Module-level customization of markdown-it.
- [src/markdownParser.ts:94-120](src/markdownParser.ts#L94-L120) — heading override uses per-render-and-reset because it captures TOC state; alerts are stateless and should use the module-level pattern (like fence).
- [themes/clean.css:193-198](themes/clean.css#L193-L198), [themes/editorial.css](themes/editorial.css), [themes/terminal.css:232-246](themes/terminal.css#L232-L246) — current blockquote styling per theme. Terminal theme already has `blockquote::before { content: "NOTE "; }` on **all** blockquotes — this conflicts with real alerts and must be resolved in Unit 4.
- [src/previewPanel.ts](src/previewPanel.ts) `buildHtml()` — if any shared CSS is needed outside the per-theme files, it goes in the inlined `<style>` there. Default plan: keep everything in per-theme CSS files.
- [themes/](themes/) pattern: each theme defines variables under `[data-theme="X"][data-mode="light"]`, `[data-theme="X"][data-mode="dark"]`, and both `@media (prefers-color-scheme)` branches. Alert color variables must follow the same 4-declaration pattern so system-preference mode works.

### Institutional Learnings

- `docs/solutions/` does not exist in this repo. Related prior plans in `docs/plans/` for frontmatter card and mermaid card established the "card container" pattern for special block elements — alerts follow the same shape (wrapped div, per-theme exterior styling, theme-harmonized voice).

### External References

Skipping heavy external research — codebase has a direct local pattern. Two specific external anchors worth citing:

- GFM alerts spec (GitHub docs): recognizes exactly `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` as the first line of a blockquote, case-insensitive.
- GitHub Octicons (MIT-licensed): `info` (NOTE), `light-bulb` (TIP), `alert` (WARNING), `stop` (CAUTION), `report` (IMPORTANT) are the canonical 5 icons.

## Key Technical Decisions

- **Custom markdown-it core rule over `markdown-it-github-alerts` plugin** — keeps the bundle free of a new dep (esbuild ships everything), matches the existing fence override pattern, gives full control over output HTML + class names so per-theme CSS can target precisely. Implementation cost is small (~40 lines).
- **Core rule (token rewrite) over renderer override** — walking tokens after block parsing and replacing matched blockquote spans with custom `html_block` tokens keeps the default `blockquote_open`/`blockquote_close` renderers pristine for real blockquotes. No conditional logic in the blockquote renderer.
- **Module-level rule registration, not per-render** — alerts are stateless (no TOC-like capture), so register once in the `md` constructor block alongside the fence override. Avoids the "override and reset" dance heading uses.
- **Inline SVG icons from Octicons (MIT)** — 5 icons × ~200B = ~1KB total, embedded directly in the emitted HTML string. No icon font, no network, no CSP change.
- **Per-theme alert palette** — each theme gets its own 5-color palette tuned to the theme's mood (clean: soft desaturated tints; editorial: serif-appropriate muted tones; terminal: phosphor-green family with hue shifts for each type). GitHub's canonical blue/green/yellow/red/purple is **not** used uniformly.
- **Terminal theme's existing blockquote `NOTE` prefix is removed** — it was a pseudo-alert that now collides with real alerts. Replaced by a genuine alert system; regular `>` quotes in terminal get a plain left-bar treatment without the prefix.

## Open Questions

### Resolved During Planning

- **Plugin vs custom?** → Custom core rule. Rationale above.
- **Which icons?** → GitHub Octicons (MIT), inlined. NOTE=info, TIP=light-bulb, WARNING=alert, CAUTION=stop, IMPORTANT=report.
- **Terminal theme behavior with existing `NOTE` prefix on all blockquotes?** → Remove the prefix; real alerts replace it. Terminal regular blockquotes become plain left-bar style.
- **HTML shape?** → `<div class="gh-alert gh-alert-{type}"><p class="gh-alert-label"><svg>...</svg><span>TYPE</span></p>{body}</div>`.

### Deferred to Implementation

- Exact per-theme hex values for each alert type — will be chosen against the running preview during implementation since color tuning needs visual verification.
- Whether to match the alert marker case-insensitively via regex `/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\][ \t]*$/i` or require uppercase — GFM is case-insensitive; assume the same but verify against a mixed-case fixture at implementation time.
- Whether multi-paragraph alerts need explicit CSS margin tuning — depends on how they render out of the box; adjust during Unit 2–4 if needed.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Core rule pseudocode (runs after block parse, before render):**

```
for each token where type == 'blockquote_open':
  find the matching blockquote_close
  peek the first inline token inside the blockquote
  if first child is text matching /^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*$/i
      followed by softbreak:
    - capture the type
    - strip the marker text + softbreak from the inline token
    - replace blockquote_open with html_block: '<div class="gh-alert gh-alert-{type}"><p class="gh-alert-label">{icon-svg}<span>{TYPE}</span></p>'
    - replace blockquote_close with html_block: '</div>'
  else:
    leave untouched
```

**Emitted HTML shape:**

```html
<div class="gh-alert gh-alert-note">
  <p class="gh-alert-label"><svg class="gh-alert-icon">...</svg><span>NOTE</span></p>
  <p>body content rendered as normal markdown</p>
  <p>additional paragraphs if any</p>
</div>
```

**CSS variable additions per theme** (example, clean light mode):

```
--alert-note-bg, --alert-note-border, --alert-note-ink
--alert-tip-bg, --alert-tip-border, --alert-tip-ink
--alert-warning-bg, --alert-warning-border, --alert-warning-ink
--alert-caution-bg, --alert-caution-border, --alert-caution-ink
--alert-important-bg, --alert-important-border, --alert-important-ink
```

Each theme × mode block defines all 15 variables (5 types × 3 props). Shared layout CSS (padding, radius, icon size) lives with the `.gh-alert` selector in the clean theme file or a new shared `<style>` block in `previewPanel.ts` — TBD during Unit 2.

## Implementation Units

- [x] **Unit 1: Parser core rule + inline Octicon set**

**Goal:** Transform matching blockquote token spans into alert HTML blocks with inline SVG icon and label.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/markdownParser.ts`
- Test: manual via fixture (see Unit 5) — no test runner in repo

**Approach:**
- Add a small `GH_ALERT_ICONS` object mapping the 5 types to inline SVG strings (Octicons `info`, `light-bulb`, `alert`, `stop`, `report`), each with `class="gh-alert-icon"` and accessible `aria-hidden="true"`.
- Register a `core.ruler.after('block', 'gh-alert', ...)` rule on the module-level `md` instance (near the existing fence override at [src/markdownParser.ts:47](src/markdownParser.ts#L47)).
- Rule walks tokens, finds `blockquote_open`, inspects the first inline token's `children[0]` for the alert marker pattern, and on match:
  1. Strips the marker text + following softbreak from the inline token's children.
  2. Replaces the `blockquote_open` token with a synthetic `html_block` containing the alert wrapper `<div class="gh-alert gh-alert-{type}"><p class="gh-alert-label">{icon}<span>{TYPE}</span></p>`.
  3. Replaces the matching `blockquote_close` token with `</div>`.
- Pattern: `/^\[!(note|tip|warning|caution|important)\]\s*$/i` (case-insensitive per GFM).
- Non-matching blockquotes are untouched — normal renderer emits normal HTML.

**Patterns to follow:**
- [src/markdownParser.ts:47-74](src/markdownParser.ts#L47-L74) — module-level renderer customization on `md`.
- Module-level registration (not the per-render "override and reset" that heading_open uses).

**Test scenarios:** (manual — no test runner in repo; verify via `npm run compile && F5` Extension Development Host against fixture from Unit 5)
- Happy path: `> [!NOTE]\n> body` → emits `<div class="gh-alert gh-alert-note">` with info icon and `NOTE` label; body rendered as `<p>body</p>`.
- Happy path: each of the 5 types produces the matching class name and icon.
- Happy path: multi-paragraph — `> [!TIP]\n> line1\n>\n> line2` produces two `<p>` inside one alert div.
- Happy path: inline markdown in body — `> [!WARNING]\n> **bold** and [link](x)` renders bold + link normally inside the alert.
- Edge case: case-insensitive marker — `> [!note]` and `> [!Note]` both match and emit `NOTE` label uppercase.
- Edge case: marker with trailing whitespace — `> [!NOTE]   ` matches.
- Edge case: regular blockquote — `> just a quote` renders as `<blockquote><p>just a quote</p></blockquote>` unchanged.
- Edge case: unknown type — `> [!HINT]\n> body` renders as a normal blockquote (marker line stays visible as body text — same as today, no regression).
- Edge case: nested blockquote — `> [!NOTE]\n> outer\n> > inner` — outer becomes an alert, inner stays as a nested blockquote inside it.
- Edge case: marker on non-first line — `> first line\n> [!NOTE]\n> body` — does NOT match, renders as regular blockquote (GFM only recognizes the marker as the first line).

**Verification:**
- Output HTML inspected in the webview devtools matches the shape above for all 5 types.
- Non-alert blockquotes unchanged (diff against pre-change rendering of a fixture with a plain blockquote).

---

- [x] **Unit 2: Clean theme alert styling**

**Goal:** Style all 5 alert types for clean theme in both light and dark modes. Establish the shared layout CSS that all themes inherit.

**Requirements:** R5, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `themes/clean.css`
- Test: manual via fixture (Unit 5)

**Approach:**
- Add shared `.gh-alert` layout rules (padding, border-radius, margin, icon sizing, label typography) scoped under `[data-theme="clean"]` first — later units decide whether to lift this into a shared block or duplicate per theme. For Unit 2, keep it local to clean to avoid premature abstraction.
- Define 15 CSS variables per mode block (5 types × {bg, border, ink}) in `[data-theme="clean"][data-mode="light"]`, `[data-theme="clean"][data-mode="dark"]`, and both `@media (prefers-color-scheme)` branches — matches the existing 4-declaration pattern for theme variables.
- Clean voice: soft tinted card with a colored left border, muted pastel fills, icon and label in the type's accent color. Example hue families (to be tuned at implementation time): NOTE=indigo, TIP=emerald, WARNING=amber, CAUTION=rose, IMPORTANT=violet.
- Label typography matches clean's existing sans UI font (`var(--font-sans)`), uppercase, tracked letter-spacing similar to `.code-lang`.

**Patterns to follow:**
- [themes/clean.css:193-198](themes/clean.css#L193-L198) — existing blockquote treatment (keep unchanged for non-alert quotes).
- [themes/clean.css:6-34](themes/clean.css#L6-L34) and [themes/clean.css:37-65](themes/clean.css#L37-L65) — variable declaration pattern for light/dark blocks.
- [themes/clean.css:178-185](themes/clean.css#L178-L185) `.code-lang` — label typography reference.

**Test scenarios:** Test expectation: none -- pure styling unit, no behavioral change. Visual verification below.

**Verification:**
- All 5 alert types visually distinct in light mode.
- All 5 alert types visually distinct in dark mode.
- Alert treatment feels coherent with clean theme's soft-card aesthetic (frontmatter card, code block wrapper).
- Contrast passes WCAG AA for label + icon vs background in both modes.
- Regular blockquote in the same document still renders with the original accent-left-border treatment.

---

- [x] **Unit 3: Editorial theme alert styling**

**Goal:** Style all 5 alert types for editorial theme in both light and dark modes, in editorial's serif-friendly voice.

**Requirements:** R5, R6

**Dependencies:** Unit 1, Unit 2 (for any shared layout decisions made during Unit 2)

**Files:**
- Modify: `themes/editorial.css`
- Test: manual via fixture (Unit 5)

**Approach:**
- Editorial voice: rule-based / typographic rather than card-based. Suggested shape: thin top+bottom rule in the type's hue, small-caps label with a bullet/diamond glyph, generous horizontal padding, no rounded corners — matches editorial's magazine-article feel.
- Define the same 15 CSS variables in all 4 declaration blocks (light, dark, prefers-light, prefers-dark).
- Editorial hue palette (to tune at implementation): muted, slightly desaturated tones that sit well alongside serif body text — e.g., NOTE=slate-blue, TIP=sage, WARNING=ochre, CAUTION=terracotta, IMPORTANT=aubergine.
- Override any shared `.gh-alert` layout from Unit 2 using `[data-theme="editorial"] .gh-alert { ... }` selectors where editorial's shape differs (radius=0, no fill, rule-based borders).

**Patterns to follow:**
- Editorial's existing frontmatter card / mermaid card treatment (whichever differs from clean — sets the precedent for editorial's "how special blocks look").
- Variable declaration across 4 mode blocks.

**Test scenarios:** Test expectation: none -- pure styling unit. Visual verification below.

**Verification:**
- All 5 alert types visually distinct in light and dark.
- Treatment reads as "editorial" — not a clone of clean with different colors.
- Serif body content inside alerts still uses editorial's body font; labels use sans/small-caps.
- Regular blockquote unchanged.

---

- [x] **Unit 4: Terminal theme alert styling + resolve existing `NOTE` prefix conflict**

**Goal:** Style all 5 alert types for terminal theme in both light and dark modes, and remove the pre-existing `blockquote::before { content: "NOTE "; }` rule that conflicts with real alerts.

**Requirements:** R5, R6 — plus an invariant: regular blockquotes stay functional (R2).

**Dependencies:** Unit 1

**Files:**
- Modify: `themes/terminal.css`
- Test: manual via fixture (Unit 5), plus explicit check that regular blockquotes no longer show a stray `NOTE` prefix.

**Approach:**
- **Remove** [themes/terminal.css:240-246](themes/terminal.css#L240-L246) — the `blockquote::before { content: "NOTE "; }` rule. That pseudo-label is replaced by genuine alerts.
- Terminal voice: ASCII-box or `[!TYPE]`-header preserved as part of the aesthetic. Suggested shape: square corners, dashed top/bottom borders (`border-top: 1px dashed var(--alert-{type}-border)`), label rendered as `[!TYPE]` in mono caps with `::before` glyph, icon optional (terminal may prefer pure ASCII — decide during implementation).
- Alternative shape to evaluate during implementation: full ASCII box with `┌─ [!NOTE] ─┐ ... └──────────┘` via corner glyphs. More theatrical; may be too noisy for long alerts. Fallback to dashed-rule if box is unreadable.
- Define the same 15 CSS variables in all 4 mode blocks.
- Terminal hue palette (to tune): phosphor family. NOTE=cyan-green, TIP=lime-green, WARNING=amber, CAUTION=red, IMPORTANT=magenta — each still legible on the dark terminal bg and the light-terminal bg.
- Regular (non-alert) blockquote retains its existing `border-left: 2px solid var(--accent); background: var(--accent-bg)` treatment — just without the prefix.

**Patterns to follow:**
- [themes/terminal.css:193-204](themes/terminal.css#L193-L204) — `.code-lang::before { content: "❯ "; }` sets precedent for prefix-based decoration.
- [themes/terminal.css:199-203](themes/terminal.css#L199-L203) — `.code-copy-btn::before { content: "["; }` and `::after { content: "]"; }` — the same `[...]` bracket pattern could decorate the alert label.

**Test scenarios:** Test expectation: none -- pure styling unit. Visual verification below.

**Verification:**
- All 5 alert types visually distinct in terminal light and dark.
- Treatment reads as "terminal" — ASCII-box or bracket-label feel, not a soft card.
- Regular blockquote in terminal theme **no longer** shows a leading `NOTE ` prefix (previous bug).
- Regular blockquote still has its left-bar accent treatment.

---

- [ ] **Unit 5: Fixture README + cross-theme manual verification**

**Goal:** Produce a single fixture markdown file that exercises every alert + theme combination, use it to verify Units 1–4 end-to-end, and update the extension's own README to list alerts as a supported feature.

**Requirements:** R7 (preview trusted vs GitHub)

**Dependencies:** Unit 1, Unit 2, Unit 3, Unit 4

**Files:**
- Create: `docs/fixtures/github-alerts-fixture.md` (test input)
- Modify: `README.md` (feature list)
- Modify: `CHANGELOG.md` (new entry for this feature)

**Approach:**
- Fixture covers: all 5 types, a multi-paragraph alert, an alert with inline markdown (bold/italic/link/code), a case-insensitive marker, a nested blockquote inside an alert, an unknown `[!HINT]` marker (should render as plain blockquote), and at least one plain `>` blockquote for regression checking.
- Run the Extension Development Host (F5), open the fixture, cycle through all 3 themes × light/dark (6 combinations), and confirm visual correctness. Document any discrepancies as implementation notes.
- Also paste the fixture into a GitHub comment or gist preview to compare the rendering side-by-side with GitHub's alerts — primary success criterion is "close enough that users trust the preview."
- Add CHANGELOG entry under the next version.

**Patterns to follow:**
- Existing CHANGELOG style in [CHANGELOG.md](CHANGELOG.md).
- Existing README feature list in [README.md](README.md).

**Test scenarios:** Test expectation: none -- this unit IS the verification layer. The scenarios below are acceptance checks, not code tests.

**Verification:**
- Fixture renders correctly in 3 themes × 2 modes = 6 environments.
- Side-by-side comparison with GitHub's rendering of the same fixture passes the "user would trust this" bar.
- Regular blockquote in fixture renders normally in all themes (no regression).
- Unknown `[!HINT]` marker gracefully falls back to plain blockquote with marker visible as body text — documented behavior, no crash.
- README and CHANGELOG updated.

## System-Wide Impact

- **Interaction graph:** Affects the markdown-it token stream, emitted HTML, and theme CSS. No impact on TOC, scroll-spy, frontmatter card, mermaid card, or code block rendering.
- **Error propagation:** Parser transform is defensive — any unexpected token shape (missing inline children, unusual nesting) falls back to "leave the blockquote as-is". No crash path.
- **State lifecycle risks:** None — alerts are a stateless render transform. No persistence, no postMessage.
- **API surface parity:** The extension has no public API. The VS Code settings surface is unchanged — no new config keys.
- **Integration coverage:** The only cross-layer concern is that webview CSS loads all 3 themes into one document and toggles via `data-theme`; CSS specificity must be high enough that `[data-theme="terminal"] .gh-alert` beats `[data-theme="clean"] .gh-alert` when terminal is active. Follow the existing `[data-theme="X"]` prefix convention and this comes for free.
- **Unchanged invariants:** Regular `>` blockquotes, code fences, headings, TOC generation, frontmatter, mermaid rendering, dark/light toggle, theme switching — all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Terminal theme's `::before { content: "NOTE " }` rule silently breaks if only removed (e.g., user relied on it as a label). | This was effectively a bug — it labeled every blockquote as `NOTE` regardless of type. Calling it out in CHANGELOG as a fix. |
| Token-stream rewrite interacts poorly with other core rules (e.g., linkify inside alert body text). | Register the rule `after('block', ...)`, before inline rules finalize. Test the fixture case with a link inside the alert body to verify. |
| Per-theme color tuning produces washed-out or over-saturated results. | Color tuning happens during Unit 2–4 implementation with live preview, not at plan time. Deferred on purpose. |
| Nested blockquote as alert body is unusual and may render awkwardly. | Fixture covers this case; acceptable outcome is "renders without breaking layout" — aesthetic polish for nested alerts is not a requirement. |
| Bundle size regression from inline SVG strings. | ~1KB total across 5 icons — negligible vs existing ~200KB mermaid vendor. No action needed. |

## Documentation / Operational Notes

- `README.md` feature list gains "GitHub-flavored alerts (`[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!CAUTION]`, `[!IMPORTANT]`)".
- `CHANGELOG.md` gets a new entry: "Add GitHub alert rendering; fix terminal theme's incorrect `NOTE` prefix on regular blockquotes".
- No settings migration, no deprecations, no rollout concerns — this is additive rendering in an extension.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-github-alerts-requirements.md](docs/brainstorms/2026-04-18-github-alerts-requirements.md)
- **Issue:** rayeddev/markdown-appealing#23
- **Related plans:** [docs/plans/2026-04-15-003-feat-mermaid-diagram-rendering-plan.md](docs/plans/2026-04-15-003-feat-mermaid-diagram-rendering-plan.md) (card-container pattern precedent)
- **Key files:** [src/markdownParser.ts](src/markdownParser.ts), [themes/clean.css](themes/clean.css), [themes/editorial.css](themes/editorial.css), [themes/terminal.css](themes/terminal.css)
- **External:** GitHub Octicons (MIT), GFM alerts spec
