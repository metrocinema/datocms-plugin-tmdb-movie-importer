export type NormalizedTrailerCandidate = {
  providerKey: 'tmdb';
  providerVideoId: string;
  movieIdentity: { providerKey: 'tmdb'; tmdbId: number };
  externalProvider: 'youtube';
  externalProviderId: string;
  title: string;
  watchUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  language: 'en';
  country: string | null;
  resolution: number;
  publishedAt: string | null;
  official: true;
  attribution: 'TMDB';
};

export type DatoExternalVideoValue = {
  provider: 'youtube';
  provider_uid: string;
  url: string;
  width: number;
  height: number;
  thumbnail_url: string;
  title: string;
};

export function datoExternalVideoValue(trailer: NormalizedTrailerCandidate): DatoExternalVideoValue {
  return {
    provider: trailer.externalProvider,
    provider_uid: trailer.externalProviderId,
    url: trailer.watchUrl,
    width: trailer.width,
    height: trailer.height,
    thumbnail_url: trailer.thumbnailUrl,
    title: trailer.title,
  };
}

export function sameExternalVideo(left: unknown, right: unknown): boolean {
  const leftValue = externalVideoIdentity(left);
  const rightValue = externalVideoIdentity(right);

  return leftValue !== null
    && rightValue !== null
    && leftValue.provider === rightValue.provider
    && leftValue.providerUid === rightValue.providerUid;
}

function externalVideoIdentity(value: unknown): { provider: string; providerUid: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.provider === 'string'
    && typeof candidate.provider_uid === 'string'
    && candidate.provider.length > 0
    && candidate.provider_uid.length > 0
    ? { provider: candidate.provider, providerUid: candidate.provider_uid }
    : null;
}
