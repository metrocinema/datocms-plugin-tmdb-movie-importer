import { Button, FieldGroup, TextField } from 'datocms-react-ui';
import type { TmdbSearchResult } from '../providers/tmdbTypes';
import { ModalStepIndicator } from './ModalStepIndicator';

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
      <ModalStepIndicator activeStep="find" />
      <header className="movie-import-modal__header">
        <p className="movie-import-modal__eyebrow">TMDB movie importer</p>
        <h2 className="movie-import-modal__title">Find movie</h2>
        <p className="movie-import-modal__intro">Find the TMDB record that matches this DatoCMS movie.</p>
      </header>

      <fieldset aria-label="Search by title and year" className="movie-import-modal__fieldset">
        <legend className="movie-import-modal__legend">Search by title and year</legend>
        <FieldGroup>
          <TextField id="movie-title" name="movie-title" label="Title" value={title} onChange={onTitleChange} />
          <TextField id="movie-year" name="movie-year" label="Year" value={year === null ? '' : String(year)} onChange={(value) => onYearChange(value ? Number(value) : null)} textInputProps={{ type: 'number' }} />
        </FieldGroup>
        <div className="movie-import-modal__actions">
          <Button buttonType="primary" type="button" onClick={onSearch}>
            Search
          </Button>
        </div>
      </fieldset>

      <fieldset aria-label="Lookup by TMDB ID" className="movie-import-modal__fieldset">
        <legend className="movie-import-modal__legend">Lookup by TMDB ID</legend>
        <FieldGroup>
          <TextField id="tmdb-id" name="tmdb-id" label="TMDB ID" value={tmdbId} onChange={onTmdbIdChange} textInputProps={{ inputMode: 'numeric' }} />
        </FieldGroup>
        <div className="movie-import-modal__actions">
          <Button type="button" onClick={onLoadTmdbId}>
            Load TMDB ID
          </Button>
        </div>
      </fieldset>

      <div className="movie-import-modal__cards">
        {results.map((result) => (
          <article key={result.id} className="movie-import-modal__card">
            {result.posterUrl
              ? <img className="movie-import-modal__card-media" src={result.posterUrl} alt={`${result.title} poster`} />
              : <div className="movie-import-modal__card-media movie-import-modal__card-placeholder">No poster</div>}
            <div>
              <h3 className="movie-import-modal__card-title">{result.title}</h3>
              {result.releaseDate ? <p className="movie-import-modal__meta">{result.releaseDate.slice(0, 4)}</p> : null}
              {result.overview ? <p className="movie-import-modal__body">{result.overview}</p> : null}
              <p className="movie-import-modal__meta">TMDB ID {result.id}</p>
            </div>
            <div className="movie-import-modal__actions">
              <Button buttonType="primary" type="button" onClick={() => onSelect(result.id)}>
                Use {result.title}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
