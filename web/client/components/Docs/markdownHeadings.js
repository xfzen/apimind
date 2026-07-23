import MarkdownIt from 'markdown-it';
import GithubSlugger from 'github-slugger';

export const markdownRenderer = new MarkdownIt({ html: false, linkify: true, breaks: true });

export function extractHeadings(markdown) {
  const tokens = markdownRenderer.parse(markdown || '', {});
  const slugger = new GithubSlugger();
  const headings = [];

  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;
    const inline = tokens[index + 1];
    const level = Number(String(token.tag || 'h1').replace('h', '')) || 1;
    const text = inline && inline.type === 'inline' ? inline.content : '';
    const line = token.map && token.map.length ? token.map[0] + 1 : index + 1;
    const id = slugger.slug(text || 'section');

    headings.push({ id, level, line, text });
  });

  return headings;
}

export function renderMarkdownWithHeadingIds(markdown) {
  const headings = extractHeadings(markdown);
  let cursor = 0;

  markdownRenderer.renderer.rules.heading_open = function headingOpen(tokens, idx, options, env, self) {
    const heading = headings[cursor];
    cursor += 1;
    if (heading) tokens[idx].attrSet('id', heading.id);
    return self.renderToken(tokens, idx, options);
  };

  const html = markdownRenderer.render(markdown || '');
  return { html, headings };
}
