import { createRoot } from 'react-dom/client';

const roots = new WeakMap();

export function renderInto(container, element) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(element);
  return root;
}

export function unmountFrom(container) {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}
