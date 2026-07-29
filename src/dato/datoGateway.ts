import type { NormalizedImageCandidate } from '../domain/movie';
import { normalizePersonName, type ExistingPersonRecord } from '../domain/personMatching';
import { mapWithConcurrency } from '../utils/concurrency';

export type GatewayClient = {
  items?: {
    create?: (payload: Record<string, unknown>) => Promise<{ id: string }>;
    list?: (params: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
    listPagedIterator?: (
      params: Record<string, unknown>,
      options?: { perPage?: number },
    ) => AsyncIterable<Record<string, unknown>>;
  };
  uploads?: {
    create?: (payload: { path: string; default_field_metadata?: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  uploadRequest?: {
    create?: (payload: { filename?: string }) => Promise<{ id: string; url: string; request_headers: Record<string, unknown> }>;
  };
};

export type GatewayContext = {
  environment?: string;
  setFieldValue?: (fieldPath: string, value: unknown) => Promise<void>;
};

export type DatoGateway = {
  findPeople(input: FindPeopleInput): Promise<ExistingPersonRecord[]>;
  createPersonDraft(input: CreatePersonDraftInput): Promise<{ id: string }>;
  uploadImage(image: NormalizedImageCandidate): Promise<{ id: string }>;
  applyFormValues(changes: Array<{ fieldPath: string; value: unknown }>): Promise<void>;
};

export class FormValuesApplyError extends Error {
  constructor(message: string, readonly appliedFields: string[]) {
    super(message);
    this.name = 'FormValuesApplyError';
  }
}

export class DuplicatePersonNameError extends Error {
  constructor(readonly personName: string) {
    super(`A Person named "${personName}" already exists in DatoCMS.`);
    this.name = 'DuplicatePersonNameError';
  }
}

export type FindPeopleInput = {
  modelApiKey: string;
  nameFieldApiKey: string;
  tmdbIdFieldApiKey: string | null;
  names: string[];
  tmdbIds?: number[];
};

export type CreatePersonDraftInput = {
  modelApiKey: string;
  modelId?: string;
  nameFieldApiKey: string;
  tmdbIdFieldApiKey: string | null;
  name: string;
  tmdbId: number;
};

export type UploadStageTiming = {
  uploadNumber: number;
  imageType: NormalizedImageCandidate['type'];
  stage: 'download' | 'upload_request' | 'transfer' | 'asset_processing' | 'total';
  status: 'success' | 'failed';
  byteSize: number;
  durationMs: number;
};

type CreateDatoGatewayInput = {
  client: GatewayClient;
  ctx: GatewayContext;
  targetLocale?: string;
  fetchImpl?: typeof fetch;
  onUploadStageTiming?: (timing: UploadStageTiming) => void;
  now?: () => number;
};

export function createDatoGateway(input: CreateDatoGatewayInput): DatoGateway {
  let uploadSequence = 0;

  return {
    async findPeople(person) {
      if (!input.client.items?.list && !input.client.items?.listPagedIterator) {
        throw new Error('DatoCMS item list permission is unavailable.');
      }

      const [recordsByName, recordsByTmdbId] = await Promise.all([
        fetchPeopleByNames(input.client.items, person),
        fetchPeopleByTmdbIds(input.client.items, person),
      ]);
      const records = uniqueBy([...recordsByName, ...recordsByTmdbId], (record) => String(record.id));
      const requestedNames = new Set(person.names.map(normalizePersonName));
      const requestedTmdbIds = new Set(person.tmdbIds ?? []);
      const matchedRecords = recordsMatchingRequest(records, person, requestedNames, requestedTmdbIds);
      if (!hasUnresolvedPersonRequest(person, matchedRecords)) {
        return matchedRecords;
      }

      const fallbackMatches = recordsMatchingRequest(
        await fetchPeopleByModel(input.client.items, person),
        person,
        requestedNames,
        requestedTmdbIds,
      );
      return uniqueBy([...matchedRecords, ...fallbackMatches], (record) => record.id);
    },

    async createPersonDraft(person) {
      if (!input.client.items?.create) {
        throw new Error('DatoCMS item create permission is unavailable.');
      }

      const payload: Record<string, unknown> = {
        item_type: { type: 'item_type', id: person.modelId ?? person.modelApiKey },
        [person.nameFieldApiKey]: person.name,
      };

      if (person.tmdbIdFieldApiKey) {
        payload[person.tmdbIdFieldApiKey] = person.tmdbId;
      }

      try {
        return await input.client.items.create(payload);
      } catch (error) {
        if (isUniqueFieldValidationError(error, person.nameFieldApiKey)) {
          throw new DuplicatePersonNameError(person.name);
        }
        throw error;
      }
    },

    async uploadImage(image) {
      if (!input.client.uploads?.create || !input.client.uploadRequest?.create) {
        throw new Error('DatoCMS upload permission is unavailable.');
      }

      const uploadNumber = ++uploadSequence;
      const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
      const now = input.now ?? (() => globalThis.performance.now());
      const totalStartedAt = now();
      let byteSize = 0;
      try {
        const { body, contentType } = await timeUploadStage('download', async () => {
          const imageResponse = await fetchImpl(image.originalUrl);
          if (!imageResponse.ok) {
            throw new Error(`TMDB image could not be downloaded: ${imageResponse.status}`);
          }

          const downloadedBody = await imageResponse.blob();
          byteSize = downloadedBody.size;
          return {
            body: downloadedBody,
            contentType: imageResponse.headers.get('content-type') ?? contentTypeForImage(image),
          };
        }, input, now, uploadNumber, image, () => byteSize);
        const uploadRequest = await timeUploadStage(
          'upload_request',
          () => input.client.uploadRequest!.create!({ filename: filenameForImage(image) }),
          input,
          now,
          uploadNumber,
          image,
          () => byteSize,
        );
        const headers = headersForUploadRequest(uploadRequest.request_headers);
        if (contentType) {
          headers['content-type'] = contentType;
        }

        await timeUploadStage('transfer', async () => {
          const uploadResponse = await fetchImpl(uploadRequest.url, {
            method: 'PUT',
            headers,
            body,
          });
          if (!uploadResponse.ok) {
            throw new Error(`DatoCMS upload request failed: ${uploadResponse.status}`);
          }
        }, input, now, uploadNumber, image, () => byteSize);

        const upload = await timeUploadStage(
          'asset_processing',
          () => input.client.uploads!.create!({
            path: uploadRequest.id,
            default_field_metadata: {
              [input.targetLocale ?? 'en']: {
                alt: `${image.type} from ${image.providerKey}`,
                title: image.providerImageId,
              },
            },
          }),
          input,
          now,
          uploadNumber,
          image,
          () => byteSize,
        );
        reportUploadTiming(input, {
          uploadNumber,
          imageType: image.type,
          stage: 'total',
          status: 'success',
          byteSize,
          durationMs: Math.max(0, now() - totalStartedAt),
        });
        return upload;
      } catch (error) {
        reportUploadTiming(input, {
          uploadNumber,
          imageType: image.type,
          stage: 'total',
          status: 'failed',
          byteSize,
          durationMs: Math.max(0, now() - totalStartedAt),
        });
        throw error;
      }
    },

    async applyFormValues(changes) {
      if (!input.ctx.setFieldValue) {
        throw new Error('DatoCMS form update API is unavailable.');
      }

      const appliedFields: string[] = [];
      for (const change of changes) {
        try {
          await input.ctx.setFieldValue(change.fieldPath, change.value);
          appliedFields.push(change.fieldPath);
        } catch (error) {
          throw new FormValuesApplyError(
            error instanceof Error ? error.message : 'DatoCMS form update failed.',
            appliedFields,
          );
        }
      }
    },
  };
}

async function timeUploadStage<T>(
  stage: UploadStageTiming['stage'],
  operation: () => Promise<T>,
  input: CreateDatoGatewayInput,
  now: () => number,
  uploadNumber: number,
  image: NormalizedImageCandidate,
  byteSize: () => number,
): Promise<T> {
  const startedAt = now();
  try {
    const result = await operation();
    reportUploadTiming(input, {
      uploadNumber,
      imageType: image.type,
      stage,
      status: 'success',
      byteSize: byteSize(),
      durationMs: Math.max(0, now() - startedAt),
    });
    return result;
  } catch (error) {
    reportUploadTiming(input, {
      uploadNumber,
      imageType: image.type,
      stage,
      status: 'failed',
      byteSize: byteSize(),
      durationMs: Math.max(0, now() - startedAt),
    });
    throw error;
  }
}

function reportUploadTiming(input: CreateDatoGatewayInput, timing: UploadStageTiming) {
  try {
    input.onUploadStageTiming?.(timing);
  } catch {
    // Diagnostics must never interrupt an upload.
  }
}

async function fetchPeopleByNames(
  items: NonNullable<GatewayClient['items']>,
  person: FindPeopleInput,
): Promise<Array<Record<string, unknown>>> {
  const names = [...new Set(person.names.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) {
    return [];
  }

  return collectQueryRecords(items, {
    filter: {
      type: person.modelApiKey,
      fields: {
        [person.nameFieldApiKey]: {
          in: names,
        },
      },
    },
  });
}

async function fetchPeopleByTmdbIds(
  items: NonNullable<GatewayClient['items']>,
  person: FindPeopleInput,
): Promise<Array<Record<string, unknown>>> {
  const tmdbIdFieldApiKey = person.tmdbIdFieldApiKey;
  if (!tmdbIdFieldApiKey || !person.tmdbIds || person.tmdbIds.length === 0) {
    return [];
  }

  const recordGroups = await mapWithConcurrency([...new Set(person.tmdbIds)], 3, (tmdbId) => {
    return collectQueryRecords(items, {
      filter: {
        type: person.modelApiKey,
        fields: {
          [tmdbIdFieldApiKey]: {
            eq: tmdbId,
          },
        },
      },
    });
  });
  return recordGroups.flat();
}

async function fetchPeopleByModel(
  items: NonNullable<GatewayClient['items']>,
  person: FindPeopleInput,
): Promise<Array<Record<string, unknown>>> {
  return collectQueryRecords(items, {
    filter: {
      type: person.modelApiKey,
    },
  });
}

function recordsMatchingRequest(
  records: Array<Record<string, unknown>>,
  person: FindPeopleInput,
  requestedNames: Set<string>,
  requestedTmdbIds: Set<number>,
): ExistingPersonRecord[] {
  return records.flatMap((record) => {
    const name = record[person.nameFieldApiKey];
    const tmdbId = person.tmdbIdFieldApiKey ? numericTmdbId(record[person.tmdbIdFieldApiKey]) : null;
    const matchesName = typeof name === 'string' && requestedNames.has(normalizePersonName(name));
    const matchesTmdbId = tmdbId !== null && requestedTmdbIds.has(tmdbId);
    if (!matchesName && !matchesTmdbId) {
      return [];
    }

    if (typeof name !== 'string') return [];

    return [{
      id: String(record.id),
      name,
      tmdbId,
    }];
  });
}

function hasUnresolvedPersonRequest(person: FindPeopleInput, matchedRecords: ExistingPersonRecord[]): boolean {
  return person.names.some((name, index) => {
    const requestedName = normalizePersonName(name);
    const requestedTmdbId = person.tmdbIds?.[index] ?? null;
    return !matchedRecords.some((record) => {
      const matchesName = normalizePersonName(record.name) === requestedName;
      const matchesTmdbId = requestedTmdbId !== null && record.tmdbId === requestedTmdbId;
      return matchesName || matchesTmdbId;
    });
  });
}

async function collectQueryRecords(
  items: NonNullable<GatewayClient['items']>,
  query: Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
  return items.listPagedIterator
    ? collectRecords(items.listPagedIterator(query, { perPage: 500 }))
    : items.list!({ ...query, page: { limit: 500 } });
}

async function collectRecords(records: AsyncIterable<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
  const collected: Array<Record<string, unknown>> = [];
  for await (const record of records) {
    collected.push(record);
  }
  return collected;
}

function filenameForImage(image: NormalizedImageCandidate): string {
  const pathSegment = image.providerImageId.split('/').filter(Boolean).at(-1);
  if (pathSegment && /\.[a-z0-9]+$/i.test(pathSegment)) {
    return pathSegment;
  }

  const extension = extensionForContentType(contentTypeForImage(image)) ?? 'jpg';
  return `${image.providerKey}-${image.movieIdentity.tmdbId}-${image.type}-${Math.abs(hashString(image.providerImageId))}.${extension}`;
}

function contentTypeForImage(image: NormalizedImageCandidate): string {
  if (/\.png($|\?)/i.test(image.providerImageId)) return 'image/png';
  if (/\.webp($|\?)/i.test(image.providerImageId)) return 'image/webp';
  return 'image/jpeg';
}

function extensionForContentType(contentType: string): string | null {
  if (/png/i.test(contentType)) return 'png';
  if (/webp/i.test(contentType)) return 'webp';
  if (/jpe?g/i.test(contentType)) return 'jpg';
  return null;
}

function headersForUploadRequest(headers: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : []));
}

function hashString(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = ((hash << 5) - hash) + character.charCodeAt(0);
    hash |= 0;
  }
  return hash;
}

function uniqueBy<T>(records: T[], keyFor: (record: T) => string): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = keyFor(record);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function numericTmdbId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  return null;
}

function isUniqueFieldValidationError(error: unknown, fieldApiKey: string): boolean {
  const findError = isRecord(error) ? error.findError : null;
  if (typeof findError === 'function') {
    return Boolean(findError.call(error, 'INVALID_FIELD', { field: fieldApiKey, code: 'VALIDATION_UNIQUE' }));
  }

  return validationErrorData(error).some((entry) => {
    const attributes = isRecord(entry) ? entry.attributes : null;
    const details = isRecord(attributes) ? attributes.details : null;
    return isRecord(attributes)
      && isRecord(details)
      && attributes.code === 'INVALID_FIELD'
      && details.field === fieldApiKey
      && details.code === 'VALIDATION_UNIQUE';
  });
}

function validationErrorData(error: unknown): unknown[] {
  if (!isRecord(error) || !isRecord(error.response) || !isRecord(error.response.body)) {
    return [];
  }

  return Array.isArray(error.response.body.data) ? error.response.body.data : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
