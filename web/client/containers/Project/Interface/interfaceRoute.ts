export type InterfaceRouteResult =
  | { kind: 'list' }
  | { kind: 'content' }
  | { kind: 'collection' }
  | { kind: 'case' }
  | { kind: 'unresolved' }
  | { kind: 'redirect'; path: string };

export function selectInterfaceRoute(
  projectId: string,
  action: string,
  actionId?: string
): InterfaceRouteResult {
  if (action === 'api') {
    if (!actionId) return { kind: 'list' };
    if (!Number.isNaN(Number(actionId))) return { kind: 'content' };
    if (actionId.indexOf('cat_') === 0) return { kind: 'list' };
    return { kind: 'unresolved' };
  }
  if (action === 'col') return { kind: 'collection' };
  if (action === 'case') return { kind: 'case' };
  return { kind: 'redirect', path: `/project/${projectId}/interface/api` };
}
