import { Button } from 'datocms-react-ui';

type FieldAddonProps = {
  tmdbId: number | string | null;
  onOpen: (mode: 'find' | 'refresh') => void;
  configurationIssues?: string[];
};

export function FieldAddon({ tmdbId, onOpen, configurationIssues = [] }: FieldAddonProps) {
  const hasTmdbId =
    tmdbId !== null && (typeof tmdbId !== 'string' || tmdbId.trim() !== '');
  const mode = hasTmdbId ? 'refresh' : 'find';

  return (
    <div className="movie-import-field-addon">
      <Button type="button" buttonSize="s" onClick={() => onOpen(mode)} disabled={configurationIssues.length > 0}>
        {hasTmdbId ? 'Refresh from TMDB' : 'Find movie'}
      </Button>
      {configurationIssues.length > 0 ? <p role="alert" className="movie-import-field-addon__alert">Finish plugin configuration before using TMDB import: {configurationIssues.join(' ')}</p> : null}
    </div>
  );
}
