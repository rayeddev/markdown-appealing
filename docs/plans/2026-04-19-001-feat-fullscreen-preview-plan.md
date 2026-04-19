---
title: 'feat: Fullscreen Preview'
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-fullscreen-preview-requirements.md
---

# feat: Fullscreen Preview

## Overview

Add a "fullscreen" mode to the markdown preview that hides VS Code's chrome (sidebar, activity bar, status bar, tabs) so the rendered document fills the window. Delivered by composing `workbench.action.toggleZenMode` from the extension host — the webview itself is untouched during the toggle. Triggerable from the Command Palette and from a new icon-button inside the preview's top-right toolbar. Esc exits via Zen Mode's native double-Escape.

## Problem Frame

The preview panel lives inside VS Code's editor chrome — tabs, sidebar, activity bar, and status bar all compete with the rendered document. Users reading long documents want a distraction-free view with a single action, and a single action to leave it. (Presentation-mode features — slide advance, speaker notes — are out of scope; see origin doc Scope Boundaries.)

A prior spike confirmed the HTML Fullscreen API is structurally blocked by VS Code's webview sandbox (see origin: `docs/brainstorms/2026-04-19-fullscreen-preview-requirements.md` "Spike Result"). The Zen Mode composition path delivers the same "distraction-free" goal with no webview changes, no state-preservation plumbing, and no platform risk.

## Requirements Trace

- R1. `markdownAppealing.toggleFullscreen` command, callable from the Command Palette; warns if no preview panel is open (origin R1).
- R2. Command is scoped via `activeWebviewPanelId == 'markdownAppealing.preview'` for any future keybinding contribution; no default keybinding in this plan (origin R2 — see Key Technical Decisions).
- R3. In-webview icon-button in the `toolbar-right` cluster, left of the existing dark-toggle, with aria-label and aria-pressed (origin R3).
- R4. Toggle invokes `workbench.action.toggleZenMode`; respects user's own `zenMode.*` settings rather than overriding them (origin R4).
- R5. Webview state (scroll, active heading, search, TOC, themes) is preserved trivially because the webview is never re-rendered, re-laid-out, or navigated by the toggle (origin R6).
- R6. Esc exits via Zen Mode's native double-Escape (origin R7 option (a) — see Key Technical Decisions).
- R7. Re-invoking the command (Command Palette or button) while in fullscreen also exits (origin R8).
- R8. Fullscreen is transient — each preview session starts windowed; no state persisted across VS Code restarts (origin R9).
- R9. Button icon reflects the current fullscreen state; synced via optimistic tracking in the host (origin R10 with documented limitation — see Key Technical Decisions).

## Scope Boundaries

- Not based on the HTML Fullscreen API — confirmed blocked (see origin Spike Result).
- No custom CSS overlay / `position: fixed` faux-fullscreen inside the webview.
- No presentation-mode features.
- No override of user's `zenMode.*` settings.
- No default keybinding contribution — user can bind via their own `keybindings.json`.
- No automatic `workbench.action.maximizeEditor` companion invocation in v1. If users report multi-split use cases, revisit.
- No observation of VS Code's `inZenMode` context for authoritative state sync — optimistic tracking only; the button may briefly show stale state if the user exits Zen Mode via Esc-Esc without re-entering through the extension (see Key Technical Decisions).

## Context & Research

### Relevant Code and Patterns

- [src/extension.ts:5-38](src/extension.ts#L5-L38) — command registration pattern. `openPreview`, `switchTheme`, `toggleDarkMode` all follow the same shape: register, guard on `PreviewPanel.currentPanel`, delegate. New command mirrors this exactly.
- [src/previewPanel.ts:14-21](src/previewPanel.ts#L14-L21) — `PreviewPanel` constructor. Does NOT currently wire up `panel.webview.onDidReceiveMessage`. Unit 1 adds this — prerequisite infrastructure.
- [src/previewPanel.ts:981-994](src/previewPanel.ts#L981-L994) — existing webview → host posts (`themeChanged`, `darkModeChanged`) that are currently unreceived. Adding `onDidReceiveMessage` is strictly additive and does not alter existing behavior (those posts have no current consumer).
- [src/previewPanel.ts:894-899](src/previewPanel.ts#L894-L899) — `toolbar-right` cluster in the webview HTML. Currently holds `theme-desc` span and `dark-toggle` button. Unit 3 inserts the fullscreen button between them (left of `dark-toggle`).
- [src/previewPanel.ts:249-277](src/previewPanel.ts#L249-L277) — `.dark-toggle` CSS shows the existing icon-button visual language (36×20 pill shape). The fullscreen button uses a different shape (square icon button) to visually distinguish a one-shot action from a two-state toggle — more in Unit 3.
- [src/previewPanel.ts:57-65](src/previewPanel.ts#L57-L65) — existing `setTheme` / `toggleDarkMode` methods on `PreviewPanel` use `this.panel.webview.postMessage(...)` for host → webview sync. Unit 2 follows the same pattern for `fullscreenChanged`.
- [package.json:24-37](package.json#L24-L37) — command contributes pattern. New command added alongside existing three.
- [package.json:72-79](package.json#L72-L79) — existing keybinding contribution. Not extended in this plan.

### Institutional Learnings

`docs/solutions/` is empty. No prior learnings to apply.

### External References

- VS Code built-in command `workbench.action.toggleZenMode` — stable, no version concerns. Respects user settings under `zenMode.*` (notably `zenMode.fullScreen`, default true on macOS/Windows: also enters OS fullscreen; `zenMode.restore`, default true: returns to prior layout on exit).
- VS Code context key `activeWebviewPanelId` — matches a panel's `viewType`. Ours is `'markdownAppealing.preview'` ([src/previewPanel.ts:9](src/previewPanel.ts#L9)).
- Spike evidence: `microsoft/vscode` issues #165073 (closed "not planned"), #110766 (backlog), #237030 (postMessage not a user gesture). See origin Spike Result for details.

## Key Technical Decisions

- **No default keybinding.** The four obvious chords each have a real cost: `F11` and `Cmd/Ctrl+Shift+F` collide with VS Code built-ins; `Cmd/Ctrl+Shift+Enter` has weak discoverability; a chord prefix like `Cmd/Ctrl+K F` asks users to learn a new multi-key sequence for a low-frequency action. Shipping with no default lets the Command Palette and button carry v1. If usage shows heavy adoption, pick a chord with real-world evidence later. The command still uses the correct `when` context key for any future binding.
- **Inline SVG icons over Codicons.** Codicons require loading a font + CSS into the webview (not available by default). Two inline SVGs (`expand` + `compress`, ~200B each, MIT-licensed) match the repo's existing GFM alert pattern and keep the bundle unchanged.
- **Button placement left of dark-toggle.** `toolbar-right` gains `fullscreen-btn` between `theme-desc` and `dark-toggle`. This keeps the dark-toggle as the rightmost control (unchanged visual anchor), groups state toggles together, and keeps the fullscreen button visually associated with the preview content rather than the chrome.
- **Optimistic state tracking, no authoritative `inZenMode` observation.** VS Code does not expose a clean `onDidChangeZenMode` event or a way to read context keys from an extension. Options considered: polling (gross), subscribing to window state (wrong signal), parsing VS Code settings (wrong signal). The pragmatic choice is for the host to track its own boolean — flipped on each `toggleFullscreen` invocation — and post `fullscreenChanged` to the webview. Known limitation: if the user exits Zen Mode via Esc-Esc without going through our command, the button's aria-pressed and icon will be stale until the next toggle. Accepted because (a) it self-corrects on next interaction, (b) the button still works to toggle correctly, (c) the alternative complexity is not worth it for a cosmetic state.
- **Native double-Escape exit, not a registered keybinding.** A VS Code-level `Escape` keybinding cannot inspect the webview's internal search-overlay state, so it would either capture Escape always (breaking search-close) or not be scoped correctly. Zen Mode's native double-Escape works everywhere and needs zero code. Cost: users press Esc twice instead of once. This is a small UX penalty that matches standard VS Code Zen Mode behavior.
- **No `workbench.action.maximizeEditor` companion in v1.** In a single-editor-group layout (the common case), it is a no-op. In a split layout, it may be useful or it may be undesired (user may want splits preserved). Ship the simpler version; add a decision point if real usage reveals the gap.
- **Command does not track preview focus beyond the `currentPanel` guard.** If a preview exists but the user's focus is in a terminal or other editor when invoking the command, the toggle still runs. This matches the behavior of `toggleDarkMode` and `switchTheme`, which operate on `PreviewPanel.currentPanel` regardless of focus.

## Open Questions

### Resolved During Planning

- **Which keybinding?** → None in v1. Command Palette + in-webview button. Revisit with usage data.
- **Icon source?** → Inline SVG (expand / compress glyphs), ~200B each, consistent with GFM alert icon pattern.
- **Button placement?** → `toolbar-right` cluster, between `theme-desc` and `dark-toggle` (left of dark-toggle).
- **Detect multi-group before maximizeEditor?** → Skip `maximizeEditor` entirely in v1.
- **Esc handling?** → Native double-Escape. No custom keybinding.
- **How to sync button state with Zen Mode?** → Optimistic tracking in host; post `fullscreenChanged` message after each command invocation. Known stale-state case documented.
- **onDidReceiveMessage wiring?** → Added in Unit 1 as infrastructure. Handles `toggleFullscreen` from webview; existing `themeChanged` / `darkModeChanged` posts become received (currently dropped — additive only).

### Deferred to Implementation

- Exact CSS pixel dimensions and border-radius for the fullscreen button — pick a size that matches `dark-toggle`'s visual weight during implementation.
- Exact SVG path data for the expand / compress icons — choose from an MIT-licensed set (Lucide, Octicons, Feather) and inline at implementation.
- Whether the existing `nav-hints` strip (j/k/gg/G/[/]//) needs a new hint for fullscreen — only if a keybinding is added in a later slice. For v1, no.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Message flow (both trigger paths resolve to the same host command):**

```mermaid
sequenceDiagram
    participant User
    participant Webview
    participant Host as Extension Host
    participant VSCode as VS Code

    Note over User,VSCode: Entry via in-webview button
    User->>Webview: click fullscreen-btn
    Webview->>Host: postMessage { type: 'toggleFullscreen' }
    Host->>VSCode: executeCommand('workbench.action.toggleZenMode')
    Host->>Host: isFullscreen = !isFullscreen
    Host->>Webview: postMessage { type: 'fullscreenChanged', fullscreen: true }
    Webview->>Webview: update button icon + aria-pressed

    Note over User,VSCode: Entry via Command Palette
    User->>Host: invoke markdownAppealing.toggleFullscreen
    Host->>VSCode: executeCommand('workbench.action.toggleZenMode')
    Host->>Host: isFullscreen = !isFullscreen
    Host->>Webview: postMessage { type: 'fullscreenChanged', fullscreen: true }
    Webview->>Webview: update button icon + aria-pressed

    Note over User,VSCode: Exit via native double-Escape
    User->>VSCode: Esc, Esc
    VSCode->>VSCode: exits Zen Mode
    Note right of Host: Host is unaware; button shows stale state until next toggle
```

**Host-side command pseudocode:**

```
command 'markdownAppealing.toggleFullscreen':
  if PreviewPanel.currentPanel is undefined:
    showWarningMessage("Open a preview first.")
    return
  PreviewPanel.currentPanel.toggleFullscreen()

PreviewPanel.toggleFullscreen():
  this.isFullscreen = !this.isFullscreen
  vscode.commands.executeCommand('workbench.action.toggleZenMode')
  this.panel.webview.postMessage({ type: 'fullscreenChanged', fullscreen: this.isFullscreen })
```

## Implementation Units

- [ ] **Unit 1: Wire up `onDidReceiveMessage` on the preview webview**

**Goal:** Add the host-side message listener so the webview can send typed messages back to the extension. This is strictly additive — existing unreceived posts (`themeChanged`, `darkModeChanged`) gain a receiver for the first time, which is a no-op for their current behavior.

**Requirements:** R1 prerequisite infrastructure

**Dependencies:** None

**Files:**
- Modify: `src/previewPanel.ts`
- Test: manual via Extension Development Host — no test runner in repo

**Approach:**
- In the `PreviewPanel` constructor (currently [src/previewPanel.ts:16-21](src/previewPanel.ts#L16-L21)), after the `onDidDispose` registration, add `this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables)`.
- Add a private `handleMessage(msg)` method that switches on `msg.type`. For this unit, include empty handlers (or `// reserved for future` comments) for the existing `themeChanged` and `darkModeChanged` types so they are acknowledged. Unit 2 adds the `toggleFullscreen` case.
- Do not change the webview-side `vscode.postMessage(...)` calls. The point of this unit is host-side only.

**Patterns to follow:**
- [src/previewPanel.ts:16-21](src/previewPanel.ts#L16-L21) — existing disposable registration pattern (push onto `this.disposables`).
- The switch-on-`msg.type` shape mirrors the webview's own `message.type` switches (e.g., [src/previewPanel.ts around the theme postMessage handler]).

**Test scenarios:** (manual — no test runner in repo)
- Happy path: open a preview, switch themes from the in-webview theme buttons — no errors in the Extension Development Host debug console (confirms `themeChanged` messages are now received without throwing).
- Happy path: toggle dark mode from the in-webview dark-toggle — no errors in debug console (confirms `darkModeChanged` messages are received).
- Edge case: send an unknown message type from the webview devtools console (`acquireVsCodeApi().postMessage({type:'nope'})`) — default case handles gracefully (no throw; optional debug log).

**Verification:**
- `npm run bundle` succeeds with no TypeScript errors.
- Reloading the Extension Development Host and exercising the existing theme + dark-toggle controls produces no new console errors.

---

- [ ] **Unit 2: Register `markdownAppealing.toggleFullscreen` command and host-side toggle logic**

**Goal:** Add the new command, wire it through `PreviewPanel`, and make it work end-to-end from the Command Palette. Button UI comes in Unit 3; this unit is complete when invoking the command from Cmd+Shift+P actually toggles Zen Mode.

**Requirements:** R1, R2, R4, R7, R8, R9

**Dependencies:** Unit 1

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/previewPanel.ts`
- Modify: `package.json`
- Test: manual via Extension Development Host

**Approach:**
- In `package.json` contributes.commands array, append a fourth entry: `{ "command": "markdownAppealing.toggleFullscreen", "title": "Markdown Appealing: Toggle Fullscreen" }`.
- In `src/extension.ts`, register the new command following the `toggleDarkMode` pattern ([src/extension.ts:30-37](src/extension.ts#L30-L37)): guard on `PreviewPanel.currentPanel` (warn if undefined), otherwise call `PreviewPanel.currentPanel.toggleFullscreen()`.
- On `PreviewPanel`, add a private `isFullscreen: boolean = false` field and a public `toggleFullscreen()` method that:
  1. Flips `this.isFullscreen`.
  2. Calls `vscode.commands.executeCommand('workbench.action.toggleZenMode')`.
  3. Posts `{ type: 'fullscreenChanged', fullscreen: this.isFullscreen }` to the webview.
- In Unit 1's `handleMessage` switch, add a case for `'toggleFullscreen'` that calls `this.toggleFullscreen()`. This wires the webview button (Unit 3) to the same code path.
- Do not contribute a keybinding in `package.json`.

**Patterns to follow:**
- [src/extension.ts:30-37](src/extension.ts#L30-L37) — `toggleDarkMode` command registration.
- [src/previewPanel.ts:62-65](src/previewPanel.ts#L62-L65) — `toggleDarkMode` method pattern (flip state, post message).
- [package.json:24-37](package.json#L24-L37) — commands array ordering; match the prefix style.

**Test scenarios:** (manual)
- Happy path: preview open, Cmd+Shift+P → "Markdown Appealing: Toggle Fullscreen" → VS Code enters Zen Mode (sidebar, activity bar, status bar, tabs all hidden). On macOS/Windows with default `zenMode.fullScreen: true`, OS fullscreen also activates.
- Happy path: invoke the command a second time → VS Code exits Zen Mode; chrome returns.
- Happy path: with a long document scrolled halfway, invoke the command → scroll position is preserved on enter AND on exit (webview is untouched).
- Happy path: with TOC open, active heading cursor on H3, invoke → TOC stays open, active heading cursor unchanged, keyboard-nav (j/k) still works inside Zen Mode.
- Error path: no preview open, Cmd+Shift+P → "Toggle Fullscreen" → VS Code shows warning "Open a preview first." (matches wording of `toggleDarkMode` / `switchTheme`).
- Edge case: user exits Zen Mode via Esc-Esc, then invokes the command again → the command toggles `isFullscreen` from its stale `true` to `false`, which calls `toggleZenMode` again — re-entering Zen Mode. Documented stale-state case. User re-invokes once more → exits normally. (This confirms the optimistic-tracking limitation but also that the button remains functional.)
- Integration: preview open, invoke command, edit the source .md file while in Zen Mode → webview live-reload fires (via existing `onDidChangeTextDocument` at [src/extension.ts:54-58](src/extension.ts#L54-L58)); Zen Mode is unaffected; preview updates in place.

**Verification:**
- Command appears in Cmd+Shift+P with the prefix "Markdown Appealing: Toggle Fullscreen".
- Invoking it toggles VS Code's Zen Mode.
- Warning path matches existing commands' wording.
- `npm run bundle` and `npm run lint` succeed.

---

- [ ] **Unit 3: In-webview fullscreen button with icon state sync**

**Goal:** Add the icon-button to `toolbar-right`, wire its click to `postMessage({type:'toggleFullscreen'})`, and update its icon + aria-pressed when the host posts `fullscreenChanged`.

**Requirements:** R3, R9

**Dependencies:** Unit 2

**Files:**
- Modify: `src/previewPanel.ts` (HTML markup, CSS, and webview JS — all inlined in `buildHtml()` per repo convention)
- Test: manual via Extension Development Host

**Approach:**
- **Markup:** In `toolbar-right` ([src/previewPanel.ts:894-899](src/previewPanel.ts#L894-L899)), insert a `<button class="fullscreen-btn" id="fullscreenBtn" aria-label="Enter fullscreen" aria-pressed="false" title="Enter fullscreen">{expand-svg}</button>` between the `theme-desc` span and the `dark-toggle` button.
- **CSS:** Add a `.fullscreen-btn` rule in the same `<style>` section as `.dark-toggle` ([src/previewPanel.ts:249](src/previewPanel.ts#L249) area). Square icon-button shape — approximately 24×24 or 28×28, `border: none`, `background: transparent`, rounded corners matching the toolbar aesthetic, `cursor: pointer`, hover-opacity transition mirroring `.toolbar-themes button:hover` ([src/previewPanel.ts:224](src/previewPanel.ts#L224)). SVG inherits `currentColor` from `--ink-soft` so it adapts to theme + dark/light automatically.
- **SVG:** Two inline SVGs embedded as template strings or template-literal constants near the top of `buildHtml`'s script block: `EXPAND_SVG` (four-corner-outward arrows) and `COMPRESS_SVG` (four-corner-inward arrows). 24×24 viewBox, single `<path>` or `<g>`, `fill="none" stroke="currentColor" stroke-width="2"` (matches typical stroke-icon systems).
- **Click handler:** Add to the script block near the existing `darkToggle.addEventListener('click', ...)` ([src/previewPanel.ts:986](src/previewPanel.ts#L986)). On click, just post `{type:'toggleFullscreen'}` — do NOT optimistically flip the icon. Wait for the host's echo to ensure button state tracks host state (even in the stale-state case, this keeps the local icon consistent with the host's view).
- **State sync:** Add a host→webview message handler in the existing `window.addEventListener('message', ...)` block (if one exists — check around [src/previewPanel.ts:1080-1100] for the current theme/darkMode message handling; extend it). On `{type:'fullscreenChanged', fullscreen:true|false}`: swap innerHTML between `EXPAND_SVG` / `COMPRESS_SVG`, update `aria-label` (`"Exit fullscreen"` / `"Enter fullscreen"`), update `aria-pressed` (`"true"` / `"false"`), update `title` to match aria-label.

**Patterns to follow:**
- [src/previewPanel.ts:896-898](src/previewPanel.ts#L896-L898) — button element construction inside `toolbar-right`.
- [src/previewPanel.ts:986-995](src/previewPanel.ts#L986-L995) — click handler + postMessage shape.
- [src/previewPanel.ts:249-277](src/previewPanel.ts#L249-L277) — toolbar button CSS conventions (transition timing, color variables).
- GFM alert inline-SVG pattern established in `src/markdownParser.ts` by the previous feature.

**Test scenarios:** (manual)
- Happy path: preview open, click the fullscreen-btn → enters Zen Mode; after the host's `fullscreenChanged` round-trip (<50ms), the icon swaps from expand to compress, aria-label becomes "Exit fullscreen", aria-pressed="true", title updates.
- Happy path: click again → exits Zen Mode; icon swaps back, aria attributes flip.
- Happy path: enter fullscreen via Command Palette, not the button → button icon still updates correctly (both paths call the same host `toggleFullscreen()` method which posts `fullscreenChanged`).
- Edge case: exit Zen Mode via Esc-Esc without clicking anything → button icon stays in the "compress" state (stale). Documented limitation. Click the button once → the host calls `toggleZenMode` a second time (re-entering Zen Mode from its POV), posts `fullscreenChanged: false`, icon swaps to expand. A second click exits cleanly. User-detectable, not-broken.
- Accessibility: inspect in devtools — fullscreen-btn has aria-label, aria-pressed, and title. Tab order includes it between theme-desc and dark-toggle.
- Theme compatibility: in each of the 3 themes (clean, editorial, terminal) × 2 modes (light, dark), the button's SVG is visible against the toolbar background. `currentColor` inheritance from `--ink-soft` should handle this, but verify on the terminal dark-mode combination specifically (that's the tightest contrast case).
- Integration: search overlay open (Cmd+K), click fullscreen-btn → enters Zen Mode; search overlay state unchanged; Esc still closes search first (because search-open state is owned by the webview and untouched by Zen Mode).
- Integration: with keyboard-nav active heading on an H3, click fullscreen-btn → active heading cursor unchanged on enter and on exit.

**Verification:**
- Button is visible in `toolbar-right` left of `dark-toggle` in all 3 themes × 2 modes.
- Icon swaps correctly on entering and exiting fullscreen via either trigger.
- aria-pressed and aria-label update in sync with the icon.
- No new console errors or layout regressions in the toolbar.
- `npm run bundle` and `npm run lint` succeed.

## System-Wide Impact

- **Interaction graph:** Adds one new host↔webview message round trip (`toggleFullscreen` webview→host, `fullscreenChanged` host→webview). The existing `themeChanged` / `darkModeChanged` posts are now *received* for the first time; handlers are no-ops to preserve current behavior but future work can extend them (e.g., persist theme across reopens).
- **Error propagation:** `executeCommand('workbench.action.toggleZenMode')` returns a promise; failure is rare (command is always registered) and not recoverable from the extension's side. Unhandled rejection is acceptable — will surface in the Extension Development Host console during development.
- **State lifecycle risks:** Host's `isFullscreen` boolean can drift from VS Code's actual Zen Mode state if the user exits via Esc-Esc. Documented and accepted. No partial-write or persistence risk because state is transient.
- **API surface parity:** The `toggleFullscreen` command follows the same guard-on-`currentPanel` pattern as `toggleDarkMode` and `switchTheme`. No new patterns introduced.
- **Integration coverage:** Two cross-layer scenarios worth explicitly verifying — (1) search overlay + fullscreen interaction (both own `Escape` in different scopes), and (2) text-change re-render while in Zen Mode (the preview's existing live-reload must not break the Zen Mode session). Both are covered in Unit 2's test scenarios.
- **Unchanged invariants:** Webview's scroll position, active-heading cursor, theme, dark-mode, search state, TOC open/collapsed state, and frontmatter card are all untouched by this feature. The DOM is not mutated; no re-render is triggered; no postMessage is sent that would cause the webview to rebuild anything. The single webview change is the button element's `innerHTML`, `aria-label`, `aria-pressed`, and `title` attributes on fullscreen state change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| User's `zenMode.*` settings produce an unexpected UX (e.g., `zenMode.fullScreen: false` + `zenMode.hideLineNumbers: false`) | Accepted — we compose, not override. Document in command description that the feature respects user Zen Mode settings. |
| Stale button state after Esc-Esc exit | Accepted with documented limitation. Self-corrects on next toggle. |
| VS Code changes `workbench.action.toggleZenMode` behavior in a future version | Very low — it's a core command. Fallback: if renamed, the command fails at invoke time with a clear error. |
| SVG icon doesn't render distinctly in terminal dark-mode | Verify visually during Unit 3. If contrast is insufficient, bump `stroke-width` or add a per-theme `--fullscreen-btn-color` variable. |
| Re-render during Zen Mode causes visual jank | Existing live-reload replaces `panel.webview.html` on every text change. Needs visual verification (Unit 2 integration test). If jank surfaces, a future slice can gate re-render. Not expected to block this plan. |

## Documentation / Operational Notes

- README: add one line under the feature list — "Toggle fullscreen reading mode with a click or from the Command Palette."
- CHANGELOG: next release entry notes the new command and button.
- No migration, no config, no monitoring changes.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-fullscreen-preview-requirements.md](docs/brainstorms/2026-04-19-fullscreen-preview-requirements.md)
- Related code: `src/extension.ts`, `src/previewPanel.ts`, `package.json`
- Prior plan convention: [docs/plans/2026-04-18-001-feat-github-alerts-plan.md](docs/plans/2026-04-18-001-feat-github-alerts-plan.md)
- External: VS Code issues `microsoft/vscode#165073`, `#110766`, `#237030` (grounding the spike result that forced the Zen Mode pivot)
