import type React from 'react';
import { createRoot as reactCreateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

const roots = new WeakMap<Element, Root>();

export function renderIntoRoot(
  container: Element,
  node: React.ReactNode,
  createRoot: (container: Element) => Root = defaultCreateRoot,
) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  root.render(node);
}

function defaultCreateRoot(container: Element): Root {
  return reactCreateRoot(container);
}
