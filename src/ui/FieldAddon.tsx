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
      <button type="button" onClick={() => onOpen(mode)} disabled={configurationIssues.length > 0}>
        {hasTmdbId ? 'Refresh from TMDB' : 'Find movie'}
      </button>
      {configurationIssues.length > 0 ? <p role="alert">Configure the importer before using it: {configurationIssues.join(' ')}</p> : null}
    </>
  );
}
