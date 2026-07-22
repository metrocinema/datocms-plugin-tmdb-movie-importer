import type { NormalizedImageCandidate } from '../domain/movie';
import { normalizePersonName, type ExistingPersonRecord } from '../domain/personMatching';

export type GatewayClient = {
  items?: {
    create?: (payload: Record<string, unknown>) => Promise<{ id: string }>;
    list?: (params: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  };
  uploads?: {
    createFromUrl?: (payload: { url: string; default_field_metadata?: Record<string, unknown> }) => Promise<{ id: string }>;
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

export type FindPeopleInput = {
  modelApiKey: string;
  nameFieldApiKey: string;
  tmdbIdFieldApiKey: string | null;
  names: string[];
  tmdbIds?: number[];
};

export type CreatePersonDraftInput = {
  modelApiKey: string;
  nameFieldApiKey: string;
  tmdbIdFieldApiKey: string | null;
  name: string;
  tmdbId: number;
};

type CreateDatoGatewayInput = {
  client: GatewayClient;
  ctx: GatewayContext;
  targetLocale?: string;
};

export function createDatoGateway(input: CreateDatoGatewayInput): DatoGateway {
  return {
    async findPeople(person) {
      if (!input.client.items?.list) {
        throw new Error('DatoCMS item list permission is unavailable.');
      }

      const records = await input.client.items.list({
        filter: {
          type: person.modelApiKey,
        },
      });

      const requestedNames = new Set(person.names.map(normalizePersonName));
      const requestedTmdbIds = new Set(person.tmdbIds ?? []);

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
    },

    async createPersonDraft(person) {
      if (!input.client.items?.create) {
        throw new Error('DatoCMS item create permission is unavailable.');
      }

      const payload: Record<string, unknown> = {
        item_type: { type: 'item_type', id: person.modelApiKey },
        [person.nameFieldApiKey]: person.name,
      };

      if (person.tmdbIdFieldApiKey) {
        payload[person.tmdbIdFieldApiKey] = person.tmdbId;
      }

      return input.client.items.create(payload);
    },

    async uploadImage(image) {
      if (!input.client.uploads?.createFromUrl) {
        throw new Error('DatoCMS upload permission is unavailable.');
      }

      return input.client.uploads.createFromUrl({
        url: image.originalUrl,
        default_field_metadata: {
          [input.targetLocale ?? 'en']: {
            alt: `${image.type} from ${image.providerKey}`,
            title: image.providerImageId,
          },
        },
      });
    },

    async applyFormValues(changes) {
      if (!input.ctx.setFieldValue) {
        throw new Error('DatoCMS form update API is unavailable.');
      }

      for (const change of changes) {
        await input.ctx.setFieldValue(change.fieldPath, change.value);
      }
    },
  };
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
