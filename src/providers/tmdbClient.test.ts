import { TmdbClient } from './tmdbClient';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('TmdbClient', () => {
  it('constructs search requests with fixed locale parameters and a bearer token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200, {
      results: [{ id: 1, title: 'The Matrix', release_date: '1999-03-30', overview: 'A', poster_path: '/poster.jpg' }],
    }));
    const client = new TmdbClient({ readToken: 'test-read-token', fetchImpl });

    await expect(client.searchMovies({ title: 'The Matrix & More', year: 1999 })).resolves.toEqual([
      { id: 1, title: 'The Matrix', releaseDate: '1999-03-30', overview: 'A', posterPath: '/poster.jpg', posterUrl: 'https://image.tmdb.org/t/p/w154/poster.jpg' },
    ]);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/search/movie?query=The+Matrix+%26+More&include_adult=false&language=en-US&year=1999',
      { headers: { Authorization: 'Bearer test-read-token', Accept: 'application/json' } },
    );
  });

  it('constructs movie package requests with fixed locale and image parameters', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200, { id: 27205 }));
    const client = new TmdbClient({ readToken: 'test-read-token', fetchImpl });

    await client.getMoviePackage(27205);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/movie/27205?language=en-US&append_to_response=credits,release_dates,images&include_image_language=en,null',
      { headers: { Authorization: 'Bearer test-read-token', Accept: 'application/json' } },
    );
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [404, 'not_found'],
    [429, 'rate_limit'],
  ] as const)('maps status %i to %s errors', async (status, code) => {
    const client = new TmdbClient({ readToken: 'test-read-token', fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response(status, {})) });

    await expect(client.searchMovies({ title: 'The Matrix' })).rejects.toMatchObject({ code });
  });

  it('maps network failures to token-safe errors', async () => {
    const client = new TmdbClient({ readToken: 'test-read-token', fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error('connection reset')) });

    await expect(client.searchMovies({ title: 'The Matrix' })).rejects.toMatchObject({ code: 'network' });
  });

  it('maps malformed JSON to a token-safe unknown error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockRejectedValue(new Error('Unexpected token')) } as unknown as Response);
    const client = new TmdbClient({ readToken: 'test-read-token', fetchImpl });

    await expect(client.searchMovies({ title: 'The Matrix' })).rejects.toMatchObject({ code: 'unknown' });
  });
});
