import DOMPurify from 'dompurify';

export function sanitizeHTML(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return DOMPurify.sanitize(String(value), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target']
  });
}
