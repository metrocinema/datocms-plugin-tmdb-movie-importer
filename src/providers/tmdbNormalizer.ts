import type { NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import type { NormalizedTrailerCandidate } from '../domain/trailer';
import type { TmdbImage, TmdbMoviePackage, TmdbReleaseDatesResponse, TmdbVideo } from './tmdbTypes';

const TMDB_IMAGE_ORIGINAL_BASE = 'https://image.tmdb.org/t/p/original';
const TMDB_POSTER_PREVIEW_BASE = 'https://image.tmdb.org/t/p/w342';
const TMDB_BACKDROP_PREVIEW_BASE = 'https://image.tmdb.org/t/p/w300';
const THEATRICAL_RELEASE_TYPES = new Set([2, 3]);
const YOUTUBE_KEY = /^[A-Za-z0-9_-]+$/;

type EligibleTmdbTrailer = TmdbVideo & {
  id: string;
  iso_639_1: 'en';
  key: string;
  name: string;
  official: true;
  site: 'YouTube';
  size: number;
  type: 'Trailer';
};

export function selectUsCertification(releaseDates: TmdbReleaseDatesResponse): string | null {
  const us = releaseDates.results.find((entry) => entry.iso_3166_1 === 'US');
  const values = us?.release_dates ?? [];
  const theatrical = values.find((release) => THEATRICAL_RELEASE_TYPES.has(release.type) && release.certification.trim().length > 0);
  const fallback = values.find((release) => release.certification.trim().length > 0);

  return theatrical?.certification.trim() || fallback?.certification.trim() || null;
}

function releaseYear(releaseDate: string | null | undefined): number | null {
  if (!releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return null;
  }

  return Number(releaseDate.slice(0, 4));
}

function normalizePeople(input: TmdbMoviePackage, actorLimit: number): { directors: PersonCandidate[]; actors: PersonCandidate[] } {
  const directors = input.credits.crew
    .filter((person) => person.job === 'Director')
    .map((person, index) => ({ tmdbId: person.id, name: person.name, order: index, role: 'director' as const }));

  const actors = input.credits.cast
    .slice(0, actorLimit)
    .map((person, index) => ({ tmdbId: person.id, name: person.name, order: person.order ?? index, role: 'actor' as const }));

  return { directors, actors };
}

function normalizeImage(tmdbId: number, type: 'poster' | 'backdrop', image: TmdbImage, index: number): NormalizedImageCandidate {
  const voteAverage = image.vote_average ?? 0;
  const voteCount = image.vote_count ?? 0;

  return {
    providerKey: 'tmdb',
    providerImageId: image.file_path,
    movieIdentity: { providerKey: 'tmdb', tmdbId },
    type,
    originalUrl: `${TMDB_IMAGE_ORIGINAL_BASE}${image.file_path}`,
    previewUrl: `${type === 'poster' ? TMDB_POSTER_PREVIEW_BASE : TMDB_BACKDROP_PREVIEW_BASE}${image.file_path}`,
    width: image.width ?? null,
    height: image.height ?? null,
    language: image.iso_639_1 ?? null,
    rank: index - voteAverage * 1000 - voteCount,
    attribution: 'TMDB',
  };
}

function normalizeImages(input: TmdbMoviePackage): NormalizedImageCandidate[] {
  const posters = input.images.posters.map((image, index) => normalizeImage(input.id, 'poster', image, index));
  const backdrops = input.images.backdrops.map((image, index) => normalizeImage(input.id, 'backdrop', image, index));

  return [...posters, ...backdrops].sort((a, b) => a.rank - b.rank);
}

function eligibleTrailer(value: unknown): value is EligibleTmdbTrailer {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const video = value as TmdbVideo;

  return video.official === true
    && video.iso_639_1 === 'en'
    && video.site === 'YouTube'
    && video.type === 'Trailer'
    && typeof video.id === 'string' && video.id.trim().length > 0
    && typeof video.key === 'string' && YOUTUBE_KEY.test(video.key)
    && typeof video.name === 'string' && video.name.trim().length > 0
    && typeof video.size === 'number' && Number.isInteger(video.size) && video.size > 0;
}

function trailerPublishedAt(video: TmdbVideo): string | null {
  if (typeof video.published_at !== 'string' || Number.isNaN(Date.parse(video.published_at))) {
    return null;
  }

  return video.published_at;
}

function trailerPublishedAtRank(video: TmdbVideo): number | null {
  const publishedAt = trailerPublishedAt(video);

  return publishedAt === null ? null : Date.parse(publishedAt);
}

function compareEligibleTrailers(left: EligibleTmdbTrailer, right: EligibleTmdbTrailer): number {
  if (left.size !== right.size) {
    return right.size - left.size;
  }

  const leftPublishedAt = trailerPublishedAtRank(left);
  const rightPublishedAt = trailerPublishedAtRank(right);

  if (leftPublishedAt === null && rightPublishedAt !== null) {
    return 1;
  }

  if (leftPublishedAt !== null && rightPublishedAt === null) {
    return -1;
  }

  if (leftPublishedAt !== null && rightPublishedAt !== null && leftPublishedAt !== rightPublishedAt) {
    return rightPublishedAt - leftPublishedAt;
  }

  return left.id.localeCompare(right.id);
}

function normalizeTrailer(input: TmdbMoviePackage): NormalizedTrailerCandidate | null {
  if (!Array.isArray(input.videos?.results)) {
    return null;
  }

  const [winner] = input.videos.results.filter(eligibleTrailer).sort(compareEligibleTrailers);

  if (!winner) {
    return null;
  }

  return {
    providerKey: 'tmdb',
    providerVideoId: winner.id,
    movieIdentity: { providerKey: 'tmdb', tmdbId: input.id },
    externalProvider: 'youtube',
    externalProviderId: winner.key,
    title: winner.name,
    watchUrl: `https://www.youtube.com/watch?v=${winner.key}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${winner.key}/hqdefault.jpg`,
    width: Math.round(winner.size * 16 / 9),
    height: winner.size,
    language: 'en',
    country: typeof winner.iso_3166_1 === 'string' && winner.iso_3166_1.trim().length > 0 ? winner.iso_3166_1 : null,
    resolution: winner.size,
    publishedAt: trailerPublishedAt(winner),
    official: true,
    attribution: 'TMDB',
  };
}

export function normalizeTmdbMovie(input: TmdbMoviePackage, actorLimit: number): NormalizedMovie {
  const people = normalizePeople(input, actorLimit);

  return {
    tmdbId: input.id,
    title: input.title,
    primaryReleaseDate: input.release_date ?? null,
    yearReleased: releaseYear(input.release_date),
    mpaaRating: selectUsCertification(input.release_dates),
    runtime: input.runtime ?? null,
    tagline: input.tagline || null,
    description: input.overview || null,
    directors: people.directors,
    actors: people.actors,
    images: normalizeImages(input),
    trailer: normalizeTrailer(input),
  };
}
