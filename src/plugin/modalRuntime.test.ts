import { describe, expect, it } from 'vitest';
import { modalCurrentValues, modalInitialTmdbId, modalMappedFields } from './modalRuntime';

describe('modalRuntime', () => {
  it('treats missing modal parameters as safe empty values', () => {
    expect(modalMappedFields(undefined)).toEqual([]);
    expect(modalCurrentValues(undefined)).toEqual({});
    expect(modalInitialTmdbId(undefined)).toBeNull();
  });
});
