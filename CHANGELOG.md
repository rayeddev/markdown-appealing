# Changelog

## [0.7.0] - 2026-04-20

### Added
- Fullscreen reading mode: `Markdown Appealing: Toggle Fullscreen` command + floating button at the preview's bottom-right corner
- FAB shows expand/compress icon with a hint label (`Fullscreen` → `Esc Esc to exit`), per-mode contrast tuning, and accessible name
- Host ↔ webview message infrastructure (`onDidReceiveMessage`) — prerequisite for future host-driven UI updates

### Notes
- Fullscreen composes `workbench.action.toggleZenMode` rather than the HTML Fullscreen API, which is blocked by VS Code's webview sandbox. Respects your own `zenMode.*` settings.

## [0.6.0] - 2026-04-18

### Added
- GitHub-flavored alerts: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` (#23)
- Inline Octicon SVGs per alert type, shipped offline in the bundle
- Per-theme alert voices: soft tinted card (clean), magazine rules (editorial), dashed `[!TYPE]` box (terminal)
- Demo sample updated with a "Callouts & Alerts" section exercising all 5 types

### Fixed
- Terminal theme no longer prepends `NOTE ` to every regular blockquote (pre-existing styling bug replaced by real alert support)

## [0.5.1] - 2026-04-16

### Fixed
- Extension activation failure: bundled with esbuild so runtime dependencies ship inside the VSIX

## [0.5.0] - 2026-04-15

### Added
- Mermaid diagram rendering: fenced `mermaid` code blocks render as SVG diagrams
- Themed card container with light inner background for reliable dark/light mode display
- Per-diagram error handling with styled "Diagram syntax error" message
- Per-theme mermaid card styling matching each theme's design language
- External script loading via `asWebviewUri` for Mermaid.js
- `.vscodeignore` for optimized VSIX packaging
- Updated demo with frontmatter + 5 Mermaid diagram types

## [0.4.0] - 2026-04-15

### Added
- YAML frontmatter rendered as a clean metadata card at the top of the preview
- Two-column key-value layout with row separators and quote stripping
- Per-theme card styling: rounded clean, accent-bordered editorial, dashed monospace terminal

## [0.3.0] - 2026-04-15

### Added
- Vim-style keyboard navigation: j/k next/prev heading, gg/G first/last, [/] same-level siblings (#6)
- Visible cursor highlight on active heading across all themes
- Keyboard shortcut hint bar in toolbar
- `/` as search shortcut (avoids VS Code Cmd+K chord conflict)
- Cursor persists across re-renders via vscode.getState/setState
- Bidirectional sync between keyboard cursor and TOC sidebar

## [0.2.0] - 2026-04-14

### Added
- Font customization settings: body font, heading font, code font, body size, code size (#3)
- Live preview re-render on font setting changes

## [0.1.2] - 2026-04-14

### Fixed
- Dark mode toggle when switching themes

### Added
- GitHub issue templates for pipeline management
- CI release workflow via GitHub Actions

## [0.1.1] - 2026-04-09

### Added
- Extension icon
- MIT license
- Editor font family for code blocks

## [0.1.0] - 2026-04-09

### Added
- Rich themes: Paper, Notion, Terminal
- TOC sidebar with scroll-spy navigation
- Search within preview
- Frosted glass toolbar
- Dark/light mode toggle
- Code block copy button and line numbers
