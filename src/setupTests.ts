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
  Button: ({
    children,
    type = 'button',
    buttonType,
    buttonSize,
    fullWidth,
    ...props
  }: {
    children: ReactNode;
    type?: 'button' | 'submit';
    buttonType?: string;
    buttonSize?: string;
    fullWidth?: boolean;
  }) =>
    createElement('button', { type, ...props }, children),
  FieldGroup: ({ children }: { children: ReactNode }) => createElement('div', undefined, children),
  Section: ({ title, children }: { title: ReactNode; children: ReactNode }) =>
    createElement('div', undefined, createElement('h3', undefined, title), children),
  TextField: ({
    id,
    name,
    label,
    hint,
    value,
    onChange,
    textInputProps,
  }: {
    id: string;
    name: string;
    label: ReactNode;
    hint?: ReactNode;
    value: string;
    onChange: (value: string) => void;
    textInputProps?: { type?: string; inputMode?: string };
  }) =>
    createElement(
      'label',
      { htmlFor: id },
      label,
      createElement('input', {
        id,
        name,
        type: textInputProps?.type,
        inputMode: textInputProps?.inputMode,
        value,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
      }),
      hint ? createElement('span', undefined, hint) : null,
    ),
}));
