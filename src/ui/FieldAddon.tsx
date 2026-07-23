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
    <>
      <Button type="button" buttonSize="s" onClick={() => onOpen(mode)} disabled={configurationIssues.length > 0}>
        {hasTmdbId ? 'Refresh from TMDB' : 'Find movie'}
      </Button>
      {configurationIssues.length > 0 ? <p role="alert">Configure the importer before using it: {configurationIssues.join(' ')}</p> : null}
    </>
  );
}
