const SYSTEM_PROJECT_KINDS = new Set(['docs', 'template']);

export function isSystemProjectKind(kind?: string): boolean {
  return SYSTEM_PROJECT_KINDS.has(kind || '');
}
