---
title: Adding Custom Block Rendering to markdown-it via Core Token Rewrite
date: 2026-04-19
category: best-practices
module: markdown-parser
problem_type: best_practice
component: tooling
severity: medium
applies_when:
  - Adding a new markdown syntax (alerts, callouts, custom cards, directives) that needs its own HTML wrapper
  - The syntax piggybacks on an existing block construct (blockquote, fence, list) and discriminates via a marker
  - Output needs to stay offline-first (no external fonts, no CDN icons, no runtime network)
  - The transform is stateless (no document-level context to capture during render)
tags:
  - markdown-it
  - webview
  - vscode-extension
  - theme-system
  - token-rewrite
  - offline-first
---

# Adding Custom Block Rendering to markdown-it via Core Token Rewrite

## Context

Shipping GitHub alerts (`> [!NOTE]`, `> [!TIP]`, etc.) to the preview meant intercepting a subset of blockquotes and re-emitting them with a different HTML shape, label, and icon — while leaving regular blockquotes untouched. Three naive approaches each fail in this webview context:

1. **Install `markdown-it-github-alerts`** — adds a dependency the esbuild bundle has to carry, and the emitted HTML / class names are dictated by the plugin rather than the theme system.
2. **Override `md.renderer.rules.blockquote_open`** — forces conditional logic into every blockquote render to decide "alert or normal?" and makes regular blockquote rendering depend on alert code.
3. **Add a plugin that loads an icon font or Codicon** — the webview runs in a sandboxed iframe with constrained resource roots; every external font is a CSP / `localResourceRoots` config change.

The pattern below sidesteps all three. It also generalizes — the same shape works for any block-level transform this extension needs next (custom directives, admonitions, per-language code-block decoration, etc.).

## Guidance

Use a **core ruler** that walks tokens after parse and rewrites matching spans into `html_block` tokens. Keep the default renderer rules pristine. Inline SVG icons. Theme styling lives in `themes/*.css` via CSS variables, not in the parser.

**Five rules:**

1. **Register on `md.core.ruler.after('inline', 'rule_name', fn)` — not `after('block')`.** The inline pass is what populates `token.children` on `inline` tokens. Your rule needs to inspect `inline.children[0]` to see the marker text. Running after block parsing only, you'd see the paragraph+inline shell but not the text content.

2. **Find the opening token, then find the matching close at the same `level`.** Don't assume the next close token is the match — nested blockquotes break that assumption. Walk forward looking for `type === '<construct>_close' && level === openTok.level`.

3. **Replace the boundary tokens with `html_block` tokens, don't mutate their `type`.** Constructing a fresh `new state.Token('html_block', '', 0)` with `content` set to your opening/closing HTML string is cleaner than trying to rewrite the existing token's `type`, `tag`, and renderer hook.

4. **Strip the marker text AND the following `softbreak` from the first inline token's children.** The marker sits on its own line inside the blockquote, so the text token is followed by a `softbreak`. Strip both. Then recompute `inlineTok.content` from the remaining children so downstream consumers see the right string.

5. **Handle the empty-paragraph edge case.** If the marker was alone on its line and there's no body text, stripping the text+softbreak leaves the inline token with zero children. That emits `<p></p>`. Detect this and splice out the paragraph_open / inline / paragraph_close trio — then decrement the close-index you calculated in rule 2 by 3.

**Keep it stateless and module-level.** Alerts don't capture per-render state (unlike `heading_open`, which captures TOC entries for the active render). Register the rule once on the module-level `md` instance. Do not do the "override, render, reset" dance that `heading_open` needs in `parseMarkdown()`.

**Icons: inline SVG strings from an MIT-licensed set, embedded in the emitted HTML.** Five ~200B SVGs is ~1KB total. No icon font, no `localResourceRoots` change, no network, no flash-of-unstyled-icon. Use `fill="currentColor"` so the CSS variable system drives the color.

**CSS: 15 variables per theme × 4 mode blocks.** Each theme file (`clean.css`, `editorial.css`, `terminal.css`) defines 5 types × {bg, border, ink} = 15 variables under each of `[data-theme="X"][data-mode="light"]`, `[data-theme="X"][data-mode="dark"]`, and both `@media (prefers-color-scheme: light/dark)` branches. That's four declaration blocks per theme, matching the existing pattern. Shared layout (padding, radius, icon sizing) sits on the base `.gh-alert` selector.

**Audit for pre-existing collisions.** Before shipping, grep every theme CSS file for any `::before` / `::after` rule on the same selector family. The terminal theme shipped a `blockquote::before { content: "NOTE "; }` rule that labeled every blockquote as NOTE — a pseudo-alert that collided with real alerts. Remove it as part of the same change.

## Why This Matters

- **Regular blockquote rendering stays untouched.** No conditional branches in the default renderer. Any future markdown-it behavior that depends on `blockquote_open` / `blockquote_close` continues to work — the rewrite only affects the matched subset.
- **Theme voices stay independent.** Because the parser emits generic classes (`gh-alert`, `gh-alert-note`) and all color/layout decisions live in per-theme CSS, each theme can express alerts in its own voice (soft cards / editorial rules / ASCII boxes) without parser changes.
- **Offline contract preserved.** No new resource roots, no font loading, no CSP change, no CDN dependency. The webview stays fully functional in restricted environments.
- **Bundle stays lean.** Custom rule is ~40 lines. A dependency-based approach adds weight for something you immediately have to work around.
- **Same shape scales.** Future additions — custom fenced directives, admonitions, section-break decorations, or any "looks like X but render as Y" transform — reuse the walk-tokens-and-replace-boundaries pattern with no new architectural decisions.

## When to Apply

- You're adding markdown syntax that is visually distinct from the construct it parses as (alerts inside blockquotes, custom cards inside fences, etc.).
- The transform is stateless — same input always produces same output, no per-render context to capture.
- The existing renderer's default output should remain unchanged for non-matching cases.
- You want theme-authored styling (CSS variables) to drive appearance, not parser-authored styling.

**Don't apply this pattern when:**

- The transform needs to capture document-level state during render (e.g., heading IDs for TOC) — those use the per-render override-then-reset pattern on `md.renderer.rules.*`, not a core rule.
- You need wholly new block syntax not piggybacking on an existing construct — write a proper markdown-it block rule (`md.block.ruler.before(...)`) instead.
- The transform depends on external config or async data — core rules run synchronously during parse.

## Examples

**Rule registration shape** (from [src/markdownParser.ts:63-125](src/markdownParser.ts#L63-L125)):

```typescript
md.core.ruler.after('inline', 'gh_alert', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const openTok = tokens[i];
    if (openTok.type !== 'blockquote_open') continue;

    // Find matching close at same nesting level
    let closeIdx = -1;
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].type === 'blockquote_close' && tokens[j].level === openTok.level) {
        closeIdx = j;
        break;
      }
    }
    if (closeIdx === -1) continue;

    // Inspect first inline token's first text child
    const inlineTok = tokens[i + 2];
    if (!inlineTok?.children?.[0] || inlineTok.children[0].type !== 'text') continue;

    const match = inlineTok.children[0].content.match(MARKER_RE);
    if (!match) continue;

    // Strip marker + softbreak, handle empty-paragraph edge case, replace boundaries
    // (see full source for the detailed splicing)
  }
  return true;
});
```

**Theme variable pattern** (each theme file defines all four blocks):

```css
[data-theme="clean"][data-mode="light"] {
  --alert-note-bg: /* light-mode hex */;
  --alert-note-border: /* ... */;
  --alert-note-ink: /* ... */;
  /* ...15 vars total (5 types × 3 props) */
}
[data-theme="clean"][data-mode="dark"] { /* same 15, dark hues */ }
@media (prefers-color-scheme: light) {
  [data-theme="clean"]:not([data-mode]) { /* same 15, light */ }
}
@media (prefers-color-scheme: dark) {
  [data-theme="clean"]:not([data-mode]) { /* same 15, dark */ }
}
```

**Emitted HTML shape:**

```html
<div class="gh-alert gh-alert-note">
  <p class="gh-alert-label">
    <svg class="gh-alert-icon" viewBox="0 0 16 16" aria-hidden="true">...</svg>
    <span>NOTE</span>
  </p>
  <p>body rendered as normal inline markdown</p>
</div>
```

## Related

- Prior plan: [docs/plans/2026-04-18-001-feat-github-alerts-plan.md](../../plans/2026-04-18-001-feat-github-alerts-plan.md) — full plan with per-theme styling units.
- Existing fence override: [src/markdownParser.ts:128-155](../../../src/markdownParser.ts#L128-L155) — module-level renderer customization, the pattern mirrored here for stateless transforms.
- Stateful counter-example: [src/markdownParser.ts:170-206](../../../src/markdownParser.ts#L170-L206) — `heading_open` uses per-render override+reset because it captures TOC state. Shows when NOT to use this pattern.
