import React from 'react';

import { renderInto, unmountFrom } from '../../client/shims/reactRoot';

declare global {
  interface Window {
    __phase3SameRoot?: boolean;
  }
}

const container = document.getElementById('root-under-test');
const unmountButton = document.querySelector<HTMLButtonElement>(
  '[data-testid="unmount-root"]'
);

if (!container || !unmountButton) {
  throw new Error('Missing Phase 3 React root fixture elements');
}

const firstRoot = renderInto(container, <span>first</span>);
const secondRoot = renderInto(
  container,
  <span data-testid="root-value">second</span>
);
window.__phase3SameRoot = firstRoot === secondRoot;

unmountButton.addEventListener('click', () => {
  unmountFrom(container);
});
