export type TmdbSearchQuery = {
  title: string;
  year?: number | null;
};

export type TmdbSearchResult = {
  id: number;
  title: string;
  releaseDate: string | null;
  overview: string | null;
  posterPath: string | null;
};

export type TmdbReleaseDate = {
  certification: string;
  type: number;
};

export type TmdbReleaseDatesResponse = {
  results: Array<{
    iso_3166_1: string;
    release_dates: TmdbReleaseDate[];
  }>;
};

export type TmdbCreditPerson = {
  id: number;
  name: string;
  order?: number;
  job?: string;
};

export type TmdbImage = {
  file_path: string;
  width?: number;
  height?: number;
  iso_639_1?: string | null;
  vote_average?: number;
  vote_count?: number;
};

export type TmdbMoviePackage = {
  id: number;
  title: string;
  release_date?: string | null;
  runtime?: number | null;
  tagline?: string | null;
  overview?: string | null;
  credits: {
    cast: TmdbCreditPerson[];
    crew: TmdbCreditPerson[];
  };
  release_dates: TmdbReleaseDatesResponse;
  images: {
    posters: TmdbImage[];
    backdrops: TmdbImage[];
  };
};
