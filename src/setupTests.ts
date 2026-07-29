import '@testing-library/jest-dom/vitest';
import { createElement, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
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
    createElement('button', { type, 'data-dato-component': 'Button', ...props }, children),
  FieldError: ({ children }: { children: ReactNode }) => createElement('div', { role: 'alert', 'data-dato-component': 'FieldError' }, children),
  FieldGroup: ({ children }: { children: ReactNode }) => createElement('div', undefined, children),
  FieldHint: ({ children }: { children: ReactNode }) => createElement('div', { 'data-dato-component': 'FieldHint' }, children),
  Form: ({ children, onSubmit }: { children: ReactNode; onSubmit?: (event: FormEvent<HTMLFormElement>) => void }) =>
    createElement('form', {
      'data-dato-component': 'Form',
      onSubmit: (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit?.(event);
      },
    }, children),
  Section: ({ title, children }: { title: ReactNode; children: ReactNode }) =>
    createElement('div', { 'data-dato-component': 'Section' }, createElement('h3', undefined, title), children),
  Spinner: ({ size }: { size?: number }) =>
    createElement('div', { 'aria-hidden': true, 'data-dato-component': 'Spinner', style: size ? { height: size, width: size } : undefined }),
  SelectField: ({
    id,
    name,
    label,
    value,
    onChange,
    selectInputProps,
  }: {
    id: string;
    name: string;
    label: ReactNode;
    value: { label: string; value: string } | null;
    onChange: (value: { label: string; value: string } | null) => void;
    selectInputProps?: { options?: Array<{ label: string; value: string }> };
  }) =>
    createElement(
      'label',
      { 'data-dato-component': 'SelectField', htmlFor: id },
      label,
      createElement(
        'select',
        {
          id,
          name,
          value: value?.value ?? '',
          onChange: (event: ChangeEvent<HTMLSelectElement>) => {
            const option = selectInputProps?.options?.find((item) => item.value === event.target.value) ?? null;
            onChange(option);
          },
        },
        createElement('option', { value: '', disabled: true }, 'Choose a resolution'),
        ...(selectInputProps?.options ?? []).map((option) => createElement('option', { key: option.value, value: option.value }, option.label)),
      ),
    ),
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
    textInputProps?: { type?: string; inputMode?: string; disabled?: boolean };
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
        disabled: textInputProps?.disabled,
        value,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
      }),
      hint ? createElement('span', undefined, hint) : null,
    ),
}));
