---
date: 2026-04-19
topic: fullscreen-preview
---

# Fullscreen Preview

## Problem Frame

The preview panel lives inside VS Code's editor chrome: tabs, sidebar, activity bar, and status bar all compete with the rendered document. Users reading long documents want a distraction-free view with a single keystroke, and a single keystroke to leave it. (Presentation mode — slide advance, speaker notes — is explicitly out of scope.)

## Spike Result (2026-04-19)

A spike investigated the HTML Fullscreen API path and confirmed it is structurally blocked:

- VS Code's webview iframe does **not** include `fullscreen` in its Permissions Policy (confirmed in `webviewElement.ts`). `element.requestFullscreen()` inside a webview throws `NotAllowedError` before the user-gesture check applies.
- Issue `microsoft/vscode#165073` (webview HTML5 video fullscreen) was closed **"not planned"**; issue `#110766` (allow output fullscreen) remains in the backlog.
- Even if the permission were added, `webview.postMessage` is not treated as a user-activation gesture (`microsoft/vscode#237030`), so host-command-triggered entry would still fail.

Conclusion: the feature cannot be delivered via the HTML Fullscreen API. This brainstorm pivots to composing existing VS Code commands — primarily `workbench.action.toggleZenMode`, which hides sidebar, activity bar, status bar, tabs, and (when `zenMode.fullScreen` is true, the default) enters OS fullscreen. This delivers the "distraction-free, full-monitor" goal at near-zero maintenance cost with no platform risk.

## Requirements

**Command & Trigger**
- R1. A new command `markdownAppealing.toggleFullscreen` toggles fullscreen mode. It is callable from the Command Palette. If no preview panel is open, it shows a warning ("Open a preview first.") matching the pattern used by `switchTheme` and `toggleDarkMode`.
- R2. The command has a default keybinding (exact chord deferred to planning) scoped via the context key `activeWebviewPanelId == 'markdownAppealing.preview'` (matches the `viewType` at `src/previewPanel.ts:9`).
- R3. The in-webview top-right controls area gains a small icon-button with accessible name "Enter fullscreen" / "Exit fullscreen". Clicking it posts `{type: 'toggleFullscreen'}` to the extension host, which runs the same command as R1.

**Fullscreen Behavior**
- R4. Entering fullscreen invokes `workbench.action.toggleZenMode` via `vscode.commands.executeCommand(...)`. VS Code's user settings already control whether this also enters OS fullscreen (`zenMode.fullScreen`, default true on macOS/Windows); the extension does not override user preference.
- R5. If multiple editor groups are visible when fullscreen is invoked, the command additionally runs `workbench.action.maximizeEditor` so the preview occupies the full window. On exit, the previous layout is restored by Zen Mode's own state.
- R6. The webview itself is unchanged by the toggle — no DOM overlay, no CSS mode, no re-render. TOC, frontmatter card, search, themes, dark mode, keyboard navigation, and scroll position all continue working unchanged because the webview has no idea the host entered Zen Mode.

**Exit**
- R7. Pressing `Esc` exits fullscreen. This relies on VS Code's Zen Mode default behavior. Planning will decide between two options: (a) rely on Zen Mode's native double-`Escape` (requires no code but deviates from "single keystroke" success criterion), or (b) register a VS Code keybinding for a single `Escape` that invokes `markdownAppealing.toggleFullscreen` when the preview is focused. Option (b) must not capture `Escape` when the webview's search overlay is open (let the webview's existing handlers run first).
- R8. Invoking `markdownAppealing.toggleFullscreen` again — via Command Palette, keybinding, or the in-webview button — also exits.

**State & Persistence**
- R9. Fullscreen is transient: each preview session starts windowed. The extension does not persist fullscreen state across VS Code restarts, nor remember it when the file changes.
- R10. The extension does not track fullscreen state itself. The source of truth is VS Code's Zen Mode state, exposed via context keys and `onDidChange` events if needed. The in-webview button's icon state is synced by listening for host → webview `fullscreenChanged` messages that the host posts when it toggles.

## Success Criteria

- A user reading a markdown preview can reach a distraction-free, VS-Code-chrome-free view in one keystroke and return in one keystroke.
- No webview re-render occurs; scroll position, active heading, search state, and theme state are all preserved trivially.
- The in-webview button's icon reflects the current state (enter/exit glyph, accessible name).
- The feature works on VS Code Desktop and VS Code for Web without branching code paths (both support `workbench.action.toggleZenMode`).

## Scope Boundaries

- Not based on the HTML Fullscreen API — spike confirmed it is blocked (see Spike Result above).
- Not a custom CSS overlay — no `position: fixed` faux-fullscreen of the webview panel. The webview stays as-is.
- No presentation features (slide advance, speaker notes, laser pointer).
- No override of user's `zenMode.*` settings (centerLayout, fullScreen, hideLineNumbers, restore). The extension composes Zen Mode; it does not reconfigure it.
- No preview-specific theme, typography, or layout changes in fullscreen.
- No persistence of fullscreen state across preview close/reopen or VS Code restart.

## Key Decisions

- **Compose `workbench.action.toggleZenMode` instead of implementing fullscreen.** The spike confirmed the HTML Fullscreen API is blocked and a CSS faux-fullscreen path would fill only the webview pane — strictly weaker than Zen Mode, which also removes VS Code chrome and optionally enters OS fullscreen. Zen Mode gives the user their own configured chrome-hiding behavior for free.
- **Respect user's Zen Mode settings rather than overriding them.** Users who have customized `zenMode.*` already picked their preferred distraction-free experience; the extension should plug into that, not fight it.
- **Webview is uninvolved in the toggle.** The host runs the VS Code command. The webview only cares enough to render the button icon correctly, which it learns via a host → webview message. This eliminates the state-preservation risks that earlier drafts worried about (scroll, active heading, search overlay), because none of that state is touched.
- **Esc behavior decision deferred but constrained.** Zen Mode's native double-`Escape` is the cheapest path; a single-`Escape` keybinding is better UX but requires careful scoping. Planning will decide based on whether the extra keybinding introduces conflicts with search/keyboard-navigation.

## Dependencies / Assumptions

- `workbench.action.toggleZenMode` and `workbench.action.maximizeEditor` are stable VS Code built-in commands. No API risk.
- `activeWebviewPanelId` is a stable VS Code context key (documented in the Keybindings contribution point).
- `PreviewPanel` does not currently wire up `panel.webview.onDidReceiveMessage` (see `src/previewPanel.ts:14-21`). The existing `themeChanged` and `darkModeChanged` posts from the webview (`src/previewPanel.ts:981`, `:992`) are unreceived. Implementation of R3 must add this listener — a small prerequisite, not a risk.
- The in-flight keyboard-first-navigation feature (`docs/brainstorms/2026-04-15-keyboard-first-navigation-requirements.md`) may introduce its own `Escape` semantics. If R7 chooses option (b) and registers a single-`Escape` exit, coordination between the two features' `Escape` handlers is required.

## Outstanding Questions

### Deferred to Planning
- [Affects R2, R7][Product] Which default keybinding for toggle and for single-Escape exit? Candidates include `Cmd/Ctrl+Shift+Enter` for toggle; Escape-exit needs a `when` clause that yields to the in-webview search overlay.
- [Affects R3][Design] Icon source (Codicon via `codicon-fullscreen` / `codicon-screen-normal`, inline SVG, or Unicode glyph), placement in the `toolbar-right` cluster (left or right of the existing dark-toggle), aria-label/aria-pressed wiring, and whether the keybinding appears in the existing nav-hints strip.
- [Affects R5][Technical] Detect whether multiple editor groups are visible before invoking `maximizeEditor` (via `vscode.window.tabGroups.all.length`) to avoid a no-op on the common single-editor case.
- [Affects R7][Technical] Choose between native double-Escape (zero code, weaker UX) and registered single-Escape keybinding (small code, better UX, needs conflict audit).

## Next Steps

-> `/ce:plan` for structured implementation planning
