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
      <h2>Search</h2>
      <label>
        Title
        <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
      </label>
      <label>
        Year
        <input value={year ?? ''} onChange={(event) => onYearChange(event.target.value ? Number(event.target.value) : null)} />
      </label>
      <button type="button" onClick={onSearch}>
        Search
      </button>
      <label>
        TMDB ID
        <input value={tmdbId} inputMode="numeric" onChange={(event) => onTmdbIdChange(event.target.value)} />
      </label>
      <button type="button" onClick={onLoadTmdbId}>
        Load TMDB ID
      </button>
      {results.map((result) => (
        <button key={result.id} type="button" onClick={() => onSelect(result.id)}>
          {result.title} {result.releaseDate ? `(${result.releaseDate.slice(0, 4)})` : ''}
        </button>
      ))}
    </section>
  );
}
