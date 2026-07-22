import '@testing-library/jest-dom/vitest';
import { createElement, type ChangeEvent, type ReactNode } from 'react';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

vi.mock('datocms-react-ui', () => ({
  Button: ({ children, type = 'button', ...props }: { children: ReactNode; type?: 'button' | 'submit' }) =>
    createElement('button', { type, ...props }, children),
  FieldGroup: ({ children }: { children: ReactNode }) => createElement('div', undefined, children),
  TextField: ({
    id,
    name,
    label,
    value,
    onChange,
  }: {
    id: string;
    name: string;
    label: ReactNode;
    value: string;
    onChange: (value: string) => void;
  }) =>
    createElement(
      'label',
      { htmlFor: id },
      label,
      createElement('input', {
        id,
        name,
        value,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
      }),
    ),
}));
