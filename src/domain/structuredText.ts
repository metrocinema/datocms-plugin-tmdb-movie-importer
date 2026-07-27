export function structuredTextPlainText(value: unknown): string | null {
  if (!isStructuredTextValue(value)) {
    return null;
  }

  const text = collectStructuredText(value).join(' ').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

export function isStructuredTextValue(value: unknown): boolean {
  if (isDatoStructuredTextDocument(value)) {
    return isStructuredTextValue(value.document);
  }

  if (Array.isArray(value)) {
    return value.length > 0 && value.every(isDastNode);
  }

  return isDastNode(value);
}

export function isEmptyStructuredText(value: unknown): boolean {
  return isStructuredTextValue(value) && structuredTextPlainText(value) === null;
}

function collectStructuredText(value: unknown): string[] {
  if (isDatoStructuredTextDocument(value)) {
    return collectStructuredText(value.document);
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStructuredText);
  }

  if (isSlateTextNode(value)) {
    return [value.text];
  }

  if (!isDastNode(value)) {
    return [];
  }

  if (typeof value.value === 'string') {
    return [value.value];
  }

  if (Array.isArray(value.children)) {
    return value.children.flatMap(collectStructuredText);
  }

  return [];
}

function isDatoStructuredTextDocument(value: unknown): value is { schema: 'dast'; document: unknown } {
  return isRecord(value) && value.schema === 'dast' && 'document' in value;
}

function isSlateTextNode(value: unknown): value is { text: string } {
  return isRecord(value) && typeof value.text === 'string';
}

function isDastNode(value: unknown): value is { type: string; value?: unknown; children?: unknown } {
  return isRecord(value)
    && typeof value.type === 'string'
    && (typeof value.value === 'string' || Array.isArray(value.children));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
