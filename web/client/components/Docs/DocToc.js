import React from 'react';
import PropTypes from 'prop-types';

function extractHeadings(markdown) {
  return String(markdown || '')
    .split('\n')
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+)$/.exec(line);
      if (!match) return null;
      return { id: `heading-${index}`, level: match[1].length, title: match[2].trim() };
    })
    .filter(Boolean);
}

export default function DocToc({ markdown }) {
  const headings = extractHeadings(markdown);
  if (!headings.length) {
    return <aside className="apimind-docs-toc empty" />;
  }
  return (
    <aside className="apimind-docs-toc">
      {headings.map(item => (
        <a key={item.id} className={`level-${item.level}`} href={`#${item.id}`}>
          {item.title}
        </a>
      ))}
    </aside>
  );
}

DocToc.propTypes = {
  markdown: PropTypes.string
};
