import { Button, FieldGroup, Section, TextField } from 'datocms-react-ui';
import type { TmdbSearchResult } from '../providers/tmdbTypes';
import { ModalStepIndicator } from './ModalStepIndicator';

type SearchStepProps = {
  title: string;
  year: number | null;
  results: TmdbSearchResult[];
  hasSearched: boolean;
  onTitleChange: (title: string) => void;
  onYearChange: (year: number | null) => void;
  onSearch: () => void;
  onSelect: (id: number) => void;
  tmdbId: string;
  onTmdbIdChange: (id: string) => void;
  onLoadTmdbId: () => void;
  isSearching?: boolean;
  isLoadingMovie?: boolean;
};

export function SearchStep({ title, year, results, hasSearched, onTitleChange, onYearChange, onSearch, onSelect, tmdbId, onTmdbIdChange, onLoadTmdbId, isSearching = false, isLoadingMovie = false }: SearchStepProps) {
  const isBusy = isSearching || isLoadingMovie;

  return (
    <section className="movie-import-modal__step-frame">
      <div className="movie-import-modal__chrome-header">
        <ModalStepIndicator activeStep="find" />
        <header className="movie-import-modal__header">
          <p className="movie-import-modal__eyebrow">TMDB movie importer</p>
          <h2 className="movie-import-modal__title">Find movie</h2>
          <p className="movie-import-modal__intro">Search TMDB and choose the record that matches this DatoCMS movie.</p>
        </header>
      </div>

      <div className="movie-import-modal__scroll-body">
        <div className="movie-import-modal__search-stack">
          <Section title="Search by title and year">
            <div role="group" aria-label="Search by title and year">
              <FieldGroup>
                <TextField id="movie-title" name="movie-title" label="Title" value={title} onChange={onTitleChange} textInputProps={{ disabled: isBusy }} />
                <TextField id="movie-year" name="movie-year" label="Year" value={year === null ? '' : String(year)} onChange={(value) => onYearChange(value ? Number(value) : null)} textInputProps={{ type: 'number', inputMode: 'numeric', min: 0, step: 1, disabled: isBusy }} />
              </FieldGroup>
              <div className="movie-import-modal__actions">
                <Button buttonType="primary" type="button" onClick={onSearch} disabled={isBusy}>
                  {isSearching ? 'Searching TMDB' : 'Search'}
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Lookup by TMDB ID">
            <div role="group" aria-label="Lookup by TMDB ID">
              <FieldGroup>
                <TextField id="tmdb-id" name="tmdb-id" label="TMDB ID" value={tmdbId} onChange={onTmdbIdChange} textInputProps={{ inputMode: 'numeric', disabled: isBusy }} />
              </FieldGroup>
              <div className="movie-import-modal__actions">
                <Button type="button" onClick={onLoadTmdbId} disabled={isBusy}>
                  {isLoadingMovie ? 'Loading movie' : 'Load movie by ID'}
                </Button>
              </div>
            </div>
          </Section>
        </div>

        <div className="movie-import-modal__cards" aria-busy={isBusy}>
          {results.map((result) => (
            <article key={result.id} className="movie-import-modal__card">
              {result.posterUrl
                ? <img className="movie-import-modal__card-media" src={result.posterUrl} alt={`${result.title} poster`} loading="lazy" width={64} height={96} />
                : <div className="movie-import-modal__card-media movie-import-modal__card-placeholder">No poster</div>}
              <div>
                <h3 className="movie-import-modal__card-title">{result.title}</h3>
                {result.releaseDate ? <p className="movie-import-modal__meta">{result.releaseDate.slice(0, 4)}</p> : null}
                {result.overview ? <p className="movie-import-modal__body">{result.overview}</p> : null}
                <p className="movie-import-modal__meta">TMDB ID {result.id}</p>
              </div>
              <div className="movie-import-modal__card-action">
                <Button buttonSize="s" type="button" onClick={() => onSelect(result.id)} disabled={isBusy} aria-label={`Use ${result.title}`}>
                  Use this
                </Button>
              </div>
            </article>
          ))}
          {hasSearched && results.length === 0 && !isBusy ? (
            <p role="status" className="movie-import-modal__empty movie-import-modal__empty--results">
              No TMDB matches found. Try a different title, remove the year, or load a known TMDB ID.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
