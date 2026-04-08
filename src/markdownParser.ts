import MarkdownIt from 'markdown-it';

export interface TocEntry {
  level: number;
  id: string;
  text: string;
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

export function parseMarkdown(source: string): { html: string; toc: TocEntry[] } {
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

  const html = md.render(source);

  // Reset the override so repeated calls don't stack
  md.renderer.rules.heading_open = defaultHeadingOpen;

  return { html, toc };
}
