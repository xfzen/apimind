import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

type MarkdownPreviewProps = {
  value?: string;
  className?: string;
};

const sanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: '',
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a || []),
      ['className', 'anchor'],
      ['ariaLabel']
    ],
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className', 'hljs', /^language-[\w-]+$/]
    ],
    h1: [...(defaultSchema.attributes?.h1 || []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 || []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 || []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 || []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 || []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 || []), 'id'],
    input: [
      ...(defaultSchema.attributes?.input || []),
      ['type', 'checkbox'],
      ['checked'],
      ['disabled']
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['className', /^hljs-[\w-]+$/]
    ]
  }
};

export default function MarkdownPreview({ value = '', className }: MarkdownPreviewProps) {
  const cls = className
    ? `apimind-docs-rendered markdown-body ${className}`
    : 'apimind-docs-rendered markdown-body';
  const rehypePlugins = useMemo(() => [
    rehypeSlug,
    [rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: {
        className: ['anchor'],
        ariaLabel: 'Link to this section'
      },
      content: {
        type: 'text',
        value: '#'
      }
    }],
    [rehypeHighlight, {
      detect: false,
      ignoreMissing: true,
      aliases: {
        golang: 'go',
        js: 'javascript',
        md: 'markdown',
        sh: 'bash',
        shell: 'bash',
        ts: 'typescript',
        yml: 'yaml'
      }
    }],
    [rehypeSanitize, sanitizeSchema]
  ], []);

  return (
    <article className={cls}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
      >
        {value}
      </ReactMarkdown>
    </article>
  );
}
