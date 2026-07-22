import type { TmdbMoviePackage, TmdbSearchQuery, TmdbSearchResult } from './tmdbTypes';

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly code: 'auth' | 'rate_limit' | 'network' | 'not_found' | 'unknown',
  ) {
    super(message);
  }
}

type TmdbClientOptions = {
  readToken: string;
  fetchImpl?: typeof fetch;
};

export class TmdbClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: TmdbClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchMovies(query: TmdbSearchQuery): Promise<TmdbSearchResult[]> {
    const params = new URLSearchParams({
      query: query.title,
      include_adult: 'false',
      language: 'en-US',
    });

    if (query.year) {
      params.set('year', String(query.year));
    }

    const json = await this.getJson<{ results: Array<{ id: number; title: string; release_date?: string; overview?: string; poster_path?: string | null }> }>(
      `/search/movie?${params}`,
    );

    return json.results.map((movie) => ({
      id: movie.id,
      title: movie.title,
      releaseDate: movie.release_date ?? null,
      overview: movie.overview ?? null,
      posterPath: movie.poster_path ?? null,
    }));
  }

  async getMoviePackage(tmdbId: number): Promise<TmdbMoviePackage> {
    return this.getJson<TmdbMoviePackage>(`/movie/${tmdbId}?language=en-US&append_to_response=credits,release_dates,images&include_image_language=en,null`);
  }

  private async getJson<T>(path: string): Promise<T> {
    let response: Response;

    try {
      response = await this.fetchImpl(`https://api.themoviedb.org/3${path}`, {
        headers: {
          Authorization: `Bearer ${this.options.readToken}`,
          Accept: 'application/json',
        },
      });
    } catch {
      throw new TmdbError('TMDB network request failed.', 'network');
    }

    if (response.status === 401 || response.status === 403) {
      throw new TmdbError('TMDB read token is invalid or not allowed.', 'auth');
    }

    if (response.status === 404) {
      throw new TmdbError('TMDB movie was not found.', 'not_found');
    }

    if (response.status === 429) {
      throw new TmdbError('TMDB rate limit reached. Try again shortly.', 'rate_limit');
    }

    if (!response.ok) {
      throw new TmdbError('TMDB request failed.', 'unknown');
    }

    try {
      return await response.json() as T;
    } catch {
      throw new TmdbError('TMDB response could not be parsed.', 'unknown');
    }
  }
}
