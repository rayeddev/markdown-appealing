import MarkdownIt from 'markdown-it';

export interface TocEntry {
  level: number;
  id: string;
  text: string;
}

export type FrontmatterData = Record<string, string> | null;

const frontmatterRegex = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const keyValueRegex = /^([^:]+):\s?(.*)/;

function extractFrontmatter(source: string): { frontmatter: FrontmatterData; body: string } {
  const match = source.match(frontmatterRegex);
  if (!match) {
    return { frontmatter: null, body: source };
  }

  const block = match[1];
  const pairs: Record<string, string> = {};

  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const kvMatch = trimmed.match(keyValueRegex);
    if (kvMatch) {
      pairs[kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }

  if (Object.keys(pairs).length === 0) {
    return { frontmatter: null, body: source };
  }

  const body = source.slice(match[0].length);
  return { frontmatter: pairs, body };
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// GitHub-flavored alert support: > [!NOTE] / [!TIP] / [!WARNING] / [!CAUTION] / [!IMPORTANT]
const GH_ALERT_TYPES = ['note', 'tip', 'warning', 'caution', 'important'] as const;
type GhAlertType = (typeof GH_ALERT_TYPES)[number];

// Inline Octicons (MIT, github/primer). Kept inline so the webview stays offline.
const GH_ALERT_ICONS: Record<GhAlertType, string> = {
  note: '<svg class="gh-alert-icon" viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
  tip: '<svg class="gh-alert-icon" viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68 18.092 18.092 0 0 1-.27-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>',
  important: '<svg class="gh-alert-icon" viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.189l2.72-2.72a.749.749 0 0 1 .53-.219h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
  warning: '<svg class="gh-alert-icon" viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
  caution: '<svg class="gh-alert-icon" viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
};

const GH_ALERT_MARKER_RE = /^\[!(note|tip|warning|caution|important)\][ \t]*$/i;

// Core rule: rewrite blockquotes that open with [!TYPE] into styled alert blocks.
// Runs after inline parsing so inline tokens have populated .children.
md.core.ruler.after('inline', 'gh_alert', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const openTok = tokens[i];
    if (openTok.type !== 'blockquote_open') continue;

    // Find the matching blockquote_close at the same nesting level.
    let closeIdx = -1;
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].type === 'blockquote_close' && tokens[j].level === openTok.level) {
        closeIdx = j;
        break;
      }
    }
    if (closeIdx === -1) continue;

    // Expect the first child to be a paragraph with inline content.
    const paraOpen = tokens[i + 1];
    const inlineTok = tokens[i + 2];
    if (!paraOpen || paraOpen.type !== 'paragraph_open') continue;
    if (!inlineTok || inlineTok.type !== 'inline' || !inlineTok.children) continue;

    const firstChild = inlineTok.children[0];
    if (!firstChild || firstChild.type !== 'text') continue;

    const match = firstChild.content.match(GH_ALERT_MARKER_RE);
    if (!match) continue;

    const alertType = match[1].toLowerCase() as GhAlertType;

    // Strip the marker text and the following softbreak (if present) from the inline children.
    const nextChild = inlineTok.children[1];
    if (nextChild && nextChild.type === 'softbreak') {
      inlineTok.children = inlineTok.children.slice(2);
    } else {
      inlineTok.children = inlineTok.children.slice(1);
    }
    inlineTok.content = inlineTok.children.map((c) => c.content).join('');

    // If stripping the marker emptied the first paragraph, remove it so we don't emit <p></p>.
    let removedParagraph = false;
    if (inlineTok.children.length === 0) {
      const paraClose = tokens[i + 3];
      if (paraClose && paraClose.type === 'paragraph_close') {
        tokens.splice(i + 1, 3);
        removedParagraph = true;
      }
    }

    const adjustedCloseIdx = removedParagraph ? closeIdx - 3 : closeIdx;

    const openHtml = new state.Token('html_block', '', 0);
    openHtml.content = `<div class="gh-alert gh-alert-${alertType}"><p class="gh-alert-label">${GH_ALERT_ICONS[alertType]}<span>${alertType.toUpperCase()}</span></p>\n`;
    openHtml.block = true;
    tokens[i] = openHtml;

    const closeHtml = new state.Token('html_block', '', 0);
    closeHtml.content = '</div>\n';
    closeHtml.block = true;
    tokens[adjustedCloseIdx] = closeHtml;
  }
  return true;
});

// Custom fence renderer — wraps code blocks with header (lang + copy button) and line numbers
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = token.info.trim();
  const content = token.content;
  const escaped = escapeHtml(content);

  // Mermaid blocks get a card container instead of a code block
  if (lang === 'mermaid' || lang.startsWith('mermaid ')) {
    return `<div class="mermaid-card"><div class="mermaid-render"><pre class="mermaid">${escaped}</pre></div></div>`;
  }

  const lines = content.split('\n');
  // Remove trailing empty line from fence content
  const lineCount = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;

  const lineNums = Array.from({ length: lineCount }, (_, i) => `<span>${i + 1}</span>`).join('');

  return `<div class="code-block-wrapper">
  <div class="code-block-header">
    <span class="code-lang">${lang || 'code'}</span>
    <button class="code-copy-btn" onclick="copyCode(this)">Copy</button>
  </div>
  <div class="code-block-body">
    <div class="code-line-numbers">${lineNums}</div>
    <pre><code>${escaped}</code></pre>
  </div>
</div>`;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseMarkdown(source: string): { html: string; toc: TocEntry[]; frontmatter: FrontmatterData } {
  const { frontmatter, body } = extractFrontmatter(source);
  const toc: TocEntry[] = [];
  const slugCounts = new Map<string, number>();

  // Override heading rendering to inject IDs and collect TOC
  const defaultHeadingOpen =
    md.renderer.rules.heading_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const level = parseInt(token.tag.slice(1), 10);
    const contentToken = tokens[idx + 1];
    const text = contentToken?.children
      ?.filter((t) => t.type === 'text' || t.type === 'code_inline')
      .map((t) => t.content)
      .join('') ?? '';

    let slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const count = slugCounts.get(slug) ?? 0;
    slugCounts.set(slug, count + 1);
    if (count > 0) {
      slug = `${slug}-${count}`;
    }

    token.attrSet('id', slug);
    toc.push({ level, id: slug, text });

    return defaultHeadingOpen(tokens, idx, options, env, self);
  };

  const html = md.render(body);

  // Reset the override so repeated calls don't stack
  md.renderer.rules.heading_open = defaultHeadingOpen;

  return { html, toc, frontmatter };
}
