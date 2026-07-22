import type { NormalizedImageCandidate } from '../domain/movie';

export type GatewayClient = {
  items?: {
    create?: (payload: Record<string, unknown>) => Promise<{ id: string }>;
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
  createPersonDraft(input: CreatePersonDraftInput): Promise<{ id: string }>;
  uploadImage(image: NormalizedImageCandidate): Promise<{ id: string }>;
  applyFormValues(changes: Array<{ fieldPath: string; value: unknown }>): Promise<void>;
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
};

export function createDatoGateway(input: CreateDatoGatewayInput): DatoGateway {
  return {
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
          en: {
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
