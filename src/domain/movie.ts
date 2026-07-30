export type MovieFieldKey =
  | 'title'
  | 'yearReleased'
  | 'mpaaRating'
  | 'runtime'
  | 'tmdbId'
  | 'tagline'
  | 'description'
  | 'poster'
  | 'heroImage'
  | 'backdrops'
  | 'directors'
  | 'actors';

export type PersonCandidate = {
  tmdbId: number;
  name: string;
  order: number;
  role: 'director' | 'actor';
};

export type NormalizedImageCandidate = {
  providerKey: string;
  providerImageId: string;
  movieIdentity: { providerKey: 'tmdb'; tmdbId: number };
  type: 'poster' | 'backdrop';
  originalUrl: string;
  previewUrl?: string;
  analysisUrl?: string;
  width: number | null;
  height: number | null;
  language: string | null;
  rank: number;
  attribution: string | null;
};

export type NormalizedMovie = {
  tmdbId: number;
  title: string;
  primaryReleaseDate: string | null;
  yearReleased: number | null;
  mpaaRating: string | null;
  runtime: number | null;
  tagline: string | null;
  description: string | null;
  directors: PersonCandidate[];
  actors: PersonCandidate[];
  images: NormalizedImageCandidate[];
};

export type ValidationIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warning';
};
