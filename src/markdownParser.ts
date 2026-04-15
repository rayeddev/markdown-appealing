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
