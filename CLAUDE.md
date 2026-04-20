# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm run bundle         # esbuild bundle → dist/extension.js (what the extension actually runs)
npm run watch:bundle   # bundle in watch mode
npm run compile        # tsc typecheck → out/ (diagnostics only; NOT used at runtime)
npm run watch          # tsc watch (diagnostics only)
npm run lint           # ESLint on src/
```

**Important:** `package.json` `main` points at `dist/extension.js`. `npm run compile` only produces `out/` for type checking and is not loaded by the extension. After editing `src/**`, run `npm run bundle` (or keep `watch:bundle` running) and reload the Extension Development Host (`Cmd+R`) to pick up changes. Theme CSS files in `themes/` are read from disk at runtime, so CSS edits do not need a rebuild — just reopen the preview.

Press **F5** in VS Code to launch the Extension Development Host (uses `.vscode/launch.json`).

## Architecture

This is a VS Code extension that provides a rich markdown preview via a webview panel.

**Data flow:** `extension.ts` registers commands and listens for editor changes → calls `PreviewPanel.update()` → `markdownParser.ts` converts markdown to HTML + TOC via markdown-it → `previewPanel.ts` builds the full webview HTML by inlining theme CSS files and embedding all JS directly in the HTML string.

**Key design decisions:**
- All webview HTML, CSS, and JS is constructed as a single template string in `previewPanel.ts:buildHtml()`. There are no separate HTML/JS files for the webview.
- Theme CSS files in `themes/` are read from disk and inlined into `<style>` tags. All three themes are always loaded; `data-theme` and `data-mode` attributes on `<html>` control which one is active via CSS specificity.
- Dark/light mode uses explicit `[data-mode="dark"]` / `[data-mode="light"]` CSS selectors per theme. On load, the mode is detected from VS Code's `activeColorTheme.kind`.
- The markdown-it fence renderer is overridden to wrap code blocks with a copy button header and line number gutter (visible only in terminal theme via CSS).
- TOC is built as a hierarchical tree in `buildTocHtml()`, with scroll-spy via IntersectionObserver in the webview JS.
- `PreviewPanel` is a singleton — only one preview panel exists at a time.
- Code blocks use the user's VS Code `editor.fontFamily` setting, injected as a CSS variable `--editor-font`.

**Theme CSS structure:** Each theme file defines variables under `[data-theme="X"][data-mode="light"]`, `[data-theme="X"][data-mode="dark"]`, and `@media (prefers-color-scheme)` for the system-default case. Themes also define element-specific styles (e.g., terminal adds `::before` content to headings).

## Documented Solutions

`docs/solutions/` — documented best practices and patterns (markdown-it rules, theme system, webview), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.

## Commits

Keep commit messages short and scannable.
