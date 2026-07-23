import test from 'ava';
import { extractHeadings } from '../../client/components/Docs/markdownHeadings.js';

test('extractHeadings returns stable slug ids and levels', t => {
  const headings = extractHeadings('# 工作区规范\n\n## API 文档\n\n### API 文档\n');

  t.deepEqual(headings, [
    { id: '工作区规范', level: 1, line: 1, text: '工作区规范' },
    { id: 'api-文档', level: 2, line: 3, text: 'API 文档' },
    { id: 'api-文档-1', level: 3, line: 5, text: 'API 文档' }
  ]);
});

test('extractHeadings ignores headings inside fenced code blocks', t => {
  const headings = extractHeadings([
    '# Visible',
    '',
    '```md',
    '# Hidden',
    '```',
    '',
    '## Also Visible'
  ].join('\n'));

  t.deepEqual(headings.map(item => item.text), ['Visible', 'Also Visible']);
});

test('extractHeadings returns an empty list for docs without headings', t => {
  t.deepEqual(extractHeadings('plain text\n\n- list item'), []);
});
