import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';

const roots = new WeakMap<Element, Root>();

export function renderInto(container: Element, element: ReactNode): Root {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(element);
  return root;
}

export function unmountFrom(container: Element): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}
