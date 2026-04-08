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

  private constructor(
    panel: vscode.WebviewPanel,
    extensionPath: string,
  ) {
    this.panel = panel;
    this.extensionPath = extensionPath;
    this.themeManager = new ThemeManager();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(context: vscode.ExtensionContext, document: vscode.TextDocument) {
    const column = vscode.ViewColumn.Beside;

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
    // Re-render with current content by posting a message
    this.panel.webview.postMessage({
      type: 'setTheme',
      theme: this.themeManager.getTheme(),
    });
  }

  public toggleDarkMode() {
    const mode = this.themeManager.toggleDarkMode();
    this.panel.webview.postMessage({
      type: 'setDarkMode',
      darkMode: mode,
    });
  }

  private loadThemeCss(name: string): string {
    const themePath = path.join(this.extensionPath, 'themes', `${name}.css`);
    try {
      return fs.readFileSync(themePath, 'utf-8');
    } catch {
      return '';
    }
  }

  private buildHtml(bodyHtml: string, toc: { level: number; id: string; text: string }[]): string {
    const cleanCss = this.loadThemeCss('clean');
    const simpleCss = this.loadThemeCss('simple');
    const terminalCss = this.loadThemeCss('terminal');
    const currentTheme = this.themeManager.getTheme();
    const darkMode = this.themeManager.isDark();

    const tocHtml = this.buildTocHtml(toc);

    const darkModeAttr =
      darkMode === null ? '' : darkMode ? 'data-mode="dark"' : 'data-mode="light"';

    return /*html*/ `<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}" ${darkModeAttr}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* ===== Base reset ===== */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --sidebar-width: 260px;
      --content-max-width: 860px;
      --pad: 2rem;
    }

    html, body { height: 100%; }

    body {
      display: flex;
      font-size: 15px;
      line-height: 1.7;
      overflow: hidden;
    }

    /* ===== Sidebar ===== */
    .sidebar {
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      height: 100vh;
      overflow-y: auto;
      padding: 1.25rem 1rem;
      border-right: 1px solid var(--border);
      background: var(--sidebar-bg);
    }

    .sidebar h4 {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.75rem;
      color: var(--text-muted);
    }

    .sidebar ul { list-style: none; }

    .sidebar li { margin-bottom: 2px; }

    .sidebar a {
      display: block;
      padding: 3px 8px;
      border-radius: 4px;
      text-decoration: none;
      font-size: 0.82rem;
      color: var(--text-muted);
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar a:hover { background: var(--hover-bg); color: var(--text); }
    .sidebar a.active { background: var(--active-bg); color: var(--active-text); font-weight: 600; }

    .sidebar .toc-h2 { padding-left: 16px; }
    .sidebar .toc-h3 { padding-left: 28px; font-size: 0.78rem; }
    .sidebar .toc-h4 { padding-left: 40px; font-size: 0.75rem; }

    /* ===== Content ===== */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: var(--pad);
      background: var(--bg);
      color: var(--text);
    }

    .content-inner {
      max-width: var(--content-max-width);
      margin: 0 auto;
    }

    /* ===== Toolbar ===== */
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
      margin-bottom: 1rem;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
    }

    .toolbar button {
      padding: 4px 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--btn-bg);
      color: var(--text);
      cursor: pointer;
      font-size: 0.78rem;
      transition: background 0.15s;
    }

    .toolbar button:hover { background: var(--hover-bg); }
    .toolbar button.active { background: var(--active-bg); color: var(--active-text); }

    .toolbar .spacer { flex: 1; }

    .mode-label {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    /* ===== Typography defaults ===== */
    .content-inner h1, .content-inner h2, .content-inner h3,
    .content-inner h4, .content-inner h5, .content-inner h6 {
      margin-top: 1.8em;
      margin-bottom: 0.6em;
      line-height: 1.3;
    }

    .content-inner h1 { font-size: 2em; }
    .content-inner h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    .content-inner h3 { font-size: 1.25em; }

    .content-inner p { margin-bottom: 1em; }

    .content-inner a { color: var(--link); text-decoration: underline; }

    .content-inner ul, .content-inner ol { margin-bottom: 1em; padding-left: 1.5em; }
    .content-inner li { margin-bottom: 0.25em; }

    .content-inner blockquote {
      border-left: 4px solid var(--accent);
      padding: 0.5em 1em;
      margin: 1em 0;
      color: var(--text-muted);
      background: var(--blockquote-bg);
      border-radius: 0 4px 4px 0;
    }

    .content-inner code {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
      background: var(--code-bg);
      padding: 0.15em 0.4em;
      border-radius: 3px;
      font-size: 0.9em;
    }

    .content-inner pre {
      background: var(--pre-bg);
      padding: 1em 1.25em;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
      border: 1px solid var(--border);
    }

    .content-inner pre code {
      background: none;
      padding: 0;
      font-size: 0.88em;
      line-height: 1.6;
    }

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
  </style>

  <!-- Theme styles -->
  <style id="theme-clean">${cleanCss}</style>
  <style id="theme-simple">${simpleCss}</style>
  <style id="theme-terminal">${terminalCss}</style>
</head>
<body>
  <nav class="sidebar">
    <h4>Contents</h4>
    ${tocHtml}
  </nav>

  <main class="content">
    <div class="toolbar">
      <button data-theme="clean" class="${currentTheme === 'clean' ? 'active' : ''}">Clean</button>
      <button data-theme="simple" class="${currentTheme === 'simple' ? 'active' : ''}">Simple</button>
      <button data-theme="terminal" class="${currentTheme === 'terminal' ? 'active' : ''}">Terminal</button>
      <span class="spacer"></span>
      <span class="mode-label" id="modeLabel">${darkMode === null ? 'System' : darkMode ? 'Dark' : 'Light'}</span>
      <button id="darkToggle">Toggle Mode</button>
    </div>
    <div class="content-inner">
      ${bodyHtml}
    </div>
  </main>

  <script>
    const vscode = acquireVsCodeApi();
    const html = document.documentElement;
    const content = document.querySelector('.content');
    const sidebar = document.querySelector('.sidebar');

    // ===== Theme switching via toolbar =====
    document.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        html.setAttribute('data-theme', theme);
        document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        vscode.postMessage({ type: 'themeChanged', theme });
      });
    });

    // ===== Dark mode toggle =====
    const darkToggle = document.getElementById('darkToggle');
    const modeLabel = document.getElementById('modeLabel');
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
      modeLabel.textContent = next === 'dark' ? 'Dark' : next === 'light' ? 'Light' : 'System';
      vscode.postMessage({ type: 'darkModeChanged', darkMode: next === 'dark' ? true : next === 'light' ? false : null });
    });

    // ===== Scroll spy for TOC =====
    function updateScrollSpy() {
      const headings = document.querySelectorAll('.content-inner h1, .content-inner h2, .content-inner h3, .content-inner h4');
      const links = document.querySelectorAll('.sidebar a');
      let activeId = '';

      for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 80) {
          activeId = heading.id;
        }
      }

      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === '#' + activeId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }

    content.addEventListener('scroll', updateScrollSpy);
    updateScrollSpy();

    // ===== Smooth scroll for TOC links =====
    sidebar.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      e.preventDefault();
      const id = link.getAttribute('href')?.slice(1);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      } else if (msg.type === 'setDarkMode') {
        if (msg.darkMode === null) {
          html.removeAttribute('data-mode');
          modeLabel.textContent = 'System';
        } else {
          html.setAttribute('data-mode', msg.darkMode ? 'dark' : 'light');
          modeLabel.textContent = msg.darkMode ? 'Dark' : 'Light';
        }
      }
    });
  </script>
</body>
</html>`;
  }

  private buildTocHtml(toc: { level: number; id: string; text: string }[]): string {
    if (toc.length === 0) return '<p style="font-size:0.8rem;color:var(--text-muted)">No headings found</p>';

    const items = toc
      .filter((entry) => entry.level <= 4)
      .map(
        (entry) =>
          `<li><a href="#${entry.id}" class="toc-h${entry.level}">${this.escapeHtml(entry.text)}</a></li>`,
      )
      .join('\n');

    return `<ul>${items}</ul>`;
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
