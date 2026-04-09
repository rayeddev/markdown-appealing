import * as vscode from 'vscode';
import { parseMarkdown } from './markdownParser';
import { ThemeManager } from './themeManager';
import * as path from 'path';
import * as fs from 'fs';

export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;
  private static readonly viewType = 'markdownAppealing.preview';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionPath: string;
  private readonly themeManager: ThemeManager;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
    this.panel = panel;
    this.extensionPath = extensionPath;
    this.themeManager = new ThemeManager();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(context: vscode.ExtensionContext, document: vscode.TextDocument) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel.panel.reveal(column);
      PreviewPanel.currentPanel.update(document);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      'Markdown Preview',
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'themes')),
          vscode.Uri.file(path.join(context.extensionPath, 'media')),
        ],
      },
    );

    PreviewPanel.currentPanel = new PreviewPanel(panel, context.extensionPath);
    PreviewPanel.currentPanel.update(document);
  }

  public update(document: vscode.TextDocument) {
    const source = document.getText();
    const { html, toc } = parseMarkdown(source);
    this.panel.title = `Preview: ${path.basename(document.fileName)}`;
    this.panel.webview.html = this.buildHtml(html, toc);
  }

  public setTheme(name: string) {
    this.themeManager.setTheme(name);
    this.panel.webview.postMessage({ type: 'setTheme', theme: this.themeManager.getTheme() });
  }

  public toggleDarkMode() {
    const mode = this.themeManager.toggleDarkMode();
    this.panel.webview.postMessage({ type: 'setDarkMode', darkMode: mode });
  }

  private loadThemeCss(name: string): string {
    const themePath = path.join(this.extensionPath, 'themes', `${name}.css`);
    try {
      return fs.readFileSync(themePath, 'utf-8');
    } catch {
      return '';
    }
  }

  private buildHtml(
    bodyHtml: string,
    toc: { level: number; id: string; text: string }[],
  ): string {
    const cleanCss = this.loadThemeCss('clean');
    const editorialCss = this.loadThemeCss('editorial');
    const terminalCss = this.loadThemeCss('terminal');

    // Read VS Code's editor font for code blocks
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const editorFontFamily = editorConfig.get<string>('fontFamily') ?? '';
    const editorFontSize = editorConfig.get<number>('fontSize') ?? 14;

    const currentTheme = this.themeManager.getTheme();
    const darkMode = this.themeManager.isDark();
    const darkModeAttr =
      darkMode === null ? '' : darkMode ? 'data-mode="dark"' : 'data-mode="light"';

    const tocHtml = this.buildTocHtml(toc);
    const tocCount = toc.length;

    return /*html*/ `<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}" ${darkModeAttr}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* ===== Base reset ===== */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --sidebar-width: 240px;
      --content-max-width: 100%;
      --pad: 2rem 3.5rem;
      --editor-font: ${editorFontFamily || "'SF Mono', Consolas, monospace"};
      --editor-font-size: ${editorFontSize * 0.92}px;
    }

    html, body { height: 100%; }

    body {
      display: flex;
      font-size: 15px;
      line-height: 1.7;
      overflow: hidden;
      background: var(--bg);
      color: var(--ink-body);
      transition: background 0.3s, color 0.3s;
    }

    /* ===== Scrollbar ===== */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--accent-dim); border-radius: 3px; }

    /* ===== Content ===== */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: var(--pad);
      padding-top: 0;
      background: var(--bg);
      color: var(--ink-body);
    }

    .content-inner {
      max-width: var(--content-max-width);
      margin: 0 auto;
      padding-top: 8px;
      padding-bottom: 100px;
    }

    /* ===== Frosted Toolbar ===== */
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 10px 24px;
      background: color-mix(in srgb, var(--bg) 80%, transparent);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      transition: background 0.3s;
    }

    .toolbar-themes {
      display: flex;
      gap: 6px;
    }

    .toolbar-themes button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--ink-soft);
      cursor: pointer;
      font-size: 0.76rem;
      font-weight: 600;
      font-family: var(--font-sans, -apple-system, sans-serif);
      transition: all 0.2s;
    }

    .toolbar-themes button:hover { opacity: 0.85; }

    .toolbar-themes button.active {
      background: var(--accent-bg);
      border-color: var(--accent-border);
      color: var(--accent);
    }

    .toolbar-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .theme-desc {
      font-size: 0.72rem;
      color: var(--ink-soft);
      font-style: italic;
      max-width: 200px;
      text-align: right;
      line-height: 1.3;
      font-family: var(--font-sans, -apple-system, sans-serif);
    }

    /* Dark mode toggle switch */
    .dark-toggle {
      width: 36px;
      height: 20px;
      border-radius: 10px;
      border: none;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
      background: var(--accent-border);
    }

    .dark-toggle.is-light { background: var(--accent); }

    .dark-toggle .toggle-knob {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      position: absolute;
      top: 2px;
      left: 2px;
      background: var(--ink-soft);
      transition: left 0.2s, background 0.2s;
    }

    .dark-toggle.is-light .toggle-knob {
      left: 18px;
      background: #fff;
    }

    /* ===== Sidebar ===== */
    .sidebar {
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      height: 100vh;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px 4px 32px 0;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      transition: width 0.3s ease, min-width 0.3s ease, background 0.3s;
    }

    .sidebar.collapsed {
      width: 44px;
      min-width: 44px;
    }

    /* Sidebar header */
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding: 0 8px 0 16px;
    }

    .sidebar-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sidebar-label {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--ink-soft);
      font-family: var(--font-sans, -apple-system, sans-serif);
    }

    /* Progress bar */
    .progress-track {
      width: 32px;
      height: 3px;
      border-radius: 2px;
      background: var(--border);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 2px;
      background: var(--accent);
      transition: width 0.3s ease;
    }

    /* Collapse button */
    .sidebar-toggle {
      background: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ink-soft);
      font-size: 0.7rem;
      font-family: var(--font-sans, -apple-system, sans-serif);
      flex-shrink: 0;
      transition: all 0.2s;
    }

    .sidebar-toggle:hover { background: var(--hover-bg); }

    /* TOC tree */
    .toc-tree { padding-left: 8px; }

    .toc-node { position: relative; }

    .toc-link {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      padding: 5px 12px;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      text-decoration: none;
      color: var(--ink-soft);
      font-family: var(--font-sans, -apple-system, sans-serif);
    }

    .toc-link:hover { background: var(--hover-bg); }

    .toc-link.active {
      background: var(--accent-bg);
    }

    /* Active bar indicator */
    .toc-link.active::before {
      content: "";
      position: absolute;
      left: 0;
      top: 4px;
      bottom: 4px;
      width: 2.5px;
      border-radius: 2px;
      background: var(--accent);
    }

    /* Dot indicator */
    .toc-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--border);
      flex-shrink: 0;
      transition: all 0.25s;
    }

    .toc-link.active .toc-dot {
      width: 7px;
      height: 7px;
      background: var(--accent);
      box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 30%, transparent);
    }

    .toc-link.parent-active .toc-dot {
      background: var(--accent-dim);
    }

    .toc-text {
      font-size: 0.78rem;
      font-weight: 400;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: color 0.2s;
    }

    .toc-link.active .toc-text {
      font-weight: 700;
      color: var(--accent);
    }

    .toc-link.parent-active .toc-text {
      color: var(--ink);
    }

    .toc-depth-0 .toc-text { font-size: 0.78rem; font-weight: 600; }
    .toc-depth-1 { padding-left: 28px; }
    .toc-depth-1 .toc-text { font-size: 0.73rem; }
    .toc-depth-2 { padding-left: 44px; }
    .toc-depth-2 .toc-text { font-size: 0.73rem; }
    .toc-depth-3 { padding-left: 60px; }
    .toc-depth-3 .toc-text { font-size: 0.7rem; }

    /* Tree connector lines */
    .toc-children {
      position: relative;
    }

    .toc-children::before {
      content: "";
      position: absolute;
      left: 25px;
      top: 0;
      bottom: 8px;
      width: 1px;
      background: var(--border);
    }

    .toc-depth-1 + .toc-children::before { left: 41px; }

    /* Collapsed mini dots */
    .collapsed-dots {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
    }

    .collapsed-dot {
      border-radius: 50%;
      background: var(--border);
      border: none;
      cursor: pointer;
      padding: 0;
      transition: all 0.25s;
    }

    .collapsed-dot.active {
      background: var(--accent);
      box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 30%, transparent);
    }

    /* ===== Typography defaults ===== */
    .content-inner h1, .content-inner h2, .content-inner h3,
    .content-inner h4, .content-inner h5, .content-inner h6 {
      margin-top: 1.8em;
      margin-bottom: 0.6em;
      line-height: 1.3;
      color: var(--ink);
      scroll-margin-top: 64px;
    }

    .content-inner h1 { font-size: 2em; }
    .content-inner h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    .content-inner h3 { font-size: 1.25em; }

    .content-inner p {
      margin-bottom: 1em;
      color: var(--ink-body);
      font-family: var(--font-body, inherit);
    }

    .content-inner a { color: var(--link); text-decoration: underline; }

    .content-inner ul, .content-inner ol { margin-bottom: 1em; padding-left: 1.5em; }
    .content-inner li { margin-bottom: 0.25em; color: var(--ink-body); }

    .content-inner blockquote {
      border-left: 4px solid var(--accent);
      padding: 0.5em 1em;
      margin: 1em 0;
      color: var(--ink-body);
      background: var(--blockquote-bg);
      border-radius: 0 4px 4px 0;
    }

    .content-inner code {
      font-family: var(--editor-font), var(--font-mono, monospace);
      background: var(--code-bg);
      padding: 0.15em 0.4em;
      border-radius: 3px;
      font-size: 0.9em;
    }

    .content-inner pre {
      margin: 0;
      padding: 12px 16px;
      font-family: var(--editor-font), var(--font-mono, monospace);
      font-size: var(--editor-font-size, 0.84rem);
      line-height: 1.75;
      color: var(--ink-body);
      overflow-x: auto;
      flex: 1;
    }

    .content-inner pre code {
      background: none;
      padding: 0;
      border: none;
      font-size: inherit;
      line-height: inherit;
    }

    /* ===== Code block wrapper ===== */
    .code-block-wrapper {
      margin: 1.5em 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--surface-elevated);
    }

    .code-block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 14px;
      border-bottom: 1px solid var(--border);
    }

    .code-lang {
      font-size: 0.72rem;
      font-weight: 500;
      color: var(--ink-soft);
    }

    .code-copy-btn {
      background: none;
      border: none;
      font-size: 0.7rem;
      color: var(--ink-soft);
      cursor: pointer;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.2s;
    }

    .code-copy-btn:hover { color: var(--accent); }
    .code-copy-btn.copied { color: var(--accent); }

    .code-block-body {
      display: block;
    }

    /* Line numbers — hidden by default, shown per theme */
    .code-line-numbers {
      display: none;
    }

    /* ===== Tables ===== */
    .content-inner table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      font-size: 0.92em;
    }

    .content-inner th, .content-inner td {
      border: 1px solid var(--border);
      padding: 0.55em 0.9em;
      text-align: left;
    }

    .content-inner th {
      background: var(--th-bg);
      font-weight: 600;
    }

    .content-inner tr:nth-child(even) { background: var(--tr-even-bg); }

    .content-inner img {
      max-width: 100%;
      border-radius: 6px;
      margin: 0.5em 0;
    }

    .content-inner hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2em 0;
    }

    .content-inner strong { color: var(--ink); }

    /* ===== Search overlay ===== */
    .search-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      z-index: 100;
      justify-content: center;
      padding-top: 20vh;
    }

    .search-overlay.open { display: flex; }

    .search-box {
      width: 480px;
      max-width: 90vw;
      background: var(--bg);
      border: 1px solid var(--accent-border);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.3);
      overflow: hidden;
      height: fit-content;
    }

    .search-input-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }

    .search-icon {
      color: var(--accent);
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      font-size: 0.95rem;
      color: var(--ink);
      font-family: var(--font-sans, -apple-system, sans-serif);
    }

    .search-input::placeholder { color: var(--ink-soft); }

    .search-meta {
      font-size: 0.72rem;
      color: var(--ink-soft);
      font-family: var(--font-sans, -apple-system, sans-serif);
      white-space: nowrap;
    }

    .search-nav {
      display: flex;
      gap: 2px;
    }

    .search-nav button {
      background: none;
      border: 1px solid var(--border);
      border-radius: 4px;
      width: 24px;
      height: 24px;
      cursor: pointer;
      color: var(--ink-soft);
      font-size: 0.7rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .search-nav button:hover { background: var(--hover-bg); color: var(--ink); }

    .search-hint {
      padding: 8px 16px;
      font-size: 0.7rem;
      color: var(--ink-soft);
      font-family: var(--font-sans, -apple-system, sans-serif);
    }

    .search-hint kbd {
      display: inline-block;
      padding: 1px 5px;
      border: 1px solid var(--border);
      border-radius: 3px;
      font-size: 0.65rem;
      font-family: var(--font-mono, monospace);
      background: var(--surface-elevated, var(--bg-subtle));
    }

    /* Highlight matches */
    mark.search-match {
      background: var(--accent-bg);
      border: 1px solid var(--accent-border);
      border-radius: 2px;
      color: inherit;
      padding: 0 1px;
    }

    mark.search-match.current {
      background: var(--accent);
      color: var(--bg);
      border-color: var(--accent);
    }

    /* ===== Transitions ===== */
    button { transition: all 0.2s; }
    button:hover { opacity: 0.85; }
  </style>

  <!-- Theme styles -->
  <style id="theme-clean">${cleanCss}</style>
  <style id="theme-editorial">${editorialCss}</style>
  <style id="theme-terminal">${terminalCss}</style>
</head>
<body>
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-header-left" id="sidebarHeaderLeft">
        <span class="sidebar-label">On this page</span>
        <div class="progress-track">
          <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>
      </div>
      <button class="sidebar-toggle" id="sidebarToggle" title="Toggle navigation">&#9776;</button>
    </div>
    <div class="toc-tree" id="tocTree">
      ${tocHtml}
    </div>
    <div class="collapsed-dots" id="collapsedDots" style="display: none;"></div>
  </nav>

  <main class="content" id="contentArea">
    <div class="toolbar">
      <div class="toolbar-themes">
        <button data-theme="clean" class="${currentTheme === 'clean' ? 'active' : ''}">&#10022; Clean</button>
        <button data-theme="editorial" class="${currentTheme === 'editorial' ? 'active' : ''}">&#128214; Editorial</button>
        <button data-theme="terminal" class="${currentTheme === 'terminal' ? 'active' : ''}">&#9000; Terminal</button>
      </div>
      <div class="toolbar-right">
        <span class="theme-desc" id="themeDesc">${this.getThemeDesc(currentTheme)}</span>
        <button class="dark-toggle ${darkMode === false ? 'is-light' : ''}" id="darkToggle">
          <div class="toggle-knob"></div>
        </button>
      </div>
    </div>
    <div class="content-inner">
      ${bodyHtml}
    </div>
  </main>

  <!-- Search overlay -->
  <div class="search-overlay" id="searchOverlay">
    <div class="search-box">
      <div class="search-input-row">
        <span class="search-icon">&#128269;</span>
        <input class="search-input" id="searchInput" type="text" placeholder="Search in document..." autocomplete="off" spellcheck="false" />
        <span class="search-meta" id="searchMeta"></span>
        <div class="search-nav">
          <button id="searchPrev" title="Previous (Shift+Enter)">&#9650;</button>
          <button id="searchNext" title="Next (Enter)">&#9660;</button>
        </div>
      </div>
      <div class="search-hint">
        <kbd>Enter</kbd> next &nbsp; <kbd>Shift+Enter</kbd> prev &nbsp; <kbd>Esc</kbd> close
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const html = document.documentElement;
    const contentArea = document.getElementById('contentArea');
    const sidebar = document.getElementById('sidebar');
    const tocTree = document.getElementById('tocTree');
    const collapsedDots = document.getElementById('collapsedDots');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarHeaderLeft = document.getElementById('sidebarHeaderLeft');
    const progressFill = document.getElementById('progressFill');
    const themeDesc = document.getElementById('themeDesc');
    const darkToggle = document.getElementById('darkToggle');

    const THEME_DESCS = {
      clean: 'Airy minimalism for distraction-free reading',
      editorial: 'Magazine-grade typography for long reads',
      terminal: 'Hacker-native. Built for code-heavy docs',
    };

    let isCollapsed = false;
    const tocCount = ${tocCount};

    // ===== Copy code =====
    window.copyCode = function(btn) {
      const wrapper = btn.closest('.code-block-wrapper');
      const pre = wrapper.querySelector('pre');
      const text = pre.textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.textContent = 'Copied';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.textContent = 'Copy';
        }, 1500);
      });
    };

    // ===== Theme switching via toolbar =====
    document.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        html.setAttribute('data-theme', theme);
        document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        themeDesc.textContent = THEME_DESCS[theme] || '';
        vscode.postMessage({ type: 'themeChanged', theme });
      });
    });

    // ===== Dark mode toggle =====
    darkToggle.addEventListener('click', () => {
      const current = html.getAttribute('data-mode');
      let next;
      if (!current) { next = 'dark'; }
      else if (current === 'dark') { next = 'light'; }
      else { next = null; }

      if (next) {
        html.setAttribute('data-mode', next);
      } else {
        html.removeAttribute('data-mode');
      }

      darkToggle.classList.toggle('is-light', next === 'light');

      vscode.postMessage({
        type: 'darkModeChanged',
        darkMode: next === 'dark' ? true : next === 'light' ? false : null,
      });
    });

    // ===== Sidebar collapse/expand =====
    sidebarToggle.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      sidebar.classList.toggle('collapsed', isCollapsed);
      tocTree.style.display = isCollapsed ? 'none' : '';
      sidebarHeaderLeft.style.display = isCollapsed ? 'none' : '';
      collapsedDots.style.display = isCollapsed ? 'flex' : 'none';
      sidebarToggle.innerHTML = isCollapsed ? '&#9776;' : '&#10005;';
      sidebarToggle.title = isCollapsed ? 'Show navigation' : 'Hide navigation';
    });

    // ===== IntersectionObserver for scroll spy =====
    const headings = document.querySelectorAll('.content-inner h1, .content-inner h2, .content-inner h3, .content-inner h4');
    let activeId = '';

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          const newId = visible[0].target.id;
          if (newId && newId !== activeId) {
            activeId = newId;
            updateTocActive(newId);
            updateProgress(newId);
            updateCollapsedDots(newId);
          }
        }
      },
      { rootMargin: '-60px 0px -70% 0px', threshold: 0.1 }
    );

    headings.forEach(h => { if (h.id) observer.observe(h); });

    // Init active to first heading
    if (headings.length > 0 && headings[0].id) {
      activeId = headings[0].id;
      updateTocActive(activeId);
    }

    function updateTocActive(id) {
      document.querySelectorAll('.toc-link').forEach(link => {
        const linkId = link.getAttribute('data-id');
        const isActive = linkId === id;
        link.classList.toggle('active', isActive);
        // parent-active: check if any descendant is active
        link.classList.remove('parent-active');
      });
      // Mark parent nodes
      const activeLink = document.querySelector('.toc-link[data-id="' + id + '"]');
      if (activeLink) {
        let parent = activeLink.parentElement;
        while (parent && parent !== tocTree) {
          if (parent.classList.contains('toc-node')) {
            const parentLink = parent.querySelector(':scope > .toc-link');
            if (parentLink && !parentLink.classList.contains('active')) {
              parentLink.classList.add('parent-active');
            }
          }
          parent = parent.parentElement;
        }
      }
    }

    function updateProgress(id) {
      const allIds = Array.from(headings).map(h => h.id).filter(Boolean);
      const idx = allIds.indexOf(id);
      const pct = allIds.length > 1 ? (idx / (allIds.length - 1)) * 100 : 0;
      progressFill.style.width = pct + '%';
    }

    // Build collapsed dots
    (function buildCollapsedDots() {
      const topLevel = Array.from(headings).filter(h => {
        const level = parseInt(h.tagName[1]);
        return level <= 2;
      });
      collapsedDots.innerHTML = topLevel.map(h => {
        const title = h.textContent.replace(/[*\`]/g, '');
        return '<button class="collapsed-dot" data-id="' + h.id + '" style="width:4px;height:4px;" title="' + title.replace(/"/g, '&quot;') + '"></button>';
      }).join('');

      collapsedDots.addEventListener('click', (e) => {
        const dot = e.target.closest('.collapsed-dot');
        if (!dot) return;
        const id = dot.getAttribute('data-id');
        navigateTo(id);
      });
    })();

    function updateCollapsedDots(id) {
      document.querySelectorAll('.collapsed-dot').forEach(dot => {
        const isActive = dot.getAttribute('data-id') === id;
        dot.classList.toggle('active', isActive);
        dot.style.width = isActive ? '8px' : '4px';
        dot.style.height = isActive ? '8px' : '4px';
      });
    }

    // ===== Smooth scroll for TOC links =====
    function navigateTo(id) {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    tocTree.addEventListener('click', (e) => {
      const link = e.target.closest('.toc-link');
      if (!link) return;
      e.preventDefault();
      const id = link.getAttribute('data-id');
      if (id) navigateTo(id);
    });

    // ===== Search =====
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    const searchMeta = document.getElementById('searchMeta');
    const searchPrev = document.getElementById('searchPrev');
    const searchNext = document.getElementById('searchNext');
    const contentInner = document.querySelector('.content-inner');

    let searchMatches = [];
    let currentMatchIdx = -1;
    let originalContentHtml = contentInner.innerHTML;

    function openSearch() {
      // Snapshot content before highlighting
      originalContentHtml = contentInner.innerHTML;
      // Remove any leftover marks
      clearHighlights();
      searchOverlay.classList.add('open');
      searchInput.value = '';
      searchMeta.textContent = '';
      searchInput.focus();
    }

    function closeSearch() {
      searchOverlay.classList.remove('open');
      clearHighlights();
      searchMatches = [];
      currentMatchIdx = -1;
      searchMeta.textContent = '';
    }

    function clearHighlights() {
      document.querySelectorAll('mark.search-match').forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      });
    }

    function performSearch(query) {
      clearHighlights();
      searchMatches = [];
      currentMatchIdx = -1;

      if (!query || query.length < 2) {
        searchMeta.textContent = '';
        return;
      }

      // Walk text nodes and wrap matches
      const walker = document.createTreeWalker(contentInner, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      while (walker.nextNode()) {
        // Skip nodes inside code blocks, search box, etc.
        const parent = walker.currentNode.parentElement;
        if (parent && (parent.closest('.code-block-header') || parent.closest('.search-overlay'))) continue;
        textNodes.push(walker.currentNode);
      }

      const lowerQuery = query.toLowerCase();

      textNodes.forEach(node => {
        const text = node.textContent;
        const lowerText = text.toLowerCase();
        let idx = lowerText.indexOf(lowerQuery);
        if (idx === -1) return;

        const frag = document.createDocumentFragment();
        let lastIdx = 0;

        while (idx !== -1) {
          if (idx > lastIdx) {
            frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
          }
          const mark = document.createElement('mark');
          mark.className = 'search-match';
          mark.textContent = text.slice(idx, idx + query.length);
          frag.appendChild(mark);
          searchMatches.push(mark);
          lastIdx = idx + query.length;
          idx = lowerText.indexOf(lowerQuery, lastIdx);
        }

        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        }

        node.parentNode.replaceChild(frag, node);
      });

      if (searchMatches.length > 0) {
        currentMatchIdx = 0;
        highlightCurrent();
      }

      searchMeta.textContent = searchMatches.length > 0
        ? (currentMatchIdx + 1) + ' / ' + searchMatches.length
        : 'No results';
    }

    function highlightCurrent() {
      searchMatches.forEach((m, i) => {
        m.classList.toggle('current', i === currentMatchIdx);
      });
      if (searchMatches[currentMatchIdx]) {
        searchMatches[currentMatchIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      searchMeta.textContent = (currentMatchIdx + 1) + ' / ' + searchMatches.length;
    }

    function nextMatch() {
      if (searchMatches.length === 0) return;
      currentMatchIdx = (currentMatchIdx + 1) % searchMatches.length;
      highlightCurrent();
    }

    function prevMatch() {
      if (searchMatches.length === 0) return;
      currentMatchIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
      highlightCurrent();
    }

    // Debounce search input
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => performSearch(searchInput.value), 200);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSearch(); return; }
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); prevMatch(); return; }
      if (e.key === 'Enter') { e.preventDefault(); nextMatch(); return; }
    });

    searchPrev.addEventListener('click', prevMatch);
    searchNext.addEventListener('click', nextMatch);

    // Close on overlay click (not box)
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) closeSearch();
    });

    // Cmd+K / Ctrl+K to open search
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchOverlay.classList.contains('open')) {
          closeSearch();
        } else {
          openSearch();
        }
      }
      if (e.key === 'Escape' && searchOverlay.classList.contains('open')) {
        closeSearch();
      }
    });

    // ===== Handle messages from extension =====
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type === 'setTheme') {
        html.setAttribute('data-theme', msg.theme);
        document.querySelectorAll('[data-theme]').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-theme') === msg.theme);
        });
        themeDesc.textContent = THEME_DESCS[msg.theme] || '';
      } else if (msg.type === 'setDarkMode') {
        if (msg.darkMode === null) {
          html.removeAttribute('data-mode');
        } else {
          html.setAttribute('data-mode', msg.darkMode ? 'dark' : 'light');
        }
        darkToggle.classList.toggle('is-light', msg.darkMode === false);
      }
    });
  </script>
</body>
</html>`;
  }

  private getThemeDesc(theme: string): string {
    const descs: Record<string, string> = {
      clean: 'Airy minimalism for distraction-free reading',
      editorial: 'Magazine-grade typography for long reads',
      terminal: 'Hacker-native. Built for code-heavy docs',
    };
    return descs[theme] ?? '';
  }

  private buildTocHtml(toc: { level: number; id: string; text: string }[]): string {
    if (toc.length === 0) {
      return '<p style="font-size:0.8rem;color:var(--ink-soft);padding:0 16px;">No headings found</p>';
    }

    // Build hierarchical tree
    interface TocNode {
      id: string;
      text: string;
      level: number;
      children: TocNode[];
    }

    const root: TocNode[] = [];
    const stack: { children: TocNode[]; level: number }[] = [{ children: root, level: 0 }];

    for (const entry of toc) {
      if (entry.level > 4) continue;
      const node: TocNode = { ...entry, children: [] };
      while (stack.length > 1 && stack[stack.length - 1].level >= entry.level) {
        stack.pop();
      }
      stack[stack.length - 1].children.push(node);
      stack.push({ children: node.children, level: entry.level });
    }

    const renderNode = (node: TocNode, depth: number): string => {
      const childrenHtml = node.children.length > 0
        ? `<div class="toc-children">${node.children.map(c => renderNode(c, depth + 1)).join('')}</div>`
        : '';

      return `<div class="toc-node">
        <button class="toc-link toc-depth-${depth}" data-id="${node.id}">
          <span class="toc-dot"></span>
          <span class="toc-text">${this.escapeHtml(node.text)}</span>
        </button>
        ${childrenHtml}
      </div>`;
    };

    return root.map(n => renderNode(n, 0)).join('');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private dispose() {
    PreviewPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
