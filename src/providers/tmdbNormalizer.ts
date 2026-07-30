import type { NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import type { TmdbImage, TmdbMoviePackage, TmdbReleaseDatesResponse } from './tmdbTypes';

const TMDB_IMAGE_ORIGINAL_BASE = 'https://image.tmdb.org/t/p/original';
const TMDB_POSTER_PREVIEW_BASE = 'https://image.tmdb.org/t/p/w342';
const TMDB_BACKDROP_PREVIEW_BASE = 'https://image.tmdb.org/t/p/w780';
const TMDB_IMAGE_ANALYSIS_BASE = 'https://image.tmdb.org/t/p/w300';
const THEATRICAL_RELEASE_TYPES = new Set([2, 3]);

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
    analysisUrl: `${TMDB_IMAGE_ANALYSIS_BASE}${image.file_path}`,
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
  };
}
