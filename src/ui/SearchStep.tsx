import type { TmdbSearchResult } from '../providers/tmdbTypes';

type SearchStepProps = {
  title: string;
  year: number | null;
  results: TmdbSearchResult[];
  onTitleChange: (title: string) => void;
  onYearChange: (year: number | null) => void;
  onSearch: () => void;
  onSelect: (id: number) => void;
  tmdbId: string;
  onTmdbIdChange: (id: string) => void;
  onLoadTmdbId: () => void;
};

export function SearchStep({ title, year, results, onTitleChange, onYearChange, onSearch, onSelect, tmdbId, onTmdbIdChange, onLoadTmdbId }: SearchStepProps) {
  return (
    <section>
      <ol aria-label="Import steps">
        <li>Find movie</li>
        <li>Review changes</li>
        <li>Confirm import</li>
      </ol>
      <h2>Find movie</h2>
      <p>Find the TMDB record that matches this DatoCMS movie.</p>

      <fieldset aria-label="Search by title and year">
        <label>
          Title
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>
        <label>
          Year
          <input type="number" value={year ?? ''} onChange={(event) => onYearChange(event.target.value ? Number(event.target.value) : null)} />
        </label>
        <button type="button" onClick={onSearch}>
          Search
        </button>
      </fieldset>

      <fieldset aria-label="Lookup by TMDB ID">
        <label>
          TMDB ID
          <input value={tmdbId} inputMode="numeric" onChange={(event) => onTmdbIdChange(event.target.value)} />
        </label>
        <button type="button" onClick={onLoadTmdbId}>
          Load TMDB ID
        </button>
      </fieldset>

      {results.map((result) => (
        <article key={result.id}>
          {result.posterUrl ? <img src={result.posterUrl} alt={`${result.title} poster`} /> : null}
          <h3>{result.title}</h3>
          {result.releaseDate ? <p>{result.releaseDate.slice(0, 4)}</p> : null}
          {result.overview ? <p>{result.overview}</p> : null}
          <p>TMDB ID {result.id}</p>
          <button type="button" onClick={() => onSelect(result.id)}>
            Use {result.title}
          </button>
        </article>
      ))}
    </section>
  );
}
